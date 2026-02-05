import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wifi,
  WifiOff,
  Loader2,
  Activity,
  Server,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function WhatsAppConnectionCard() {
  const [testingConnection, setTestingConnection] = useState(false);
  const { toast } = useToast();

  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    state?: string;
    instance?: string;
    message?: string;
    error?: string;
    testedAt?: string;
  } | null>(null);

  const connectionState = connectionResult?.state;
  const isConnected = connectionState === "open";

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
        toast({ title: "Falha na conexão ❌", description: error.message, variant: "destructive" });
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
        toast({ title: "Conexão OK! ✅", description: data.message || `Instância ${data.instance} (${data.state})` });
      } else {
        toast({ title: "Problema na conexão ⚠️", description: data?.details || data?.error || "Verifique as configurações", variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setConnectionResult({ success: false, error: msg, testedAt: new Date().toISOString() });
      toast({ title: "Erro ❌", description: msg, variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
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
              {testingConnection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
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
  );
}
