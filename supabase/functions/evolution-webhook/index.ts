import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Evolution API webhook event types
type EventType = 
  | "messages.upsert" // Incoming message
  | "messages.update" // Message status update (delivered, read)
  | "connection.update" // Connection status
  | "qrcode.updated"; // QR code update

interface EvolutionWebhookPayload {
  event: EventType;
  instance: string;
  data: {
    key?: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
    };
    messageType?: string;
    pushName?: string;
    status?: string; // "DELIVERY_ACK" | "READ" | "PLAYED"
    messageTimestamp?: number;
  };
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

    const payload: EvolutionWebhookPayload = await req.json();
    
    console.log("Evolution webhook received:", JSON.stringify(payload, null, 2));

    const { event, data, instance } = payload;

    // Handle incoming messages
    if (event === "messages.upsert" && data.key && !data.key.fromMe) {
      const phone = data.key.remoteJid?.replace("@s.whatsapp.net", "").replace("55", "");
      const messageContent = data.message?.conversation || data.message?.extendedTextMessage?.text || "";
      const senderName = data.pushName || "Desconhecido";
      
      console.log(`Incoming message from ${phone}: ${messageContent}`);

      // Find or create lead by phone
      let leadId: string | null = null;
      
      // Try to find existing lead by phone (normalized)
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .or(`phone.ilike.%${phone}%,phone_normalized.ilike.%${phone}%`)
        .maybeSingle();

      if (existingLead) {
        leadId = existingLead.id;
      } else {
        // Create new lead
        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert({
            name: senderName,
            phone: phone,
            phone_normalized: `+55${phone}`,
            origin: "whatsapp",
            status: "novo",
          })
          .select("id")
          .single();

        if (leadError) {
          console.error("Error creating lead:", leadError);
        } else {
          leadId = newLead.id;
        }
      }

      if (!leadId) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not find or create lead" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find or create conversation
      let conversationId: string | null = null;
      
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("lead_id", leadId)
        .eq("channel", "whatsapp")
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            lead_id: leadId,
            channel: "whatsapp",
            unread_count: 1,
          })
          .select("id")
          .single();

        if (convError) {
          console.error("Error creating conversation:", convError);
        } else {
          conversationId = newConv.id;
        }
      }

      if (conversationId) {
        // Insert message
        const { error: msgError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            content: messageContent,
            direction: "inbound",
            message_type: data.messageType || "text",
            sent_status: "received",
            provider: "evolution",
            provider_payload: data,
          });

        if (msgError) {
          console.error("Error inserting message:", msgError);
        }

        // Update conversation with last message and increment unread
        const { data: currentConv } = await supabase
          .from("conversations")
          .select("unread_count")
          .eq("id", conversationId)
          .single();

        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: messageContent.slice(0, 100),
            unread_count: (currentConv?.unread_count || 0) + 1,
          })
          .eq("id", conversationId);

        console.log(`Message saved to conversation ${conversationId}`);
      }
    }

    // Handle message status updates (delivered, read)
    if (event === "messages.update" && data.key && data.status) {
      const messageId = data.key.id;
      let newStatus = "sent";

      switch (data.status) {
        case "DELIVERY_ACK":
          newStatus = "delivered";
          break;
        case "READ":
        case "PLAYED":
          newStatus = "read";
          break;
      }

      console.log(`Message ${messageId} status updated to: ${newStatus}`);

      // Update message status by provider_payload
      const { error: updateError } = await supabase
        .from("messages")
        .update({ sent_status: newStatus })
        .filter("provider_payload->key->id", "eq", messageId);

      if (updateError) {
        console.error("Error updating message status:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
