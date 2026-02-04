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
      participant?: string; // Present in group messages - the actual sender
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
    // Group info fields that Evolution API may send
    groupMetadata?: {
      subject?: string; // Group name
      desc?: string;
      owner?: string;
    };
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

    // Handle all messages (incoming AND outgoing from phone)
    if (event === "messages.upsert" && data.key) {
      const remoteJid = data.key.remoteJid || "";
      const isGroup = remoteJid.includes("@g.us");
      
      // For groups, extract phone from participant; for individual, from remoteJid
      let phone: string;
      let groupName: string | null = null;
      
      if (isGroup) {
        // Group message - get actual sender from participant field
        const participant = data.key.participant || "";
        phone = participant.replace("@s.whatsapp.net", "").replace("55", "");
        
        // Try to get group name from metadata or use JID as fallback
        groupName = data.groupMetadata?.subject || null;
        
        // If no group name in metadata, we'll try to fetch it later
        if (!groupName) {
          // Extract group ID for logging
          const groupId = remoteJid.replace("@g.us", "");
          console.log(`Group message from group ID: ${groupId}, participant: ${phone}`);
        }
      } else {
        // Individual message
        phone = remoteJid.replace("@s.whatsapp.net", "").replace("55", "");
      }
      
      const messageContent = data.message?.conversation || data.message?.extendedTextMessage?.text || "";
      const senderName = data.pushName || "Desconhecido";
      const isFromMe = data.key.fromMe || false;
      
      console.log(`${isFromMe ? 'Outgoing' : 'Incoming'} ${isGroup ? 'GROUP' : ''} message ${isFromMe ? 'to' : 'from'} ${phone}: ${messageContent}`);

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
      } else if (!isFromMe) {
        // Only create new lead for incoming messages (not outgoing)
        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert({
            name: senderName,
            phone: phone,
            phone_normalized: `+55${phone}`,
            origin: "whatsapp",
            status: "entrou_em_contato",
          })
          .select("id")
          .single();

        if (leadError) {
          console.error("Error creating lead:", leadError);
        } else {
          leadId = newLead.id;
        }
      }

      // For outgoing messages without a lead, we can't save (need existing conversation)
      if (!leadId && isFromMe) {
        console.log("Outgoing message but no existing lead found, skipping...");
        return new Response(
          JSON.stringify({ success: true, skipped: "no_lead_for_outgoing" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!leadId) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not find or create lead" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find or create conversation
      let conversationId: string | null = null;
      
      // For groups, also match by external_thread_id (the group JID)
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id, is_group, group_name")
        .eq("lead_id", leadId)
        .eq("channel", "whatsapp")
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
        
        // If it's a group and we now have a group name but didn't before, update it
        if (isGroup && groupName && !existingConv.group_name) {
          await supabase
            .from("conversations")
            .update({ 
              is_group: true, 
              group_name: groupName,
              external_thread_id: remoteJid 
            })
            .eq("id", conversationId);
        }
      } else {
        // Create new conversation with group info if applicable
        const insertData: Record<string, unknown> = {
          lead_id: leadId,
          channel: "whatsapp",
          unread_count: 1,
          is_group: isGroup,
        };
        
        if (isGroup) {
          insertData.external_thread_id = remoteJid;
          if (groupName) {
            insertData.group_name = groupName;
          }
        }
        
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert(insertData)
          .select("id")
          .single();

        if (convError) {
          console.error("Error creating conversation:", convError);
        } else {
          conversationId = newConv.id;
          
          // If it's a group and we don't have the name yet, try to fetch it
          if (isGroup && !groupName) {
            try {
              const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
              const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
              const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");
              
              if (evolutionUrl && evolutionKey && instanceName) {
                const groupInfoRes = await fetch(
                  `${evolutionUrl}/group/findGroupInfos/${instanceName}`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "apikey": evolutionKey,
                    },
                    body: JSON.stringify({ groupJid: remoteJid }),
                  }
                );
                
                if (groupInfoRes.ok) {
                  const groupInfo = await groupInfoRes.json();
                  const fetchedGroupName = groupInfo?.subject || groupInfo?.groupMetadata?.subject;
                  
                  if (fetchedGroupName) {
                    await supabase
                      .from("conversations")
                      .update({ group_name: fetchedGroupName })
                      .eq("id", conversationId);
                    
                    console.log(`Updated group name to: ${fetchedGroupName}`);
                  }
                }
              }
            } catch (groupError) {
              console.error("Error fetching group info:", groupError);
            }
          }
        }
      }

      if (conversationId) {
        // Insert message with correct direction based on fromMe
        const { error: msgError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            content: messageContent,
            direction: isFromMe ? "outbound" : "inbound",
            message_type: data.messageType || "text",
            sent_status: isFromMe ? "sent" : "received",
            provider: "evolution",
            provider_payload: data,
          });

        if (msgError) {
          console.error("Error inserting message:", msgError);
        }

        // Update conversation - only increment unread for incoming messages
        const updateData: Record<string, unknown> = {
          last_message_at: new Date().toISOString(),
          last_message_preview: messageContent.slice(0, 100),
        };

        if (!isFromMe) {
          // Only increment unread count for incoming messages
          const { data: currentConv } = await supabase
            .from("conversations")
            .select("unread_count")
            .eq("id", conversationId)
            .single();
          
          updateData.unread_count = (currentConv?.unread_count || 0) + 1;
        }

        await supabase
          .from("conversations")
          .update(updateData)
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
