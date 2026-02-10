import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ArchivedMessage {
  id: string;
  content: string | null;
  direction: "inbound" | "outbound";
  message_type: string | null;
  media_url: string | null;
  sent_status: string | null;
  created_at: string;
  provider: string | null;
  conversation_id?: string;
  // Mark as archived so UI can distinguish
  _archived?: boolean;
}

interface ArchiveFile {
  conversation_id: string;
  archived_at: string;
  message_count: number;
  date_range: { from: string; to: string };
  messages: ArchivedMessage[];
}

export function useArchivedMessages(conversationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["archived-messages", conversationId],
    queryFn: async (): Promise<ArchivedMessage[]> => {
      if (!conversationId) return [];

      // List all archive files for this conversation
      const { data: files, error: listError } = await supabase.storage
        .from("archived-messages")
        .list(conversationId, { sortBy: { column: "name", order: "asc" } });

      if (listError) {
        console.error("Error listing archived files:", listError);
        return [];
      }

      if (!files || files.length === 0) return [];

      // Download and parse each JSON file
      const allMessages: ArchivedMessage[] = [];

      for (const file of files) {
        if (!file.name.endsWith(".json")) continue;

        const { data: fileData, error: downloadError } = await supabase.storage
          .from("archived-messages")
          .download(`${conversationId}/${file.name}`);

        if (downloadError || !fileData) {
          console.error(`Error downloading archive ${file.name}:`, downloadError);
          continue;
        }

        try {
          const text = await fileData.text();
          const archive: ArchiveFile = JSON.parse(text);
          
          for (const msg of archive.messages) {
            allMessages.push({
              ...msg,
              conversation_id: conversationId,
              _archived: true,
            });
          }
        } catch (e) {
          console.error(`Error parsing archive ${file.name}:`, e);
        }
      }

      // Sort chronologically
      allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      return allMessages;
    },
    enabled: !!conversationId && enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
}
