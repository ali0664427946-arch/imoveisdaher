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

    // Process in tiny batches - just get IDs and null out payload
    for (let i = 0; i < 10; i++) {
      const { data: ids, error: fetchError } = await supabase
        .from("messages")
        .select("id")
        .not("provider_payload", "is", null)
        .limit(5);

      if (fetchError || !ids || ids.length === 0) break;

      for (const row of ids) {
        await supabase
          .from("messages")
          .update({ provider_payload: null })
          .eq("id", row.id);
        totalCleaned++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, cleaned: totalCleaned }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
