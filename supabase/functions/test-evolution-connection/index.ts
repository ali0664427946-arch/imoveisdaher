import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Evolution API credentials from DB (with env var fallback)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "");
    let evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    let instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    try {
      const { data: dbConfig } = await supabaseAdmin
        .from("integrations_settings")
        .select("value")
        .eq("key", "evolution_api")
        .maybeSingle();
      if (dbConfig?.value) {
        const cfg = dbConfig.value as { base_url: string; api_key: string; instance_name: string };
        if (cfg.base_url) evolutionUrl = cfg.base_url.replace(/\/+$/, "");
        if (cfg.api_key) evolutionKey = cfg.api_key;
        if (cfg.instance_name) instanceName = cfg.instance_name;
      }
    } catch (e) { console.error("Failed to load DB config:", e); }

    console.log("Testing Evolution API connection...");
    console.log("URL configured:", !!evolutionUrl);
    console.log("Key configured:", !!evolutionKey);
    console.log("Instance configured:", !!instanceName);

    if (!evolutionUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "URL da Evolution API não configurada",
          details: "Configure a URL nas Configurações > Integrações"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!evolutionKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API Key da Evolution não configurada",
          details: "Configure a API Key nas Configurações > Integrações"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!instanceName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nome da instância não configurado",
          details: "Configure o nome da instância nas Configurações > Integrações"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test connection by fetching instance info
    console.log(`Fetching instance info from: ${evolutionUrl}/instance/fetchInstances`);
    
    const instanceResponse = await fetch(
      `${evolutionUrl}/instance/fetchInstances`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
      }
    );

    const instanceData = await instanceResponse.json();

    if (!instanceResponse.ok) {
      console.error("Evolution API error:", instanceData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Falha ao conectar com a Evolution API",
          details: instanceData.message || instanceData.error || JSON.stringify(instanceData)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Instances found:", instanceData);

    // Check if our instance exists
    const instances = Array.isArray(instanceData) ? instanceData : instanceData.instances || [];
    const ourInstance = instances.find((inst: any) => 
      inst.instance?.instanceName === instanceName || 
      inst.instanceName === instanceName ||
      inst.name === instanceName
    );

    if (!ourInstance) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Instância "${instanceName}" não encontrada`,
          details: `Instâncias disponíveis: ${instances.map((i: any) => i.instance?.instanceName || i.instanceName || i.name).join(", ") || "nenhuma"}`,
          instances: instances.map((i: any) => i.instance?.instanceName || i.instanceName || i.name)
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get instance connection state
    const stateResponse = await fetch(
      `${evolutionUrl}/instance/connectionState/${instanceName}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
      }
    );

    let connectionState = "unknown";
    if (stateResponse.ok) {
      const stateData = await stateResponse.json();
      connectionState = stateData.instance?.state || stateData.state || "unknown";
    }

    console.log("Connection successful! Instance state:", connectionState);

    return new Response(
      JSON.stringify({
        success: true,
        instance: instanceName,
        state: connectionState,
        message: connectionState === "open" 
          ? "Conectado e pronto para enviar mensagens!" 
          : `Instância encontrada (estado: ${connectionState})`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error testing Evolution connection:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Erro ao testar conexão",
        details: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
