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

    // Extract profile ID from URL for pagination
    const profileIdMatch = profileUrl.match(/perfil\/([^?\/]+)/);
    const profileId = profileIdMatch ? profileIdMatch[1] : null;
    console.log("Profile ID:", profileId);

    // Scrape multiple pages of the profile (OLX paginates results)
    const allPropertyUrls: Set<string> = new Set();
    const pagesToScrape = 5; // Scrape up to 5 pages (10 items each = 50 items)

    for (let page = 1; page <= pagesToScrape; page++) {
      // Build paginated URL
      let pageUrl = profileUrl;
      if (page > 1) {
        // OLX uses ?o=2, ?o=3, etc. for pagination
        const separator = profileUrl.includes("?") ? "&" : "?";
        pageUrl = `${profileUrl.split("?")[0]}?o=${page}`;
      }

      console.log(`Scraping page ${page}: ${pageUrl}`);

      const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: pageUrl,
          formats: ["links", "html"],
          onlyMainContent: false,
          waitFor: 5000,
        }),
      });

      const scrapeData = await scrapeResponse.json();

      if (!scrapeResponse.ok) {
        console.error(`Error scraping page ${page}:`, scrapeData);
        continue;
      }

      const links = scrapeData.data?.links || scrapeData.links || [];
      const html = scrapeData.data?.html || scrapeData.html || "";

      // Extract links from API response
      for (const link of links) {
        if (isPropertyUrl(link)) {
          allPropertyUrls.add(cleanUrl(link));
        }
      }

      // Extract links from HTML (more reliable)
      const htmlMatches = html.matchAll(/href="(https:\/\/[^"]*olx\.com\.br\/[^"]*\d{8,}[^"]*)"/g);
      for (const match of htmlMatches) {
        if (isPropertyUrl(match[1])) {
          allPropertyUrls.add(cleanUrl(match[1]));
        }
      }

      console.log(`Page ${page} found ${allPropertyUrls.size} unique properties so far`);

      // If we got no new links on this page, stop pagination
      const prevSize = allPropertyUrls.size;
      if (page > 1 && links.length < 5) {
        console.log("No more pages to scrape");
        break;
      }
    }

    console.log("Total unique property URLs found:", allPropertyUrls.size);

    const propertyUrls = Array.from(allPropertyUrls).slice(0, 60);
    console.log("Property URLs to scrape:", propertyUrls.length);

    if (propertyUrls.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: 0, 
          message: "Nenhum anúncio encontrado.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapedProperties: ScrapedProperty[] = [];

    // Scrape each property page in batches
    const batchSize = 5;
    for (let i = 0; i < propertyUrls.length; i += batchSize) {
      const batch = propertyUrls.slice(i, i + batchSize);
      console.log(`Scraping batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(propertyUrls.length/batchSize)}`);
      
      const batchPromises = batch.map(async (propUrl: string) => {
        try {
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
            console.error("Error scraping:", propUrl);
            return null;
          }

          const content = scrapeData.data?.markdown || scrapeData.markdown || "";
          const propHtml = scrapeData.data?.html || scrapeData.html || "";
          const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

          // Extract property ID from URL (the numeric ID at the end)
          const idMatch = propUrl.match(/-(\d{8,})(?:\?|$)/);
          const propertyId = idMatch ? idMatch[1] : extractIdFromUrl(propUrl);

          return parseOLXProperty(content, propHtml, metadata, propUrl, propertyId);
        } catch (err) {
          console.error("Error processing:", propUrl, err);
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

    console.log("Successfully scraped:", scrapedProperties.length);

    // Insert/update properties in database (with deduplication by origin_id)
    let syncedCount = 0;
    let skippedCount = 0;

    for (const prop of scrapedProperties) {
      // Skip if missing essential data
      if (!prop.id || !prop.title || prop.price <= 0) {
        console.log("Skipping invalid property:", prop.id);
        skippedCount++;
        continue;
      }

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

      // Use upsert with origin + origin_id constraint to prevent duplicates
      const { data: existing } = await supabase
        .from("properties")
        .select("id")
        .eq("origin", "olx")
        .eq("origin_id", prop.id)
        .maybeSingle();

      let propertyId: string | null = null;

      if (existing) {
        // Update existing
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
            status: propertyData.status,
          })
          .eq("id", existing.id)
          .select("id")
          .single();

        if (!updateError && updated) {
          propertyId = updated.id;
        }
      } else {
        // Insert new
        const { data: inserted, error: insertError } = await supabase
          .from("properties")
          .insert(propertyData)
          .select("id")
          .single();

        if (!insertError && inserted) {
          propertyId = inserted.id;
        }
      }

      // Add photo if available and not already exists
      if (prop.imageUrl && propertyId) {
        const { data: existingPhoto } = await supabase
          .from("property_photos")
          .select("id")
          .eq("property_id", propertyId)
          .eq("url", prop.imageUrl)
          .maybeSingle();

        if (!existingPhoto) {
          await supabase.from("property_photos").insert({
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
        skipped: skippedCount,
        timestamp: new Date().toISOString(),
      },
    });

    // Update last sync timestamp
    const { data: existingSettings } = await supabase
      .from("integrations_settings")
      .select("value")
      .eq("key", "olx_auto_sync")
      .maybeSingle();

    if (existingSettings?.value) {
      const currentValue = existingSettings.value as Record<string, unknown>;
      await supabase
        .from("integrations_settings")
        .update({
          value: { ...currentValue, last_sync_at: new Date().toISOString() },
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

function isPropertyUrl(url: string): boolean {
  if (!url.includes("olx.com.br")) return false;
  if (url.includes("/perfil/")) return false;
  if (url.includes("/suporte") || url.includes("/ajuda") || url.includes("/termos")) return false;
  if (url.includes("#")) return false;
  if (url.includes("conta.olx") || url.includes("chat.olx")) return false;
  if (url.includes("/busca") || url.includes("/search")) return false;
  // Must have 8+ digit ID
  return /\d{8,}/.test(url);
}

function cleanUrl(url: string): string {
  // Remove query params like ?lis=xxx
  return url.split("?")[0];
}

function extractIdFromUrl(url: string): string {
  // Try various patterns to extract ID
  const patterns = [
    /-(\d{8,})$/,           // ID at end of path
    /-(\d{8,})\?/,          // ID before query
    /\/(\d{8,})(?:\?|$)/,   // Just ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  // Fallback: get all digits
  const allDigits = url.match(/\d{8,}/g);
  return allDigits?.[allDigits.length - 1] || Date.now().toString();
}

function parseOLXProperty(content: string, html: string, metadata: any, url: string, id: string): ScrapedProperty | null {
  try {
    // Get title
    let title = metadata.title?.replace(" | OLX", "").replace(/\s+/g, " ").trim() || 
                content.match(/^#\s+(.+)/m)?.[1] ||
                "Imóvel OLX";

    // Extract price
    const priceMatch = content.match(/R\$\s*([\d.,]+)/);
    let price = 0;
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
    }

    // Extract location from title pattern: "... - Neighborhood, City - RJ"
    let neighborhood = "", city = "Rio de Janeiro", state = "RJ";
    const titleLocationMatch = title.match(/[-–]\s*([^,]+),\s*([^-–]+?)(?:\s*[-–]\s*([A-Z]{2}))?(?:\s+\d+)?$/);
    if (titleLocationMatch) {
      neighborhood = titleLocationMatch[1]?.trim() || "";
      city = titleLocationMatch[2]?.trim() || "Rio de Janeiro";
      state = titleLocationMatch[3]?.trim() || "RJ";
    }

    // Extract bedrooms
    const bedroomMatch = content.match(/(\d+)\s*(?:quarto|quartos|dormitório|dormitórios|dorm)/i) ||
                         title.match(/(\d+)\s*(?:quarto|quartos|dorm)/i);
    const bedrooms = bedroomMatch ? parseInt(bedroomMatch[1]) : 0;

    // Extract bathrooms
    const bathroomMatch = content.match(/(\d+)\s*(?:banheiro|banheiros|wc)/i);
    const bathrooms = bathroomMatch ? parseInt(bathroomMatch[1]) : 0;

    // Extract parking
    const parkingMatch = content.match(/(\d+)\s*(?:vaga|vagas|garagem)/i) ||
                         title.match(/(?:c\/|com)\s*(?:vaga|garagem)/i);
    const parking = parkingMatch ? (typeof parkingMatch[1] === 'string' && /\d/.test(parkingMatch[1]) ? parseInt(parkingMatch[1]) : 1) : 0;

    // Extract area
    const areaMatch = content.match(/(\d+)\s*m²/) || title.match(/(\d+)\s*m²/) || title.match(/(\d+)m/);
    const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

    // Get image
    let imageUrl = metadata.ogImage || metadata.image;
    if (!imageUrl && html) {
      const imgMatch = html.match(/<img[^>]+src="(https:\/\/[^"]*(?:olxbr|olximg)[^"]*)"/);
      if (imgMatch) imageUrl = imgMatch[1];
    }

    return { id, title, price, url, neighborhood, city, state, bedrooms, bathrooms, parking, area, imageUrl };
  } catch (err) {
    console.error("Parse error:", err);
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
  if (price > 100000) return "sale";
  return "rent";
}
