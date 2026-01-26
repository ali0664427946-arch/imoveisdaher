import { useState } from "react";
import { Save, RefreshCw, Link2, Shield, Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function Settings() {
  const [olxConnected, setOlxConnected] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

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
                    Sincronize seus anúncios da OLX automaticamente
                  </CardDescription>
                </div>
                {olxConnected ? (
                  <span className="text-sm text-success flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    Conectado
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Não conectado
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Button variant="secondary">
                  <RefreshCw className="w-4 h-4" />
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
                Importe imóveis via Feed URL ou CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="feed_url">Feed URL</Label>
                <Input id="feed_url" placeholder="https://seucrm.com/feed/imoveis.xml" />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">
                  <RefreshCw className="w-4 h-4" />
                  Importar do Feed
                </Button>
                <Button variant="outline">
                  Importar CSV
                </Button>
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
                Configure a integração com WhatsApp
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
