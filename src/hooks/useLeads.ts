import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Enums } from "@/integrations/supabase/types";

export type LeadStatus = Enums<"lead_status">;

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: LeadStatus;
  origin: string | null;
  notes: string | null;
  property_id: string | null;
  assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
  property?: {
    id: string;
    title: string;
    neighborhood: string;
    city: string;
  } | null;
  allConversationsArchived?: boolean;
}

interface CreateLeadInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  property_id?: string | null;
  origin?: string | null;
  notes?: string | null;
  status?: LeadStatus;
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [archivedLeadIds, setArchivedLeadIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchArchivedLeadIds = async () => {
    try {
      // Get all lead_ids that have at least one conversation
      const { data: allConvs, error: err1 } = await supabase
        .from("conversations")
        .select("lead_id, archived");

      if (err1) throw err1;

      // Group by lead_id: a lead is "all archived" if it has conversations AND all are archived
      const leadConvMap = new Map<string, { total: number; archived: number }>();
      for (const conv of allConvs || []) {
        const existing = leadConvMap.get(conv.lead_id) || { total: 0, archived: 0 };
        existing.total++;
        if (conv.archived) existing.archived++;
        leadConvMap.set(conv.lead_id, existing);
      }

      const archived = new Set<string>();
      for (const [leadId, counts] of leadConvMap) {
        if (counts.total > 0 && counts.total === counts.archived) {
          archived.add(leadId);
        }
      }
      setArchivedLeadIds(archived);
    } catch (error) {
      console.error("Error fetching archived lead ids:", error);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          property:properties(id, title, neighborhood, city)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads((data || []) as Lead[]);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Erro ao carregar leads",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );

      toast({
        title: "Status atualizado",
        description: "O lead foi movido com sucesso",
      });
    } catch (error) {
      console.error("Error updating lead status:", error);
      toast({
        title: "Erro ao atualizar status",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const createLead = async (lead: CreateLeadInput) => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          name: lead.name,
          phone: lead.phone || null,
          email: lead.email || null,
          property_id: lead.property_id || null,
          origin: lead.origin || null,
          notes: lead.notes || null,
          status: lead.status || "entrou_em_contato",
        })
        .select(`
          *,
          property:properties(id, title, neighborhood, city)
        `)
        .single();

      if (error) throw error;

      setLeads((prev) => [data as Lead, ...prev]);

      toast({
        title: "Lead criado",
        description: "Novo lead adicionado ao pipeline",
      });

      return data;
    } catch (error) {
      console.error("Error creating lead:", error);
      toast({
        title: "Erro ao criar lead",
        description: "Tente novamente",
        variant: "destructive",
      });
      return null;
    }
  };

  // Filter leads: hide those with all conversations archived (unless showArchived is on)
  const visibleLeads = showArchived
    ? leads
    : leads.filter((lead) => !archivedLeadIds.has(lead.id));

  const archivedCount = archivedLeadIds.size;

  useEffect(() => {
    fetchLeads();
    fetchArchivedLeadIds();

    // Subscribe to realtime changes
    const leadsChannel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            fetchLeads();
          } else if (payload.eventType === "UPDATE") {
            setLeads((prev) =>
              prev.map((lead) =>
                lead.id === (payload.new as Lead).id
                  ? { ...lead, ...payload.new }
                  : lead
              )
            );
          } else if (payload.eventType === "DELETE") {
            setLeads((prev) =>
              prev.filter((lead) => lead.id !== (payload.old as { id: string }).id)
            );
          }
        }
      )
      .subscribe();

    // Subscribe to conversation changes to update archived status
    const convsChannel = supabase
      .channel("convs-archived-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        () => {
          fetchArchivedLeadIds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(convsChannel);
    };
  }, []);

  return {
    leads: visibleLeads,
    allLeads: leads,
    isLoading,
    updateLeadStatus,
    createLead,
    refetch: () => { fetchLeads(); fetchArchivedLeadIds(); },
    showArchived,
    setShowArchived,
    archivedCount,
  };
}
