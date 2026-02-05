import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InitiateContactRequest {
  name: string;
  phone: string;
  propertyId: string;
  propertyTitle: string;
  propertyNeighborhood: string;
  propertyPrice: number;
  propertyPurpose: "rent" | "sale";
}

// Anti-ban delay: random between 2-9 seconds
async function antiBanDelay(): Promise<void> {
  const delayMs = Math.floor(Math.random() * 7000) + 2000;
  console.log(`Anti-ban delay: ${delayMs}ms`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request
    const body: InitiateContactRequest = await req.json();
    const { name, phone, propertyId, propertyTitle, propertyNeighborhood, propertyPrice, propertyPurpose } = body;

    if (!name || !phone || !propertyId) {
      return new Response(
        JSON.stringify({ success: false, error: "Nome, telefone e imóvel são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean and normalize phone
    const cleanPhone = phone.replace(/\D/g, "");
    const normalizedPhone = cleanPhone.startsWith("55") 
      ? `+${cleanPhone}` 
      : `+55${cleanPhone}`;

    console.log(`Processing contact from ${name} (${normalizedPhone}) for property ${propertyId}`);

    // Get Evolution API credentials
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      console.error("Missing Evolution API configuration");
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = evolutionUrl.replace(/\/+$/, "");

    // 1. Check if lead already exists
    let leadId: string;
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("phone_normalized", normalizedPhone)
      .single();

    if (existingLead) {
      leadId = existingLead.id;
      console.log(`Found existing lead: ${leadId}`);
      
      // Update lead with property interest
      await supabase
        .from("leads")
        .update({ 
          property_id: propertyId,
          notes: `Interessado em: ${propertyTitle}`,
        })
        .eq("id", leadId);
    } else {
      // Create new lead
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name,
          phone: cleanPhone,
          phone_normalized: normalizedPhone,
          property_id: propertyId,
          origin: "site_whatsapp",
          status: "entrou_em_contato",
          notes: `Interessado em: ${propertyTitle}`,
        })
        .select("id")
        .single();

      if (leadError || !newLead) {
        console.error("Error creating lead:", leadError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao registrar contato" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      leadId = newLead.id;
      console.log(`Created new lead: ${leadId}`);
    }

    // 2. Check if conversation exists
    let conversationId: string;
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("lead_id", leadId)
      .eq("channel", "whatsapp")
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
      console.log(`Found existing conversation: ${conversationId}`);
    } else {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          lead_id: leadId,
          channel: "whatsapp",
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (convError || !newConv) {
        console.error("Error creating conversation:", convError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao criar conversa" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      conversationId = newConv.id;
      console.log(`Created new conversation: ${conversationId}`);
    }

    // 3. Prepare welcome message
    const priceFormatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(propertyPrice);

    const purposeText = propertyPurpose === "rent" ? "aluguel" : "venda";

    const welcomeMessage = `Olá ${name}! 👋

Obrigado pelo interesse no imóvel:

🏠 *${propertyTitle}*
📍 ${propertyNeighborhood}
💰 ${priceFormatted}${propertyPurpose === "rent" ? "/mês" : ""} (${purposeText})

Em breve um de nossos corretores entrará em contato para te ajudar!

*Daher Imóveis* - Sua imobiliária em Jacarepaguá 🏡`;

    // 4. Apply anti-ban delay
    await antiBanDelay();

    // 5. Send message via Evolution API
    const sendPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    
    console.log(`Sending WhatsApp message to ${sendPhone}`);

    const evolutionResponse = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: sendPhone,
        text: welcomeMessage,
      }),
    });

    const evolutionData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error("Evolution API error:", evolutionData);
      // Still save the message even if sending failed
    } else {
      console.log("WhatsApp message sent successfully:", evolutionData);
    }

    // 6. Save message to database
    const { error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        content: welcomeMessage,
        direction: "outbound",
        message_type: "text",
        provider: "evolution",
        sent_status: evolutionResponse.ok ? "sent" : "failed",
        provider_payload: evolutionData,
      });

    if (msgError) {
      console.error("Error saving message:", msgError);
    }

    // 7. Update conversation
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: welcomeMessage.substring(0, 100),
      })
      .eq("id", conversationId);

    // 8. Log activity
    await supabase.from("activity_log").insert({
      action: "whatsapp_initiated",
      entity_type: "lead",
      entity_id: leadId,
      metadata: {
        phone: sendPhone,
        property_id: propertyId,
        property_title: propertyTitle,
        conversation_id: conversationId,
        message_sent: evolutionResponse.ok,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        leadId,
        conversationId,
        messageSent: evolutionResponse.ok,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error initiating WhatsApp contact:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
