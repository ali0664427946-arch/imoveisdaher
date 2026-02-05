import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownLeft, ArrowUpRight, MessageSquare, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function MessageStatsGrid() {
  const { data: messageStats } = useQuery({
    queryKey: ["integration-status-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: inboundCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "inbound")
        .gte("created_at", since);

      const { count: outboundCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("direction", "outbound")
        .gte("created_at", since);

      const { count: activeConvs } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("channel", "whatsapp")
        .gte("last_message_at", since);

      return {
        inbound: inboundCount || 0,
        outbound: outboundCount || 0,
        activeConversations: activeConvs || 0,
      };
    },
    refetchInterval: 30000,
  });

  const { data: unreadCount } = useQuery({
    queryKey: ["integration-status-unread"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("unread_count")
        .eq("channel", "whatsapp")
        .gt("unread_count", 0);
      return data?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0;
    },
    refetchInterval: 15000,
  });

  const stats = [
    { icon: ArrowDownLeft, color: "text-blue-500", bg: "bg-blue-500/10", value: messageStats?.inbound, label: "Recebidas (24h)" },
    { icon: ArrowUpRight, color: "text-green-500", bg: "bg-green-500/10", value: messageStats?.outbound, label: "Enviadas (24h)" },
    { icon: MessageSquare, color: "text-primary", bg: "bg-primary/10", value: messageStats?.activeConversations, label: "Conversas ativas (24h)" },
    { icon: Inbox, color: "text-orange-500", bg: "bg-orange-500/10", value: unreadCount, label: "Não lidas" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
