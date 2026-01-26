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
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
          status: lead.status || "novo",
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

  useEffect(() => {
    fetchLeads();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            fetchLeads(); // Refetch to get relations
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    leads,
    isLoading,
    updateLeadStatus,
    createLead,
    refetch: fetchLeads,
  };
}
