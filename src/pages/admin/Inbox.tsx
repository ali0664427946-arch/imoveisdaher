import { useState } from "react";
import { Search, Phone, MoreVertical, Send, Paperclip, Smile, MessageSquare, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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

export default function Inbox() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversationId) throw new Error("Nenhuma conversa selecionada");

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

  const filteredConversations = conversations.filter((conv) =>
    conv.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lead?.phone?.includes(searchTerm)
  );

  const handleSendMessage = () => {
    if (messageText.trim()) {
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
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar conversas..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-accent">
                      {conv.lead?.name?.charAt(0) || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {conv.lead?.name || "Lead desconhecido"}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message_preview || "Sem mensagens"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${channelColors[conv.channel] || "bg-gray-500 text-white"}`}
                      >
                        {channelLabels[conv.channel] || conv.channel}
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
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-accent">
                    {selectedConversation.lead?.name?.charAt(0) || "?"}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedConversation.lead?.name || "Lead"}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.lead?.phone || "Sem telefone"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
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
                        <p className="text-sm">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            msg.direction === "outbound"
                              ? "text-accent-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-card">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  placeholder="Digite uma mensagem..."
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
                  disabled={!messageText.trim() || sendMessage.isPending}
                >
                  {sendMessage.isPending ? (
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
          <h3 className="font-heading font-semibold mb-4">Detalhes do Lead</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="font-medium">{selectedConversation.lead?.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="font-medium">{selectedConversation.lead?.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Canal</p>
              <Badge className={channelColors[selectedConversation.channel] || "bg-gray-500"}>
                {channelLabels[selectedConversation.channel] || selectedConversation.channel}
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
