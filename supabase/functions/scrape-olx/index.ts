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

    // Step 1: Map the profile page to get all listing URLs
    const mapResponse = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: profileUrl,
        limit: 100,
        includeSubdomains: false,
      }),
    });

    const mapData = await mapResponse.json();

    if (!mapResponse.ok) {
      console.error("Firecrawl map error:", mapData);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao mapear página: " + (mapData.error || "Erro desconhecido") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found links:", mapData.links?.length || 0);

    // Filter only property listing URLs (contain /d/)
    const propertyUrls = (mapData.links || [])
      .filter((url: string) => url.includes("/d/") && !url.includes("/perfil/"))
      .slice(0, 20); // Limit to 20 properties

    console.log("Property URLs to scrape:", propertyUrls.length);

    if (propertyUrls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: "Nenhum anúncio encontrado no perfil" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapedProperties: ScrapedProperty[] = [];

    // Step 2: Scrape each property page
    for (const propUrl of propertyUrls) {
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
          continue;
        }

        const content = scrapeData.data?.markdown || scrapeData.markdown || "";
        const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

        // Extract property ID from URL
        const idMatch = propUrl.match(/(\d+)(?:\?|$)/);
        const propertyId = idMatch ? idMatch[1] : propUrl.split("/").pop()?.split("-").pop()?.replace(/\D/g, "") || Date.now().toString();

        // Parse property data from content
        const property = parseOLXProperty(content, metadata, propUrl, propertyId);
        if (property) {
          scrapedProperties.push(property);
        }
      } catch (err) {
        console.error("Error processing property:", propUrl, err);
      }
    }

    console.log("Scraped properties:", scrapedProperties.length);

    // Step 3: Insert properties into database
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
        area: prop.area || null,
        url_original: prop.url,
        purpose: detectPurpose(prop.title, prop.price) as "rent" | "sale",
        status: "active" as const,
      };

      // Upsert property
      const { data: upserted, error } = await supabase
        .from("properties")
        .upsert(propertyData, {
          onConflict: "origin,origin_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Error upserting property:", error);
        continue;
      }

      // Add photo if available
      if (prop.imageUrl && upserted) {
        await supabase
          .from("property_photos")
          .upsert({
            property_id: upserted.id,
            url: prop.imageUrl,
            sort_order: 0,
          }, {
            onConflict: "property_id,url",
            ignoreDuplicates: true,
          });
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

function parseOLXProperty(content: string, metadata: any, url: string, id: string): ScrapedProperty | null {
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

    // Extract location info
    const locationMatch = content.match(/(?:Localização|Local|Endereço).*?([^,\n]+),\s*([^,\n]+)(?:,\s*([A-Z]{2}))?/i);
    let neighborhood = "", city = "", state = "RJ";
    if (locationMatch) {
      neighborhood = locationMatch[1]?.trim() || "";
      city = locationMatch[2]?.trim() || "";
      state = locationMatch[3]?.trim() || "RJ";
    }

    // Extract bedrooms
    const bedroomMatch = content.match(/(\d+)\s*(?:quarto|dormitório|dorm)/i);
    const bedrooms = bedroomMatch ? parseInt(bedroomMatch[1]) : 0;

    // Extract area
    const areaMatch = content.match(/(\d+)\s*m²/);
    const area = areaMatch ? parseInt(areaMatch[1]) : undefined;

    // Try to get first image from metadata
    const imageUrl = metadata.ogImage || metadata.image || undefined;

    return {
      id,
      title,
      price,
      url,
      neighborhood,
      city,
      state,
      bedrooms,
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
  if (lower.includes("kitnet") || lower.includes("studio")) return "kitnet";
  if (lower.includes("comercial") || lower.includes("loja") || lower.includes("sala")) return "comercial";
  if (lower.includes("terreno") || lower.includes("lote")) return "terreno";
  if (lower.includes("cobertura")) return "cobertura";
  return "apartamento";
}

function detectPurpose(title: string, price: number): string {
  const lower = title.toLowerCase();
  if (lower.includes("venda") || lower.includes("vendo")) return "sale";
  if (lower.includes("alug") || lower.includes("locação")) return "rent";
  // If price is high (> 100k), likely a sale
  if (price > 100000) return "sale";
  return "rent";
}
