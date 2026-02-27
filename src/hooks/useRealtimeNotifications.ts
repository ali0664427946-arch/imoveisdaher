import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface RealtimeNotification {
  type: "new_ficha" | "new_message" | "ficha_updated" | "new_lead";
  title: string;
  description: string;
  data?: Record<string, unknown>;
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio not available
  }
}

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();

  const showNotification = useCallback((notification: RealtimeNotification) => {
    if (notification.type === "new_ficha") {
      playNotificationSound();
      toast(notification.title, {
        description: notification.description,
        icon: "🔔",
        duration: 15000,
        dismissible: true,
        style: {
          background: "hsl(var(--accent))",
          color: "hsl(var(--accent-foreground))",
          border: "2px solid hsl(var(--primary))",
          fontWeight: "600",
          fontSize: "1rem",
          boxShadow: "0 8px 32px hsl(var(--primary) / 0.3)",
        },
        action: {
          label: "Ver Fichas",
          onClick: () => {
            window.location.href = "/admin/fichas";
          },
        },
      });
      return;
    }

    const icons: Record<string, string> = {
      new_message: "💬",
      ficha_updated: "🔄",
      new_lead: "🎯",
    };

    toast(notification.title, {
      description: notification.description,
      icon: icons[notification.type],
      duration: 5000,
    });
  }, []);

  useEffect(() => {
    // Subscribe to new leads
    const leadsChannel = supabase
      .channel("realtime-leads")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          const newLead = payload.new as { name: string; origin: string | null; phone: string | null };
          const originLabel = newLead.origin ? ` via ${newLead.origin.toUpperCase()}` : "";
          showNotification({
            type: "new_lead",
            title: "Novo Lead Recebido!",
            description: `${newLead.name}${originLabel}${newLead.phone ? ` - ${newLead.phone}` : ""}`,
            data: payload.new as Record<string, unknown>,
          });
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
        }
      )
      .subscribe();

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
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(fichasChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [showNotification, queryClient]);
}
