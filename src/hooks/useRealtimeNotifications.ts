import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface RealtimeNotification {
  type: "new_ficha" | "new_message" | "ficha_updated" | "new_lead" | "new_document" | "new_tenant";
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
      new_document: "📄",
      new_tenant: "👤",
    };

    if (notification.type === "new_document" || notification.type === "new_tenant") {
      playNotificationSound();
      toast(notification.title, {
        description: notification.description,
        icon: icons[notification.type],
        duration: 10000,
        dismissible: true,
        action: notification.data?.fichaId ? {
          label: "Ver Ficha",
          onClick: () => {
            window.location.href = `/admin/fichas/${notification.data!.fichaId}`;
          },
        } : undefined,
      });
      return;
    }

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
          const oldFicha = payload.old as { status: string; form_data: any };
          const updatedFicha = payload.new as { id: string; full_name: string; status: string; form_data: any };
          
          // Check for new tenant added
          const oldTenants = (oldFicha.form_data?.additional_tenants || []) as any[];
          const newTenants = (updatedFicha.form_data?.additional_tenants || []) as any[];
          if (newTenants.length > oldTenants.length) {
            const added = newTenants[newTenants.length - 1];
            const role = added?.role === "fiador" ? "Fiador" : "Locatário";
            showNotification({
              type: "new_tenant",
              title: "Novo Participante Adicionado!",
              description: `${role}: ${added?.fullName || "Sem nome"} na ficha de ${updatedFicha.full_name}`,
              data: { fichaId: updatedFicha.id },
            });
          }
          
          if (oldFicha.status !== updatedFicha.status) {
            showNotification({
              type: "ficha_updated",
              title: "Ficha Atualizada",
              description: `${updatedFicha.full_name} - Status: ${updatedFicha.status}`,
              data: payload.new as Record<string, unknown>,
            });
          }
          queryClient.invalidateQueries({ queryKey: ["fichas"] });
          queryClient.invalidateQueries({ queryKey: ["ficha", updatedFicha.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
        }
      )
      .subscribe();

    // Subscribe to new documents (resubmissions)
    const documentsChannel = supabase
      .channel("realtime-documents")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "documents",
        },
        (payload) => {
          const newDoc = payload.new as { ficha_id: string; category: string; file_name: string };
          showNotification({
            type: "new_document",
            title: "Novo Documento Recebido!",
            description: `${newDoc.file_name} (${newDoc.category})`,
            data: { fichaId: newDoc.ficha_id },
          });
          queryClient.invalidateQueries({ queryKey: ["fichas"] });
          queryClient.invalidateQueries({ queryKey: ["ficha", newDoc.ficha_id] });
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
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [showNotification, queryClient]);
}
