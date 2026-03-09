import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fichaId } = await req.json();

    if (!fichaId) {
      return new Response(
        JSON.stringify({ success: false, error: "fichaId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limiting: max 3 sends per ficha in 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentSends } = await supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "ficha_protocol_sent")
      .eq("entity_id", fichaId)
      .gte("created_at", tenMinutesAgo);

    if ((recentSends ?? 0) >= 3) {
      console.log(`Rate limit hit for ficha ${fichaId}: ${recentSends} sends in last 10min`);
      return new Response(
        JSON.stringify({ success: false, error: "Limite de envios atingido. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ficha data
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas")
      .select("id, protocol, phone, full_name, property_id")
      .eq("id", fichaId)
      .single();

    if (fichaError || !ficha) {
      return new Response(
        JSON.stringify({ success: false, error: "Ficha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ficha.phone || !ficha.protocol) {
      return new Response(
        JSON.stringify({ success: false, error: "Ficha sem telefone ou protocolo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get property info if available
    let propertyInfo = "";
    if (ficha.property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("title, neighborhood")
        .eq("id", ficha.property_id)
        .single();
      if (prop) {
        propertyInfo = `\n🏠 *Imóvel:* ${prop.title} — ${prop.neighborhood}`;
      }
    }

    // Build message
    const message = `Olá, *${ficha.full_name}*! 👋

Sua ficha de interesse foi recebida com sucesso! ✅

📋 *Protocolo:* ${ficha.protocol}${propertyInfo}

Guarde este protocolo para acompanhar o status da sua solicitação. Entraremos em contato em breve!

_Daher Imóveis_`;

    // Get Evolution API credentials
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = evolutionUrl.replace(/\/+$/, "");

    // Clean phone and add country code
    let cleanPhone = ficha.phone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55")) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Check if number exists on WhatsApp
    const checkResponse = await fetch(`${baseUrl}/chat/whatsappNumbers/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ numbers: [cleanPhone] }),
    });

    let validPhone = cleanPhone;
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (Array.isArray(checkData) && checkData.length > 0 && checkData[0].exists) {
        validPhone = checkData[0].jid?.replace("@s.whatsapp.net", "") || cleanPhone;
      } else {
        console.log(`WhatsApp number not found for ${cleanPhone}, sending anyway`);
      }
    }

    // Anti-ban delay: random 2-9 seconds
    const delayMs = Math.floor(Math.random() * 7000) + 2000;
    console.log(`Anti-ban delay: ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Send message
    const sendResponse = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: validPhone, text: message }),
    });

    const sendData = await sendResponse.json();

    // Log to centralized send log
    await supabase.from("whatsapp_send_log").insert({
      function_name: "send-ficha-protocol",
      phone: validPhone,
      status: sendResponse.ok ? "success" : "failed",
      delay_ms: delayMs,
      error_message: sendResponse.ok ? null : (sendData.message || "API error"),
      message_preview: `Protocolo ${ficha.protocol}`,
    }).then(({ error }) => { if (error) console.error("Send log error:", error); });

    const sendData = await sendResponse.json();

    if (!sendResponse.ok) {
      console.error("Evolution API error:", sendData);
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao enviar mensagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Protocol ${ficha.protocol} sent to ${validPhone}`);

    // Log for rate limiting
    await supabase.from("activity_log").insert({
      action: "ficha_protocol_sent",
      entity_type: "ficha",
      entity_id: fichaId,
      metadata: { protocol: ficha.protocol, phone: validPhone },
    });

    return new Response(
      JSON.stringify({ success: true, protocol: ficha.protocol }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
