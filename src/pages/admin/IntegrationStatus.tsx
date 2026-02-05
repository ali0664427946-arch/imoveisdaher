import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppConnectionCard } from "@/components/integration-status/WhatsAppConnectionCard";
import { MessageStatsGrid } from "@/components/integration-status/MessageStatsGrid";
import { LastMessagesCards } from "@/components/integration-status/LastMessagesCards";
import { WebhookInfoCard } from "@/components/integration-status/WebhookInfoCard";
import { GroupsSyncCard } from "@/components/integration-status/GroupsSyncCard";
import { OLXIntegrationSection } from "@/components/integration-status/OLXIntegrationSection";

export default function IntegrationStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["integration-status"] });
    // Invalidate all queries that start with integration-status
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        typeof query.queryKey[0] === "string" &&
        query.queryKey[0].startsWith("integration-status"),
    });
    toast({ title: "Dados atualizados" });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Status da Integração</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real das integrações WhatsApp e OLX
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* WhatsApp Section */}
      <WhatsAppConnectionCard />
      <MessageStatsGrid />
      <LastMessagesCards />

      {/* Webhook */}
      <WebhookInfoCard
        title="Webhook Evolution API (WhatsApp)"
        description="Configure este URL na Evolution API para receber mensagens"
        endpoint={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`}
        events="MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE"
      />

      {/* Groups */}
      <GroupsSyncCard />

      {/* OLX Section */}
      <OLXIntegrationSection />
    </div>
  );
}
