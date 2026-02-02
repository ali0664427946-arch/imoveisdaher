import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    // Get Evolution API credentials
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    console.log("Testing Evolution API connection...");
    console.log("URL configured:", !!evolutionUrl);
    console.log("Key configured:", !!evolutionKey);
    console.log("Instance configured:", !!instanceName);

    if (!evolutionUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "EVOLUTION_API_URL não configurada",
          details: "Configure a URL da Evolution API nos secrets do projeto"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!evolutionKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "EVOLUTION_API_KEY não configurada",
          details: "Configure a API Key da Evolution API nos secrets do projeto"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!instanceName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "EVOLUTION_INSTANCE_NAME não configurada",
          details: "Configure o nome da instância nos secrets do projeto"
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
