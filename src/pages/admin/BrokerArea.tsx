import { useMemo, useState } from "react";
import { UserRound, Send, Clock, ListChecks, ShieldCheck, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, addHours, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { useLeads } from "@/hooks/useLeads";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useScheduledMessages } from "@/hooks/useScheduledMessages";
import { useToast } from "@/hooks/use-toast";

// ─── Anti-ban conservador (Área do Corretor) ───
const BROKER_LIMITS = {
  dailyCap: 20,           // Máx 20 msgs / 24h por corretor
  minGapMinutes: 2,       // Intervalo mínimo entre envios do mesmo corretor
  maxGapMinutes: 4,       // Intervalo máximo (o processador escolhe entre 2-4min)
  windowStart: 7,         // 07:00 Brasília
  windowEnd: 20,          // 20:00
  activeDaysLabel: "Segunda a sexta",
};

function withinBusinessWindow(d: Date) {
  const h = d.getHours();
  const day = d.getDay();
  return h >= BROKER_LIMITS.windowStart && h < BROKER_LIMITS.windowEnd && day >= 1 && day <= 5;
}

export default function BrokerArea() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { leads } = useLeads();
  const { messages: allMessages, cancelMessage, isLoading: loadingMessages } = useScheduledMessages();

  // Só mensagens do corretor logado
  const myMessages = useMemo(
    () => (allMessages || []).filter((m) => m.created_by === user?.id),
    [allMessages, user?.id]
  );

  // Contagem nas últimas 24h (pending + sent, para respeitar cap real de envios)
  const { data: last24hCount = 0 } = useQuery({
    queryKey: ["broker-24h-count", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const since = subHours(new Date(), 24).toISOString();
      const { count } = await supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user!.id)
        .in("status", ["pending", "sent"])
        .gte("created_at", since);
      return count ?? 0;
    },
  });

  const remainingToday = Math.max(0, BROKER_LIMITS.dailyCap - last24hCount);
  const capReached = remainingToday <= 0;

  // ─── Formulário ───
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(format(addHours(new Date(), 1), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(addHours(new Date(), 1), "HH:mm"));
  const [submitting, setSubmitting] = useState(false);

  const handleLeadChange = (id: string) => {
    setSelectedLeadId(id);
    const lead = leads?.find((l) => l.id === id);
    if (lead?.phone) setPhone(lead.phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!phone.trim() || !message.trim()) {
      toast({ title: "Preencha telefone e mensagem", variant: "destructive" });
      return;
    }
    if (capReached) {
      toast({
        title: "Limite diário atingido",
        description: `Você já usou ${BROKER_LIMITS.dailyCap} envios nas últimas 24h. Aguarde para agendar mais.`,
        variant: "destructive",
      });
      return;
    }

    const [hh, mm] = time.split(":").map(Number);
    const [yy, mo, dd] = date.split("-").map(Number);
    const scheduledAt = new Date(yy, mo - 1, dd, hh, mm);

    if (scheduledAt.getTime() < Date.now() - 60_000) {
      toast({ title: "Escolha uma data/hora futura", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("scheduled_messages").insert({
        phone: phone.trim(),
        message: message.trim(),
        scheduled_at: scheduledAt.toISOString(),
        lead_id: selectedLeadId || null,
        created_by: user.id,
        status: "pending",
        metadata: {
          source: "corretor",
          broker_id: user.id,
          broker_email: user.email,
        },
      });
      if (error) throw error;

      toast({
        title: "Mensagem agendada ✅",
        description: `Envio programado para ${format(scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
      });
      setMessage("");
    } catch (err) {
      toast({
        title: "Erro ao agendar",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const outsideWindow = !withinBusinessWindow(new Date(`${date}T${time}`));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <UserRound className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold">Área do Corretor</h1>
          <p className="text-muted-foreground text-sm">
            Envie mensagens agendadas via WhatsApp com proteção anti-banimento
          </p>
        </div>
      </div>

      {/* Anti-ban banner */}
      <Card className="border-accent/40 bg-accent/5">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">Modo conservador ativo</span>
          </div>
          <Badge variant="secondary">Intervalo {BROKER_LIMITS.minGapMinutes}-{BROKER_LIMITS.maxGapMinutes} min</Badge>
          <Badge variant="secondary">Máx {BROKER_LIMITS.dailyCap} msgs / 24h</Badge>
          <Badge variant="secondary">{BROKER_LIMITS.activeDaysLabel} • {BROKER_LIMITS.windowStart}h–{BROKER_LIMITS.windowEnd}h</Badge>
          <div className="ml-auto text-sm">
            Restam hoje:{" "}
            <span className={capReached ? "text-destructive font-bold" : "font-bold text-accent"}>
              {remainingToday}/{BROKER_LIMITS.dailyCap}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agendar"><Send className="w-4 h-4 mr-2" />Agendar</TabsTrigger>
          <TabsTrigger value="historico"><Clock className="w-4 h-4 mr-2" />Meus Envios</TabsTrigger>
          <TabsTrigger value="leads"><ListChecks className="w-4 h-4 mr-2" />Meus Leads</TabsTrigger>
        </TabsList>

        {/* AGENDAR */}
        <TabsContent value="agendar">
          <Card>
            <CardHeader>
              <CardTitle>Nova mensagem agendada</CardTitle>
              <CardDescription>
                A mensagem entra na fila e é enviada pelo servidor respeitando os intervalos anti-ban.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Lead (opcional)</Label>
                  <Select value={selectedLeadId} onValueChange={handleLeadChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecionar lead para preencher automaticamente" />
                    </SelectTrigger>
                    <SelectContent>
                      {(leads || []).slice(0, 100).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} {l.phone ? `— ${l.phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(21) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="message">Mensagem</Label>
                    <TemplateSelector onSelect={(c) => setMessage(c)} channel="whatsapp" />
                  </div>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Digite ou selecione um template..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={format(new Date(), "yyyy-MM-dd")}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Horário</Label>
                    <Input
                      id="time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {outsideWindow && (
                  <Alert variant="default" className="border-yellow-500/40 bg-yellow-500/10">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle>Fora da janela de envio</AlertTitle>
                    <AlertDescription>
                      Agendamentos fora de seg–sex, 07h–20h ficam pendentes até a próxima janela.
                    </AlertDescription>
                  </Alert>
                )}

                {capReached && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertTitle>Limite diário atingido</AlertTitle>
                    <AlertDescription>
                      Você já agendou/enviou {BROKER_LIMITS.dailyCap} mensagens nas últimas 24h. Aguarde para agendar mais.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={submitting || capReached}>
                    <Send className="w-4 h-4 mr-2" />
                    {submitting ? "Agendando..." : "Agendar envio"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Meus envios agendados</CardTitle>
              <CardDescription>Somente mensagens criadas por você</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMessages ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : myMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma mensagem agendada ainda.</p>
              ) : (
                <ScrollArea className="h-[500px] pr-3">
                  <div className="space-y-2">
                    {myMessages.map((m) => (
                      <div key={m.id} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                m.status === "sent" ? "default"
                                : m.status === "failed" ? "destructive"
                                : m.status === "cancelled" ? "outline"
                                : "secondary"
                              }
                            >
                              {m.status}
                            </Badge>
                            <span className="text-sm font-medium">{m.phone}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(m.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{m.message}</p>
                        {m.error_message && (
                          <p className="text-xs text-destructive">Erro: {m.error_message}</p>
                        )}
                        {m.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => cancelMessage(m.id)}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEADS */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle>Meus leads</CardTitle>
              <CardDescription>Clique para preencher o formulário de agendamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-3">
                <div className="grid gap-2">
                  {(leads || []).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        handleLeadChange(l.id);
                        (document.querySelector('[data-value="agendar"]') as HTMLElement)?.click();
                      }}
                      className="text-left border rounded-lg p-3 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{l.name}</p>
                          <p className="text-xs text-muted-foreground">{l.phone || "sem telefone"}</p>
                        </div>
                        {l.property && (
                          <span className="text-xs text-primary truncate max-w-[200px]">
                            🏠 {l.property.title}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {(!leads || leads.length === 0) && (
                    <p className="text-sm text-muted-foreground">Nenhum lead ainda.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
