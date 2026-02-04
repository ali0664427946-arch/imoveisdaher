import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Share, MoreVertical, Plus, CheckCircle, Bell, Zap, Wifi } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="p-6">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
            <CardTitle className="text-2xl">App Instalado!</CardTitle>
            <CardDescription>
              O Daher Corretor já está instalado no seu dispositivo. Você pode acessar diretamente da tela inicial.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center max-w-lg mx-auto">
        <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Smartphone className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Instalar Daher Corretor</h1>
        <p className="text-muted-foreground mt-2">
          Tenha acesso rápido ao painel administrativo direto do seu celular
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        {/* Benefits Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vantagens do App</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Acesso Instantâneo</p>
                <p className="text-sm text-muted-foreground">
                  Abra direto da tela inicial, sem precisar abrir o navegador
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Notificações</p>
                <p className="text-sm text-muted-foreground">
                  Receba alertas de novos leads e mensagens em tempo real
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Funciona Offline</p>
                <p className="text-sm text-muted-foreground">
                  Consulte dados mesmo quando estiver sem conexão
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Install Instructions */}
        {deferredPrompt ? (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <Button onClick={handleInstallClick} className="w-full" size="lg">
                <Download className="w-5 h-5 mr-2" />
                Instalar Agora
              </Button>
            </CardContent>
          </Card>
        ) : isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como instalar no iPhone/iPad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  1
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p>Toque no botão</p>
                  <Share className="w-5 h-5 text-primary" />
                  <p>(Compartilhar) na barra inferior do Safari</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  2
                </div>
                <p>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  3
                </div>
                <p>Confirme tocando em <strong>"Adicionar"</strong></p>
              </div>
            </CardContent>
          </Card>
        ) : isAndroid ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como instalar no Android</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  1
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p>Toque no menu</p>
                  <MoreVertical className="w-5 h-5" />
                  <p>(três pontos) no canto superior</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  2
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p>Toque em <strong>"Instalar app"</strong> ou</p>
                  <Plus className="w-5 h-5" />
                  <p><strong>"Adicionar à tela inicial"</strong></p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  3
                </div>
                <p>Confirme a instalação</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como instalar</CardTitle>
              <CardDescription>
                Acesse pelo celular para ver instruções específicas do seu dispositivo, ou use o menu do navegador para adicionar à tela inicial.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
