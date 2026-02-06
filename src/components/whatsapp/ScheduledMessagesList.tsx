import { Clock, CheckCircle, XCircle, Trash2, Ban, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScheduledMessages, ScheduledMessage } from "@/hooks/useScheduledMessages";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig = {
  pending: {
    label: "Pendente",
    icon: Clock,
    variant: "secondary" as const,
  },
  sent: {
    label: "Enviada",
    icon: CheckCircle,
    variant: "default" as const,
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    variant: "destructive" as const,
  },
  cancelled: {
    label: "Cancelada",
    icon: Ban,
    variant: "outline" as const,
  },
};

function MessageCard({
  message,
  onCancel,
  onDelete,
}: {
  message: ScheduledMessage;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const config = statusConfig[message.status];
  const StatusIcon = config.icon;
  const isOverdue = message.status === "pending" && isPast(new Date(message.scheduled_at));

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={config.variant} className="flex items-center gap-1">
            <StatusIcon className="w-3 h-3" />
            {config.label}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-xs">
              Atrasada
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {message.status === "pending" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onCancel(message.id)}
              title="Cancelar envio"
            >
              <Ban className="w-4 h-4" />
            </Button>
          )}
          {message.status !== "pending" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(message.id)}
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Phone className="w-4 h-4" />
        <span>{message.phone}</span>
      </div>

      <div className="flex items-start gap-2">
        <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-sm line-clamp-2">{message.message}</p>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {message.status === "sent" && message.sent_at
            ? `Enviada ${formatDistanceToNow(new Date(message.sent_at), { addSuffix: true, locale: ptBR })}`
            : message.status === "pending"
            ? `Agendada para ${format(new Date(message.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
            : `Criada ${formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ptBR })}`}
        </span>
        {message.error_message && (
          <span className="text-destructive">{message.error_message}</span>
        )}
      </div>
    </div>
  );
}

export function ScheduledMessagesList() {
  const {
    pendingMessages,
    sentMessages,
    failedMessages,
    isLoading,
    cancelMessage,
    deleteMessage,
  } = useScheduledMessages();

  const cancelledMessages = (failedMessages || []).filter(
    (m) => m.status === "cancelled"
  );
  const actualFailedMessages = (failedMessages || []).filter(
    (m) => m.status === "failed"
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando mensagens agendadas...
        </CardContent>
      </Card>
    );
  }

  const totalMessages =
    pendingMessages.length +
    sentMessages.length +
    actualFailedMessages.length +
    cancelledMessages.length;

  if (totalMessages === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma mensagem agendada</p>
          <p className="text-sm mt-1">
            Agende mensagens para envio automático via WhatsApp
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {pendingMessages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pendentes ({pendingMessages.length})
            </CardTitle>
            <CardDescription>
              Mensagens aguardando envio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {pendingMessages.map((msg) => (
                  <MessageCard
                    key={msg.id}
                    message={msg}
                    onCancel={cancelMessage}
                    onDelete={deleteMessage}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {sentMessages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Enviadas ({sentMessages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {sentMessages.map((msg) => (
                  <MessageCard
                    key={msg.id}
                    message={msg}
                    onCancel={cancelMessage}
                    onDelete={deleteMessage}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {(actualFailedMessages.length > 0 || cancelledMessages.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Falhas/Canceladas ({actualFailedMessages.length + cancelledMessages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {[...actualFailedMessages, ...cancelledMessages].map((msg) => (
                  <MessageCard
                    key={msg.id}
                    message={msg}
                    onCancel={cancelMessage}
                    onDelete={deleteMessage}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
