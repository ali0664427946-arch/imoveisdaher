import { Building2, Users, FileText, MessageSquare, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  {
    title: "Imóveis Ativos",
    value: "42",
    change: "+3",
    trend: "up",
    icon: Building2,
  },
  {
    title: "Leads do Mês",
    value: "128",
    change: "+12%",
    trend: "up",
    icon: Users,
  },
  {
    title: "Fichas Pendentes",
    value: "8",
    change: "-2",
    trend: "down",
    icon: FileText,
  },
  {
    title: "Conversas Ativas",
    value: "24",
    change: "+5",
    trend: "up",
    icon: MessageSquare,
  },
];

const recentLeads = [
  { id: 1, name: "João Silva", property: "Apt 2 quartos - Pechincha", status: "novo", time: "2 min" },
  { id: 2, name: "Maria Santos", property: "Casa 3 quartos - Recreio", status: "retornar", time: "15 min" },
  { id: 3, name: "Carlos Oliveira", property: "Sala Comercial - Barra", status: "reuniao_marcada", time: "1h" },
  { id: 4, name: "Ana Costa", property: "Apt 1 quarto - Taquara", status: "novo", time: "2h" },
];

const statusColors: Record<string, string> = {
  novo: "bg-info text-info-foreground",
  retornar: "bg-warning text-warning-foreground",
  reuniao_marcada: "bg-success text-success-foreground",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  retornar: "Retornar",
  reuniao_marcada: "Reunião",
};

export default function Dashboard() {
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
                <span className="text-2xl font-bold">{stat.value}</span>
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Leads Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
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
                        {lead.property}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${statusColors[lead.status]}`}
                    >
                      {statusLabels[lead.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lead.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <button className="p-4 rounded-xl bg-accent/10 hover:bg-accent/20 transition-colors text-left">
              <Building2 className="w-6 h-6 text-accent mb-2" />
              <p className="font-medium text-sm">Novo Imóvel</p>
              <p className="text-xs text-muted-foreground">Cadastrar imóvel</p>
            </button>
            <button className="p-4 rounded-xl bg-info/10 hover:bg-info/20 transition-colors text-left">
              <Users className="w-6 h-6 text-info mb-2" />
              <p className="font-medium text-sm">Novo Lead</p>
              <p className="text-xs text-muted-foreground">Adicionar lead</p>
            </button>
            <button className="p-4 rounded-xl bg-success/10 hover:bg-success/20 transition-colors text-left">
              <MessageSquare className="w-6 h-6 text-success mb-2" />
              <p className="font-medium text-sm">Enviar Mensagem</p>
              <p className="text-xs text-muted-foreground">Template rápido</p>
            </button>
            <button className="p-4 rounded-xl bg-warning/10 hover:bg-warning/20 transition-colors text-left">
              <TrendingUp className="w-6 h-6 text-warning mb-2" />
              <p className="font-medium text-sm">Sincronizar</p>
              <p className="text-xs text-muted-foreground">OLX / ImovelWeb</p>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
