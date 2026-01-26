import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FichaStatusCount {
  status: string;
  count: number;
}

interface MetricsChartsProps {
  fichasByStatus: FichaStatusCount[];
  conversionRate: number;
  avgAnalysisTime: number;
  isLoading?: boolean;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_analise: "Em Análise",
  apto: "Apto",
  nao_apto: "Não Apto",
  faltando_docs: "Faltando Docs",
};

const statusColors: Record<string, string> = {
  pendente: "hsl(var(--warning))",
  em_analise: "hsl(var(--info))",
  apto: "hsl(var(--success))",
  nao_apto: "hsl(var(--destructive))",
  faltando_docs: "hsl(var(--muted-foreground))",
};

export function MetricsCharts({
  fichasByStatus,
  conversionRate,
  avgAnalysisTime,
  isLoading,
}: MetricsChartsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const pieData = fichasByStatus.map((item) => ({
    name: statusLabels[item.status] || item.status,
    value: item.count,
    color: statusColors[item.status] || "hsl(var(--muted))",
  }));

  const barData = fichasByStatus.map((item) => ({
    name: statusLabels[item.status] || item.status,
    quantidade: item.count,
    fill: statusColors[item.status] || "hsl(var(--muted))",
  }));

  const conversionData = [
    { name: "Aprovados", value: conversionRate, color: "hsl(var(--success))" },
    { name: "Outros", value: 100 - conversionRate, color: "hsl(var(--muted))" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Bar Chart - Fichas por Status */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg font-heading">Fichas por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pie Chart - Taxa de Conversão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Taxa de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={conversionData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {conversionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center mt-4">
            <p className="text-3xl font-bold text-success">{conversionRate}%</p>
            <p className="text-sm text-muted-foreground">Fichas aprovadas</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Tempo Médio de Análise</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-4xl font-bold text-accent">{avgAnalysisTime}h</p>
          <p className="text-sm text-muted-foreground mt-2">Média em horas</p>
        </CardContent>
      </Card>

      {/* Pie Chart - Distribuição de Status */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg font-heading">Distribuição de Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
