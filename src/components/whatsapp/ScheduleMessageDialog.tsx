import { useState } from "react";
import { Calendar, Clock, Send, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useScheduledMessages, CreateScheduledMessageInput } from "@/hooks/useScheduledMessages";
import { format, addHours, setHours, setMinutes } from "date-fns";

interface ScheduleMessageDialogProps {
  trigger?: React.ReactNode;
  defaultPhone?: string;
  defaultMessage?: string;
  leadId?: string;
  fichaId?: string;
  conversationId?: string;
  onSuccess?: () => void;
}

export function ScheduleMessageDialog({
  trigger,
  defaultPhone = "",
  defaultMessage = "",
  leadId,
  fichaId,
  conversationId,
  onSuccess,
}: ScheduleMessageDialogProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState(defaultMessage);
  const [date, setDate] = useState(format(addHours(new Date(), 1), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(addHours(new Date(), 1), "HH:mm"));

  const { scheduleMessage, isScheduling } = useScheduledMessages();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim() || !message.trim()) return;

    const [hours, minutes] = time.split(":").map(Number);
    const scheduledAt = setMinutes(setHours(new Date(date), hours), minutes);

    const input: CreateScheduledMessageInput = {
      phone: phone.trim(),
      message: message.trim(),
      scheduled_at: scheduledAt,
      lead_id: leadId,
      ficha_id: fichaId,
      conversation_id: conversationId,
    };

    scheduleMessage(input, {
      onSuccess: () => {
        setOpen(false);
        setPhone(defaultPhone);
        setMessage(defaultMessage);
        onSuccess?.();
      },
    });
  };

  const quickScheduleOptions = [
    { label: "Em 1 hora", hours: 1 },
    { label: "Em 2 horas", hours: 2 },
    { label: "Amanhã 9h", hours: null, tomorrow9: true },
    { label: "Amanhã 14h", hours: null, tomorrow14: true },
  ];

  const handleQuickSchedule = (option: typeof quickScheduleOptions[0]) => {
    const now = new Date();
    let scheduledDate: Date;

    if (option.hours) {
      scheduledDate = addHours(now, option.hours);
    } else if (option.tomorrow9) {
      scheduledDate = setMinutes(setHours(addHours(now, 24), 9), 0);
    } else if (option.tomorrow14) {
      scheduledDate = setMinutes(setHours(addHours(now, 24), 14), 0);
    } else {
      return;
    }

    setDate(format(scheduledDate, "yyyy-MM-dd"));
    setTime(format(scheduledDate, "HH:mm"));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Clock className="w-4 h-4 mr-2" />
            Agendar Mensagem
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Agendar Mensagem WhatsApp
            </DialogTitle>
            <DialogDescription>
              A mensagem será enviada automaticamente no horário programado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                placeholder="Digite a mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="mt-1"
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

            <div>
              <Label className="text-xs text-muted-foreground">Atalhos</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {quickScheduleOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSchedule(option)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isScheduling || !phone.trim() || !message.trim()}
            >
              {isScheduling ? (
                "Agendando..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Agendar Envio
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
