import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ScheduledMessage {
  id: string;
  phone: string;
  message: string;
  scheduled_at: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  lead_id: string | null;
  ficha_id: string | null;
  conversation_id: string | null;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CreateScheduledMessageInput {
  phone: string;
  message: string;
  scheduled_at: Date;
  lead_id?: string;
  ficha_id?: string;
  conversation_id?: string;
}

export function useScheduledMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ["scheduled-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as ScheduledMessage[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateScheduledMessageInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("scheduled_messages")
        .insert({
          phone: input.phone,
          message: input.message,
          scheduled_at: input.scheduled_at.toISOString(),
          lead_id: input.lead_id || null,
          ficha_id: input.ficha_id || null,
          conversation_id: input.conversation_id || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast({
        title: "Mensagem agendada! ✅",
        description: "A mensagem será enviada no horário programado",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao agendar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("scheduled_messages")
        .update({ status: "cancelled" })
        .eq("id", messageId)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast({
        title: "Agendamento cancelado",
        description: "A mensagem não será enviada",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("scheduled_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast({
        title: "Agendamento removido",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get the original message
      const { data: original, error: fetchError } = await supabase
        .from("scheduled_messages")
        .select("*")
        .eq("id", messageId)
        .single();

      if (fetchError || !original) throw new Error("Mensagem não encontrada");

      // Create a new scheduled message with the same content, scheduled for now
      const { error: insertError } = await supabase
        .from("scheduled_messages")
        .insert({
          phone: original.phone,
          message: original.message,
          scheduled_at: new Date().toISOString(),
          lead_id: original.lead_id,
          ficha_id: original.ficha_id,
          conversation_id: original.conversation_id,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      // Delete the old failed message
      await supabase
        .from("scheduled_messages")
        .delete()
        .eq("id", messageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast({
        title: "Mensagem reagendada! ✅",
        description: "A mensagem será enviada em breve",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao reenviar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pendingMessages = messages?.filter((m) => m.status === "pending") || [];
  const sentMessages = messages?.filter((m) => m.status === "sent") || [];
  const failedMessages = messages?.filter((m) => m.status === "failed" || m.status === "cancelled") || [];

  return {
    messages,
    pendingMessages,
    sentMessages,
    failedMessages,
    isLoading,
    error,
    scheduleMessage: createMutation.mutate,
    isScheduling: createMutation.isPending,
    cancelMessage: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
    deleteMessage: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    retryMessage: retryMutation.mutate,
    isRetrying: retryMutation.isPending,
  };
}
