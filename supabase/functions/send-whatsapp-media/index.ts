import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendMediaRequest {
  phone: string;
  mediaUrl: string;
  mediaType: "image" | "document";
  mimeType: string;
  fileName?: string;
  caption?: string;
  conversationId?: string;
}

// Anti-ban delay: random between 2-9 seconds
async function antiBanDelay(): Promise<void> {
  const delayMs = Math.floor(Math.random() * 7000) + 2000;
  console.log(`Anti-ban delay: ${delayMs}ms`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

// Check if a number exists on WhatsApp
async function checkWhatsAppNumber(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string
): Promise<{ exists: boolean; jid?: string }> {
  try {
    const response = await fetch(`${baseUrl}/chat/whatsappNumbers/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({ numbers: [phone] }),
    });

    if (!response.ok) {
      console.log(`WhatsApp check failed for ${phone}:`, response.status);
      return { exists: false };
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      return { exists: result.exists === true, jid: result.jid };
    }
    return { exists: false };
  } catch (error) {
    console.error(`Error checking WhatsApp number ${phone}:`, error);
    return { exists: false };
  }
}

// Resolve valid WhatsApp phone (handles groups, normalizes numbers)
async function resolvePhone(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  originalPhone: string
): Promise<{ validPhone: string | null; jid?: string }> {
  if (originalPhone.includes("@g.us")) {
    console.log(`Group JID: ${originalPhone}`);
    return { validPhone: originalPhone, jid: originalPhone };
  }

  if (originalPhone.includes("@lid") || originalPhone.includes("@")) {
    console.log(`LID/special format: ${originalPhone} - cannot send`);
    return { validPhone: null };
  }

  let cleanPhone = originalPhone.replace(/\D/g, "");

  if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
    const check = await checkWhatsAppNumber(baseUrl, apiKey, instanceName, cleanPhone);
    if (check.exists) return { validPhone: cleanPhone, jid: check.jid };
  }

  if (cleanPhone.startsWith("55")) {
    cleanPhone = cleanPhone.substring(2);
  }

  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    const fullNumber = `55${cleanPhone}`;
    const check = await checkWhatsAppNumber(baseUrl, apiKey, instanceName, fullNumber);
    if (check.exists) return { validPhone: fullNumber, jid: check.jid };
  }

  return { validPhone: null };
}

Deno.serve(async (req) => {
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
    const { phone, mediaUrl, mediaType, mimeType, fileName, caption, conversationId }: SendMediaRequest = await req.json();

    if (!phone || !mediaUrl || !mediaType || !mimeType) {
      return new Response(
        JSON.stringify({ success: false, error: "phone, mediaUrl, mediaType and mimeType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Evolution API credentials
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = evolutionUrl.replace(/\/+$/, "");

    // Resolve phone number
    console.log(`Resolving phone: ${phone}`);
    const { validPhone } = await resolvePhone(baseUrl, evolutionKey, instanceName, phone);

    if (!validPhone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Número não encontrado no WhatsApp. Verifique o número.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Valid phone: ${validPhone}`);

    // Anti-ban delay
    await antiBanDelay();

    // Send media via Evolution API
    const apiUrl = `${baseUrl}/message/sendMedia/${instanceName}`;
    console.log(`Sending ${mediaType} to ${validPhone} via ${apiUrl}`);

    const mediaBody: Record<string, unknown> = {
      number: validPhone,
      mediatype: mediaType,
      mimetype: mimeType,
      media: mediaUrl,
    };

    if (caption) mediaBody.caption = caption;
    if (fileName && mediaType === "document") mediaBody.fileName = fileName;

    const evolutionResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify(mediaBody),
    });

    const evolutionData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error("Evolution API media error:", evolutionData);
      return new Response(
        JSON.stringify({ success: false, error: evolutionData.message || "Failed to send media" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Media sent successfully:", evolutionData);

    // Save message to database
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let targetConversationId = conversationId;

    // If no conversation provided, try to find one
    if (!targetConversationId) {
      const phoneNormalized = `+${validPhone}`;
      const phoneWithoutCountry = validPhone.replace(/^55/, "");

      const { data: existingLead } = await adminClient
        .from("leads")
        .select("id")
        .or(`phone.eq.${validPhone},phone.eq.${phoneWithoutCountry},phone_normalized.eq.${phoneNormalized}`)
        .maybeSingle();

      if (existingLead?.id) {
        const { data: existingConv } = await adminClient
          .from("conversations")
          .select("id")
          .eq("lead_id", existingLead.id)
          .eq("channel", "whatsapp")
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingConv) {
          targetConversationId = existingConv.id;
        }
      }
    }

    // Save message
    const messageContent = caption || (mediaType === "image" ? "📷 Imagem" : "📄 Documento");
    
    if (targetConversationId) {
      await adminClient.from("messages").insert({
        conversation_id: targetConversationId,
        direction: "outbound",
        content: messageContent,
        message_type: mediaType,
        media_url: mediaUrl,
        provider: "evolution",
        sent_status: "sent",
        provider_payload: evolutionData,
      });

      await adminClient
        .from("conversations")
        .update({
          last_message_preview: messageContent.substring(0, 100),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", targetConversationId);

      console.log(`Media message saved to conversation ${targetConversationId}`);
    }

    // Log activity
    await adminClient.from("activity_log").insert({
      action: "whatsapp_media_sent",
      entity_type: "conversation",
      entity_id: targetConversationId || null,
      user_id: userId,
      metadata: {
        phone: validPhone,
        media_type: mediaType,
        mime_type: mimeType,
        file_name: fileName,
        media_url: mediaUrl,
        conversation_id: targetConversationId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: evolutionData.key?.id || evolutionData.id,
        phone: validPhone,
        evolutionData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending WhatsApp media:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
