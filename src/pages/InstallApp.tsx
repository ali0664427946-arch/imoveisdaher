import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Share, MoreVertical, Plus, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallApp() {
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">App Instalado!</CardTitle>
            <CardDescription>
              O Daher Imóveis já está instalado no seu dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/">
              <Button className="w-full">Ir para o App</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-12 px-4 text-center">
        <img 
          src="/pwa-192x192.png" 
          alt="Daher Imóveis" 
          className="w-24 h-24 mx-auto rounded-2xl shadow-lg mb-4"
        />
        <h1 className="text-3xl font-bold mb-2">Daher Imóveis</h1>
        <p className="text-primary-foreground/80">Instale nosso app no seu celular</p>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 -mt-6">
        {/* Benefits Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Por que instalar?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Acesso rápido</p>
                <p className="text-sm text-muted-foreground">
                  Abra direto da tela inicial, como um app nativo
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Funciona offline</p>
                <p className="text-sm text-muted-foreground">
                  Navegue pelos imóveis mesmo sem internet
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Install Instructions */}
        {deferredPrompt ? (
          <Card className="border-primary">
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
              <CardTitle>Como instalar no iPhone/iPad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  1
                </div>
                <div className="flex items-center gap-2">
                  <p>Toque no botão</p>
                  <Share className="w-5 h-5 text-blue-500" />
                  <p>(Compartilhar)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  2
                </div>
                <p>Role para baixo e toque em "Adicionar à Tela de Início"</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  3
                </div>
                <p>Confirme tocando em "Adicionar"</p>
              </div>
            </CardContent>
          </Card>
        ) : isAndroid ? (
          <Card>
            <CardHeader>
              <CardTitle>Como instalar no Android</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  1
                </div>
                <div className="flex items-center gap-2">
                  <p>Toque no menu</p>
                  <MoreVertical className="w-5 h-5" />
                  <p>(três pontos)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0 text-sm font-bold">
                  2
                </div>
                <div className="flex items-center gap-2">
                  <p>Toque em "Instalar app" ou</p>
                  <Plus className="w-5 h-5" />
                  <p>"Adicionar à tela inicial"</p>
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
              <CardTitle>Como instalar</CardTitle>
              <CardDescription>
                Use o menu do seu navegador para adicionar à tela inicial
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Back to home */}
        <div className="text-center pt-4">
          <Link to="/" className="text-primary hover:underline">
            ← Voltar para o site
          </Link>
        </div>
      </div>
    </div>
  );
}
