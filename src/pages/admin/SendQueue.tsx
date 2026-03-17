import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock, CheckCircle, XCircle, AlertTriangle, Shield, ShieldCheck,
  Activity, Send, RefreshCw, Play, Timer, Calendar, Keyboard,
  Coffee, TrendingUp,
} from "lucide-react";
import { format, subHours, subMinutes, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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

interface ScheduledMsg {
  id: string;
  phone: string;
  message: string;
  scheduled_at: string;
  status: string;
  lead_id: string | null;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
}

function maskPhone(phone: string) {
  if (phone.length > 6) {
    return phone.slice(0, 4) + "****" + phone.slice(-2);
  }
  return phone;
}

// Anti-ban config constants
const ANTI_BAN = {
  sendWindowStart: 9,
  sendWindowEnd: 20,
  minIntervalSec: 60,
  maxIntervalSec: 120,
  typingMinSec: 2,
  typingMaxSec: 8,
  messagesBeforeRest: 10,
  restMinMinutes: 7,
  restMaxMinutes: 10,
  activeDays: [1, 2, 3, 4, 5], // Mon-Fri
};

export default function SendQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch scheduled messages
  const { data: scheduledMessages, isLoading: loadingScheduled } = useQuery({
    queryKey: ["send-queue-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as ScheduledMsg[];
    },
    refetchInterval: 15000,
  });

  // Fetch send logs for metrics
  const { data: sendLogs } = useQuery({
    queryKey: ["send-queue-logs"],
    queryFn: async () => {
      const since = subHours(new Date(), 24).toISOString();
      const { data, error } = await supabase
        .from("whatsapp_send_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as SendLogEntry[];
    },
    refetchInterval: 15000,
  });

  // Process scheduled messages
  const handleProcess = async () => {
    toast({ title: "Processando fila..." });
    const { error } = await supabase.functions.invoke("process-scheduled-messages");
    if (error) {
      toast({ title: "Erro ao processar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Fila processada! ✅" });
      queryClient.invalidateQueries({ queryKey: ["send-queue-messages"] });
      queryClient.invalidateQueries({ queryKey: ["send-queue-logs"] });
    }
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["send-queue-messages"] });
    queryClient.invalidateQueries({ queryKey: ["send-queue-logs"] });
  };

  // Stats
  const total = scheduledMessages?.length ?? 0;
  const pending = scheduledMessages?.filter((m) => m.status === "pending").length ?? 0;
  const sent = scheduledMessages?.filter((m) => m.status === "sent").length ?? 0;
  const failed = scheduledMessages?.filter((m) => m.status === "failed").length ?? 0;
  const cancelled = scheduledMessages?.filter((m) => m.status === "cancelled").length ?? 0;

  // Anti-ban metrics from send logs
  const lastHourLogs = sendLogs?.filter(
    (l) => new Date(l.created_at) > subHours(new Date(), 1)
  ) ?? [];
  const last10minLogs = sendLogs?.filter(
    (l) => new Date(l.created_at) > subMinutes(new Date(), 10)
  ) ?? [];

  // Calculate intervals between consecutive sends
  const sortedLogs = [...(sendLogs ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const intervals: number[] = [];
  for (let i = 1; i < sortedLogs.length; i++) {
    const diff = differenceInSeconds(
      new Date(sortedLogs[i].created_at),
      new Date(sortedLogs[i - 1].created_at)
    );
    if (diff < 600) intervals.push(diff); // Only count intervals < 10min (not rest periods)
  }

  const avgInterval = intervals.length > 0
    ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : 0;
  const minInterval = intervals.length > 0 ? Math.min(...intervals) : 0;
  const maxInterval = intervals.length > 0 ? Math.max(...intervals) : 0;

  // Compliance: % of intervals within safe range
  const safeIntervals = intervals.filter(
    (i) => i >= ANTI_BAN.minIntervalSec && i <= ANTI_BAN.maxIntervalSec * 2
  );
  const compliance = intervals.length > 0
    ? Math.round((safeIntervals.length / intervals.length) * 100)
    : 100;

  // Rest periods (gaps > 5 min between messages)
  const restPeriods = [];
  for (let i = 1; i < sortedLogs.length; i++) {
    const diff = differenceInSeconds(
      new Date(sortedLogs[i].created_at),
      new Date(sortedLogs[i - 1].created_at)
    );
    if (diff >= 300) restPeriods.push(diff);
  }
  const avgRestMin = restPeriods.length > 0
    ? Math.round(restPeriods.reduce((a, b) => a + b, 0) / restPeriods.length / 60)
    : 0;

  // Interval distribution for chart
  const buckets = [
    { label: "0-30s", min: 0, max: 30 },
    { label: "30-60s", min: 30, max: 60 },
    { label: "60-90s", min: 60, max: 90 },
    { label: "90-120s", min: 90, max: 120 },
    { label: "120-180s", min: 120, max: 180 },
    { label: "180s+", min: 180, max: Infinity },
  ];
  const bucketCounts = buckets.map((b) => ({
    ...b,
    count: intervals.filter((i) => i >= b.min && i < b.max).length,
    safe: b.min >= ANTI_BAN.minIntervalSec,
  }));
  const maxBucketCount = Math.max(...bucketCounts.map((b) => b.count), 1);

  // Send window status
  const brasiliaHour = currentTime.getHours(); // Assuming server runs in Brasília timezone
  const isInSendWindow = brasiliaHour >= ANTI_BAN.sendWindowStart && brasiliaHour < ANTI_BAN.sendWindowEnd;
  const dayOfWeek = currentTime.getDay();
  const isActiveDay = ANTI_BAN.activeDays.includes(dayOfWeek);
  const sendingAllowed = isInSendWindow && isActiveDay;

  // Progress to rest (messages sent in last burst)
  const recentBurstCount = last10minLogs.length;
  const restProgress = Math.min((recentBurstCount / ANTI_BAN.messagesBeforeRest) * 100, 100);

  // Last send time
  const lastSendLog = sendLogs?.[0];
  const lastSendTime = lastSendLog
    ? format(new Date(lastSendLog.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })
    : "—";

  // Filtered messages for table
  const filteredMessages = scheduledMessages?.filter((m) => {
    if (statusFilter === "all") return true;
    return m.status === statusFilter;
  }) ?? [];

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const formatSeconds = (s: number) => {
    if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${s}s`;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Fila de Envio</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie a fila de mensagens WhatsApp
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={handleProcess} className="bg-primary hover:bg-primary/90">
            <Play className="w-4 h-4 mr-2" />
            Processar Agora
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-yellow-500">{pending}</p>
          <p className="text-xs text-muted-foreground mt-1">Na fila</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-blue-500">0</p>
          <p className="text-xs text-muted-foreground mt-1">Processando</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-500">{sent}</p>
          <p className="text-xs text-muted-foreground mt-1">Enviados</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-destructive">{failed}</p>
          <p className="text-xs text-muted-foreground mt-1">Falharam</p>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-purple-500">{cancelled}</p>
          <p className="text-xs text-muted-foreground mt-1">Expirados</p>
        </div>
      </div>

      {/* Anti-Ban Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>Status Anti-Banimento</CardTitle>
            </div>
            {lastSendLog && (
              <Badge variant="outline" className="text-xs">
                Último envio: {lastSendTime}
              </Badge>
            )}
          </div>
          <CardDescription>Proteção ativa para evitar bloqueio da conta WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* System active banner */}
          <div
            className={`flex items-center gap-2 p-3 rounded-lg border ${
              sendingAllowed
                ? "bg-green-500/10 border-green-500/30 text-green-600"
                : "bg-yellow-500/10 border-yellow-500/30 text-yellow-600"
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="font-medium text-sm">
              {sendingAllowed
                ? "Sistema ativo - Envios permitidos"
                : "Fora da janela de envio - Aguardando horário"}
            </span>
          </div>

          {/* Brasília time + Send window */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Clock className="w-4 h-4" />
                Horário Brasília
              </div>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-mono font-bold">
                  {format(currentTime, "HH:mm:ss")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(currentTime, "EEEE, dd MMM", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Calendar className="w-4 h-4" />
                Janela de Envio
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold">
                  {String(ANTI_BAN.sendWindowStart).padStart(2, "0")}:00 - {String(ANTI_BAN.sendWindowEnd).padStart(2, "0")}:00
                </p>
                <div className="flex gap-1">
                  {dayNames.map((d, i) => (
                    <Badge
                      key={d}
                      variant={ANTI_BAN.activeDays.includes(i) ? "default" : "outline"}
                      className={`text-[10px] px-1.5 py-0.5 ${
                        i === dayOfWeek ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                      }`}
                    >
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Intervals + Typing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Timer className="w-4 h-4" />
                Entre mensagens
              </div>
              <p className="text-xl font-bold">
                {ANTI_BAN.minIntervalSec}-{ANTI_BAN.maxIntervalSec}s
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Keyboard className="w-4 h-4" />
                Digitação simulada
              </div>
              <p className="text-xl font-bold">
                {ANTI_BAN.typingMinSec}-{ANTI_BAN.typingMaxSec}s
              </p>
            </div>
          </div>

          {/* Progress to rest */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Coffee className="w-4 h-4" />
                Progresso até descanso
              </div>
              <span className="text-sm font-bold">
                {recentBurstCount}/{ANTI_BAN.messagesBeforeRest} msgs
              </span>
            </div>
            <Progress value={restProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Após {ANTI_BAN.messagesBeforeRest} envios, pausa de {ANTI_BAN.restMinMinutes}-{ANTI_BAN.restMaxMinutes} minutos
            </p>
          </div>

          {/* Bottom stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-500">{pending}</p>
              <p className="text-xs text-muted-foreground">Na fila</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-500">{last10minLogs.length}</p>
              <p className="text-xs text-muted-foreground">Últimos 10min</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-destructive">
                {sendLogs?.filter((l) => l.status === "failed").length ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Com erro</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Anti-Ban Metrics Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle>Métricas de Tempo Anti-Banimento</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={refreshAll}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Compliance banner */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                compliance >= 80 ? "bg-green-500/20" : compliance >= 50 ? "bg-yellow-500/20" : "bg-destructive/20"
              }`}>
                <ShieldCheck className={`w-5 h-5 ${
                  compliance >= 80 ? "text-green-500" : compliance >= 50 ? "text-yellow-500" : "text-destructive"
                }`} />
              </div>
              <div>
                <p className="font-medium">Conformidade com Regras Anti-Ban</p>
                <p className="text-sm text-muted-foreground">
                  {compliance >= 80
                    ? "Envios dentro dos parâmetros seguros"
                    : compliance >= 50
                    ? "Alguns envios fora do intervalo recomendado"
                    : "Muitos envios fora do intervalo seguro!"}
                </p>
              </div>
            </div>
            <p className={`text-4xl font-bold ${
              compliance >= 80 ? "text-green-500" : compliance >= 50 ? "text-yellow-500" : "text-destructive"
            }`}>
              {compliance}%
            </p>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <Timer className="w-3 h-3" />
                Intervalo Médio
              </div>
              <p className="text-xl font-bold">{formatSeconds(avgInterval)}</p>
              <p className="text-[10px] text-muted-foreground">Meta: {ANTI_BAN.minIntervalSec}-{ANTI_BAN.maxIntervalSec}s</p>
            </div>
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <TrendingUp className="w-3 h-3" />
                Min / Max
              </div>
              <p className="text-xl font-bold">
                {formatSeconds(minInterval)} / {formatSeconds(maxInterval)}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <Coffee className="w-3 h-3" />
                Períodos de Descanso
              </div>
              <p className="text-xl font-bold">{restPeriods.length}</p>
              <p className="text-[10px] text-muted-foreground">Média: {avgRestMin}min</p>
            </div>
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                <Clock className="w-3 h-3" />
                Última Hora
              </div>
              <p className="text-xl font-bold">{lastHourLogs.length}</p>
              <p className="text-[10px] text-muted-foreground">Últimos 10min: {last10minLogs.length}</p>
            </div>
          </div>

          {/* Interval distribution chart */}
          <div>
            <p className="text-sm font-medium mb-3">Distribuição de Intervalos</p>
            <div className="flex items-end gap-2 h-32">
              {bucketCounts.map((b) => (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{b.count > 0 ? b.count : ""}</span>
                  <div
                    className={`w-full rounded-t transition-all ${
                      b.safe ? "bg-primary" : "bg-destructive"
                    }`}
                    style={{
                      height: `${b.count > 0 ? (b.count / maxBucketCount) * 100 : 0}%`,
                      minHeight: b.count > 0 ? "4px" : "0",
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">{b.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary" />
                <span className="text-xs text-muted-foreground">Dentro das regras</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-destructive" />
                <span className="text-xs text-muted-foreground">Fora das regras</span>
              </div>
            </div>
          </div>

          {/* Last 20 intervals mini chart */}
          {intervals.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">Últimos 20 Intervalos</p>
              <div className="h-24 flex items-end gap-px">
                {intervals.slice(-20).map((interval, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/80 rounded-t"
                    style={{
                      height: `${Math.min((interval / (ANTI_BAN.maxIntervalSec * 2)) * 100, 100)}%`,
                      minHeight: "2px",
                    }}
                    title={`${interval}s`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>0s</span>
                <span>{ANTI_BAN.minIntervalSec}s</span>
                <span>{ANTI_BAN.maxIntervalSec}s</span>
                <span>{ANTI_BAN.maxIntervalSec * 2}s</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Fila de Mensagens
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtros:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="failed">Falharam</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Telefone</th>
                    <th className="text-left p-3 hidden md:table-cell">Mensagem</th>
                    <th className="text-left p-3 hidden lg:table-cell">Agendado</th>
                    <th className="text-left p-3 hidden lg:table-cell">Enviado</th>
                    <th className="text-left p-3 hidden md:table-cell">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingScheduled ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredMessages.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Nenhuma mensagem encontrada
                      </td>
                    </tr>
                  ) : (
                    filteredMessages.slice(0, 100).map((msg) => (
                      <tr key={msg.id} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <Badge
                            variant={
                              msg.status === "sent" ? "default" :
                              msg.status === "pending" ? "secondary" :
                              msg.status === "failed" ? "destructive" : "outline"
                            }
                            className={`text-xs ${
                              msg.status === "sent" ? "bg-green-600 hover:bg-green-700" : ""
                            }`}
                          >
                            {msg.status === "sent" && <CheckCircle className="w-3 h-3 mr-1" />}
                            {msg.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                            {msg.status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
                            {msg.status === "sent" ? "Enviado" :
                             msg.status === "pending" ? "Pendente" :
                             msg.status === "failed" ? "Falhou" : "Cancelado"}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-xs">{maskPhone(msg.phone)}</td>
                        <td className="p-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground truncate block max-w-[250px]">
                            {msg.message.substring(0, 50)}...
                          </span>
                        </td>
                        <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(msg.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                        </td>
                        <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {msg.sent_at
                            ? format(new Date(msg.sent_at), "dd/MM HH:mm", { locale: ptBR })
                            : "—"}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {msg.error_message ? (
                            <span className="text-xs text-destructive truncate block max-w-[200px]">
                              {msg.error_message}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
