import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScrapedProperty {
  id: string;
  title: string;
  price: number;
  url: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  area?: number;
  imageUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl não está configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { profileUrl } = await req.json();

    if (!profileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "URL do perfil é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate it's an OLX URL
    if (!profileUrl.includes("olx.com.br")) {
      return new Response(
        JSON.stringify({ success: false, error: "URL deve ser do OLX" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting OLX scrape for:", profileUrl);

    // Step 1: Use Map API to discover all URLs from the profile
    console.log("Mapping profile page to find all listings...");
    
    const mapResponse = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: profileUrl,
        limit: 200,
        includeSubdomains: true,
      }),
    });

    const mapData = await mapResponse.json();
    let mappedLinks: string[] = [];
    
    if (mapResponse.ok && mapData.links) {
      mappedLinks = mapData.links;
      console.log("Map API found links:", mappedLinks.length);
    } else {
      console.log("Map API failed or returned no links, falling back to scrape");
    }

    // Step 2: Also scrape the profile page directly for more links
    console.log("Scraping profile page for additional listings...");
    
    const scrapeProfileResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: profileUrl,
        formats: ["links", "html"],
        onlyMainContent: false,
        waitFor: 8000, // Wait 8 seconds for JavaScript to fully load
      }),
    });

    const scrapeProfileData = await scrapeProfileResponse.json();

    if (!scrapeProfileResponse.ok) {
      console.error("Firecrawl scrape profile error:", scrapeProfileData);
      
      // If we have mapped links, continue with those
      if (mappedLinks.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao acessar página: " + (scrapeProfileData.error || "Erro desconhecido") }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get links from scrape response
    const scrapeLinks = scrapeProfileData.data?.links || scrapeProfileData.links || [];
    const html = scrapeProfileData.data?.html || scrapeProfileData.html || "";
    
    console.log("Scrape API found links:", scrapeLinks.length);

    // Also extract links from HTML using regex (OLX links often follow pattern)
    const htmlLinkMatches = html.matchAll(/href="(https:\/\/[^"]*olx\.com\.br\/[^"]*\d{8,}[^"]*)"/g);
    const htmlLinks: string[] = [];
    for (const match of htmlLinkMatches) {
      htmlLinks.push(match[1]);
    }
    console.log("Found HTML links with IDs:", htmlLinks.length);
    
    // Combine all links from different sources
    const combinedLinks = [...new Set([...mappedLinks, ...scrapeLinks, ...htmlLinks])];
    console.log("Combined unique links:", combinedLinks.length);

    // Filter property listing URLs - OLX uses various patterns
    // Main pattern is: URLs containing a long numeric ID (8+ digits)
    const propertyUrls = combinedLinks
      .filter((url: string) => {
        // Must be OLX URL
        if (!url.includes("olx.com.br")) return false;
        // Exclude profile pages
        if (url.includes("/perfil/")) return false;
        // Exclude generic pages
        if (url.includes("/suporte") || url.includes("/ajuda") || url.includes("/termos")) return false;
        if (url.includes("#")) return false; // Skip anchor links
        if (url.includes("conta.olx") || url.includes("chat.olx")) return false;
        if (url.includes("/busca") || url.includes("/search")) return false;
        
        // Include if it matches listing patterns - must have 8+ digit ID
        const hasListingId = /\d{8,}/.test(url);
        
        return hasListingId;
      })
      .slice(0, 60); // Increase limit to 60 properties

    console.log("Property URLs to scrape:", propertyUrls.length);
    if (propertyUrls.length > 0) {
      console.log("Sample URLs:", propertyUrls.slice(0, 3));
    }

    if (propertyUrls.length === 0) {
      console.log("All links sample:", combinedLinks.slice(0, 10));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: 0, 
          message: "Nenhum anúncio encontrado. O OLX pode estar usando proteção anti-bot ou a página não contém anúncios.",
          debug: {
            totalLinks: combinedLinks.length,
            sampleLinks: combinedLinks.slice(0, 5),
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapedProperties: ScrapedProperty[] = [];

    // Step 3: Scrape each property page (in batches to avoid rate limiting)
    const batchSize = 5;
    for (let i = 0; i < propertyUrls.length; i += batchSize) {
      const batch = propertyUrls.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (propUrl: string) => {
        try {
          console.log("Scraping property:", propUrl);

          const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: propUrl,
              formats: ["markdown", "html"],
              onlyMainContent: true,
            }),
          });

          const scrapeData = await scrapeResponse.json();

          if (!scrapeResponse.ok) {
            console.error("Error scraping property:", propUrl, scrapeData);
            return null;
          }

          const content = scrapeData.data?.markdown || scrapeData.markdown || "";
          const propHtml = scrapeData.data?.html || scrapeData.html || "";
          const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

          // Extract property ID from URL
          const idMatch = propUrl.match(/(\d+)(?:\?|$)/);
          const propertyId = idMatch ? idMatch[1] : propUrl.split("/").pop()?.split("-").pop()?.replace(/\D/g, "") || Date.now().toString();

          // Parse property data from content
          return parseOLXProperty(content, propHtml, metadata, propUrl, propertyId);
        } catch (err) {
          console.error("Error processing property:", propUrl, err);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (result) {
          scrapedProperties.push(result);
        }
      }
    }

    console.log("Scraped properties:", scrapedProperties.length);

    // Step 4: Insert properties into database
    let syncedCount = 0;

    for (const prop of scrapedProperties) {
      const propertyData = {
        origin: "olx" as const,
        origin_id: prop.id,
        title: prop.title,
        price: prop.price,
        type: detectPropertyType(prop.title),
        neighborhood: prop.neighborhood || "Centro",
        city: prop.city || "Rio de Janeiro",
        state: prop.state || "RJ",
        bedrooms: prop.bedrooms || 0,
        bathrooms: prop.bathrooms || 0,
        parking: prop.parking || 0,
        area: prop.area || null,
        url_original: prop.url,
        purpose: detectPurpose(prop.title, prop.price) as "rent" | "sale",
        status: "active" as const,
      };

      // Check if property already exists
      const { data: existing } = await supabase
        .from("properties")
        .select("id")
        .eq("origin", "olx")
        .eq("origin_id", prop.id)
        .maybeSingle();

      let propertyId: string | null = null;

      if (existing) {
        // Update existing property
        const { data: updated, error: updateError } = await supabase
          .from("properties")
          .update({
            title: propertyData.title,
            price: propertyData.price,
            type: propertyData.type,
            neighborhood: propertyData.neighborhood,
            city: propertyData.city,
            state: propertyData.state,
            bedrooms: propertyData.bedrooms,
            bathrooms: propertyData.bathrooms,
            parking: propertyData.parking,
            area: propertyData.area,
          })
          .eq("id", existing.id)
          .select("id")
          .single();

        if (updateError) {
          console.error("Error updating property:", updateError);
          continue;
        }
        propertyId = updated?.id || null;
      } else {
        // Insert new property
        const { data: inserted, error: insertError } = await supabase
          .from("properties")
          .insert(propertyData)
          .select("id")
          .single();

        if (insertError) {
          console.error("Error inserting property:", insertError);
          continue;
        }
        propertyId = inserted?.id || null;
      }

      // Add photo if available
      if (prop.imageUrl && propertyId) {
        // Check if photo already exists
        const { data: existingPhoto } = await supabase
          .from("property_photos")
          .select("id")
          .eq("property_id", propertyId)
          .eq("url", prop.imageUrl)
          .maybeSingle();

        if (!existingPhoto) {
          await supabase
            .from("property_photos")
            .insert({
              property_id: propertyId,
              url: prop.imageUrl,
              sort_order: 0,
            });
        }
      }

      syncedCount++;
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "olx_scrape",
      entity_type: "property",
      metadata: {
        profile_url: profileUrl,
        found: propertyUrls.length,
        scraped: scrapedProperties.length,
        synced: syncedCount,
        timestamp: new Date().toISOString(),
      },
    });

    // Update last sync timestamp in settings
    const { data: existingSettings } = await supabase
      .from("integrations_settings")
      .select("value")
      .eq("key", "olx_auto_sync")
      .maybeSingle();

    if (existingSettings?.value) {
      const currentValue = existingSettings.value as { enabled: boolean; profile_url: string | null; last_sync_at: string | null };
      await supabase
        .from("integrations_settings")
        .update({
          value: {
            ...currentValue,
            last_sync_at: new Date().toISOString(),
          },
        })
        .eq("key", "olx_auto_sync");
    }

    console.log(`Synced ${syncedCount} properties from OLX`);

    return new Response(
      JSON.stringify({
        success: true,
        found: propertyUrls.length,
        scraped: scrapedProperties.length,
        synced: syncedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Scrape error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseOLXProperty(content: string, html: string, metadata: any, url: string, id: string): ScrapedProperty | null {
  try {
    // Get title from metadata or content
    const title = metadata.title?.replace(" | OLX", "").trim() || 
                  content.match(/^#\s+(.+)/m)?.[1] ||
                  "Imóvel OLX";

    // Extract price - look for R$ patterns
    const priceMatch = content.match(/R\$\s*([\d.,]+)/);
    let price = 0;
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
    }

    // Extract location info from title or content
    // Pattern: "... - Neighborhood, City - State" or "... - Neighborhood, City"
    const titleLocationMatch = title.match(/[-–]\s*([^,-]+),\s*([^-–]+?)(?:\s*[-–]\s*([A-Z]{2}))?$/);
    let neighborhood = "", city = "", state = "RJ";
    
    if (titleLocationMatch) {
      neighborhood = titleLocationMatch[1]?.trim() || "";
      city = titleLocationMatch[2]?.trim() || "";
      state = titleLocationMatch[3]?.trim() || "RJ";
    } else {
      // Try from content
      const contentLocationMatch = content.match(/(?:Localização|Local|Endereço|Bairro)[:\s]*([^,\n]+),?\s*([^,\n]*)/i);
      if (contentLocationMatch) {
        neighborhood = contentLocationMatch[1]?.trim() || "";
        city = contentLocationMatch[2]?.trim() || "Rio de Janeiro";
      }
    }

    // Extract bedrooms
    const bedroomMatch = content.match(/(\d+)\s*(?:quarto|quartos|dormitório|dormitórios|dorm)/i) ||
                         title.match(/(\d+)\s*(?:quarto|quartos|dorm)/i);
    const bedrooms = bedroomMatch ? parseInt(bedroomMatch[1]) : 0;

    // Extract bathrooms
    const bathroomMatch = content.match(/(\d+)\s*(?:banheiro|banheiros|wc)/i);
    const bathrooms = bathroomMatch ? parseInt(bathroomMatch[1]) : 0;

    // Extract parking
    const parkingMatch = content.match(/(\d+)\s*(?:vaga|vagas|garagem)/i);
    const parking = parkingMatch ? parseInt(parkingMatch[1]) : 0;

    // Extract area
    const areaMatch = content.match(/(\d+)\s*m²/) || title.match(/(\d+)\s*m²/);
    const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

    // Try to get first image from metadata or HTML
    let imageUrl = metadata.ogImage || metadata.image;
    
    // If no image in metadata, try to extract from HTML
    if (!imageUrl && html) {
      const imgMatch = html.match(/<img[^>]+src="(https:\/\/[^"]*(?:olximg|img)[^"]*)"/);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }

    return {
      id,
      title,
      price,
      url,
      neighborhood,
      city: city || "Rio de Janeiro",
      state: state || "RJ",
      bedrooms,
      bathrooms,
      parking,
      area,
      imageUrl,
    };
  } catch (err) {
    console.error("Error parsing property:", err);
    return null;
  }
}

function detectPropertyType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("apartamento") || lower.includes("apto")) return "apartamento";
  if (lower.includes("casa")) return "casa";
  if (lower.includes("kitnet") || lower.includes("studio") || lower.includes("loft")) return "kitnet";
  if (lower.includes("comercial") || lower.includes("loja") || lower.includes("sala") || lower.includes("lojão")) return "comercial";
  if (lower.includes("terreno") || lower.includes("lote")) return "terreno";
  if (lower.includes("cobertura")) return "cobertura";
  if (lower.includes("galpão") || lower.includes("galpao")) return "galpão";
  return "apartamento";
}

function detectPurpose(title: string, price: number): string {
  const lower = title.toLowerCase();
  if (lower.includes("venda") || lower.includes("vende") || lower.includes("vendo")) return "sale";
  if (lower.includes("alug") || lower.includes("locação") || lower.includes("locacao")) return "rent";
  // If price is high (> 100k), likely a sale
  if (price > 100000) return "sale";
  return "rent";
}
