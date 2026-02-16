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
        JSON.stringify({ success: false, error: "Firecrawl não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { urls } = await req.json();
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Array 'urls' é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load all OLX properties needing photos
    const { data: properties } = await supabase
      .from("properties")
      .select("id, title, origin_id")
      .eq("status", "active")
      .eq("origin", "olx");

    const { data: existingPhotos } = await supabase
      .from("property_photos")
      .select("property_id")
      .in("property_id", (properties || []).map(p => p.id));

    const withPhotos = new Set((existingPhotos || []).map(p => p.property_id));
    const needingPhotos = (properties || []).filter(p => !withPhotos.has(p.id));

    // Build lookup by origin_id
    const propByCode = new Map<string, typeof needingPhotos[0]>();
    for (const p of needingPhotos) {
      if (p.origin_id) {
        propByCode.set(p.origin_id.toUpperCase(), p);
      }
    }

    console.log(`Properties needing photos: ${needingPhotos.length}`);

    const results: { url: string; matched: string | null; photos: number; error?: string }[] = [];

    for (const url of urls.slice(0, 20)) {
      try {
        console.log(`Scraping: ${url}`);

        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            formats: ["markdown"],
            waitFor: 10000,
          }),
        });

        const scrapeData = await scrapeResp.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

        if (!markdown) {
          results.push({ url, matched: null, photos: 0, error: "Sem conteúdo" });
          continue;
        }

        // Try to match property by code in URL or markdown
        let matchedProp: typeof needingPhotos[0] | null = null;
        let matchedCode = "";

        // Extract code from URL (e.g. "cdq-191" -> try matching)
        for (const [code, prop] of propByCode.entries()) {
          const codeLower = code.toLowerCase();
          const codeWithDash = codeLower.replace(/([a-z]+)(\d+)/, "$1-$2");
          
          if (url.toLowerCase().includes(codeLower) || url.toLowerCase().includes(codeWithDash)) {
            matchedProp = prop;
            matchedCode = code;
            break;
          }
        }

        // Also check markdown content
        if (!matchedProp) {
          for (const [code, prop] of propByCode.entries()) {
            const codeRegex = new RegExp(`\\b${code}\\b`, "i");
            if (codeRegex.test(markdown)) {
              matchedProp = prop;
              matchedCode = code;
              break;
            }
          }
        }

        // Extract photos
        const photos = extractPhotos(markdown);
        
        if (!matchedProp) {
          // Try matching by title similarity
          const titleFromPage = extractTitle(markdown);
          if (titleFromPage) {
            for (const p of needingPhotos) {
              if (titlesMatch(titleFromPage, p.title)) {
                matchedProp = p;
                matchedCode = p.origin_id || "title-match";
                break;
              }
            }
          }
        }

        if (!matchedProp || photos.length === 0) {
          results.push({ 
            url, 
            matched: matchedProp ? matchedCode : null, 
            photos: photos.length,
            error: !matchedProp ? "Imóvel não encontrado" : "Sem fotos"
          });
          continue;
        }

        // Insert photos
        const photoRows = photos.slice(0, 20).map((photoUrl, index) => ({
          property_id: matchedProp!.id,
          url: photoUrl,
          sort_order: index,
        }));

        const { error } = await supabase.from("property_photos").insert(photoRows);
        if (error) {
          results.push({ url, matched: matchedCode, photos: 0, error: error.message });
        } else {
          // Save original URL
          await supabase.from("properties").update({ url_original: url }).eq("id", matchedProp.id);
          results.push({ url, matched: matchedCode, photos: photos.length });
          // Remove from lookup
          propByCode.delete(matchedCode);
        }
      } catch (err) {
        results.push({ url, matched: null, photos: 0, error: String(err) });
      }
    }

    const totalSynced = results.filter(r => r.photos > 0 && !r.error).length;
    console.log(`Done: ${totalSynced}/${urls.length} synced`);

    return new Response(
      JSON.stringify({ success: true, results, total_synced: totalSynced }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractPhotos(markdown: string): string[] {
  const photos: string[] = [];
  const seen = new Set<string>();

  // Cut markdown at the recommendations section to avoid picking up other listings' photos
  const cutPoints = [
    "Adicionar aos favoritos",
    "Anúncios recomendados",
    "Você também pode gostar",
    "publicidade",
  ];
  let mainContent = markdown;
  for (const cut of cutPoints) {
    const idx = mainContent.indexOf(cut);
    if (idx > 200) { // only cut if it's not at the very beginning
      mainContent = mainContent.substring(0, idx);
      break;
    }
  }

  // Extract only images with "Daher" in the alt text (markdown format: ![alt](url))
  const daherPattern = /!\[([^\]]*[Dd]aher[^\]]*)\]\((https:\/\/img\.olx\.com\.br\/(?:images|thumbs256x256)\/\d+\/[^\s)]+\.(?:jpg|webp|jpeg|png))\)/gi;
  for (const match of mainContent.matchAll(daherPattern)) {
    let url = match[2].replace("/thumbs256x256/", "/images/");
    const baseUrl = url.replace(/\.(jpg|webp|jpeg|png)$/i, "");
    if (!seen.has(baseUrl)) {
      seen.add(baseUrl);
      photos.push(url);
    }
  }

  // If no Daher-specific photos found, fall back to all photos in main content only
  if (photos.length === 0) {
    const fallbackPattern = /https:\/\/img\.olx\.com\.br\/images\/\d+\/[^\s)"\]]+\.(?:jpg|webp|jpeg|png)/gi;
    for (const match of mainContent.matchAll(fallbackPattern)) {
      const url = match[0];
      const baseUrl = url.replace(/\.(jpg|webp|jpeg|png)$/i, "");
      if (!seen.has(baseUrl)) {
        seen.add(baseUrl);
        photos.push(url);
      }
    }
  }

  return photos;
}

function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : null;
}

function titlesMatch(pageTitle: string, dbTitle: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = normalize(pageTitle);
  const b = normalize(dbTitle);
  // Check if significant overlap
  return a.includes(b.substring(0, 30)) || b.includes(a.substring(0, 30));
}
