import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  Package,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WebhookInfoCard } from "./WebhookInfoCard";

export function OLXIntegrationSection() {
  // OLX sync settings (last sync)
  const { data: olxSettings } = useQuery({
    queryKey: ["integration-status-olx-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations_settings")
        .select("value, updated_at")
        .eq("key", "olx_auto_sync")
        .maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });

  // OLX properties count
  const { data: olxPropertiesCount } = useQuery({
    queryKey: ["integration-status-olx-properties"],
    queryFn: async () => {
      const { count } = await supabase
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("origin", "olx");
      return count || 0;
    },
    refetchInterval: 60000,
  });

  // OLX leads (last 24h)
  const { data: olxLeadsStats } = useQuery({
    queryKey: ["integration-status-olx-leads"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: totalLeads } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("origin", "olx");

      const { count: recentLeads } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("origin", "olx")
        .gte("created_at", since);

      const { count: olxConversations } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("channel", "olx_chat")
        .gte("last_message_at", since);

      return {
        total: totalLeads || 0,
        recent: recentLeads || 0,
        conversations: olxConversations || 0,
      };
    },
    refetchInterval: 30000,
  });

  // Last OLX lead
  const { data: lastOlxLead } = useQuery({
    queryKey: ["integration-status-last-olx-lead"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, created_at, property_id")
        .eq("origin", "olx")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 30000,
  });

  // Last scrape activity
  const { data: lastScrapeActivity } = useQuery({
    queryKey: ["integration-status-last-scrape"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("metadata, created_at")
        .eq("action", "olx_scrape")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });

  const olxSettingsValue = olxSettings?.value as Record<string, unknown> | null;
  const lastSyncAt = olxSettingsValue?.last_sync_at as string | null;
  const profileUrl = olxSettingsValue?.profile_url as string | null;
  const isAutoSyncEnabled = olxSettingsValue?.enabled === true;

  const scrapeMetadata = lastScrapeActivity?.metadata as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      <Separator />
      <div>
        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
          <img src="https://www.olx.com.br/favicon.ico" alt="OLX" className="w-5 h-5" />
          Integração OLX
        </h2>
        <p className="text-sm text-muted-foreground">
          Captura de leads e sincronização de imóveis via OLX / Grupo ZAP
        </p>
      </div>

      {/* OLX Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{olxPropertiesCount ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Imóveis OLX</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{olxLeadsStats?.recent ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Leads OLX (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{olxLeadsStats?.total ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Leads OLX (total)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{olxLeadsStats?.conversations ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Conversas OLX (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status & Last Lead */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scraping Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-purple-500" />
              Sincronização de Imóveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Auto-sync</span>
              <Badge variant={isAutoSyncEnabled ? "default" : "secondary"} className={isAutoSyncEnabled ? "bg-green-500 hover:bg-green-600" : ""}>
                {isAutoSyncEnabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            {profileUrl && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Perfil OLX</span>
                <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver perfil
                </a>
              </div>
            )}

            {lastSyncAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Última sync</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(lastSyncAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  {" • "}
                  {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            )}

            {scrapeMetadata && (
              <div className="mt-2 p-2 bg-muted rounded-md text-xs space-y-1">
                <p className="font-medium">Último scraping:</p>
                <p>Encontrados: {String(scrapeMetadata.found || 0)} | Processados: {String(scrapeMetadata.scraped || 0)} | Sincronizados: {String(scrapeMetadata.synced || 0)}</p>
                {lastScrapeActivity?.created_at && (
                  <p className="text-muted-foreground">
                    {format(new Date(lastScrapeActivity.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            )}

            {!lastSyncAt && !scrapeMetadata && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Nenhuma sincronização realizada</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last OLX Lead */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" />
              Último Lead OLX
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastOlxLead ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{lastOlxLead.name}</p>
                  {lastOlxLead.property_id && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Vinculado
                    </Badge>
                  )}
                </div>
                {lastOlxLead.phone && (
                  <p className="text-xs text-muted-foreground">{lastOlxLead.phone}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {format(new Date(lastOlxLead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  <span>•</span>
                  {formatDistanceToNow(new Date(lastOlxLead.created_at), { addSuffix: true, locale: ptBR })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Nenhum lead OLX encontrado</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* OLX Webhook Endpoint */}
      <WebhookInfoCard
        title="Webhook de Leads OLX / Grupo ZAP"
        description="Configure este URL no painel do Grupo ZAP / OLX Pro para receber leads automaticamente"
        endpoint={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-lead?source=olx`}
        events="Novo lead, Visualização de telefone, Visualização de WhatsApp"
      />
    </div>
  );
}
