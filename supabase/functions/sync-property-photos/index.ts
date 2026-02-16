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

    console.log("=== SYNC PROPERTY PHOTOS (v5 - search by title) ===");

    // 1. Load properties needing photos
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

    const { data: existingPhotos } = await supabase
      .from("property_photos")
      .select("property_id")
      .in("property_id", properties.map(p => p.id));

    const withPhotos = new Set((existingPhotos || []).map(p => p.property_id));
    const needingPhotos = properties.filter(p => !withPhotos.has(p.id));

    console.log(`Total active: ${properties.length}, needing photos: ${needingPhotos.length}`);

    if (needingPhotos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos os imóveis já possuem fotos", matched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Search OLX for each property by title
    let matched = 0;
    const notFound: string[] = [];

    for (let i = 0; i < needingPhotos.length; i++) {
      const prop = needingPhotos[i];
      const code = prop.origin_id || "";
      
      // Build search query from title - take the most distinctive part
      // Remove "Daher Vende:" / "Daher Aluga:" prefix for better search
      const cleanTitle = prop.title
        .replace(/^Daher\s+(Vende|Aluga)[:\s]*/i, "")
        .replace(/\s+Cód\.?\s*\w+/i, "")
        .replace(/\s+[A-Z]{2}\d{4}$/i, "")
        .trim();
      
      // Use first ~60 chars of clean title for search
      const searchTitle = cleanTitle.substring(0, 60);
      const query = `site:olx.com.br "${searchTitle}"`;

      console.log(`[${i+1}/${needingPhotos.length}] ${code}: searching "${searchTitle.substring(0, 40)}..."`);

      try {
        const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 2,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        const searchData = await searchResp.json();
        if (!searchResp.ok) {
          console.error(`Search error for ${code}:`, searchData);
          notFound.push(code);
          continue;
        }

        const results = searchData.data || [];
        let foundPhotos: string[] = [];

        for (const result of results) {
          const url = result.url || "";
          const markdown = result.markdown || "";

          if (!url.includes("olx.com.br") || !url.includes("/d/")) continue;

          const photos = extractPhotosFromMarkdown(markdown);
          if (photos.length > 0) {
            foundPhotos = photos;
            await supabase
              .from("properties")
              .update({ url_original: url })
              .eq("id", prop.id);
            console.log(`  Found: ${url.substring(0, 70)}...`);
            break;
          }
        }

        if (foundPhotos.length > 0) {
          const photoRows = foundPhotos.slice(0, 20).map((photoUrl, index) => ({
            property_id: prop.id,
            url: photoUrl,
            sort_order: index,
          }));

          const { error } = await supabase.from("property_photos").insert(photoRows);
          if (!error) {
            console.log(`  ✓ ${code} → ${foundPhotos.length} photos`);
            matched++;
          } else {
            console.error(`  DB error for ${code}:`, error.message);
          }
        } else {
          console.log(`  ✗ ${code}: not found on OLX`);
          notFound.push(code);
        }

        // Delay between requests
        if (i < needingPhotos.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (e) {
        console.error(`Error for ${code}:`, e);
        notFound.push(code);
      }
    }

    console.log(`=== DONE: ${matched}/${needingPhotos.length} synced ===`);
    if (notFound.length > 0) {
      console.log(`Not found: ${notFound.join(", ")}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_needing: needingPhotos.length,
        total_synced: matched,
        still_needing: needingPhotos.length - matched,
        not_found: notFound,
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

/**
 * Extract full-size photo URLs from OLX listing markdown.
 */
function extractPhotosFromMarkdown(markdown: string): string[] {
  const photos: string[] = [];
  const seen = new Set<string>();

  const patterns = [
    /https:\/\/img\.olx\.com\.br\/images\/\d+\/[^\s)"\]]+\.(?:jpg|webp|jpeg|png)/gi,
    /https:\/\/img\.olx\.com\.br\/thumbs256x256\/\d+\/[^\s)"\]]+\.(?:jpg|webp|jpeg|png)/gi,
  ];

  for (const pattern of patterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      let url = match[0].replace("/thumbs256x256/", "/images/");
      const baseUrl = url.replace(/\.(jpg|webp|jpeg|png)$/i, "");

      if (!seen.has(baseUrl)) {
        seen.add(baseUrl);
        photos.push(url);
      }
    }
  }

  return photos;
}
