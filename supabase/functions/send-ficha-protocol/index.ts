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

    // Send message
    const sendResponse = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: validPhone, text: message }),
    });

    const sendData = await sendResponse.json();

    if (!sendResponse.ok) {
      console.error("Evolution API error:", sendData);
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao enviar mensagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Protocol ${ficha.protocol} sent to ${validPhone}`);

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
