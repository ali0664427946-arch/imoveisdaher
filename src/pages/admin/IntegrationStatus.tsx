import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Activity,
  Users,
  Inbox,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function IntegrationStatus() {
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingGroups, setSyncingGroups] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Connection test result
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    state?: string;
    instance?: string;
    message?: string;
    error?: string;
    testedAt?: string;
  } | null>(null);

  // Last inbound message
  const { data: lastInboundMessage, isLoading: loadingInbound } = useQuery({
    queryKey: ["integration-status-last-inbound"],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, content, created_at, conversation_id, direction, message_type")
        .eq("direction", "inbound")
        .eq("provider", "evolution")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 15000,
  });

  // Last outbound message
  const { data: lastOutboundMessage, isLoading: loadingOutbound } = useQuery({
    queryKey: ["integration-status-last-outbound"],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, content, created_at, conversation_id, direction, message_type")
        .eq("direction", "outbound")
        .eq("provider", "evolution")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 15000,
  });

  // Message stats (last 24h)
  const { data: messageStats } = useQuery({
    queryKey: ["integration-status-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { count: inboundCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "inbound")
        .gte("created_at", since);

      const { count: outboundCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "outbound")
        .gte("created_at", since);

      const { count: activeConvs } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("channel", "whatsapp")
        .gte("last_message_at", since);

      return {
        inbound: inboundCount || 0,
        outbound: outboundCount || 0,
        activeConversations: activeConvs || 0,
      };
    },
    refetchInterval: 30000,
  });

  // Conversations with unread messages
  const { data: unreadCount } = useQuery({
    queryKey: ["integration-status-unread"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("unread_count")
        .eq("channel", "whatsapp")
        .gt("unread_count", 0);
      
      return data?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0;
    },
    refetchInterval: 15000,
  });

  // Groups without names
  const { data: groupsWithoutNames } = useQuery({
    queryKey: ["integration-status-groups-no-name"],
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("is_group", true)
        .is("group_name", null);
      return count || 0;
    },
    refetchInterval: 60000,
  });

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-evolution-connection");

      if (error) {
        setConnectionResult({
          success: false,
          error: error.message || "Erro ao testar conexão",
          testedAt: new Date().toISOString(),
        });
        toast({
          title: "Falha na conexão ❌",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setConnectionResult({
        success: data?.success || false,
        state: data?.state,
        instance: data?.instance,
        message: data?.message,
        error: data?.error || data?.details,
        testedAt: new Date().toISOString(),
      });

      if (data?.success) {
        toast({
          title: "Conexão OK! ✅",
          description: data.message || `Instância ${data.instance} (${data.state})`,
        });
      } else {
        toast({
          title: "Problema na conexão ⚠️",
          description: data?.details || data?.error || "Verifique as configurações",
          variant: "destructive",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setConnectionResult({
        success: false,
        error: msg,
        testedAt: new Date().toISOString(),
      });
      toast({ title: "Erro ❌", description: msg, variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  const syncGroups = async () => {
    setSyncingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-group-names");
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Grupos sincronizados! ✅",
          description: `${data.updated} de ${data.total} grupos atualizados`,
        });
        queryClient.invalidateQueries({ queryKey: ["integration-status-groups-no-name"] });
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast({ title: "Erro ❌", description: msg, variant: "destructive" });
    } finally {
      setSyncingGroups(false);
    }
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["integration-status-last-inbound"] });
    queryClient.invalidateQueries({ queryKey: ["integration-status-last-outbound"] });
    queryClient.invalidateQueries({ queryKey: ["integration-status-stats"] });
    queryClient.invalidateQueries({ queryKey: ["integration-status-unread"] });
    queryClient.invalidateQueries({ queryKey: ["integration-status-groups-no-name"] });
    toast({ title: "Dados atualizados" });
  };

  const connectionState = connectionResult?.state;
  const isConnected = connectionState === "open";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Status da Integração</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real do WhatsApp via Evolution API
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Connection Card */}
      <Card className={connectionResult
        ? isConnected
          ? "border-green-500/50 bg-green-500/5"
          : "border-destructive/50 bg-destructive/5"
        : "border-muted"
      }>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connectionResult ? (
                isConnected ? (
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Wifi className="w-6 h-6 text-green-500" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <WifiOff className="w-6 h-6 text-destructive" />
                  </div>
                )
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Server className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">Conexão WhatsApp</CardTitle>
                <CardDescription>
                  {connectionResult
                    ? isConnected
                      ? `Instância "${connectionResult.instance}" conectada`
                      : connectionResult.error || "Desconectado"
                    : "Clique em testar para verificar a conexão"
                  }
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {connectionResult && (
                <Badge variant={isConnected ? "default" : "destructive"} className={isConnected ? "bg-green-500 hover:bg-green-600" : ""}>
                  {connectionState === "open" ? "Conectado" : connectionState || "Erro"}
                </Badge>
              )}
              <Button onClick={testConnection} disabled={testingConnection}>
                {testingConnection ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Activity className="w-4 h-4 mr-2" />
                )}
                Testar Conexão
              </Button>
            </div>
          </div>
        </CardHeader>
        {connectionResult?.testedAt && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Último teste: {format(new Date(connectionResult.testedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{messageStats?.inbound ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Recebidas (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{messageStats?.outbound ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Enviadas (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{messageStats?.activeConversations ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Conversas ativas (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Não lidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Messages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Last Inbound */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-blue-500" />
              Última Mensagem Recebida
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInbound ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : lastInboundMessage ? (
              <div className="space-y-2">
                <p className="text-sm line-clamp-2">
                  {lastInboundMessage.content || `[${lastInboundMessage.message_type}]`}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {format(new Date(lastInboundMessage.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  <span>•</span>
                  {formatDistanceToNow(new Date(lastInboundMessage.created_at), { addSuffix: true, locale: ptBR })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Nenhuma mensagem recebida encontrada</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Outbound */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-green-500" />
              Última Mensagem Enviada
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOutbound ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : lastOutboundMessage ? (
              <div className="space-y-2">
                <p className="text-sm line-clamp-2">
                  {lastOutboundMessage.content || `[${lastOutboundMessage.message_type}]`}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {format(new Date(lastOutboundMessage.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  <span>•</span>
                  {formatDistanceToNow(new Date(lastOutboundMessage.created_at), { addSuffix: true, locale: ptBR })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Nenhuma mensagem enviada encontrada</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Webhook Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" />
            Endpoint do Webhook
          </CardTitle>
          <CardDescription>
            Configure este URL na Evolution API para receber mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-lg text-xs font-mono break-all">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`
                );
                toast({ title: "URL copiada!" });
              }}
            >
              Copiar
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Eventos necessários:</strong> MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE
            </p>
            <p>
              <strong>Método:</strong> POST
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Groups Sync */}
      {(groupsWithoutNames ?? 0) > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">{groupsWithoutNames} grupos sem nome</p>
                  <p className="text-xs text-muted-foreground">
                    Sincronize para buscar os nomes da Evolution API
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={syncGroups} disabled={syncingGroups}>
                {syncingGroups ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sincronizar Grupos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
