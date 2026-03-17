// Configure Evolution API webhook to send events to our endpoint
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2.91.1");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    let evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    let instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    try {
      const { data: dbConfig } = await supabase
        .from("integrations_settings")
        .select("value")
        .eq("key", "evolution_api")
        .maybeSingle();
      if (dbConfig?.value) {
        const cfg = dbConfig.value as { base_url: string; api_key: string; instance_name: string };
        if (cfg.base_url) evolutionUrl = cfg.base_url;
        if (cfg.api_key) evolutionKey = cfg.api_key;
        if (cfg.instance_name) instanceName = cfg.instance_name;
      }
    } catch (e) { console.error("Failed to load DB config:", e); }

    if (!evolutionUrl || !evolutionKey || !instanceName || !supabaseUrl) {
      return new Response(
        JSON.stringify({ error: "Missing configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;

    // First, check current webhook config
    const getRes = await fetch(
      `${evolutionUrl}/webhook/find/${instanceName}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionKey,
        },
      }
    );

    let currentConfig = null;
    if (getRes.ok) {
      currentConfig = await getRes.json();
    }

    // Set webhook configuration
    const webhookConfig = {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED",
      ],
    };

    const setRes = await fetch(
      `${evolutionUrl}/webhook/set/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionKey,
        },
        body: JSON.stringify(webhookConfig),
      }
    );

    const setResult = await setRes.json();

    // Verify the config was applied
    const verifyRes = await fetch(
      `${evolutionUrl}/webhook/find/${instanceName}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionKey,
        },
      }
    );

    let verifyResult = null;
    if (verifyRes.ok) {
      verifyResult = await verifyRes.json();
    }

    return new Response(
      JSON.stringify({
        success: true,
        webhookUrl,
        previousConfig: currentConfig,
        setResult,
        currentConfig: verifyResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
