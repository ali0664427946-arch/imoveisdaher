import { useState } from "react";
import { Save, RefreshCw, Link2, Shield, Bell, MessageSquare, Copy, Check, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { usePropertySync } from "@/hooks/usePropertySync";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [olxConnected, setOlxConnected] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { isSyncing, importFromFeedUrl } = usePropertySync();
  const { toast } = useToast();

  // Base URLs for Supabase functions
  const supabaseFunctionsUrl = "https://jrwnrygaejtsodeinpni.supabase.co/functions/v1";

  // Webhook URLs for syncing properties
  const webhookBaseUrl = `${supabaseFunctionsUrl}/sync-properties`;
  const olxWebhookUrl = `${webhookBaseUrl}?source=olx`;
  const imovelwebWebhookUrl = `${webhookBaseUrl}?source=imovelweb`;

  // Webhook URLs for capturing leads
  const leadCaptureBaseUrl = `${supabaseFunctionsUrl}/capture-lead`;
  const olxLeadWebhookUrl = `${leadCaptureBaseUrl}?source=olx`;
  const imovelwebLeadWebhookUrl = `${leadCaptureBaseUrl}?source=imovelweb`;

  const copyToClipboard = async (text: string, fieldId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast({ title: "Copiado!", description: "URL copiada para a área de transferência" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleImportFeed = async () => {
    if (!feedUrl.trim()) {
      toast({
        title: "URL necessária",
        description: "Informe a URL do feed para importar",
        variant: "destructive",
      });
      return;
    }
    await importFromFeedUrl(feedUrl);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie integrações e preferências do sistema
        </p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integrations">
            <Link2 className="w-4 h-4 mr-2" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="agent">
            <MessageSquare className="w-4 h-4 mr-2" />
            Agente IA
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          {/* OLX Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-accent flex items-center justify-center text-accent-foreground font-bold text-xs">
                      OLX
                    </span>
                    Integração OLX
                  </CardTitle>
                  <CardDescription>
                    Sincronize seus anúncios da OLX automaticamente via webhook
                  </CardDescription>
                </div>
                {olxConnected ? (
                  <span className="text-sm text-success flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    Conectado
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Aguardando configuração
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>URL do Webhook (para receber dados da OLX)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={olxWebhookUrl} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(olxWebhookUrl, "olx-sync")}
                  >
                    {copiedField === "olx-sync" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure este URL no painel da OLX para receber atualizações automáticas
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="olx_client_id">Client ID</Label>
                  <Input id="olx_client_id" placeholder="Seu Client ID da OLX" />
                </div>
                <div>
                  <Label htmlFor="olx_client_secret">Client Secret</Label>
                  <Input id="olx_client_secret" type="password" placeholder="Seu Client Secret" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Shield className="w-4 h-4" />
                  Conectar via OAuth
                </Button>
                <Button variant="secondary" disabled={isSyncing}>
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  Sincronizar Agora
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ImovelWeb Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-8 h-8 rounded bg-navy-600 flex items-center justify-center text-white font-bold text-xs">
                  IW
                </span>
                Integração ImovelWeb
              </CardTitle>
              <CardDescription>
                Receba imóveis via webhook ou importe via Feed URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>URL do Webhook (para receber dados do ImovelWeb)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={imovelwebWebhookUrl} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(imovelwebWebhookUrl, "imovelweb-sync")}
                  >
                    {copiedField === "imovelweb-sync" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure este URL para receber atualizações do ImovelWeb
                </p>
              </div>
              <div className="border-t pt-4">
                <Label htmlFor="feed_url">Ou importe via Feed URL</Label>
                <Input
                  id="feed_url"
                  placeholder="https://seucrm.com/feed/imoveis.xml"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={isSyncing} onClick={handleImportFeed}>
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  Importar do Feed
                </Button>
                <Button variant="outline">
                  Importar CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lead Capture Webhooks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
                  <Webhook className="w-4 h-4" />
                </span>
                Webhooks de Captura de Leads
              </CardTitle>
              <CardDescription>
                URLs para receber leads automaticamente de portais externos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-accent flex items-center justify-center text-accent-foreground font-bold text-[10px]">
                    OLX
                  </span>
                  Captura de Leads OLX (Canal Pro)
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input value={olxLeadWebhookUrl} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(olxLeadWebhookUrl, "olx-lead")}
                  >
                    {copiedField === "olx-lead" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure este URL no Canal Pro da OLX para receber leads automaticamente
                </p>
              </div>
              <div className="border-t pt-4">
                <Label className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-navy-600 flex items-center justify-center text-white font-bold text-[10px]">
                    IW
                  </span>
                  Captura de Leads ImovelWeb
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input value={imovelwebLeadWebhookUrl} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(imovelwebLeadWebhookUrl, "imovelweb-lead")}
                  >
                    {copiedField === "imovelweb-lead" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure este URL no painel do ImovelWeb para receber leads
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Evolution API */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-8 h-8 rounded bg-success flex items-center justify-center text-white">
                  <MessageSquare className="w-4 h-4" />
                </span>
                Evolution API (WhatsApp)
              </CardTitle>
              <CardDescription>
                Configuração da integração com WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="evolution_url">Base URL</Label>
                  <Input id="evolution_url" placeholder="https://api.evolution.com" />
                </div>
                <div>
                  <Label htmlFor="evolution_key">API Key</Label>
                  <Input id="evolution_key" type="password" placeholder="Sua API Key" />
                </div>
                <div>
                  <Label htmlFor="evolution_instance">Instance</Label>
                  <Input id="evolution_instance" placeholder="daher-imoveis" />
                </div>
              </div>
              <Button variant="outline">
                Testar Conexão
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Agente IA</CardTitle>
              <CardDescription>
                Configure o comportamento do agente de análise documental
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Envio Automático de Mensagens</p>
                  <p className="text-sm text-muted-foreground">
                    Enviar resultado da análise automaticamente via WhatsApp
                  </p>
                </div>
                <Switch
                  checked={autoSendEnabled}
                  onCheckedChange={setAutoSendEnabled}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label>Template: Cliente Apto</Label>
                  <Textarea
                    className="mt-2"
                    rows={4}
                    placeholder="Olá {{nome}}, sua documentação foi aprovada para o imóvel {{imovel_titulo}}..."
                  />
                </div>
                <div>
                  <Label>Template: Não Apto</Label>
                  <Textarea
                    className="mt-2"
                    rows={4}
                    placeholder="Olá {{nome}}, infelizmente sua documentação não foi aprovada..."
                  />
                </div>
                <div>
                  <Label>Template: Documentos Pendentes</Label>
                  <Textarea
                    className="mt-2"
                    rows={4}
                    placeholder="Olá {{nome}}, identificamos que alguns documentos estão faltando..."
                  />
                </div>
              </div>

              <Button variant="hero">
                <Save className="w-4 h-4" />
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Configure quando receber alertas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "new_lead", label: "Novo lead recebido" },
                { id: "new_ficha", label: "Nova ficha enviada" },
                { id: "new_message", label: "Nova mensagem no inbox" },
                { id: "sync_complete", label: "Sincronização concluída" },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <Label htmlFor={item.id}>{item.label}</Label>
                  <Switch id={item.id} defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
