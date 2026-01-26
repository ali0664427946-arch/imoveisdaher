import { Phone, MessageSquare, MoreHorizontal, ExternalLink } from "lucide-react";
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

interface KanbanCardProps {
  lead: Lead;
  color: string;
  onDragStart: (lead: Lead) => void;
}

export function KanbanCard({ lead, color, onDragStart }: KanbanCardProps) {
  const createdAt = formatDistanceToNow(new Date(lead.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const handleWhatsAppClick = () => {
    if (lead.phone) {
      const phone = lead.phone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }
  };

  const handlePhoneClick = () => {
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, "_blank");
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
            <DropdownMenuItem onClick={handlePhoneClick}>
              <Phone className="w-3 h-3 mr-2" />
              Ligar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleWhatsAppClick}>
              <MessageSquare className="w-3 h-3 mr-2" />
              WhatsApp
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
      <div className="mt-2 pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          {lead.property ? `${lead.property.title}` : "Sem imóvel vinculado"}
        </p>
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
