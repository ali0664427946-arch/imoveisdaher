import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RETENTION_DAYS = 90;
const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`Archiving messages older than ${cutoffISO} (${RETENTION_DAYS} days)`);

    // Get distinct conversation IDs that have old messages
    const { data: oldMessages, error: fetchError } = await supabase
      .from("messages")
      .select("id, conversation_id, content, direction, message_type, media_url, sent_status, created_at, provider")
      .lt("created_at", cutoffISO)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching old messages:", fetchError);
      throw fetchError;
    }

    if (!oldMessages || oldMessages.length === 0) {
      console.log("No messages to archive");
      return new Response(
        JSON.stringify({ success: true, archived: 0, deleted: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group messages by conversation_id
    const byConversation: Record<string, typeof oldMessages> = {};
    for (const msg of oldMessages) {
      if (!byConversation[msg.conversation_id]) {
        byConversation[msg.conversation_id] = [];
      }
      byConversation[msg.conversation_id].push(msg);
    }

    let totalArchived = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    for (const [conversationId, msgs] of Object.entries(byConversation)) {
      try {
        // Create a date-based filename for this batch
        const oldestDate = msgs[0].created_at.split("T")[0];
        const newestDate = msgs[msgs.length - 1].created_at.split("T")[0];
        const fileName = `${conversationId}/${oldestDate}_to_${newestDate}_${Date.now()}.json`;

        // Check if there's already an archive file for this conversation
        // and merge if the date ranges overlap
        const archiveData = {
          conversation_id: conversationId,
          archived_at: new Date().toISOString(),
          message_count: msgs.length,
          date_range: { from: oldestDate, to: newestDate },
          messages: msgs.map(m => ({
            id: m.id,
            content: m.content,
            direction: m.direction,
            message_type: m.message_type,
            media_url: m.media_url,
            sent_status: m.sent_status,
            created_at: m.created_at,
            provider: m.provider,
          })),
        };

        const jsonContent = JSON.stringify(archiveData);
        const encoder = new TextEncoder();
        const fileBytes = encoder.encode(jsonContent);

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("archived-messages")
          .upload(fileName, fileBytes, {
            contentType: "application/json",
            upsert: false,
          });

        if (uploadError) {
          console.error(`Upload error for ${conversationId}:`, uploadError);
          errors.push(`Upload ${conversationId}: ${uploadError.message}`);
          continue;
        }

        totalArchived += msgs.length;

        // Delete archived messages from database
        const messageIds = msgs.map(m => m.id);
        
        // Delete in chunks of 100 to avoid query size limits
        for (let i = 0; i < messageIds.length; i += 100) {
          const chunk = messageIds.slice(i, i + 100);
          const { error: deleteError } = await supabase
            .from("messages")
            .delete()
            .in("id", chunk);

          if (deleteError) {
            console.error(`Delete error for ${conversationId}:`, deleteError);
            errors.push(`Delete ${conversationId}: ${deleteError.message}`);
          } else {
            totalDeleted += chunk.length;
          }
        }

        console.log(`Archived ${msgs.length} messages for conversation ${conversationId}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error archiving conversation ${conversationId}:`, errMsg);
        errors.push(`${conversationId}: ${errMsg}`);
      }
    }

    console.log(`Archive complete: ${totalArchived} archived, ${totalDeleted} deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        archived: totalArchived,
        deleted: totalDeleted,
        conversations_processed: Object.keys(byConversation).length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Archive error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
