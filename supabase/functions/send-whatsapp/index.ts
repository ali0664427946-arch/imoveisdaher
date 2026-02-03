import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendWhatsAppRequest {
  phone: string;
  message: string;
  fichaId?: string;
  conversationId?: string;
  skipDelay?: boolean; // For scheduled messages that already have delay
}

// Anti-ban delay: random between 2-9 seconds
async function antiBanDelay(): Promise<void> {
  const delayMs = Math.floor(Math.random() * 7000) + 2000; // 2000-9000ms
  console.log(`Anti-ban delay: ${delayMs}ms`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const userId = claims.claims.sub;

    // Parse request
    const { phone, message, fichaId, conversationId, skipDelay }: SendWhatsAppRequest = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Evolution API credentials
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      console.error("Missing Evolution API configuration");
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove non-digits, ensure country code)
    let normalizedPhone = phone.replace(/\D/g, "");
    if (!normalizedPhone.startsWith("55")) {
      normalizedPhone = "55" + normalizedPhone;
    }

    // Apply anti-ban delay (unless skipped for scheduled messages)
    if (!skipDelay) {
      await antiBanDelay();
    }

    console.log(`Sending WhatsApp message to ${normalizedPhone}`);

    // Send message via Evolution API
    const evolutionResponse = await fetch(
      `${evolutionUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: normalizedPhone,
          text: message,
        }),
      }
    );

    const evolutionData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error("Evolution API error:", evolutionData);
      return new Response(
        JSON.stringify({ success: false, error: evolutionData.message || "Failed to send message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Message sent successfully:", evolutionData);

    // Log activity
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await adminClient.from("activity_log").insert({
      action: "whatsapp_sent",
      entity_type: fichaId ? "ficha" : conversationId ? "conversation" : "message",
      entity_id: fichaId || conversationId || null,
      user_id: userId,
      metadata: {
        phone: normalizedPhone,
        message_preview: message.substring(0, 100),
        evolution_message_id: evolutionData.key?.id || evolutionData.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: evolutionData.key?.id || evolutionData.id,
        evolutionData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending WhatsApp:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
