import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ListingData {
  code: string;
  title: string;
  thumbnails: string[];
  url: string;
}

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

    console.log("=== SYNC PROPERTY PHOTOS (v2 - profile parsing) ===");

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

    // Build lookup by origin_id (uppercase)
    const propByCode = new Map<string, typeof propertiesNeedingPhotos[0]>();
    for (const p of propertiesNeedingPhotos) {
      if (p.origin_id) {
        propByCode.set(p.origin_id.toUpperCase(), p);
      }
    }

    // 2. Scrape profile pages and extract listings from markdown
    const allListings: ListingData[] = [];
    const baseUrl = profileUrl.split("?")[0];
    
    // Try multiple pages - OLX profile shows 12 per page, total 48 = 4 pages
    // Also try category-filtered pages to get more results
    const urlsToScrape = [
      baseUrl, // Page 1
    ];

    // Add category filters to get different subsets
    const categories = ["Apartamentos", "Casas", "Comércio e indústria"];
    // OLX might use query params for category filtering
    // But first let's try getting page 1 and see what we get

    for (const scrapeUrl of urlsToScrape) {
      console.log(`Scraping profile: ${scrapeUrl}`);

      const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: scrapeUrl,
          formats: ["markdown"],
          onlyMainContent: false,
          waitFor: 5000,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        console.error("Scrape error:", data);
        continue;
      }

      const markdown = data.data?.markdown || data.markdown || "";
      const listings = parseProfileListings(markdown);
      console.log(`Extracted ${listings.length} listings from profile page`);

      for (const listing of listings) {
        // Avoid duplicates
        if (!allListings.some(l => l.code === listing.code || l.url === listing.url)) {
          allListings.push(listing);
        }
      }
    }

    // 3. Now try to scrape individual listing pages for properties NOT found on profile
    // First, match what we have from profile
    let matched = 0;
    const matchedCodes = new Set<string>();

    for (const listing of allListings) {
      const prop = propByCode.get(listing.code.toUpperCase());
      if (!prop) {
        console.log(`⊘ Code ${listing.code} not in DB (or already has photos)`);
        continue;
      }

      // Convert thumbnails to full-size images
      const fullSizeUrls = listing.thumbnails.map(t =>
        t.replace("/thumbs256x256/", "/images/")
      );

      const photos = fullSizeUrls.map((url, index) => ({
        property_id: prop.id,
        url,
        sort_order: index,
      }));

      const { error } = await supabase.from("property_photos").insert(photos);
      if (!error) {
        console.log(`✓ ${listing.code} → ${prop.origin_id} (${photos.length} photos from profile thumbnails)`);
        matched++;
        matchedCodes.add(listing.code.toUpperCase());
      } else {
        console.error(`Error for ${listing.code}:`, error.message);
      }
    }

    // 4. For remaining properties, try scraping individual pages
    const remainingProps = propertiesNeedingPhotos.filter(
      p => p.origin_id && !matchedCodes.has(p.origin_id.toUpperCase())
    );

    console.log(`Profile matched: ${matched}. Remaining: ${remainingProps.length}. Trying individual scrape...`);

    // Get all listing URLs from the profile page for individual scraping
    // Build a map of OLX listing URLs we found
    const listingUrlsByCode = new Map<string, string>();
    for (const listing of allListings) {
      listingUrlsByCode.set(listing.code.toUpperCase(), listing.url);
    }

    // For remaining properties without a direct profile match,
    // try to find and scrape their individual OLX pages
    let individualMatched = 0;
    const batchSize = 5;
    
    // Get ALL listing URLs from profile (including ones already matched, we need URLs for unmatched)
    // Actually, we need the URLs from the profile that we haven't matched - these are listings
    // whose codes weren't in our DB. The remaining properties DON'T have listing URLs.
    // We need to scrape individual pages by searching or by direct URL.
    
    // Strategy: scrape the individual listing pages we found on the profile
    // to get their full photo sets, and try to match by title/price
    const unmatchedListings = allListings.filter(l => !matchedCodes.has(l.code.toUpperCase()) && !propByCode.has(l.code.toUpperCase()));
    
    // For the remaining properties that weren't in the profile at all,
    // we need to try getting more pages from the profile
    // Let's try scrolling/pagination approaches
    if (remainingProps.length > 0) {
      // Try scraping with different sort orders to surface different listings
      const additionalUrls = [
        `${baseUrl}?sf=price_asc`,  // Sort by price ascending
        `${baseUrl}?sf=price_desc`, // Sort by price descending
      ];

      for (const scrapeUrl of additionalUrls) {
        console.log(`Trying additional sort: ${scrapeUrl}`);

        const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: scrapeUrl,
            formats: ["markdown"],
            onlyMainContent: false,
            waitFor: 5000,
          }),
        });

        const data = await resp.json();
        if (!resp.ok) continue;

        const markdown = data.data?.markdown || data.markdown || "";
        const listings = parseProfileListings(markdown);
        console.log(`Sort page found ${listings.length} listings`);

        for (const listing of listings) {
          if (matchedCodes.has(listing.code.toUpperCase())) continue;
          
          const prop = propByCode.get(listing.code.toUpperCase());
          if (!prop) continue;

          const fullSizeUrls = listing.thumbnails.map(t =>
            t.replace("/thumbs256x256/", "/images/")
          );

          const photos = fullSizeUrls.map((url, index) => ({
            property_id: prop.id,
            url,
            sort_order: index,
          }));

          const { error } = await supabase.from("property_photos").insert(photos);
          if (!error) {
            console.log(`✓ (sort) ${listing.code} → ${prop.origin_id} (${photos.length} photos)`);
            individualMatched++;
            matchedCodes.add(listing.code.toUpperCase());
          }
        }
      }
    }

    const totalMatched = matched + individualMatched;
    const stillNeeding = propertiesNeedingPhotos.length - totalMatched;

    console.log(`=== DONE: ${totalMatched} matched (${matched} profile + ${individualMatched} sort), ${stillNeeding} still need photos ===`);

    return new Response(
      JSON.stringify({
        success: true,
        profile_listings_found: allListings.length,
        matched_from_profile: matched,
        matched_from_sort: individualMatched,
        total_matched: totalMatched,
        still_needing_photos: stillNeeding,
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
 * Parse profile page markdown to extract listings with their codes and thumbnail images.
 * 
 * Profile markdown structure per listing:
 * - thumbnail images as markdown images
 * - count of photos (e.g., "20")  
 * - [**Title with Code**](URL)
 * - ### R$ price
 */
function parseProfileListings(markdown: string): ListingData[] {
  const listings: ListingData[] = [];
  const lines = markdown.split("\n");

  let currentThumbnails: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Collect thumbnail URLs
    const thumbMatch = line.match(/!\[.*?\]\((https:\/\/img\.olx\.com\.br\/thumbs256x256\/[^)]+)\)/);
    if (thumbMatch) {
      currentThumbnails.push(thumbMatch[1]);
      continue;
    }

    // Look for listing title link: [**Title with Code**](URL)
    const titleMatch = line.match(/\[\*\*(.+?)\*\*\]\((https:\/\/[^)]+olx\.com\.br[^)]+)\)/);
    if (titleMatch) {
      const title = titleMatch[1];
      const url = titleMatch[2];

      // Extract Daher code from title
      // Patterns: "Cód: AP0149", "Cód AP0022", "Código: LO0007", "CDQ 280", or just code at end
      const codePatterns = [
        /C[oó]d(?:igo)?[:\s]+([A-Z]{2,4}\s*\d{2,4})/i,
        /([A-Z]{2}\d{4})\s*\*?\*?\]?$/i,  // Code at end of title like "AP0149"
        /\b([A-Z]{2,3}\d{3,4})\b/,  // Any pattern like AP0149, LO007, CA062
      ];

      let code = "";
      for (const pattern of codePatterns) {
        const match = title.match(pattern);
        if (match) {
          code = match[1].replace(/\s+/g, "").toUpperCase();
          break;
        }
      }

      if (code && currentThumbnails.length > 0) {
        listings.push({
          code,
          title,
          thumbnails: [...currentThumbnails],
          url,
        });
      } else if (currentThumbnails.length > 0) {
        // No code found - try to extract from URL
        const urlCodeMatch = url.match(/cod[:-]?\s*([a-z]{2,4}\d{2,4})/i);
        if (urlCodeMatch) {
          code = urlCodeMatch[1].replace(/\s+/g, "").toUpperCase();
          listings.push({ code, title, thumbnails: [...currentThumbnails], url });
        } else {
          console.log(`⚠ No code found in: "${title.substring(0, 60)}"`);
        }
      }

      currentThumbnails = [];
      continue;
    }

    // Reset thumbnails if we hit a non-image, non-thumbnail line that isn't a count
    if (line && !line.match(/^\d+$/) && !line.startsWith("-") && !line.startsWith("!") && !line.startsWith("#")) {
      // Don't reset on price lines, dates, "Profissional", location
      if (!line.includes("R$") && !line.includes("Profissional") && !line.includes("Rio de Janeiro") && !line.match(/^\d{2}\/\d{2}/)) {
        // This might be noise between listings - keep thumbnails
      }
    }
  }

  return listings;
}
