import { useState, useEffect, useRef } from "react";
import { Search, Phone, MoreVertical, Send, Paperclip, Smile, MessageSquare, Loader2, Check, CheckCheck, Clock as ClockIcon, Pencil, Archive, ArchiveRestore, Filter, Image, FileText, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ScheduleMessageDialog } from "@/components/whatsapp/ScheduleMessageDialog";
import { EditLeadDialog } from "@/components/leads/EditLeadDialog";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
const channelColors: Record<string, string> = {
  whatsapp: "bg-success text-success-foreground",
  olx_chat: "bg-amber-500 text-white",
  internal: "bg-blue-500 text-white",
  email: "bg-purple-500 text-white",
};

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  olx_chat: "OLX",
  internal: "Interno",
  email: "Email",
};

// Message status indicator component
function MessageStatusIcon({ status, direction }: { status: string | null; direction: string }) {
  if (direction !== "outbound") return null;
  
  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    sending: {
      icon: <ClockIcon className="w-3 h-3" />,
      label: "Enviando...",
      color: "text-muted-foreground",
    },
    sent: {
      icon: <Check className="w-3 h-3" />,
      label: "Enviado",
      color: "text-muted-foreground",
    },
    delivered: {
      icon: <CheckCheck className="w-3 h-3" />,
      label: "Entregue",
      color: "text-muted-foreground",
    },
    read: {
      icon: <CheckCheck className="w-3 h-3" />,
      label: "Lido",
      color: "text-blue-400",
    },
    failed: {
      icon: <span className="text-destructive text-[10px]">!</span>,
      label: "Falhou",
      color: "text-destructive",
    },
  };
  
  const config = statusConfig[status || "sent"] || statusConfig.sent;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ml-1 ${config.color}`}>
            {config.icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {config.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const MAX_FILE_SIZE_MB = 10;

export default function Inbox() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to realtime updates for messages
  useEffect(() => {
    const channel = supabase
      .channel("inbox-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("Realtime message update:", payload);
          // Refresh messages when there's any change
          queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId, queryClient]);

  // Fetch conversations with lead info
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          lead:leads(id, name, phone, property:properties(title, neighborhood, price))
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedConversationId,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversationId) {
      supabase
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", selectedConversationId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        });
    }
  }, [selectedConversationId, queryClient]);

  // Send message mutation - now sends via WhatsApp API
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversationId) throw new Error("Nenhuma conversa selecionada");
      
      const conversation = conversations.find(c => c.id === selectedConversationId);
      
      // For group conversations, use the group JID (external_thread_id)
      // For individual conversations, use the lead's phone
      let phone: string | undefined;
      
      if (conversation?.is_group && conversation?.external_thread_id) {
        phone = conversation.external_thread_id; // e.g. "120363401372992755@g.us"
      } else {
        phone = conversation?.lead?.phone;
      }
      
      if (!phone) {
        throw new Error("Lead não possui telefone cadastrado");
      }

      // First, try to send via WhatsApp if it's a WhatsApp channel
      if (conversation?.channel === "whatsapp" || conversation?.channel === "olx_chat") {
        console.log("Sending message via WhatsApp API...", { phone, isGroup: conversation?.is_group });
        
        const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke("send-whatsapp", {
          body: { 
            phone, 
            message: content, 
            conversationId: selectedConversationId,
          },
        });

        if (whatsappError) {
          console.error("WhatsApp send error:", whatsappError);
          throw new Error(whatsappError.message || "Erro ao enviar via WhatsApp");
        }

        if (!whatsappResult?.success) {
          throw new Error(whatsappResult?.error || "Falha ao enviar mensagem via WhatsApp");
        }

        console.log("WhatsApp message sent successfully:", whatsappResult);
        
        // Edge function already saved message and updated conversation
        // No need to save again here to avoid duplicates
        return whatsappResult;
      }

      // For non-WhatsApp channels, save message directly
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: selectedConversationId,
          content,
          direction: "outbound",
          message_type: "text",
          sent_status: "sent",
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation preview
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.slice(0, 100),
        })
        .eq("id", selectedConversationId);

      return data;
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({
        title: "Mensagem enviada!",
        description: "A mensagem foi enviada via WhatsApp com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch = conv.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.lead?.phone?.includes(searchTerm);
    const matchesArchived = showArchived ? conv.archived === true : conv.archived !== true;
    return matchesSearch && matchesArchived;
  });

  const archivedCount = conversations.filter((c) => c.archived === true).length;

  const toggleArchive = async (conversationId: string, archive: boolean) => {
    const { error } = await supabase
      .from("conversations")
      .update({ archived: archive })
      .eq("id", conversationId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: archive ? "Conversa encerrada" : "Conversa reaberta",
      description: archive
        ? "A conversa foi movida para o arquivo"
        : "A conversa voltou para a lista principal",
    });

    if (archive && selectedConversationId === conversationId) {
      setSelectedConversationId(null);
    }

    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  // File selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Envie apenas imagens (JPG, PNG, WebP, GIF) ou PDFs.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: `O limite é ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Send media file
  const handleSendMedia = async () => {
    if (!selectedFile || !selectedConversationId) return;

    const conversation = conversations.find(c => c.id === selectedConversationId);
    let phone: string | undefined;

    if (conversation?.is_group && conversation?.external_thread_id) {
      phone = conversation.external_thread_id;
    } else {
      phone = conversation?.lead?.phone;
    }

    if (!phone) {
      toast({ title: "Erro", description: "Lead não possui telefone.", variant: "destructive" });
      return;
    }

    setIsSendingMedia(true);

    try {
      // 1. Upload file to storage
      const fileExt = selectedFile.name.split(".").pop() || "bin";
      const filePath = `${selectedConversationId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("inbox-media")
        .upload(filePath, selectedFile, { contentType: selectedFile.type });

      if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("inbox-media")
        .getPublicUrl(filePath);

      const mediaUrl = urlData.publicUrl;

      // 3. Determine media type
      const isImage = selectedFile.type.startsWith("image/");
      const mediaType = isImage ? "image" : "document";

      // 4. Send via edge function
      const { data, error } = await supabase.functions.invoke("send-whatsapp-media", {
        body: {
          phone,
          mediaUrl,
          mediaType,
          mimeType: selectedFile.type,
          fileName: selectedFile.name,
          caption: messageText.trim() || undefined,
          conversationId: selectedConversationId,
        },
      });

      if (error) throw new Error(error.message || "Erro ao enviar mídia");
      if (!data?.success) throw new Error(data?.error || "Falha ao enviar mídia");

      toast({
        title: "Arquivo enviado! ✅",
        description: isImage ? "Imagem enviada com sucesso." : "Documento enviado com sucesso.",
      });

      clearSelectedFile();
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar arquivo",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingMedia(false);
    }
  };

  const handleSendMessage = () => {
    if (selectedFile) {
      handleSendMedia();
    } else if (messageText.trim()) {
      sendMessage.mutate(messageText.trim());
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    return formatDistanceToNow(new Date(dateString), { addSuffix: false, locale: ptBR });
  };

  if (loadingConversations) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Conversation List */}
      <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-4 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar conversas..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              className="text-xs w-full"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="w-3 h-3 mr-1" />
              {showArchived ? `Encerradas (${archivedCount})` : `Ver encerradas (${archivedCount})`}
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Nenhuma conversa ainda
              </p>
              <p className="text-muted-foreground/70 text-xs mt-1">
                As conversas aparecerão aqui quando leads entrarem em contato
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={`p-4 border-b cursor-pointer transition-colors hover:bg-secondary/50 ${
                  selectedConversationId === conv.id ? "bg-secondary" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    conv.is_group ? "bg-blue-500/20" : "bg-accent/20"
                  }`}>
                    {conv.is_group ? (
                      <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58A2.01 2.01 0 000 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0020 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
                      </svg>
                    ) : (
                      <span className="text-sm font-semibold text-accent">
                        {conv.lead?.name?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {conv.is_group && conv.group_name 
                          ? conv.group_name 
                          : conv.lead?.name || "Lead desconhecido"}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    {conv.is_group && conv.group_name && (
                      <p className="text-[10px] text-blue-400 truncate">
                        via {conv.lead?.name || "membro"}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message_preview || "Sem mensagens"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${channelColors[conv.channel] || "bg-gray-500 text-white"}`}
                      >
                        {conv.is_group ? "Grupo" : channelLabels[conv.channel] || conv.channel}
                      </Badge>
                      {(conv.unread_count || 0) > 0 && (
                        <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b bg-card flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedConversation.is_group ? "bg-blue-500/20" : "bg-accent/20"
                }`}>
                  {selectedConversation.is_group ? (
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58A2.01 2.01 0 000 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0020 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold text-accent">
                      {selectedConversation.lead?.name?.charAt(0) || "?"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium">
                      {selectedConversation.is_group && selectedConversation.group_name 
                        ? selectedConversation.group_name 
                        : selectedConversation.lead?.name || "Lead"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedConversation.is_group 
                        ? `Membro: ${selectedConversation.lead?.name || "Desconhecido"}`
                        : selectedConversation.lead?.phone || "Sem telefone"}
                    </p>
                  </div>
                  {selectedConversation.lead && (
                    <EditLeadDialog
                      lead={{
                        id: selectedConversation.lead.id,
                        name: selectedConversation.lead.name || "Lead",
                        phone: selectedConversation.lead.phone,
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ScheduleMessageDialog
                  defaultPhone={selectedConversation.lead?.phone || ""}
                  leadId={selectedConversation.lead?.id}
                  conversationId={selectedConversation.id}
                />
                {selectedConversation.lead?.phone && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-success hover:text-success hover:bg-success/10"
                          onClick={() => {
                            const phone = selectedConversation.lead?.phone?.replace(/\D/g, "");
                            const whatsappUrl = `https://wa.me/55${phone}`;
                            window.open(whatsappUrl, "_blank");
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Abrir WhatsApp</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Button variant="ghost" size="icon">
                  <Phone className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {selectedConversation.archived ? (
                      <DropdownMenuItem onClick={() => toggleArchive(selectedConversation.id, false)}>
                        <ArchiveRestore className="w-4 h-4 mr-2" />
                        Reabrir conversa
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => toggleArchive(selectedConversation.id, true)}>
                        <Archive className="w-4 h-4 mr-2" />
                        Encerrar conversa
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Nenhuma mensagem nesta conversa</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.direction === "outbound" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.direction === "outbound"
                            ? "bg-accent text-accent-foreground rounded-br-sm"
                            : "bg-card border rounded-bl-sm"
                        }`}
                      >
                        {/* Media rendering */}
                        {msg.media_url && (msg.message_type === "image" || msg.media_url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) ? (
                          <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="block mb-1">
                            <img
                              src={msg.media_url}
                              alt="Imagem"
                              className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer"
                              loading="lazy"
                            />
                          </a>
                        ) : msg.media_url && (msg.message_type === "document" || msg.media_url.match(/\.pdf(\?|$)/i)) ? (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg mb-1 ${
                              msg.direction === "outbound" ? "bg-accent-foreground/10" : "bg-muted"
                            }`}
                          >
                            <FileText className="w-5 h-5 shrink-0" />
                            <span className="text-sm underline truncate">
                              {msg.content || "Documento PDF"}
                            </span>
                          </a>
                        ) : msg.media_url ? (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg mb-1 ${
                              msg.direction === "outbound" ? "bg-accent-foreground/10" : "bg-muted"
                            }`}
                          >
                            <Paperclip className="w-4 h-4 shrink-0" />
                            <span className="text-sm underline truncate">
                              {msg.content || "Arquivo"}
                            </span>
                          </a>
                        ) : null}

                        {/* Text content - hide if it's just a media label */}
                        {msg.content && !(msg.media_url && (msg.content === "📷 Imagem" || msg.content === "📄 Documento")) && (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}

                        <div
                          className={`flex items-center justify-end gap-1 mt-1 ${
                            msg.direction === "outbound"
                              ? "text-accent-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                          <MessageStatusIcon status={msg.sent_status} direction={msg.direction} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-card space-y-2">
              {/* File preview */}
              {selectedFile && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted border">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="w-16 h-16 rounded object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded bg-secondary flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearSelectedFile} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <TemplateSelector 
                  onSelect={(content) => setMessageText(content)}
                  variables={{
                    nome: selectedConversation.lead?.name || "",
                    telefone: selectedConversation.lead?.phone || "",
                    imovel: selectedConversation.lead?.property?.title || "",
                    bairro: selectedConversation.lead?.property?.neighborhood || "",
                    preco: selectedConversation.lead?.property?.price?.toLocaleString("pt-BR") || "",
                  }}
                  channel="whatsapp"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  title="Enviar imagem ou PDF"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  placeholder={selectedFile ? "Legenda (opcional)..." : "Digite uma mensagem..."}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon">
                  <Smile className="w-4 h-4" />
                </Button>
                <Button 
                  variant="hero" 
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !selectedFile) || sendMessage.isPending || isSendingMedia}
                >
                  {(sendMessage.isPending || isSendingMedia) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Selecione uma conversa para visualizar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lead Details Sidebar */}
      {selectedConversation && (
        <div className="w-72 border-l bg-card p-4 hidden xl:block">
          <h3 className="font-heading font-semibold mb-4">
            {selectedConversation.is_group ? "Detalhes do Grupo" : "Detalhes do Lead"}
          </h3>
          <div className="space-y-4">
            {selectedConversation.is_group && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-1">Nome do Grupo</p>
                <p className="font-semibold text-blue-600">
                  {selectedConversation.group_name || selectedConversation.external_thread_id?.replace("@g.us", "") || "Grupo sem nome"}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">
                {selectedConversation.is_group ? "Último membro ativo" : "Nome"}
              </p>
              <p className="font-medium">{selectedConversation.lead?.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="font-medium">{selectedConversation.lead?.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Canal</p>
              <Badge className={channelColors[selectedConversation.channel] || "bg-gray-500"}>
                {selectedConversation.is_group ? "Grupo WhatsApp" : channelLabels[selectedConversation.channel] || selectedConversation.channel}
              </Badge>
            </div>
            {selectedConversation.lead?.property && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Imóvel de Interesse</p>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{selectedConversation.lead.property.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.lead.property.neighborhood} • R$ {selectedConversation.lead.property.price?.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
