import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  phone_normalized: string | null;
  email: string | null;
  tags: string[];
  origin: string | null;
  last_contact_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ContactFilters {
  search?: string;
  tags?: string[];
  origin?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateContactInput {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  origin?: string;
  notes?: string;
  last_contact_at?: string;
}

export function useContacts(filters?: ContactFilters) {
  const queryClient = useQueryClient();

  const { data: contacts, isLoading, error } = useQuery({
    queryKey: ["contacts", filters],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*")
        .order("last_contact_at", { ascending: false, nullsFirst: false });

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.overlaps("tags", filters.tags);
      }

      if (filters?.origin) {
        query = query.eq("origin", filters.origin);
      }

      if (filters?.dateFrom) {
        query = query.gte("last_contact_at", filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte("last_contact_at", filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contact[];
    },
  });

  // Get all unique tags for filtering
  const { data: allTags } = useQuery({
    queryKey: ["contact-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("tags");
      
      if (error) throw error;
      
      const tagsSet = new Set<string>();
      data?.forEach((c: { tags: string[] }) => {
        c.tags?.forEach((tag) => tagsSet.add(tag));
      });
      return Array.from(tagsSet).sort();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const cleanPhone = input.phone.replace(/\D/g, "");
      const phoneNormalized = cleanPhone.startsWith("55") ? `+${cleanPhone}` : `+55${cleanPhone}`;

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          name: input.name,
          phone: cleanPhone,
          phone_normalized: phoneNormalized,
          email: input.email || null,
          tags: input.tags || [],
          origin: input.origin || "manual",
          notes: input.notes || null,
          last_contact_at: input.last_contact_at || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
      toast.success("Contato criado com sucesso!");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast.error("Este telefone já está cadastrado");
      } else {
        toast.error("Erro ao criar contato", { description: error.message });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, metadata, ...updates }: Partial<Contact> & { id: string }) => {
      // Exclude metadata from updates to avoid type issues
      const { data, error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
      toast.success("Contato atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar contato", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contato removido!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover contato", { description: error.message });
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async ({ id, tag }: { id: string; tag: string }) => {
      const contact = contacts?.find((c) => c.id === id);
      if (!contact) throw new Error("Contato não encontrado");

      const newTags = [...(contact.tags || []), tag];
      const { error } = await supabase
        .from("contacts")
        .update({ tags: newTags })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async ({ id, tag }: { id: string; tag: string }) => {
      const contact = contacts?.find((c) => c.id === id);
      if (!contact) throw new Error("Contato não encontrado");

      const newTags = (contact.tags || []).filter((t) => t !== tag);
      const { error } = await supabase
        .from("contacts")
        .update({ tags: newTags })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
    },
  });

  // Convert contact to lead
  const convertToLeadMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const contact = contacts?.find((c) => c.id === contactId);
      if (!contact) throw new Error("Contato não encontrado");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Check if lead already exists
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .or(`phone.eq.${contact.phone},phone_normalized.eq.${contact.phone_normalized}`)
        .single();

      if (existingLead) {
        throw new Error("Este contato já existe como lead");
      }

      // Create lead
      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          name: contact.name,
          phone: contact.phone,
          phone_normalized: contact.phone_normalized,
          email: contact.email,
          origin: "contact_conversion",
          status: "entrou_em_contato",
          notes: contact.notes,
          assigned_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Contato convertido para Lead!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao converter", { description: error.message });
    },
  });

  return {
    contacts: contacts || [],
    allTags: allTags || [],
    isLoading,
    error,
    createContact: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateContact: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteContact: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    addTag: addTagMutation.mutate,
    removeTag: removeTagMutation.mutate,
    convertToLead: convertToLeadMutation.mutate,
    isConverting: convertToLeadMutation.isPending,
  };
}

// Export contacts to CSV
export function exportContactsToCSV(contacts: Contact[], filename = "contatos") {
  const headers = ["Nome", "Telefone", "Email", "Tags", "Origem", "Último Contato", "Notas"];
  
  const rows = contacts.map((c) => [
    c.name,
    c.phone,
    c.email || "",
    (c.tags || []).join("; "),
    c.origin || "",
    c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString("pt-BR") : "",
    (c.notes || "").replace(/"/g, '""'),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}
