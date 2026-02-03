import { useState, useMemo } from "react";
import { Search, Filter, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLeads, LeadStatus, Lead } from "@/hooks/useLeads";
import { KanbanColumn } from "@/components/leads/KanbanColumn";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";
import { ImportContactsDialog } from "@/components/contacts/ImportContactsDialog";
import { useQueryClient } from "@tanstack/react-query";

const columns: { id: LeadStatus; title: string; color: string }[] = [
  { id: "entrou_em_contato", title: "Entrou em Contato", color: "border-l-info" },
  { id: "visita_agendada", title: "Visita Agendada", color: "border-l-success" },
  { id: "aguardando_imovel", title: "Aguardando Imóvel", color: "border-l-amber-400" },
  { id: "aguardando_retorno", title: "Aguardando Retorno", color: "border-l-warning" },
  { id: "fechado", title: "Fechado", color: "border-l-accent" },
];

export default function Leads() {
  const { leads, isLoading, updateLeadStatus, createLead } = useLeads();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(query) ||
        lead.phone?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.property?.title?.toLowerCase().includes(query)
    );
  }, [leads, searchQuery]);

  const getLeadsByStatus = (status: LeadStatus) => {
    return filteredLeads.filter((lead) => lead.status === status);
  };

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDrop = async (status: LeadStatus) => {
    if (draggedLead && draggedLead.status !== status) {
      await updateLeadStatus(draggedLead.id, status);
    }
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col" onDragEnd={handleDragEnd}>
      {/* Header */}
      <div className="p-4 border-b bg-card flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold">Pipeline de Leads</h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards para mover entre as etapas • {leads.length} leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              className="pl-9 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          <ImportContactsDialog 
            trigger={
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Importar WhatsApp
              </Button>
            }
            onSuccess={handleImportSuccess}
          />
          <NewLeadDialog onSubmit={createLead} />
        </div>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 min-w-max">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              color={column.color}
              leads={getLeadsByStatus(column.id)}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              isDragOver={dragOverColumn === column.id}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
