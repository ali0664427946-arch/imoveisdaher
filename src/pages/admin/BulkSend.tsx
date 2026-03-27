import { useState, useRef } from "react";
import { Upload, Send, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface Recipient {
  phone: string;
  name?: string;
  [key: string]: string | undefined;
}

export default function BulkSend() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ scheduled: number; estimatedDurationMin: number } | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        if (jsonData.length === 0) {
          toast({ title: "Arquivo vazio", variant: "destructive" });
          return;
        }

        const columns = Object.keys(jsonData[0]);
        setCsvColumns(columns);

        // Find phone column (phone, telefone, celular, numero)
        const phoneCol = columns.find((c) =>
          /phone|telefone|celular|numero|whatsapp/i.test(c)
        );

        if (!phoneCol) {
          toast({
            title: "Coluna de telefone não encontrada",
            description: "O arquivo precisa ter uma coluna com nome: phone, telefone, celular ou numero",
            variant: "destructive",
          });
          return;
        }

        const nameCol = columns.find((c) => /name|nome/i.test(c));

        const parsed: Recipient[] = jsonData
          .filter((row) => row[phoneCol])
          .map((row) => ({
            ...row,
            phone: String(row[phoneCol]).replace(/\D/g, ""),
            name: nameCol ? row[nameCol] : undefined,
          }));

        setRecipients(parsed);
        toast({
          title: `${parsed.length} contatos importados`,
          description: `Colunas encontradas: ${columns.join(", ")}`,
        });
      } catch (err) {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const removeRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!recipients.length || !messageTemplate.trim()) {
      toast({ title: "Preencha os destinatários e a mensagem", variant: "destructive" });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-bulk-whatsapp", {
        body: {
          recipients,
          messageTemplate: messageTemplate.trim(),
          campaignName: campaignName.trim() || undefined,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success) {
        setResult({
          scheduled: data.scheduled,
          estimatedDurationMin: data.estimatedDurationMin,
        });
        toast({
          title: `${data.scheduled} mensagens agendadas! ✅`,
          description: `Tempo estimado: ~${data.estimatedDurationMin} minutos`,
        });
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao agendar";
      toast({ title: "Erro no envio em massa", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Preview with first recipient's data
  const previewMessage = recipients.length > 0
    ? messageTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = recipients[0][key];
        return val ? `**${val}**` : `{{${key}}}`;
      })
    : messageTemplate;

  const estimatedTime = Math.round(
    recipients.length > 0
      ? (recipients.length * 90 + Math.floor(recipients.length / 10) * 8 * 60) / 60
      : 0
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Send className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">Envio em Massa</h1>
          <p className="text-muted-foreground text-sm">
            Envie mensagens personalizadas via WhatsApp respeitando regras anti-banimento
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Import + Recipients */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Importar Contatos
              </CardTitle>
              <CardDescription>
                Envie um arquivo CSV ou Excel com os contatos. Colunas: telefone, nome, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Selecionar Arquivo (CSV / Excel)
              </Button>

              {csvColumns.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">Variáveis disponíveis:</span>
                  {csvColumns.map((col) => (
                    <Badge key={col} variant="secondary" className="text-xs cursor-pointer"
                      onClick={() => setMessageTemplate((prev) => prev + `{{${col}}}`)}
                    >
                      {`{{${col}}}`}
                    </Badge>
                  ))}
                </div>
              )}

              {recipients.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {recipients.length} destinatários
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setRecipients([])}>
                      Limpar
                    </Button>
                  </div>
                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="p-2 space-y-1">
                      {recipients.slice(0, 50).map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-muted/50 rounded">
                          <span>{r.name || "Sem nome"} — {r.phone}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeRecipient(i)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      {recipients.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          +{recipients.length - 50} contatos não exibidos
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Message + Send */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mensagem</CardTitle>
              <CardDescription>
                Use variáveis como {`{{nome}}`} para personalizar. Clique nas variáveis acima para inserir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome da Campanha (opcional)</Label>
                <Input
                  placeholder="Ex: Promoção Março 2026"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Modelo de Mensagem</Label>
                <Textarea
                  rows={6}
                  placeholder={`Olá {{nome}}, tudo bem? 😊\n\nTemos uma oportunidade especial para você em Jacarepaguá!\n\nDaher Imóveis`}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {messageTemplate && recipients.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Pré-visualização (1º contato):</p>
                  <p className="text-sm whitespace-pre-wrap">{previewMessage}</p>
                </div>
              )}

              {recipients.length > 0 && (
                <div className="p-3 bg-accent/10 rounded-lg border border-accent/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-accent-foreground" />
                    <span className="text-sm font-medium">Resumo Anti-Banimento</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>📤 Destinatários: <strong>{recipients.length}</strong></span>
                    <span>⏱ Tempo estimado: <strong>~{estimatedTime} min</strong></span>
                    <span>🔄 Intervalo: <strong>60-120s</strong></span>
                    <span>☕ Pausas: <strong>a cada 10 msgs</strong></span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card className="border-success/50 bg-success/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-success" />
                  <div>
                    <p className="font-medium text-success">{result.scheduled} mensagens agendadas!</p>
                    <p className="text-sm text-muted-foreground">
                      Tempo estimado: ~{result.estimatedDurationMin} minutos. Acompanhe na Fila de Envio.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleSend}
            disabled={sending || !recipients.length || !messageTemplate.trim()}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Agendar Envio ({recipients.length} mensagens)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
