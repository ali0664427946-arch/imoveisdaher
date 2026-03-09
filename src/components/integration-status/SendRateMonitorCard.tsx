import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, Activity, Send, XCircle } from "lucide-react";
import { format, subHours, subMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SendLogEntry {
  id: string;
  created_at: string;
  function_name: string;
  phone: string;
  status: string;
  delay_ms: number | null;
  error_message: string | null;
  message_preview: string | null;
}

function maskPhone(phone: string) {
  if (phone.length > 6) {
    return phone.slice(0, 4) + "****" + phone.slice(-2);
  }
  return phone;
}

export function SendRateMonitorCard() {
  // Fetch logs from last 24h
  const { data: logs, isLoading } = useQuery({
    queryKey: ["integration-status-send-rate"],
    queryFn: async () => {
      const since = subHours(new Date(), 24).toISOString();
      const { data, error } = await supabase
        .from("whatsapp_send_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as SendLogEntry[];
    },
    refetchInterval: 30000,
  });

  // Compute metrics
  const totalSent = logs?.length ?? 0;
  const successes = logs?.filter((l) => l.status === "success").length ?? 0;
  const failures = logs?.filter((l) => l.status === "failed").length ?? 0;
  const failureRate = totalSent > 0 ? ((failures / totalSent) * 100).toFixed(1) : "0";

  // Rate per hour (last 1h)
  const lastHourLogs = logs?.filter(
    (l) => new Date(l.created_at) > subHours(new Date(), 1)
  ) ?? [];
  const sendsPerHour = lastHourLogs.length;

  // Rate per 10min (burst detection)
  const last10minLogs = logs?.filter(
    (l) => new Date(l.created_at) > subMinutes(new Date(), 10)
  ) ?? [];
  const sendsPer10min = last10minLogs.length;

  // Risk level
  const getRiskLevel = () => {
    if (sendsPer10min > 15 || sendsPerHour > 60) return "high";
    if (sendsPer10min > 8 || sendsPerHour > 30) return "medium";
    return "low";
  };
  const risk = getRiskLevel();

  // By function breakdown
  const byFunction = logs?.reduce((acc, l) => {
    acc[l.function_name] = (acc[l.function_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const recentLogs = logs?.slice(0, 15) ?? [];

  const functionLabels: Record<string, string> = {
    "send-whatsapp": "Envio direto",
    "send-whatsapp-media": "Mídia",
    "send-ficha-protocol": "Protocolo",
    "process-scheduled-messages": "Agendado",
    "initiate-whatsapp-contact": "Contato site",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Monitor de Taxa de Envio
        </CardTitle>
        <CardDescription>
          Monitoramento centralizado de todos os envios WhatsApp (últimas 24h)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            {/* Risk Banner */}
            {risk !== "low" && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  risk === "high"
                    ? "bg-destructive/10 text-destructive border border-destructive/30"
                    : "bg-yellow-500/10 text-yellow-700 border border-yellow-500/30"
                }`}
              >
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">
                  {risk === "high"
                    ? "⚠️ Taxa de envio ALTA — risco de banimento! Reduza os envios."
                    : "Taxa de envio moderada — monitore com atenção."}
                </span>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <Send className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{totalSent}</p>
                <p className="text-xs text-muted-foreground">Total 24h</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <CheckCircle className="w-4 h-4 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{successes}</p>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <XCircle className="w-4 h-4 mx-auto mb-1 text-destructive" />
                <p className="text-2xl font-bold text-destructive">{failures}</p>
                <p className="text-xs text-muted-foreground">Falhas ({failureRate}%)</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{sendsPerHour}</p>
                <p className="text-xs text-muted-foreground">Última hora</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <Activity className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className={`text-2xl font-bold ${risk === "high" ? "text-destructive" : risk === "medium" ? "text-yellow-600" : ""}`}>
                  {sendsPer10min}
                </p>
                <p className="text-xs text-muted-foreground">Últimos 10min</p>
              </div>
            </div>

            {/* By Function */}
            {Object.keys(byFunction).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Por função:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(byFunction).map(([fn, count]) => (
                    <Badge key={fn} variant="secondary">
                      {functionLabels[fn] || fn}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Logs Table */}
            <div>
              <p className="text-sm font-medium mb-2">Últimos envios:</p>
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Hora</th>
                        <th className="text-left p-2">Função</th>
                        <th className="text-left p-2">Telefone</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2 hidden md:table-cell">Delay</th>
                        <th className="text-left p-2 hidden lg:table-cell">Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-muted-foreground">
                            Nenhum envio nas últimas 24h
                          </td>
                        </tr>
                      ) : (
                        recentLogs.map((log) => (
                          <tr key={log.id} className="border-t">
                            <td className="p-2 whitespace-nowrap">
                              {format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}
                            </td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-[10px]">
                                {functionLabels[log.function_name] || log.function_name}
                              </Badge>
                            </td>
                            <td className="p-2 font-mono">{maskPhone(log.phone)}</td>
                            <td className="p-2">
                              {log.status === "success" ? (
                                <Badge className="bg-green-600/10 text-green-700 border-green-600/30 text-[10px]">
                                  OK
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">
                                  Falha
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 hidden md:table-cell">
                              {log.delay_ms ? `${(log.delay_ms / 1000).toFixed(1)}s` : "—"}
                            </td>
                            <td className="p-2 hidden lg:table-cell text-muted-foreground truncate max-w-[200px]">
                              {log.error_message || log.message_preview || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
