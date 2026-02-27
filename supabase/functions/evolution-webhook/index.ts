// Evolution API Webhook Handler - v3
import { createClient } from "npm:@supabase/supabase-js@2.91.1";
import { decode as decodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  console.log("Evolution webhook received request");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET health-check from Evolution API (v2 sends GET to verify webhook URL)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", webhook: "evolution-webhook" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
      
      // Helper: extract clean phone from JID, removing country code 55 from start only
      function cleanPhoneFromJid(jid: string): string {
        const raw = jid
          .replace("@s.whatsapp.net", "")
          .replace("@lid", "");
        // Only remove country code "55" from the START of the number
        return raw.startsWith("55") ? raw.substring(2) : raw;
      }

      if (isGroup) {
        // Group message - get actual sender from participant field
        // First try participantAlt (actual phone) then participant (may be LID)
        const participantAlt = (data.key as { participantAlt?: string }).participantAlt || "";
        const participant = data.key.participant || "";
        
        // Prefer participantAlt as it contains the actual phone number
        const phoneSource = participantAlt.includes("@s.whatsapp.net") 
          ? participantAlt 
          : participant;
        
        phone = cleanPhoneFromJid(phoneSource);
        
        // Try to get group name from metadata or use JID as fallback
        groupName = data.groupMetadata?.subject || null;
        
        if (!groupName) {
          const groupId = remoteJid.replace("@g.us", "");
          console.log(`Group message from group ID: ${groupId}, participant: ${phone}`);
        }
      } else {
        // Individual message - prefer remoteJidAlt (actual phone) over remoteJid (may be LID)
        const remoteJidAlt = (data.key as { remoteJidAlt?: string }).remoteJidAlt || "";
        const phoneSource = remoteJidAlt.includes("@s.whatsapp.net")
          ? remoteJidAlt
          : remoteJid;
        
        phone = cleanPhoneFromJid(phoneSource);
      }
      
      // Extract message content - support text, images, audio, video, documents, stickers
      let messageContent = "";
      let messageType = data.messageType || "text";
      let mediaUrl: string | null = null;
      let needsMediaDownload = false;
      
      const msg = data.message as Record<string, unknown> | undefined;
      
      if (msg?.conversation) {
        messageContent = msg.conversation as string;
      } else if (msg?.extendedTextMessage) {
        const extMsg = msg.extendedTextMessage as { text?: string };
        messageContent = extMsg.text || "";
      } else if (msg?.imageMessage) {
        const imgMsg = msg.imageMessage as { caption?: string; url?: string; directPath?: string };
        messageContent = imgMsg.caption || "📷 Imagem";
        messageType = "image";
        needsMediaDownload = true;
      } else if (msg?.audioMessage) {
        messageContent = "🎵 Áudio";
        messageType = "audio";
        needsMediaDownload = true;
      } else if (msg?.videoMessage) {
        const vidMsg = msg.videoMessage as { caption?: string };
        messageContent = vidMsg.caption || "🎬 Vídeo";
        messageType = "video";
        needsMediaDownload = true;
      } else if (msg?.documentMessage) {
        const docMsg = msg.documentMessage as { fileName?: string; title?: string };
        messageContent = `📎 ${docMsg.fileName || docMsg.title || "Documento"}`;
        messageType = "document";
        needsMediaDownload = true;
      } else if (msg?.stickerMessage) {
        messageContent = "🎨 Sticker";
        messageType = "sticker";
      } else if (msg?.contactMessage) {
        const contactMsg = msg.contactMessage as { displayName?: string };
        messageContent = `👤 Contato: ${contactMsg.displayName || "Desconhecido"}`;
        messageType = "contact";
      } else if (msg?.locationMessage) {
        messageContent = "📍 Localização";
        messageType = "location";
      }
      
      const senderName = data.pushName || "Desconhecido";
      const isFromMe = data.key.fromMe || false;
      
      console.log(`${isFromMe ? 'Outgoing' : 'Incoming'} ${isGroup ? 'GROUP' : ''} message ${isFromMe ? 'to' : 'from'} ${phone}: ${messageContent}`);

      // Find or create lead by phone
      let leadId: string | null = null;
      
      // Try to find existing lead by phone using exact matches on multiple formats
      const phoneWith55 = phone.startsWith("55") ? phone : `55${phone}`;
      const phoneWithout55 = phone.startsWith("55") ? phone.substring(2) : phone;
      const phoneNormalized = `+${phoneWith55}`;
      
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("id")
        .or(`phone.eq.${phone},phone.eq.${phoneWith55},phone.eq.${phoneWithout55},phone_normalized.eq.${phoneNormalized}`)
        .limit(1);

      if (existingLeads && existingLeads.length > 0) {
        leadId = existingLeads[0].id;
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

      // Helper function to fetch group name from Evolution API
      async function fetchGroupName(groupJid: string): Promise<string | null> {
        try {
          const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
          const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
          const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");
          
          if (!evolutionUrl || !evolutionKey || !instanceName) {
            return null;
          }
          
          const groupInfoRes = await fetch(
            `${evolutionUrl}/group/findGroupInfos/${instanceName}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": evolutionKey,
              },
              body: JSON.stringify({ groupJid }),
            }
          );
          
          if (groupInfoRes.ok) {
            const groupInfo = await groupInfoRes.json();
            const fetchedName = groupInfo?.subject || groupInfo?.groupMetadata?.subject || groupInfo?.name;
            console.log(`Fetched group info:`, JSON.stringify(groupInfo));
            return fetchedName || null;
          }
          return null;
        } catch (error) {
          console.error("Error fetching group info:", error);
          return null;
        }
      }

      // Helper function to download media from Evolution API and re-host it
      async function downloadAndHostMedia(
        messageKey: Record<string, unknown>,
        messageType: string,
        conversationId: string,
      ): Promise<string | null> {
        try {
          const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
          const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
          const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

          if (!evolutionUrl || !evolutionKey || !instanceName) {
            console.log("Evolution API config missing, skipping media download");
            return null;
          }

          console.log(`Downloading media via getBase64FromMediaMessage for key: ${messageKey.id}`);

          const res = await fetch(
            `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": evolutionKey,
              },
              body: JSON.stringify({
                message: { key: messageKey },
                convertToMp4: false,
              }),
            }
          );

          if (!res.ok) {
            console.error(`getBase64 failed with status ${res.status}: ${await res.text()}`);
            return null;
          }

          const result = await res.json();
          const base64Data: string | undefined = result?.base64;
          const mimeType: string | undefined = result?.mimetype || result?.mimeType;

          if (!base64Data) {
            console.error("No base64 data in response");
            return null;
          }

          // Clean base64 string (remove data URI prefix if present)
          const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");

          // Determine file extension from mime type
          const extMap: Record<string, string> = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
            "application/pdf": "pdf",
            "video/mp4": "mp4",
            "audio/ogg": "ogg",
            "audio/mpeg": "mp3",
            "audio/mp4": "m4a",
          };
          const ext = (mimeType && extMap[mimeType]) || "bin";
          const contentType = mimeType || "application/octet-stream";

          // Decode base64 to bytes
          const fileBytes = decodeBase64(cleanBase64);
          const filePath = `${conversationId}/${Date.now()}_recv.${ext}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("inbox-media")
            .upload(filePath, fileBytes, { contentType, upsert: false });

          if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return null;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("inbox-media")
            .getPublicUrl(filePath);

          console.log(`Media re-hosted successfully: ${urlData.publicUrl}`);
          return urlData.publicUrl;
        } catch (error) {
          console.error("downloadAndHostMedia error:", error);
          return null;
        }
      }

      // Find or create conversation
      let conversationId: string | null = null;
      
      // For groups, try to match by external_thread_id first, then by lead
      let existingConv = null;
      
      if (isGroup) {
        // For groups, match by the group JID (external_thread_id)
        const { data: groupConvs } = await supabase
          .from("conversations")
          .select("id, is_group, group_name")
          .eq("external_thread_id", remoteJid)
          .eq("channel", "whatsapp")
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(1);
        
        existingConv = groupConvs?.[0] || null;
      }
      
      if (!existingConv) {
        // Fallback to lead-based matching
        const { data: leadConvs } = await supabase
          .from("conversations")
          .select("id, is_group, group_name")
          .eq("lead_id", leadId)
          .eq("channel", "whatsapp")
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(1);
        
        existingConv = leadConvs?.[0] || null;
      }

      if (existingConv) {
        conversationId = existingConv.id;
        
        // If it's a group and we don't have a group name, try to fetch it
        if (isGroup && !existingConv.group_name) {
          // First check if we have it in payload
          if (!groupName) {
            groupName = await fetchGroupName(remoteJid);
          }
          
          if (groupName) {
            await supabase
              .from("conversations")
              .update({ 
                is_group: true, 
                group_name: groupName,
                external_thread_id: remoteJid 
              })
              .eq("id", conversationId);
            
            console.log(`Updated group name to: ${groupName}`);
          }
        }
      } else {
        // For groups, try to fetch the group name before creating
        if (isGroup && !groupName) {
          groupName = await fetchGroupName(remoteJid);
        }
        
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
        }
      }

      if (conversationId) {
        // Download and re-host media if needed (images, documents, audio, video)
        if (needsMediaDownload && data.key) {
          mediaUrl = await downloadAndHostMedia(data.key as Record<string, unknown>, messageType, conversationId);
          if (!mediaUrl) {
            console.log(`Could not download media for message type ${messageType}, saving without media URL`);
          }
        }

        // Insert message with correct direction based on fromMe
        // Only save minimal provider metadata (not the full heavy payload)
        const minimalPayload = {
          key: data.key ? { id: data.key.id, remoteJid: data.key.remoteJid, fromMe: data.key.fromMe } : null,
          pushName: data.pushName,
          messageType: messageType,
        };

        const messageInsertData: Record<string, unknown> = {
          conversation_id: conversationId,
          content: messageContent,
          direction: isFromMe ? "outbound" : "inbound",
          message_type: messageType,
          sent_status: isFromMe ? "sent" : "received",
          provider: "evolution",
          provider_payload: minimalPayload,
        };
        
        // Add media URL if present
        if (mediaUrl) {
          messageInsertData.media_url = mediaUrl;
        }
        
        const { error: msgError } = await supabase
          .from("messages")
          .insert(messageInsertData);

        if (msgError) {
          console.error("Error inserting message:", msgError);
        }

        // Update conversation - only increment unread for incoming messages
        // Reopen archived conversations on new inbound messages
        const updateData: Record<string, unknown> = {
          last_message_at: new Date().toISOString(),
          last_message_preview: messageContent.slice(0, 100),
        };

        if (!isFromMe) {
          updateData.archived = false;
        }

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
