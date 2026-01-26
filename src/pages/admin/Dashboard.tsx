import { Building2, Users, FileText, MessageSquare, TrendingUp, ArrowUpRight, ArrowDownRight, Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricsCharts } from "@/components/dashboard/MetricsCharts";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, string> = {
  novo: "bg-info text-info-foreground",
  retornar: "bg-warning text-warning-foreground",
  reuniao_marcada: "bg-success text-success-foreground",
  nao_atendeu: "bg-muted text-muted-foreground",
  fechado: "bg-accent text-accent-foreground",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  retornar: "Retornar",
  reuniao_marcada: "Reunião",
  nao_atendeu: "Não Atendeu",
  fechado: "Fechado",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  
  // Enable realtime notifications
  useRealtimeNotifications();

  // Fetch recent leads
  const { data: recentLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ["recent-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id,
          name,
          status,
          created_at,
          property:properties(title, neighborhood)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const stats = [
    {
      title: "Imóveis Ativos",
      value: metricsLoading ? "-" : String(metrics?.totalProperties || 0),
      change: "",
      trend: null,
      icon: Building2,
    },
    {
      title: "Leads do Mês",
      value: metricsLoading ? "-" : String(metrics?.leadsThisMonth || 0),
      change: "",
      trend: null,
      icon: Users,
    },
    {
      title: "Fichas Pendentes",
      value: metricsLoading ? "-" : String(metrics?.fichasByStatus.find(f => f.status === "pendente")?.count || 0),
      change: "",
      trend: null,
      icon: FileText,
    },
    {
      title: "Conversas Ativas",
      value: metricsLoading ? "-" : String(metrics?.activeConversations || 0),
      change: "",
      trend: null,
      icon: MessageSquare,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu negócio imobiliário
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                {metricsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <span className="text-2xl font-bold">{stat.value}</span>
                )}
                {stat.change && stat.trend && (
                  <span
                    className={`text-xs flex items-center ${
                      stat.trend === "up" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {stat.change}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Metrics Charts */}
      <MetricsCharts
        fichasByStatus={metrics?.fichasByStatus || []}
        conversionRate={metrics?.conversionRate || 0}
        avgAnalysisTime={metrics?.avgAnalysisTime || 0}
        isLoading={metricsLoading}
      />

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Fichas
            </CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold">{metrics?.totalFichas || 0}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fichas Este Mês
            </CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold">{metrics?.fichasThisMonth || 0}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Leads
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold">{metrics?.totalLeads || 0}</span>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Leads Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leadsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : recentLeads && recentLeads.length > 0 ? (
                recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                    onClick={() => navigate("/admin/leads")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-accent">
                          {lead.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.property?.title || "Sem imóvel"} - {lead.property?.neighborhood || ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${statusColors[lead.status] || "bg-muted"}`}
                      >
                        {statusLabels[lead.status] || lead.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(lead.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum lead encontrado
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <button 
              className="p-4 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors text-left"
              onClick={() => navigate("/admin/properties")}
            >
              <Building2 className="w-6 h-6 text-accent mb-2" />
              <p className="font-medium text-sm">Novo Imóvel</p>
              <p className="text-xs text-muted-foreground">Cadastrar imóvel</p>
            </button>
            <button 
              className="p-4 rounded-xl bg-info/10 hover:bg-info/20 transition-colors text-left"
              onClick={() => navigate("/admin/leads")}
            >
              <Users className="w-6 h-6 text-info mb-2" />
              <p className="font-medium text-sm">Novo Lead</p>
              <p className="text-xs text-muted-foreground">Adicionar lead</p>
            </button>
            <button 
              className="p-4 rounded-xl bg-success/10 hover:bg-success/20 transition-colors text-left"
              onClick={() => navigate("/admin/fichas")}
            >
              <FileText className="w-6 h-6 text-success mb-2" />
              <p className="font-medium text-sm">Ver Fichas</p>
              <p className="text-xs text-muted-foreground">Gerenciar fichas</p>
            </button>
            <button 
              className="p-4 rounded-xl bg-warning/10 hover:bg-warning/20 transition-colors text-left"
              onClick={() => navigate("/admin/inbox")}
            >
              <MessageSquare className="w-6 h-6 text-warning mb-2" />
              <p className="font-medium text-sm">Inbox</p>
              <p className="text-xs text-muted-foreground">Ver mensagens</p>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
