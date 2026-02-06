import { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SendNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone: string;
  contactName?: string;
}

export function SendNowDialog({
  open,
  onOpenChange,
  defaultPhone,
  contactName,
}: SendNowDialogProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Sync phone when prop changes
  useEffect(() => {
    setPhone(defaultPhone);
  }, [defaultPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !message.trim()) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { phone: phone.trim(), message: message.trim() },
      });

      if (error) throw new Error(error.message || "Erro ao enviar mensagem");
      if (!data?.success) throw new Error(data?.error || "Falha ao enviar");

      toast({
        title: "Mensagem enviada! ✅",
        description: `Mensagem enviada para ${contactName || phone}`,
      });
      setMessage("");
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erro ao enviar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Enviar Mensagem WhatsApp
            </DialogTitle>
            <DialogDescription>
              {contactName
                ? `Enviar mensagem agora para ${contactName}`
                : "A mensagem será enviada imediatamente via WhatsApp"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="send-phone">Telefone</Label>
              <Input
                id="send-phone"
                placeholder="(21) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="send-message">Mensagem</Label>
                <TemplateSelector
                  onSelect={(content) => setMessage(content)}
                  channel="whatsapp"
                />
              </div>
              <Textarea
                id="send-message"
                placeholder="Digite a mensagem ou selecione um template..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSending || !phone.trim() || !message.trim()}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Agora
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
