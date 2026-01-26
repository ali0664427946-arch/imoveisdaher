import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface RealtimeNotification {
  type: "new_ficha" | "new_message" | "ficha_updated";
  title: string;
  description: string;
  data?: Record<string, unknown>;
}

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();

  const showNotification = useCallback((notification: RealtimeNotification) => {
    const icons: Record<string, string> = {
      new_ficha: "📋",
      new_message: "💬",
      ficha_updated: "🔄",
    };

    toast(notification.title, {
      description: notification.description,
      icon: icons[notification.type],
      duration: 5000,
    });
  }, []);

  useEffect(() => {
    // Subscribe to new fichas
    const fichasChannel = supabase
      .channel("realtime-fichas")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fichas",
        },
        (payload) => {
          const newFicha = payload.new as { full_name: string; protocol: string };
          showNotification({
            type: "new_ficha",
            title: "Nova Ficha Recebida!",
            description: `${newFicha.full_name} - Protocolo: ${newFicha.protocol}`,
            data: payload.new as Record<string, unknown>,
          });
          queryClient.invalidateQueries({ queryKey: ["fichas"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fichas",
        },
        (payload) => {
          const oldFicha = payload.old as { status: string };
          const updatedFicha = payload.new as { full_name: string; status: string };
          if (oldFicha.status !== updatedFicha.status) {
            showNotification({
              type: "ficha_updated",
              title: "Ficha Atualizada",
              description: `${updatedFicha.full_name} - Status: ${updatedFicha.status}`,
              data: payload.new as Record<string, unknown>,
            });
          }
          queryClient.invalidateQueries({ queryKey: ["fichas"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
        }
      )
      .subscribe();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as { direction: string; content: string };
          if (newMessage.direction === "inbound") {
            showNotification({
              type: "new_message",
              title: "Nova Mensagem Recebida!",
              description: newMessage.content?.substring(0, 50) + "..." || "Nova mensagem",
              data: payload.new as Record<string, unknown>,
            });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(fichasChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [showNotification, queryClient]);
}
