import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { subHours, subMinutes } from "date-fns";

type RiskLevel = "low" | "medium" | "high";

/**
 * Hook que monitora a taxa de envio de WhatsApp em background
 * e dispara notificações in-app quando o risco de banimento sobe.
 * 
 * Nota: mensagens "novas" (iniciadas pelo sistema) pesam mais no risco
 * do que respostas a mensagens recebidas, pois o WhatsApp trata
 * conversas iniciadas pelo remetente com limites mais rigorosos.
 */
export function useSendRateAlert() {
  const lastAlertedRisk = useRef<RiskLevel>("low");

  const { data: riskData } = useQuery({
    queryKey: ["send-rate-alert-monitor"],
    queryFn: async () => {
      const since1h = subHours(new Date(), 1).toISOString();
      const since10m = subMinutes(new Date(), 10).toISOString();

      const [lastHourRes, last10minRes] = await Promise.all([
        supabase
          .from("whatsapp_send_log")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since1h),
        supabase
          .from("whatsapp_send_log")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since10m),
      ]);

      const sendsPerHour = lastHourRes.count ?? 0;
      const sendsPer10min = last10minRes.count ?? 0;

      let risk: RiskLevel = "low";
      if (sendsPer10min > 15 || sendsPerHour > 60) risk = "high";
      else if (sendsPer10min > 8 || sendsPerHour > 30) risk = "medium";

      return { risk, sendsPerHour, sendsPer10min };
    },
    refetchInterval: 60000, // check every 60s
  });

  useEffect(() => {
    if (!riskData) return;
    const { risk, sendsPerHour, sendsPer10min } = riskData;

    // Only alert when risk escalates (not on every poll)
    if (risk === "low") {
      lastAlertedRisk.current = "low";
      return;
    }

    const riskOrder: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
    if (riskOrder[risk] <= riskOrder[lastAlertedRisk.current]) return;

    lastAlertedRisk.current = risk;

    if (risk === "high") {
      toast.error("⚠️ RISCO ALTO de banimento!", {
        description: `${sendsPer10min} msgs nos últimos 10min / ${sendsPerHour} na última hora. Reduza os envios imediatamente! Lembre-se: iniciar conversas novas pesa mais que responder mensagens.`,
        duration: 30000,
        style: {
          background: "hsl(0 84% 60%)",
          color: "white",
          border: "2px solid hsl(0 84% 40%)",
          fontWeight: "600",
        },
      });
    } else if (risk === "medium") {
      toast.warning("Taxa de envio moderada", {
        description: `${sendsPer10min} msgs nos últimos 10min / ${sendsPerHour} na última hora. Monitore com atenção. Priorize responder mensagens ao invés de iniciar novas conversas.`,
        duration: 15000,
      });
    }
  }, [riskData]);
}
