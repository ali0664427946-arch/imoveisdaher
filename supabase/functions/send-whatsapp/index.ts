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
  // Clean the phone number
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
        phone: validPhone,
        original_phone: phone,
        message_preview: message.substring(0, 100),
        evolution_message_id: evolutionData.key?.id || evolutionData.id,
        auto_corrected_ddd: phone !== validPhone,
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
