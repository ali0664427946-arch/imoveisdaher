import { Badge } from "@/components/ui/badge";
import { Lead, LeadStatus } from "@/hooks/useLeads";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  id: LeadStatus;
  title: string;
  color: string;
  leads: Lead[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (status: LeadStatus) => void;
  onDragStart: (lead: Lead) => void;
  isDragOver: boolean;
}

export function KanbanColumn({
  id,
  title,
  color,
  leads,
  onDragOver,
  onDrop,
  onDragStart,
  isDragOver,
}: KanbanColumnProps) {
  return (
    <div
      className={`w-72 flex flex-col bg-secondary/30 rounded-xl transition-all ${
        isDragOver ? "ring-2 ring-primary/50 bg-primary/5" : ""
      }`}
      onDragOver={onDragOver}
      onDrop={() => onDrop(id)}
    >
      {/* Column Header */}
      <div className={`p-3 border-l-4 ${color} bg-card rounded-t-xl`}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            {leads.length}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <div className="p-2 space-y-2 flex-1 min-h-[200px]">
        {leads.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            color={color}
            onDragStart={onDragStart}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-xs border-2 border-dashed rounded-lg">
            Arraste leads para cá
          </div>
        )}
      </div>
    </div>
  );
}
