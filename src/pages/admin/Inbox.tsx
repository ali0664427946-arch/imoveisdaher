import { useState } from "react";
import { Search, Phone, MoreVertical, Send, Paperclip, Smile } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const conversations = [
  {
    id: 1,
    name: "João Silva",
    phone: "(21) 99999-1234",
    lastMessage: "Olá, gostaria de agendar uma visita",
    time: "2 min",
    unread: 2,
    channel: "whatsapp" as const,
  },
  {
    id: 2,
    name: "Maria Santos",
    phone: "(21) 99999-5678",
    lastMessage: "Qual o valor do condomínio?",
    time: "15 min",
    unread: 0,
    channel: "olx_chat" as const,
  },
  {
    id: 3,
    name: "Carlos Oliveira",
    phone: "(21) 99999-9012",
    lastMessage: "Confirmado para amanhã às 10h",
    time: "1h",
    unread: 0,
    channel: "whatsapp" as const,
  },
  {
    id: 4,
    name: "Ana Costa",
    phone: "(21) 99999-3456",
    lastMessage: "Aceita pets no imóvel?",
    time: "2h",
    unread: 1,
    channel: "whatsapp" as const,
  },
];

const messages = [
  { id: 1, content: "Olá, vi o anúncio do apartamento na Pechincha", direction: "inbound" as const, time: "14:30" },
  { id: 2, content: "Olá João! O apartamento ainda está disponível. Tem interesse em agendar uma visita?", direction: "outbound" as const, time: "14:32" },
  { id: 3, content: "Sim! Qual seria o melhor horário?", direction: "inbound" as const, time: "14:35" },
  { id: 4, content: "Podemos agendar para amanhã às 10h ou 15h. Qual prefere?", direction: "outbound" as const, time: "14:36" },
  { id: 5, content: "Olá, gostaria de agendar uma visita", direction: "inbound" as const, time: "14:40" },
];

const channelColors = {
  whatsapp: "bg-success text-success-foreground",
  olx_chat: "bg-amber-500 text-white",
};

export default function Inbox() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);
  const [messageText, setMessageText] = useState("");

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Conversation List */}
      <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar conversas..." className="pl-9" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={`p-4 border-b cursor-pointer transition-colors hover:bg-secondary/50 ${
                selectedConversation.id === conv.id ? "bg-secondary" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-accent">
                    {conv.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {conv.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {conv.time}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${channelColors[conv.channel]}`}
                    >
                      {conv.channel === "whatsapp" ? "WhatsApp" : "OLX"}
                    </Badge>
                    {conv.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Chat Header */}
        <div className="h-16 border-b bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-accent">
                {selectedConversation.name.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium">{selectedConversation.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedConversation.phone}
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
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
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
              className="flex-1"
            />
            <Button variant="ghost" size="icon">
              <Smile className="w-4 h-4" />
            </Button>
            <Button variant="hero" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Lead Details Sidebar */}
      <div className="w-72 border-l bg-card p-4 hidden xl:block">
        <h3 className="font-heading font-semibold mb-4">Detalhes do Lead</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Nome</p>
            <p className="font-medium">{selectedConversation.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telefone</p>
            <p className="font-medium">{selectedConversation.phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Canal</p>
            <Badge className={channelColors[selectedConversation.channel]}>
              {selectedConversation.channel === "whatsapp" ? "WhatsApp" : "OLX Chat"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="new">Novo</Badge>
          </div>
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Imóvel de Interesse</p>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Apt 2 quartos - Pechincha</p>
              <p className="text-xs text-muted-foreground">R$ 1.800/mês</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
