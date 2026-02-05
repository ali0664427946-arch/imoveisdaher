import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Processing scheduled messages...");

    // Use service role for background job
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Get pending messages that are due
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching scheduled messages:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingMessages?.length || 0} messages to send`);

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No pending messages" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const msg of pendingMessages) {
      try {
        // Normalize phone number
        let normalizedPhone = msg.phone.replace(/\D/g, "");
        if (!normalizedPhone.startsWith("55")) {
          normalizedPhone = "55" + normalizedPhone;
        }

        console.log(`Sending scheduled message to ${normalizedPhone}`);

        // Send via Evolution API
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
              text: msg.message,
            }),
          }
        );

        const evolutionData = await evolutionResponse.json();

        if (evolutionResponse.ok) {
          // Mark as sent
          await supabase
            .from("scheduled_messages")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              metadata: { ...msg.metadata, evolution_response: evolutionData },
            })
            .eq("id", msg.id);

          // Save message to messages table if conversation exists
          let targetConversationId = msg.conversation_id;
          
          if (!targetConversationId && msg.lead_id) {
            // Find or create conversation for the lead
            const { data: existingConv } = await supabase
              .from("conversations")
              .select("id")
              .eq("lead_id", msg.lead_id)
              .eq("channel", "whatsapp")
              .maybeSingle();

            if (existingConv) {
              targetConversationId = existingConv.id;
            } else {
              // Create new conversation
              const { data: newConv } = await supabase
                .from("conversations")
                .insert({
                  lead_id: msg.lead_id,
                  channel: "whatsapp",
                  last_message_preview: msg.message.substring(0, 100),
                  last_message_at: new Date().toISOString(),
                  unread_count: 0,
                })
                .select("id")
                .single();
              targetConversationId = newConv?.id;
            }
          }

          if (targetConversationId) {
            // Insert message into messages table
            await supabase.from("messages").insert({
              conversation_id: targetConversationId,
              direction: "outbound",
              content: msg.message,
              message_type: "text",
              provider: "evolution",
              sent_status: "sent",
              provider_payload: evolutionData,
            });

            // Update conversation last message
            await supabase
              .from("conversations")
              .update({
                last_message_preview: msg.message.substring(0, 100),
                last_message_at: new Date().toISOString(),
              })
              .eq("id", targetConversationId);

            console.log(`Scheduled message saved to conversation ${targetConversationId}`);
          }

          // Log activity
          await supabase.from("activity_log").insert({
            action: "scheduled_whatsapp_sent",
            entity_type: msg.lead_id ? "lead" : msg.ficha_id ? "ficha" : "scheduled_message",
            entity_id: msg.lead_id || msg.ficha_id || msg.id,
            user_id: msg.created_by,
            metadata: {
              phone: normalizedPhone,
              message_preview: msg.message.substring(0, 100),
              scheduled_at: msg.scheduled_at,
              conversation_id: targetConversationId,
            },
          });

          sentCount++;
          console.log(`Message ${msg.id} sent successfully`);
        } else {
          // Mark as failed
          await supabase
            .from("scheduled_messages")
            .update({
              status: "failed",
              error_message: evolutionData.message || "Failed to send",
              metadata: { ...msg.metadata, evolution_error: evolutionData },
            })
            .eq("id", msg.id);

          failedCount++;
          console.error(`Message ${msg.id} failed:`, evolutionData);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await supabase
          .from("scheduled_messages")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", msg.id);

        failedCount++;
        console.error(`Error sending message ${msg.id}:`, error);
      }

      // Small delay between messages to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`Processed ${sentCount + failedCount} messages: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: pendingMessages.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing scheduled messages:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
