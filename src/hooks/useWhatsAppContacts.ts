import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhatsAppContact {
  id: string;
  pushName?: string;
  name?: string;
  phone: string;
  lastMessageAt?: string;
  isExistingContact?: boolean;
}

interface FetchContactsResponse {
  success: boolean;
  contacts: WhatsAppContact[];
  total: number;
  existingContacts: number;
  newContacts: number;
  error?: string;
}

interface ImportContactsResponse {
  success: boolean;
  imported: number;
  skipped: number;
  message?: string;
  error?: string;
}

export function useWhatsAppContacts() {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const fetchMutation = useMutation({
    mutationFn: async (): Promise<FetchContactsResponse> => {
      const response = await supabase.functions.invoke("fetch-whatsapp-contacts");
      
      if (response.error) {
        throw new Error(response.error.message || "Erro ao buscar contatos");
      }
      
      return response.data as FetchContactsResponse;
    },
    onSuccess: (data) => {
      setContacts(data.contacts);
      setSelectedContacts(new Set());
      toast.success(`${data.total} contatos encontrados`, {
        description: `${data.newContacts} novos, ${data.existingContacts} já importados`,
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao buscar contatos", {
        description: error.message,
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (contactsToImport: { phone: string; name?: string; lastMessageAt?: string }[]): Promise<ImportContactsResponse> => {
      const response = await supabase.functions.invoke("import-whatsapp-contacts", {
        body: { contacts: contactsToImport },
      });
      
      if (response.error) {
        throw new Error(response.error.message || "Erro ao importar contatos");
      }
      
      return response.data as ImportContactsResponse;
    },
    onSuccess: (data) => {
      toast.success(data.message || `${data.imported} contatos importados!`);
      // Refresh contacts list and table
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      fetchMutation.mutate();
    },
    onError: (error: Error) => {
      toast.error("Erro ao importar contatos", {
        description: error.message,
      });
    },
  });

  const toggleContact = (contactId: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const selectAllNew = () => {
    const newContactIds = contacts
      .filter((c) => !c.isExistingContact)
      .map((c) => c.id);
    setSelectedContacts(new Set(newContactIds));
  };

  const clearSelection = () => {
    setSelectedContacts(new Set());
  };

  const importSelected = () => {
    const contactsToImport = contacts
      .filter((c) => selectedContacts.has(c.id) && !c.isExistingContact)
      .map((c) => ({
        phone: c.phone,
        name: c.name || c.pushName,
        lastMessageAt: c.lastMessageAt,
      }));

    if (contactsToImport.length === 0) {
      toast.error("Nenhum contato novo selecionado para importar");
      return;
    }

    importMutation.mutate(contactsToImport);
  };

  return {
    contacts,
    selectedContacts,
    isFetching: fetchMutation.isPending,
    isImporting: importMutation.isPending,
    fetchContacts: () => fetchMutation.mutate(),
    toggleContact,
    selectAllNew,
    clearSelection,
    importSelected,
    newContactsCount: contacts.filter((c) => !c.isExistingContact).length,
    existingContactsCount: contacts.filter((c) => c.isExistingContact).length,
  };
}
