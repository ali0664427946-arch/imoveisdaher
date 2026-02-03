import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Template = Tables<"templates">;
export type CreateTemplateInput = Omit<TablesInsert<"templates">, "id" | "created_at" | "updated_at">;
export type UpdateTemplateInput = TablesUpdate<"templates">;

export function useTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Template[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("templates")
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: UpdateTemplateInput & { id: string }) => {
      const { data, error } = await supabase
        .from("templates")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template atualizado!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template removido!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    templates,
    isLoading,
    createTemplate: createMutation.mutate,
    updateTemplate: updateMutation.mutate,
    deleteTemplate: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Extract variables from template content (format: {{variableName}})
export function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = content.matchAll(regex);
  const variables = new Set<string>();
  
  for (const match of matches) {
    variables.add(match[1]);
  }
  
  return Array.from(variables);
}

// Replace variables in template content
export function replaceVariables(content: string, values: Record<string, string>): string {
  let result = content;
  
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  
  return result;
}
