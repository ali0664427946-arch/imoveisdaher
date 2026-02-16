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

    console.log("=== SYNC PROPERTY PHOTOS (v6 - crawl) ===");

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

    // Build lookup by origin_id (uppercase)
    const propByCode = new Map<string, typeof needingPhotos[0]>();
    for (const p of needingPhotos) {
      if (p.origin_id) {
        propByCode.set(p.origin_id.toUpperCase(), p);
      }
    }

    // 2. Start a crawl of the OLX profile 
    const baseUrl = profileUrl.split("?")[0];
    console.log(`Starting crawl of: ${baseUrl}`);

    const crawlResp = await fetch("https://api.firecrawl.dev/v1/crawl", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: baseUrl,
        limit: 100, // Crawl up to 100 pages (profile + individual listings)
        maxDepth: 2,
        scrapeOptions: {
          formats: ["markdown"],
          waitFor: 3000,
        },
      }),
    });

    const crawlData = await crawlResp.json();
    if (!crawlResp.ok) {
      console.error("Crawl start error:", crawlData);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao iniciar crawl" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Crawl returns a job ID - we need to poll for results
    const crawlId = crawlData.id;
    if (!crawlId) {
      console.error("No crawl ID returned:", crawlData);
      return new Response(
        JSON.stringify({ success: false, error: "Crawl não retornou ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Crawl started, ID: ${crawlId}. Polling for results...`);

    // Poll for crawl results (max 3 minutes)
    let crawlResults: any[] = [];
    const maxPolls = 36; // 36 * 5s = 180s
    
    for (let poll = 0; poll < maxPolls; poll++) {
      await new Promise(r => setTimeout(r, 5000));

      const statusResp = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        },
      });

      const statusData = await statusResp.json();
      
      if (statusData.status === "completed") {
        crawlResults = statusData.data || [];
        console.log(`Crawl completed: ${crawlResults.length} pages scraped`);
        break;
      } else if (statusData.status === "failed") {
        console.error("Crawl failed:", statusData);
        break;
      } else {
        const completed = statusData.completed || 0;
        const total = statusData.total || "?";
        if (poll % 3 === 0) {
          console.log(`  Crawl in progress: ${completed}/${total} pages...`);
        }
      }
    }

    if (crawlResults.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Crawl não retornou resultados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Process each crawled page - match to properties
    let matched = 0;
    const matchedCodes = new Set<string>();

    for (const page of crawlResults) {
      const markdown = page.markdown || "";
      const pageUrl = page.metadata?.sourceURL || "";

      // Try to find property code in the page URL or content
      let matchedProp: typeof needingPhotos[0] | null = null;

      // Check URL for code patterns
      for (const [code, prop] of propByCode.entries()) {
        if (matchedCodes.has(code)) continue;
        
        const codeLower = code.toLowerCase();
        const codeWithDash = codeLower.replace(/(\D+)(\d+)/, "$1-$2");
        
        if (pageUrl.toLowerCase().includes(codeLower) || pageUrl.toLowerCase().includes(codeWithDash)) {
          matchedProp = prop;
          break;
        }
      }

      // If not found in URL, check markdown content for code
      if (!matchedProp) {
        for (const [code, prop] of propByCode.entries()) {
          if (matchedCodes.has(code)) continue;
          
          // Search for the code in the markdown (case insensitive)
          const codeRegex = new RegExp(`\\b${code}\\b`, "i");
          if (codeRegex.test(markdown)) {
            matchedProp = prop;
            break;
          }
        }
      }

      if (!matchedProp) continue;

      // Extract photos from this page
      const photos = extractPhotosFromMarkdown(markdown);
      if (photos.length === 0) continue;

      const code = matchedProp.origin_id!.toUpperCase();
      const photoRows = photos.slice(0, 20).map((photoUrl, index) => ({
        property_id: matchedProp!.id,
        url: photoUrl,
        sort_order: index,
      }));

      const { error } = await supabase.from("property_photos").insert(photoRows);
      if (!error) {
        console.log(`✓ ${code} → ${photos.length} photos (from ${pageUrl.substring(0, 60)})`);
        matched++;
        matchedCodes.add(code);

        // Save URL
        await supabase
          .from("properties")
          .update({ url_original: pageUrl })
          .eq("id", matchedProp.id);
      } else {
        console.error(`DB error for ${code}:`, error.message);
      }
    }

    const remaining = needingPhotos.length - matched;
    console.log(`=== DONE: ${matched}/${needingPhotos.length} synced, ${remaining} still need photos ===`);

    return new Response(
      JSON.stringify({
        success: true,
        pages_crawled: crawlResults.length,
        total_needing: needingPhotos.length,
        total_synced: matched,
        still_needing: remaining,
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
