import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Ficha = Tables<"fichas">;

export interface AIAnalysis {
  score: number;
  status_sugerido: "apto" | "nao_apto" | "faltando_docs";
  resumo: string;
  analise_financeira: {
    renda_informada: number;
    valor_aluguel: number;
    comprometimento_renda: number;
    parecer: string;
  };
  documentacao: {
    documentos_recebidos: string[];
    documentos_faltantes: string[];
    parecer: string;
  };
  perfil_locatario: {
    pontos_positivos: string[];
    pontos_atencao: string[];
    parecer: string;
  };
  riscos: string[];
  recomendacao_final: string;
  mensagem_whatsapp: string;
}

export function useFichas() {
  return useQuery({
    queryKey: ["fichas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fichas")
        .select(`
          *,
          property:properties(id, title, neighborhood),
          documents:documents(id, category, status)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useFichaById(id: string | undefined) {
  return useQuery({
    queryKey: ["ficha", id],
    queryFn: async () => {
      if (!id) throw new Error("ID não fornecido");

      const { data, error } = await supabase
        .from("fichas")
        .select(`
          *,
          property:properties(*),
          documents:documents(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useAnalyzeFicha() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fichaId: string) => {
      const response = await supabase.functions.invoke("analyze-ficha", {
        body: { fichaId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao analisar ficha");
      }

      return response.data as { success: boolean; analysis: AIAnalysis };
    },
    onSuccess: (data, fichaId) => {
      queryClient.invalidateQueries({ queryKey: ["fichas"] });
      queryClient.invalidateQueries({ queryKey: ["ficha", fichaId] });
      toast.success("Análise concluída!", {
        description: `Score: ${data.analysis.score}/100 - ${data.analysis.status_sugerido.replace("_", " ")}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Erro na análise", {
        description: error.message,
      });
    },
  });
}

export function useUpdateFichaStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fichaId,
      status,
    }: {
      fichaId: string;
      status: Ficha["status"];
    }) => {
      const { error } = await supabase
        .from("fichas")
        .update({ status })
        .eq("id", fichaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fichas"] });
      toast.success("Status atualizado");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar", {
        description: error.message,
      });
    },
  });
}
