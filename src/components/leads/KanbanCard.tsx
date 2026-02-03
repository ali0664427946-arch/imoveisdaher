import { useState } from "react";
import { Phone, MessageSquare, MoreHorizontal, ExternalLink, Inbox, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lead } from "@/hooks/useLeads";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ScheduleMessageDialog } from "@/components/whatsapp/ScheduleMessageDialog";

interface KanbanCardProps {
  lead: Lead;
  color: string;
  onDragStart: (lead: Lead) => void;
}

export function KanbanCard({ lead, color, onDragStart }: KanbanCardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  
  const createdAt = formatDistanceToNow(new Date(lead.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const handlePhoneClick = () => {
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, "_blank");
    }
  };

  const openOrCreateConversation = async (channel: "whatsapp" | "internal" = "whatsapp") => {
    if (isCreatingConversation) return;
    setIsCreatingConversation(true);
    
    try {
      // Check if WhatsApp conversation already exists for this lead
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("channel", "whatsapp")
        .maybeSingle();

      if (existing) {
        // Navigate to Inbox - the conversation already exists
        navigate("/admin/inbox");
        return;
      }

      // Create new WhatsApp conversation
      const { data: newConversation, error } = await supabase
        .from("conversations")
        .insert({
          lead_id: lead.id,
          channel: "whatsapp",
          last_message_preview: `Conversa iniciada com ${lead.name}`,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "Conversa criada",
        description: "Conversa WhatsApp criada no Inbox",
      });
      
      navigate("/admin/inbox");
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a conversa",
        variant: "destructive",
      });
    } finally {
      setIsCreatingConversation(false);
    }
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(lead)}
      className={`bg-card rounded-lg p-3 shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all hover:-translate-y-0.5 ${color}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-accent">
              {lead.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-sm">{lead.name}</p>
            <p className="text-xs text-muted-foreground">{lead.phone}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openOrCreateConversation("whatsapp")}>
              <Inbox className="w-3 h-3 mr-2" />
              Abrir no Inbox
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePhoneClick}>
              <Phone className="w-3 h-3 mr-2" />
              Ligar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openOrCreateConversation("whatsapp")} disabled={isCreatingConversation}>
              <MessageSquare className="w-3 h-3 mr-2" />
              WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setScheduleOpen(true)}>
              <Clock className="w-3 h-3 mr-2" />
              Agendar Mensagem
            </DropdownMenuItem>
            {lead.property && (
              <DropdownMenuItem asChild>
                <a href={`/imovel/${lead.property.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3 h-3 mr-2" />
                  Ver Imóvel
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <ScheduleMessageDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultPhone={lead.phone || ""}
        leadId={lead.id}
      />
      
      <div className="mt-2 pt-2 border-t">
        {lead.property ? (
          <p className="text-xs text-primary font-medium truncate">
            🏠 {lead.property.title}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Sem imóvel vinculado
          </p>
        )}
        {lead.origin && (
          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
            {lead.origin}
          </span>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1">{createdAt}</p>
      </div>
    </div>
  );
}
