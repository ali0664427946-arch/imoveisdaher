import { useState } from "react";
import { Plus, Search, Filter, MoreHorizontal, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LeadStatus = "novo" | "nao_atendeu" | "retornar" | "nao_quis_reuniao" | "reuniao_marcada" | "fechado";

interface Lead {
  id: string;
  name: string;
  phone: string;
  property: string;
  status: LeadStatus;
  createdAt: string;
}

const columns: { id: LeadStatus; title: string; color: string }[] = [
  { id: "novo", title: "Entrou em Contato", color: "border-l-info" },
  { id: "nao_atendeu", title: "Não Atendeu", color: "border-l-warning" },
  { id: "retornar", title: "Retornar", color: "border-l-amber-400" },
  { id: "reuniao_marcada", title: "Reunião Marcada", color: "border-l-success" },
  { id: "fechado", title: "Cliente Fechado", color: "border-l-accent" },
];

const initialLeads: Lead[] = [
  { id: "1", name: "João Silva", phone: "(21) 99999-1234", property: "Apt Pechincha", status: "novo", createdAt: "2 min" },
  { id: "2", name: "Maria Santos", phone: "(21) 99999-5678", property: "Casa Recreio", status: "novo", createdAt: "15 min" },
  { id: "3", name: "Carlos Oliveira", phone: "(21) 99999-9012", property: "Sala Barra", status: "reuniao_marcada", createdAt: "1h" },
  { id: "4", name: "Ana Costa", phone: "(21) 99999-3456", property: "Apt Taquara", status: "retornar", createdAt: "2h" },
  { id: "5", name: "Pedro Lima", phone: "(21) 99999-7890", property: "Casa Jacarepaguá", status: "nao_atendeu", createdAt: "3h" },
  { id: "6", name: "Lucia Ferreira", phone: "(21) 99999-4321", property: "Apt Barra", status: "fechado", createdAt: "1d" },
];

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: LeadStatus) => {
    if (draggedLead) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === draggedLead.id ? { ...lead, status } : lead
        )
      );
      setDraggedLead(null);
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold">Pipeline de Leads</h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards para mover entre as etapas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar leads..." className="pl-9 w-64" />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          <Button variant="hero">
            <Plus className="w-4 h-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 min-w-max">
          {columns.map((column) => (
            <div
              key={column.id}
              className="w-72 flex flex-col bg-secondary/30 rounded-xl"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
              {/* Column Header */}
              <div className={`p-3 border-l-4 ${column.color} bg-card rounded-t-xl`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {getLeadsByStatus(column.id).length}
                  </Badge>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 flex-1">
                {getLeadsByStatus(column.id).map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => handleDragStart(lead)}
                    className={`bg-card rounded-lg p-3 shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${column.color}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                          <span className="text-xs font-semibold text-accent">
                            {lead.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.phone}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Phone className="w-3 h-3 mr-2" />
                            Ligar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <MessageSquare className="w-3 h-3 mr-2" />
                            WhatsApp
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        {lead.property}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {lead.createdAt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
