import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
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
    if (!profileUrl || !profileUrl.includes("olx.com.br")) {
      return new Response(
        JSON.stringify({ success: false, error: "URL do perfil OLX é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== SYNC PROPERTY PHOTOS ===");
    console.log("Profile URL:", profileUrl);

    // 1. Load all active properties that need photos
    const { data: properties } = await supabase
      .from("properties")
      .select("id, title, price, origin_id, neighborhood")
      .eq("status", "active")
      .eq("origin", "olx");

    if (!properties || properties.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum imóvel ativo encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which ones already have photos
    const { data: existingPhotos } = await supabase
      .from("property_photos")
      .select("property_id")
      .in("property_id", properties.map(p => p.id));

    const propertiesWithPhotos = new Set((existingPhotos || []).map(p => p.property_id));
    const propertiesNeedingPhotos = properties.filter(p => !propertiesWithPhotos.has(p.id));

    console.log(`Total active: ${properties.length}, needing photos: ${propertiesNeedingPhotos.length}`);

    if (propertiesNeedingPhotos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos os imóveis já possuem fotos", matched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Build a lookup index by normalized title keywords
    function normalize(text: string): string {
      return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // 3. Scrape OLX profile to find property listing URLs
    const allPropertyUrls: Set<string> = new Set();
    for (let page = 1; page <= 10; page++) {
      const pageUrl = page === 1 ? profileUrl : `${profileUrl.split("?")[0]}?o=${page}`;
      console.log(`Scraping listing page ${page}...`);

      const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
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

      const data = await resp.json();
      if (!resp.ok) { console.error(`Page ${page} error`); continue; }

      const links = data.data?.links || [];
      const html = data.data?.html || "";

      for (const link of links) {
        if (isPropertyUrl(link)) allPropertyUrls.add(link.split("?")[0]);
      }
      for (const match of html.matchAll(/href="(https:\/\/[^"]*olx\.com\.br\/[^"]*\d{8,}[^"]*)"/g)) {
        if (isPropertyUrl(match[1])) allPropertyUrls.add(match[1].split("?")[0]);
      }

      console.log(`Found ${allPropertyUrls.size} URLs so far`);
      if (links.length < 5 && page > 1) break;
    }

    console.log(`Total property URLs: ${allPropertyUrls.size}`);

    // 4. Scrape each property page for title + photos, then match to DB
    let matched = 0;
    let unmatched = 0;
    const propertyUrls = Array.from(allPropertyUrls);

    const batchSize = 5;
    for (let i = 0; i < propertyUrls.length; i += batchSize) {
      const batch = propertyUrls.slice(i, i + batchSize);
      console.log(`Scraping detail batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(propertyUrls.length / batchSize)}`);

      const results = await Promise.all(batch.map(async (propUrl) => {
        try {
          const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: propUrl,
              formats: ["markdown", "html"],
              onlyMainContent: false,
              waitFor: 3000,
            }),
          });

          const data = await resp.json();
          if (!resp.ok) return null;

          const content = data.data?.markdown || "";
          const metadata = data.data?.metadata || {};

          // Extract title
          const scrapedTitle = metadata.title?.replace(" | OLX", "").trim() || "";
          // Extract price
          const priceMatch = content.match(/R\$\s*([\d.,]+)/);
          const scrapedPrice = priceMatch
            ? parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."))
            : 0;

          // Extract photos
          const imageUrls: string[] = [];
          const seenBases = new Set<string>();
          function imageBaseKey(url: string): string {
            return url.split("?")[0].replace(/\.(jpg|jpeg|webp|png)$/i, "").replace(/\/thumbs\//, "/images/");
          }
          for (const match of content.matchAll(/!\[[^\]]*\]\((https:\/\/img\.olx\.com\.br\/images\/[^)]+)\)/g)) {
            const base = imageBaseKey(match[1]);
            if (!seenBases.has(base)) {
              seenBases.add(base);
              imageUrls.push(match[1].replace(/\.webp/i, ".jpg"));
            }
          }
          if (imageUrls.length === 0 && metadata.ogImage) {
            imageUrls.push(metadata.ogImage);
          }

          return { title: scrapedTitle, price: scrapedPrice, imageUrls: imageUrls.slice(0, 20), url: propUrl };
        } catch {
          return null;
        }
      }));

      for (const scraped of results) {
        if (!scraped || scraped.imageUrls.length === 0) continue;

        // Try to match to a property needing photos
        const normalizedScraped = normalize(scraped.title);

        // Score each property - higher is better match
        let bestMatch: typeof propertiesNeedingPhotos[0] | null = null;
        let bestScore = 0;

        for (const prop of propertiesNeedingPhotos) {
          const normalizedProp = normalize(prop.title);
          
          // Check keyword overlap
          const scrapedWords = new Set(normalizedScraped.split(" ").filter(w => w.length > 2));
          const propWords = new Set(normalizedProp.split(" ").filter(w => w.length > 2));
          
          let overlap = 0;
          for (const word of propWords) {
            if (scrapedWords.has(word)) overlap++;
          }

          // Calculate score: word overlap + price proximity bonus
          const wordScore = propWords.size > 0 ? overlap / propWords.size : 0;
          const priceDiff = Math.abs(scraped.price - prop.price);
          const priceScore = priceDiff < 100 ? 0.3 : priceDiff < 500 ? 0.1 : 0;
          
          const score = wordScore + priceScore;

          if (score > bestScore && score >= 0.5) {
            bestScore = score;
            bestMatch = prop;
          }
        }

        if (bestMatch) {
          // Insert photos for this property
          const photos = scraped.imageUrls.map((url, index) => ({
            property_id: bestMatch!.id,
            url,
            sort_order: index,
          }));

          const { error } = await supabase.from("property_photos").insert(photos);
          if (!error) {
            console.log(`✓ Matched "${scraped.title.substring(0, 40)}" → ${bestMatch.origin_id} (${scraped.imageUrls.length} photos, score: ${bestScore.toFixed(2)})`);
            // Remove from the needing-photos list to avoid double-matching
            const idx = propertiesNeedingPhotos.indexOf(bestMatch);
            if (idx >= 0) propertiesNeedingPhotos.splice(idx, 1);
            matched++;
          } else {
            console.error(`Error inserting photos for ${bestMatch.origin_id}:`, error.message);
          }
        } else {
          unmatched++;
          console.log(`✗ No match for "${scraped.title.substring(0, 50)}" (price: ${scraped.price})`);
        }
      }
    }

    console.log(`=== DONE: ${matched} matched, ${unmatched} unmatched ===`);

    return new Response(
      JSON.stringify({
        success: true,
        total_scraped: propertyUrls.length,
        matched,
        unmatched,
        still_needing_photos: propertiesNeedingPhotos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function isPropertyUrl(url: string): boolean {
  if (!url.includes("olx.com.br")) return false;
  if (url.includes("/perfil/")) return false;
  if (url.includes("/suporte") || url.includes("/ajuda") || url.includes("/termos")) return false;
  if (url.includes("#") || url.includes("conta.olx") || url.includes("chat.olx")) return false;
  if (url.includes("/busca") || url.includes("/search")) return false;
  return /\d{8,}/.test(url);
}
