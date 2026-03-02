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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let totalCleaned = 0;
    const startTime = Date.now();
    const MAX_DURATION_MS = 50000;

    // Use RPC-style: fetch small batches of IDs and null them out one by one
    while (Date.now() - startTime < MAX_DURATION_MS) {
      // Simple select with limit - avoid complex filters on large jsonb
      const { data: batch, error: fetchError } = await supabase
        .from("messages")
        .select("id")
        .not("provider_payload", "is", null)
        .order("created_at", { ascending: true })
        .limit(5);

      if (fetchError) {
        console.error("Fetch error:", fetchError.message);
        // Wait a bit and retry
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      if (!batch || batch.length === 0) {
        console.log("All payloads cleaned!");
        break;
      }

      // Update one by one to avoid large transactions
      for (const row of batch) {
        if (Date.now() - startTime > MAX_DURATION_MS) break;
        
        const { error: updateError } = await supabase
          .from("messages")
          .update({ provider_payload: null })
          .eq("id", row.id);

        if (updateError) {
          console.error(`Update error for ${row.id}:`, updateError.message);
          await new Promise(r => setTimeout(r, 500));
        } else {
          totalCleaned++;
        }
      }

      console.log(`Progress: ${totalCleaned} cleaned`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Cleanup done: ${totalCleaned} in ${elapsed}s`);

    return new Response(
      JSON.stringify({ success: true, cleaned: totalCleaned, elapsed_seconds: elapsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
