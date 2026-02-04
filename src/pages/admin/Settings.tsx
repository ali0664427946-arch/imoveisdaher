import { useState } from "react";
import { Save, RefreshCw, Link2, Shield, Bell, MessageSquare, Copy, Check, Webhook, Clock, Zap, Loader2, Download, Globe, CalendarClock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { usePropertySync } from "@/hooks/usePropertySync";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleMessageDialog } from "@/components/whatsapp/ScheduleMessageDialog";
import { ScheduledMessagesList } from "@/components/whatsapp/ScheduledMessagesList";

export default function Settings() {
  const [olxConnected, setOlxConnected] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [olxProfileUrl, setOlxProfileUrl] = useState("");
  const [scrapingOlx, setScrapingOlx] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testingEvolution, setTestingEvolution] = useState(false);
  const [syncingGroups, setSyncingGroups] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [savingAutoSync, setSavingAutoSync] = useState(false);
  const { isSyncing, importFromFeedUrl } = usePropertySync();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query to get last lead received per origin
  const { data: lastLeadsByOrigin } = useQuery({
    queryKey: ["last-leads-by-origin"],
    queryFn: async () => {
      const origins = ["olx", "imovelweb", "website", "manual"];
      const results: Record<string, { created_at: string; name: string } | null> = {};
      
      for (const origin of origins) {
        const { data } = await supabase
          .from("leads")
          .select("created_at, name")
          .eq("origin", origin)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        results[origin] = data;
      }
      
      return results;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Query to get auto-sync settings
  const { data: autoSyncSettings } = useQuery({
    queryKey: ["olx-auto-sync-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations_settings")
        .select("value")
        .eq("key", "olx_auto_sync")
        .maybeSingle();
      
      if (data?.value) {
        const settings = data.value as { enabled: boolean; profile_url: string | null; last_sync_at: string | null };
        setAutoSyncEnabled(settings.enabled || false);
        if (settings.profile_url) {
          setOlxProfileUrl(settings.profile_url);
        }
        return settings;
      }
      return null;
    },
  });

  const handleSaveAutoSync = async (enabled: boolean) => {
    setSavingAutoSync(true);
    try {
      const { error } = await supabase
        .from("integrations_settings")
        .update({
          value: {
            enabled,
            profile_url: olxProfileUrl.trim() || null,
            last_sync_at: autoSyncSettings?.last_sync_at || null,
          },
        })
        .eq("key", "olx_auto_sync");

      if (error) throw error;

      setAutoSyncEnabled(enabled);
      queryClient.invalidateQueries({ queryKey: ["olx-auto-sync-settings"] });
      
      toast({
        title: enabled ? "Sincronização automática ativada! ✅" : "Sincronização automática desativada",
        description: enabled 
          ? "Seus imóveis serão sincronizados diariamente às 6:00 da manhã" 
          : "A sincronização automática foi desativada",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar";
      toast({
        title: "Erro ao salvar configuração",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingAutoSync(false);
    }
  };

  // Base URL for backend functions (derive from current project env)
  const supabaseFunctionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

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

  const handleScrapeOlx = async () => {
    if (!olxProfileUrl.trim()) {
      toast({
        title: "URL necessária",
        description: "Informe a URL do seu perfil ou página de anúncios na OLX",
        variant: "destructive",
      });
      return;
    }

    setScrapingOlx(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-olx", {
        body: { profileUrl: olxProfileUrl.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Importação concluída! ✅",
          description: `${data.synced} imóveis importados da OLX`,
        });
        queryClient.invalidateQueries({ queryKey: ["properties"] });
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao importar";
      toast({
        title: "Falha na importação ❌",
        description: message,
        variant: "destructive",
      });
    } finally {
      setScrapingOlx(false);
    }
  };

  const testWebhook = async (source: "olx" | "imovelweb") => {
    setTestingWebhook(source);
    
    try {
      const testData = source === "olx" 
        ? {
            ad_id: "test-" + Date.now(),
            name: "[TESTE] Lead de Teste OLX",
            phone: "(21) 99999-0000",
            email: "teste.olx@exemplo.com",
            message: "Este é um lead de teste gerado pelo sistema para validar a integração.",
          }
        : {
            imovel_id: "test-" + Date.now(),
            nome: "[TESTE] Lead de Teste ImovelWeb",
            telefone: "(21) 99999-0001",
            email: "teste.imovelweb@exemplo.com",
            mensagem: "Este é um lead de teste gerado pelo sistema para validar a integração.",
          };

      const { data, error } = await supabase.functions.invoke("capture-lead", {
        body: testData,
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Add source query param by using the URL directly
      const response = await fetch(`${supabaseFunctionsUrl}/capture-lead?source=${source}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testData),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Webhook funcionando! ✅",
          description: `Lead de teste criado com sucesso (ID: ${result.lead_id?.slice(0, 8)}...)`,
        });
        // Refresh the last leads query
        queryClient.invalidateQueries({ queryKey: ["last-leads-by-origin"] });
      } else {
        throw new Error(result.error || "Erro desconhecido");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao testar webhook";
      toast({
        title: "Falha no teste ❌",
        description: message,
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const testEvolutionConnection = async () => {
    setTestingEvolution(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("test-evolution-connection");

      if (error) {
        throw new Error(error.message || "Erro ao testar conexão");
      }

      if (data?.success) {
        toast({
          title: "Conexão bem sucedida! ✅",
          description: data.message || `Instância: ${data.instance} (${data.state})`,
        });
      } else {
        toast({
          title: "Falha na conexão ❌",
          description: data?.details || data?.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao testar conexão";
      toast({
        title: "Erro na conexão ❌",
        description: message,
        variant: "destructive",
      });
    } finally {
      setTestingEvolution(false);
    }
  };

  const syncGroupNames = async () => {
    setSyncingGroups(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("sync-group-names");

      if (error) {
        throw new Error(error.message || "Erro ao sincronizar grupos");
      }

      if (data?.success) {
        toast({
          title: "Grupos sincronizados! ✅",
          description: `${data.updated} de ${data.total} grupos atualizados`,
        });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao sincronizar";
      toast({
        title: "Erro na sincronização ❌",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSyncingGroups(false);
    }
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
          <TabsTrigger value="scheduling">
            <CalendarClock className="w-4 h-4 mr-2" />
            Agendamentos
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
          {/* OLX Scraping - Import Properties */}
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
                  <Download className="w-4 h-4" />
                </span>
                Importar Imóveis da OLX
              </CardTitle>
              <CardDescription>
                Importe seus anúncios diretamente da sua página OLX para o CRM e site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="olx_profile_url">URL do seu Perfil ou Lista de Anúncios na OLX</Label>
                <Input
                  id="olx_profile_url"
                  placeholder="https://www.olx.com.br/perfil/SEU_USUARIO ou URL de busca"
                  value={olxProfileUrl}
                  onChange={(e) => setOlxProfileUrl(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cole a URL do seu perfil na OLX ou uma página de busca com seus anúncios
                </p>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Sincronização Automática Diária</p>
                    <p className="text-xs text-muted-foreground">
                      {autoSyncEnabled 
                        ? "Imóveis sincronizados todos os dias às 6:00" 
                        : "Ative para sincronizar automaticamente"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={autoSyncEnabled}
                  onCheckedChange={(checked) => handleSaveAutoSync(checked)}
                  disabled={savingAutoSync || !olxProfileUrl.trim()}
                />
              </div>
              
              {autoSyncSettings?.last_sync_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="w-3 h-3 text-success" />
                  Última sincronização: {formatDistanceToNow(new Date(autoSyncSettings.last_sync_at), { addSuffix: true, locale: ptBR })}
                </p>
              )}

              <Button 
                onClick={handleScrapeOlx} 
                disabled={scrapingOlx}
                className="w-full"
              >
                {scrapingOlx ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando... (pode levar alguns minutos)
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    Buscar e Importar Imóveis Agora
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* OLX API for Publishing */}
          <Card className="border-accent/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded bg-accent flex items-center justify-center text-accent-foreground font-bold text-xs">
                      OLX
                    </span>
                    Publicar Imóveis na OLX
                  </CardTitle>
                  <CardDescription>
                    Configure as credenciais da API para publicar imóveis do CRM diretamente na OLX
                  </CardDescription>
                </div>
                <span className="text-sm text-muted-foreground">
                  Requer conta OLX Pro
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Como funciona:</h4>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Crie uma conta no <a href="https://pro.olx.com.br" target="_blank" className="text-primary underline">OLX Pro</a></li>
                  <li>Acesse "Integrações" e crie uma aplicação para obter o Client ID e Secret</li>
                  <li>Configure as credenciais abaixo (elas serão salvas de forma segura)</li>
                  <li>Publique imóveis direto do CRM clicando em "Publicar na OLX"</li>
                </ol>
              </div>
              
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
              
              <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
                <p className="text-xs text-warning-foreground">
                  <strong>Nota:</strong> Para finalizar a configuração das credenciais OLX, entre em contato com o suporte ou configure os secrets <code className="bg-muted px-1 rounded">OLX_CLIENT_ID</code>, <code className="bg-muted px-1 rounded">OLX_CLIENT_SECRET</code> e <code className="bg-muted px-1 rounded">OLX_ACCESS_TOKEN</code> no backend.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" disabled>
                  <Shield className="w-4 h-4 mr-2" />
                  Conectar via OAuth
                </Button>
                <Button variant="secondary" disabled={isSyncing}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
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
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-accent flex items-center justify-center text-accent-foreground font-bold text-[10px]">
                      OLX
                    </span>
                    Captura de Leads OLX (Canal Pro)
                  </Label>
                  {lastLeadsByOrigin?.olx ? (
                    <span className="text-xs text-success flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Último: {formatDistanceToNow(new Date(lastLeadsByOrigin.olx.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Nenhum lead recebido
                    </span>
                  )}
                </div>
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
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    Configure este URL no Canal Pro da OLX para receber leads automaticamente
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testWebhook("olx")}
                    disabled={testingWebhook !== null}
                  >
                    {testingWebhook === "olx" ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Zap className="w-3 h-3 mr-1" />
                    )}
                    Testar
                  </Button>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-navy-600 flex items-center justify-center text-white font-bold text-[10px]">
                      IW
                    </span>
                    Captura de Leads ImovelWeb
                  </Label>
                  {lastLeadsByOrigin?.imovelweb ? (
                    <span className="text-xs text-success flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Último: {formatDistanceToNow(new Date(lastLeadsByOrigin.imovelweb.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Nenhum lead recebido
                    </span>
                  )}
                </div>
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
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    Configure este URL no painel do ImovelWeb para receber leads
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testWebhook("imovelweb")}
                    disabled={testingWebhook !== null}
                  >
                    {testingWebhook === "imovelweb" ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Zap className="w-3 h-3 mr-1" />
                    )}
                    Testar
                  </Button>
                </div>
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
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={testEvolutionConnection}
                  disabled={testingEvolution}
                >
                  {testingEvolution ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Testar Conexão
                </Button>
                <Button 
                  variant="secondary"
                  onClick={syncGroupNames}
                  disabled={syncingGroups}
                >
                  {syncingGroups ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Users className="w-4 h-4 mr-2" />
                  )}
                  Sincronizar Nomes de Grupos
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5" />
                    Agendamento de Mensagens WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Agende mensagens para envio automático em datas e horários específicos
                  </CardDescription>
                </div>
                <ScheduleMessageDialog />
              </div>
            </CardHeader>
            <CardContent>
              <ScheduledMessagesList />
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
