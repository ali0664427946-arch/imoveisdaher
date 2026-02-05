import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, Clock, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function MessageCard({ direction }: { direction: "inbound" | "outbound" }) {
  const isInbound = direction === "inbound";

  const { data: message, isLoading } = useQuery({
    queryKey: [`integration-status-last-${direction}`],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, content, created_at, conversation_id, direction, message_type")
        .eq("direction", direction)
        .eq("provider", "evolution")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 15000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isInbound ? (
            <ArrowDownLeft className="w-4 h-4 text-blue-500" />
          ) : (
            <ArrowUpRight className="w-4 h-4 text-green-500" />
          )}
          {isInbound ? "Última Mensagem Recebida" : "Última Mensagem Enviada"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : message ? (
          <div className="space-y-2">
            <p className="text-sm line-clamp-2">
              {message.content || `[${message.message_type}]`}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {format(new Date(message.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              <span>•</span>
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ptBR })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              Nenhuma mensagem {isInbound ? "recebida" : "enviada"} encontrada
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LastMessagesCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <MessageCard direction="inbound" />
      <MessageCard direction="outbound" />
    </div>
  );
}
