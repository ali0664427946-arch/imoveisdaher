import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const getInstancesList = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [payload.instances, payload.response, payload.data, payload.result];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && Array.isArray(candidate.instances)) return candidate.instances;
  }

  return [];
};

const getEvolutionErrorMessage = (payload: any): string => {
  if (!payload) return "Erro desconhecido";

  const rawMessage =
    payload.response?.message ??
    payload.response?.error ??
    payload.message ??
    payload.error;

  if (Array.isArray(rawMessage)) return rawMessage.join(" | ");
  if (typeof rawMessage === "string") return rawMessage;

  try {
    return JSON.stringify(payload);
  } catch {
    return "Erro desconhecido";
  }
};

const isInstanceAlreadyInUse = (payload: any): boolean => {
  const message = getEvolutionErrorMessage(payload).toLowerCase();
  return (
    message.includes("already in use") ||
    message.includes("já está em uso") ||
    message.includes("name is already in use") ||
    message.includes("name \"")
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Evolution API + WABA credentials from DB
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: dbConfig } = await supabaseAdmin
      .from("integrations_settings")
      .select("value")
      .eq("key", "evolution_api")
      .maybeSingle();

    if (!dbConfig?.value) {
      return new Response(
        JSON.stringify({ success: false, error: "Configurações da Evolution API não encontradas. Salve as configurações primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfg = dbConfig.value as {
      base_url: string;
      api_key: string;
      instance_name: string;
      integration_type?: string;
      meta_access_token?: string;
      phone_number_id?: string;
      business_account_id?: string;
    };

    if (cfg.integration_type !== "waba") {
      return new Response(
        JSON.stringify({ success: false, error: "O tipo de integração deve ser WABA Oficial. Altere nas configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cfg.base_url || !cfg.api_key || !cfg.instance_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Preencha Base URL, API Key e Nome da Instância." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cfg.meta_access_token || !cfg.phone_number_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Preencha o Meta Access Token e Phone Number ID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evolutionUrl = cfg.base_url.replace(/\/+$/, "");
    const evolutionKey = cfg.api_key;
    const instanceName = cfg.instance_name;

    console.log(`Connecting WABA instance: ${instanceName} at ${evolutionUrl}`);
    console.log(`API Key (first 8 chars): ${evolutionKey.substring(0, 8)}...`);

    // Step 1: Check if instance already exists
    const fetchRes = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
    });

    let instanceExists = false;
    if (fetchRes.ok) {
      const instances = await fetchRes.json();
      const list = getInstancesList(instances);
      instanceExists = list.some((inst: any) =>
        (inst.instance?.instanceName || inst.instanceName || inst.name) === instanceName
      );
      console.log(`fetchInstances OK. Found ${list.length} instances. Our instance exists: ${instanceExists}`);
    } else {
      const fetchBody = await fetchRes.text();
      console.log(`fetchInstances failed (${fetchRes.status}): ${fetchBody}`);

      if (fetchRes.status === 401 || fetchRes.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "API Key da Evolution não autorizada. Verifique se a chave está correta nas Configurações.",
            details: `fetchInstances retornou ${fetchRes.status}. Verifique a API Key no painel da Evolution API.`,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: Create instance if it doesn't exist
    if (!instanceExists) {
      console.log("Creating new WABA instance...");

      const createBody: Record<string, any> = {
        instanceName,
        integration: "WHATSAPP-BUSINESS",
        token: cfg.meta_access_token,
        number: cfg.phone_number_id,
      };

      if (cfg.business_account_id) {
        createBody.businessId = cfg.business_account_id;
      }

      // Set webhook URL automatically
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (supabaseUrl) {
        createBody.webhook = {
          url: `${supabaseUrl}/functions/v1/evolution-webhook`,
          enabled: true,
          webhookByEvents: false,
          webhookBase64: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
          ],
        };
      }

      console.log("Create payload:", JSON.stringify({
        ...createBody,
        token: cfg.meta_access_token ? "[REDACTED]" : undefined,
      }));

      const createRes = await fetch(`${evolutionUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify(createBody),
      });

      const createData = await createRes.json();
      console.log("Create response:", JSON.stringify(createData));

      if (!createRes.ok) {
        if (isInstanceAlreadyInUse(createData)) {
          console.log(`Instance "${instanceName}" already in use — attempting to delete and recreate...`);

          // Try to delete the orphaned instance
          const delRes = await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", apikey: evolutionKey },
          });
          const delBody = await delRes.text();
          console.log(`Delete response (${delRes.status}):`, delBody);

          if (delRes.ok || delRes.status === 404) {
            // Retry create after delete
            console.log("Retrying create after delete...");
            const retryRes = await fetch(`${evolutionUrl}/instance/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evolutionKey },
              body: JSON.stringify(createBody),
            });
            const retryData = await retryRes.json();
            console.log("Retry create response:", JSON.stringify(retryData));

            if (!retryRes.ok) {
              // If still fails, just continue with connect flow
              console.log("Retry create also failed, continuing with connect flow...");
              instanceExists = true;
            }
          } else {
            // Delete failed (401 — instance owned by another key)
            // Continue with connect flow anyway, it might work
            console.log("Cannot delete instance (owned by different API key). Continuing with connect...");
            instanceExists = true;
          }
        } else {
          const details = getEvolutionErrorMessage(createData);
          const status = createRes.status === 403 ? 403 : 500;

          return new Response(
            JSON.stringify({
              success: false,
              error: "Falha ao criar instância na Evolution API",
              details,
            }),
            { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      console.log("Instance already exists, attempting to connect...");
    }

    // Step 3: Connect instance
    const connectRes = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
    });

    const connectData = await connectRes.json();
    console.log("Connect response:", JSON.stringify(connectData));

    // If connect returns 401, report clearly
    if (connectRes.status === 401) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Instância "${instanceName}" não pode ser acessada com a API Key atual. A instância foi criada com outra chave.`,
          details: "Delete a instância manualmente no painel da Evolution API ou use a API Key original.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Check final connection state
    const stateRes = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
    });

    let finalState = "unknown";
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      finalState = stateData.instance?.state || stateData.state || "unknown";
    } else {
      await stateRes.text();
    }

    console.log("Final state:", finalState);

    return new Response(
      JSON.stringify({
        success: true,
        instance: instanceName,
        state: finalState,
        created: !instanceExists,
        message: finalState === "open"
          ? "✅ WABA conectado e pronto para enviar mensagens!"
          : !instanceExists
            ? `Instância "${instanceName}" criada com sucesso (estado: ${finalState}). Pode levar alguns segundos para conectar.`
            : `Instância "${instanceName}" reconectada (estado: ${finalState}).`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error connecting WABA:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Erro ao conectar WABA",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
