import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

type InstanceRecord = {
  instance?: Record<string, unknown>;
  instanceId?: string;
  id?: string;
  instanceName?: string;
  name?: string;
  state?: string;
  connectionStatus?: string;
  status?: string;
  [key: string]: unknown;
};

function normalizeEvolutionUrl(rawUrl: string) {
  let baseUrl = rawUrl.trim().replace(/\/manager\/?$/i, "").replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }

  return baseUrl;
}

function getTlsErrorMessage(baseUrl: string, errorMessage: string) {
  const host = (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return baseUrl;
    }
  })();

  if (host.includes("traefik.me")) {
    return "O domínio traefik.me da Evolution GO está forçando HTTPS com certificado inválido para o runtime do backend. Use um domínio próprio com SSL válido (ex.: Cloudflare/NGINX/Let's Encrypt) ou um endpoint publicado com certificado confiável.";
  }

  return `Certificado TLS inválido no host ${host}. Publique a Evolution GO atrás de um domínio com SSL válido. Detalhe: ${errorMessage}`;
}

function extractInstances(payload: unknown): InstanceRecord[] {
  if (Array.isArray(payload)) return payload as InstanceRecord[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const candidates = [record.instances, record.data, record.result, record.response];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      if (Array.isArray(nested.instances)) return nested.instances;
      if (Array.isArray(nested.data)) return nested.data;
    }
  }

  return [];
}

function getInstanceIdentity(instance: InstanceRecord) {
  const instanceInfo = instance?.instance ?? instance;
  return {
    id: instanceInfo?.instanceId ?? instanceInfo?.id ?? instance?.instanceId ?? instance?.id,
    name: instanceInfo?.instanceName ?? instanceInfo?.name ?? instance?.instanceName ?? instance?.name,
    state: instanceInfo?.state ?? instance?.state ?? instance?.connectionStatus ?? instance?.status,
  };
}

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
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
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
        const cfg = dbConfig.value as { base_url: string; api_key: string; instance_name: string; integration_type?: string };
        if (cfg.base_url) evolutionUrl = cfg.base_url.replace(/\/+$/, "");
        if (cfg.api_key) evolutionKey = cfg.api_key;
        if (cfg.instance_name) instanceName = cfg.instance_name;
        const integrationType = cfg.integration_type || "qrcode";
        
        if (integrationType === "evogo") {
          console.log("Testing Evolution GO connection...");

          const baseUrl = normalizeEvolutionUrl(evolutionUrl!);
          let lastError = "";

          try {
            console.log(`Trying Evolution GO at: ${baseUrl}/instance/all`);
            const evogoRes = await fetch(`${baseUrl}/instance/all`, {
              method: "GET",
              headers: { "Content-Type": "application/json", apikey: evolutionKey! },
            });

            const responseText = await evogoRes.text();

            if (!evogoRes.ok) {
              return new Response(JSON.stringify({
                success: false,
                error: "Falha na Evolution GO",
                details: `A Evolution GO respondeu ${evogoRes.status} ao consultar /instance/all. Verifique a API Key e a publicação da instância. Detalhe: ${responseText.slice(0, 300)}`,
              }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            let payload: unknown = null;
            try {
              payload = responseText ? JSON.parse(responseText) : null;
            } catch {
              payload = responseText;
            }

            const instances = extractInstances(payload);
            const matched = instances.find((instance) => {
              const identity = getInstanceIdentity(instance);
              return identity.name === instanceName || identity.id === instanceName;
            });

            if (!matched) {
              return new Response(JSON.stringify({
                success: false,
                error: `Instância "${instanceName}" não encontrada na Evolution GO`,
                details: instances.length
                  ? `Instâncias disponíveis: ${instances.map((instance) => {
                      const identity = getInstanceIdentity(instance);
                      return identity.name || identity.id || "sem identificação";
                    }).join(", ")}`
                  : "A conexão com a Evolution GO funcionou, mas a lista de instâncias veio vazia.",
              }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const identity = getInstanceIdentity(matched);
            return new Response(JSON.stringify({
              success: true,
              state: identity.state || "available",
              instance: identity.name || identity.id || instanceName,
              message: `Evolution GO conectada com sucesso via ${baseUrl}!`,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          } catch (fetchErr) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            lastError = msg;
            console.error(`Failed at ${baseUrl}:`, msg);
          }

          const isTlsErr = lastError.includes("UnknownIssuer") || lastError.toLowerCase().includes("certificate") || lastError.toLowerCase().includes("tls");
          return new Response(JSON.stringify({
            success: false,
            error: "Falha na Evolution GO",
            details: isTlsErr
              ? getTlsErrorMessage(baseUrl, lastError)
              : `Não foi possível conectar. Verifique a URL (sem /manager) e a API Key. Detalhe: ${lastError}`,
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
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
