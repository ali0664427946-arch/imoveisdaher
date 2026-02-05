import { createClient } from "npm:@supabase/supabase-js@2.91.1";

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

// Common Brazilian DDD codes to try (most populous regions first)
const COMMON_DDDS = ["21", "11", "31", "41", "51", "61", "71", "81", "19", "27", "47", "48", "85", "62", "84", "83", "82", "79", "98", "92"];

// Anti-ban delay: random between 2-9 seconds
async function antiBanDelay(): Promise<void> {
  const delayMs = Math.floor(Math.random() * 7000) + 2000; // 2000-9000ms
  console.log(`Anti-ban delay: ${delayMs}ms`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

// Check if a number exists on WhatsApp using Evolution API
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
      body: JSON.stringify({
        numbers: [phone],
      }),
    });

    if (!response.ok) {
      console.log(`WhatsApp check failed for ${phone}:`, response.status);
      return { exists: false };
    }

    const data = await response.json();
    console.log(`WhatsApp check result for ${phone}:`, JSON.stringify(data));

    // The API returns an array of results
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

// Find a valid WhatsApp number by trying different DDDs
async function findValidWhatsAppNumber(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  originalPhone: string
): Promise<{ validPhone: string | null; jid?: string }> {
  // Check if it's a group JID format (e.g., "21981366125-1553634143@g.us")
  if (originalPhone.includes("@g.us")) {
    console.log(`Detected group JID format: ${originalPhone}`);
    // Extract the first phone number from the group JID (before the hyphen)
    const groupMatch = originalPhone.match(/^(\d+)-/);
    if (groupMatch) {
      const extractedPhone = groupMatch[1];
      console.log(`Extracted phone from group JID: ${extractedPhone}`);
      // Continue with this extracted phone
      const fullNumber = extractedPhone.startsWith("55") ? extractedPhone : `55${extractedPhone}`;
      const check = await checkWhatsAppNumber(baseUrl, apiKey, instanceName, fullNumber);
      if (check.exists) {
        return { validPhone: fullNumber, jid: check.jid };
      }
    }
    // If we can't extract or validate, return null
    return { validPhone: null };
  }

  // Check if it's a LID format (e.g., "57788801761502@lid") - used for group participants
  // LID format cannot be used to send messages directly - need to look up the actual phone
  if (originalPhone.includes("@lid") || originalPhone.includes("@")) {
    console.log(`Detected LID/special format: ${originalPhone} - cannot send direct message`);
    return { validPhone: null };
  }

  // Clean the phone number (remove non-digits)
  let cleanPhone = originalPhone.replace(/\D/g, "");
  
  // If already starts with 55 and has full length (13 digits for mobile), check directly
  if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
    const check = await checkWhatsAppNumber(baseUrl, apiKey, instanceName, cleanPhone);
    if (check.exists) {
      return { validPhone: cleanPhone, jid: check.jid };
    }
  }
  
  // Remove country code if present for DDD testing
  if (cleanPhone.startsWith("55")) {
    cleanPhone = cleanPhone.substring(2);
  }
  
  // If the number already has a valid DDD (2 digits + 8-9 digit number)
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    const fullNumber = `55${cleanPhone}`;
    const check = await checkWhatsAppNumber(baseUrl, apiKey, instanceName, fullNumber);
    if (check.exists) {
      return { validPhone: fullNumber, jid: check.jid };
    }
  }
  
  // If number is 8-9 digits (no DDD), try common DDDs
  if (cleanPhone.length >= 8 && cleanPhone.length <= 9) {
    console.log(`Phone ${cleanPhone} has no DDD, trying common DDDs...`);
    
    for (const ddd of COMMON_DDDS) {
      const testNumber = `55${ddd}${cleanPhone}`;
      console.log(`Trying DDD ${ddd}: ${testNumber}`);
      
      const check = await checkWhatsAppNumber(baseUrl, apiKey, instanceName, testNumber);
      if (check.exists) {
        console.log(`Found valid WhatsApp number with DDD ${ddd}: ${testNumber}`);
        return { validPhone: testNumber, jid: check.jid };
      }
    }
  }
  
  return { validPhone: null };
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

    const baseUrl = evolutionUrl.replace(/\/+$/, ""); // Remove trailing slashes

    // Find valid WhatsApp number (auto-detect DDD if needed)
    console.log(`Looking for valid WhatsApp number for: ${phone}`);
    const { validPhone, jid } = await findValidWhatsAppNumber(baseUrl, evolutionKey, instanceName, phone);

    if (!validPhone) {
      console.error(`No valid WhatsApp found for phone: ${phone}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Número não encontrado no WhatsApp. Verifique se o número está correto e inclui o DDD.",
          details: "O sistema tentou DDDs comuns mas não encontrou uma conta WhatsApp válida."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Valid WhatsApp number found: ${validPhone}`);

    // Apply anti-ban delay (unless skipped for scheduled messages)
    if (!skipDelay) {
      await antiBanDelay();
    }

    console.log(`Sending WhatsApp message to ${validPhone}`);

    // Build API URL
    const apiUrl = `${baseUrl}/message/sendText/${instanceName}`;
    console.log(`API URL: ${apiUrl}`);

    // Send message via Evolution API
    const evolutionResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: validPhone,
        text: message,
      }),
    });

    const evolutionData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error("Evolution API error:", evolutionData);
      return new Response(
        JSON.stringify({ success: false, error: evolutionData.message || "Failed to send message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Message sent successfully:", evolutionData);

    // Update lead phone if we found a different valid number
    const originalClean = phone.replace(/\D/g, "");
    const validClean = validPhone.replace(/^55/, ""); // Remove country code for storage
    
    if (originalClean !== validClean && !originalClean.startsWith(validClean.substring(0, 2))) {
      // The phone was corrected with a DDD, update the lead
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Find and update the lead with the correct phone
      if (conversationId) {
        const { data: conv } = await adminClient
          .from("conversations")
          .select("lead_id")
          .eq("id", conversationId)
          .single();

        if (conv?.lead_id) {
          await adminClient
            .from("leads")
            .update({ 
              phone: validClean, 
              phone_normalized: `+${validPhone}` 
            })
            .eq("id", conv.lead_id);
          console.log(`Updated lead ${conv.lead_id} phone to ${validClean}`);
        }
      }
    }

    // Save message to database and log activity
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine or create conversation for the message
    let targetConversationId = conversationId;
    
    if (!targetConversationId) {
      // Try to find existing conversation by phone
      const phoneNormalized = `+${validPhone}`;
      const { data: existingConv } = await adminClient
        .from("conversations")
        .select("id, lead_id")
        .eq("channel", "whatsapp")
        .limit(1)
        .maybeSingle();

      // If no conversation exists, try to find or create lead and conversation
      if (!existingConv) {
        // Find lead by phone
        const { data: existingLead } = await adminClient
          .from("leads")
          .select("id")
          .or(`phone.eq.${validPhone},phone_normalized.eq.${phoneNormalized}`)
          .maybeSingle();

        let leadId = existingLead?.id;

        // Create lead if not exists
        if (!leadId) {
          const { data: newLead } = await adminClient
            .from("leads")
            .insert({
              name: `WhatsApp ${validPhone}`,
              phone: validPhone.replace(/^55/, ""),
              phone_normalized: phoneNormalized,
              origin: fichaId ? "ficha" : "whatsapp",
            })
            .select("id")
            .single();
          leadId = newLead?.id;
        }

        if (leadId) {
          // Create conversation
          const { data: newConv } = await adminClient
            .from("conversations")
            .insert({
              lead_id: leadId,
              channel: "whatsapp",
              last_message_preview: message.substring(0, 100),
              last_message_at: new Date().toISOString(),
              unread_count: 0,
            })
            .select("id")
            .single();
          targetConversationId = newConv?.id;
        }
      } else {
        targetConversationId = existingConv.id;
      }
    }

    // Save message to messages table
    if (targetConversationId) {
      await adminClient.from("messages").insert({
        conversation_id: targetConversationId,
        direction: "outbound",
        content: message,
        message_type: "text",
        provider: "evolution",
        sent_status: "sent",
        provider_payload: evolutionData,
      });

      // Update conversation last message
      await adminClient
        .from("conversations")
        .update({
          last_message_preview: message.substring(0, 100),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", targetConversationId);

      console.log(`Message saved to conversation ${targetConversationId}`);
    }

    // Log activity
    await adminClient.from("activity_log").insert({
      action: "whatsapp_sent",
      entity_type: fichaId ? "ficha" : conversationId ? "conversation" : "message",
      entity_id: fichaId || targetConversationId || null,
      user_id: userId,
      metadata: {
        phone: validPhone,
        original_phone: phone,
        message_preview: message.substring(0, 100),
        evolution_message_id: evolutionData.key?.id || evolutionData.id,
        auto_corrected_ddd: phone !== validPhone,
        conversation_id: targetConversationId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: evolutionData.key?.id || evolutionData.id,
        phone: validPhone,
        autoCorrected: phone !== validPhone,
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
