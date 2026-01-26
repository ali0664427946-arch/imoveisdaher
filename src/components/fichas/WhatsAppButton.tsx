import { useState } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSendWhatsApp } from "@/hooks/useWhatsApp";

interface WhatsAppButtonProps {
  phone: string;
  fichaId?: string;
  suggestedMessage?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function WhatsAppButton({
  phone,
  fichaId,
  suggestedMessage = "",
  variant = "default",
  size = "default",
  className,
}: WhatsAppButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(suggestedMessage);
  const [editablePhone, setEditablePhone] = useState(phone);
  const { mutate: sendWhatsApp, isPending } = useSendWhatsApp();

  const handleSend = () => {
    sendWhatsApp(
      { phone: editablePhone, message, fichaId },
      {
        onSuccess: () => {
          setOpen(false);
          setMessage(suggestedMessage);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <MessageCircle className="w-4 h-4 mr-2" />
          Enviar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem WhatsApp</DialogTitle>
          <DialogDescription>
            Envie uma mensagem diretamente para o cliente via WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={editablePhone}
              onChange={(e) => setEditablePhone(e.target.value)}
              placeholder="(21) 99999-9999"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              {message.length} caracteres
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isPending || !message.trim() || !editablePhone.trim()}
            className="bg-success hover:bg-success/90"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
