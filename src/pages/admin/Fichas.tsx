import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MoreHorizontal,
  Eye,
  FileCheck,
  FileX,
  Bot,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useFichas, useAnalyzeFicha, useUpdateFichaStatus, AIAnalysis } from "@/hooks/useFichas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<
  string,
  { label: string; variant: "pending" | "analyzing" | "approved" | "rejected" | "secondary" }
> = {
  pendente: { label: "Pendente", variant: "pending" },
  em_analise: { label: "Em Análise", variant: "analyzing" },
  apto: { label: "Apto", variant: "approved" },
  nao_apto: { label: "Não Apto", variant: "rejected" },
  faltando_docs: { label: "Faltando Docs", variant: "secondary" },
};

interface FormDataWithAnalysis {
  ai_analysis?: AIAnalysis;
  ai_analyzed_at?: string;
  [key: string]: unknown;
}

export default function Fichas() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState<AIAnalysis | null>(null);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);

  const { data: fichas, isLoading } = useFichas();
  const analyzeMutation = useAnalyzeFicha();
  const updateStatusMutation = useUpdateFichaStatus();

  const filteredFichas = (fichas || []).filter((f) => {
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      f.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.protocol?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusCounts = Object.keys(statusConfig).reduce(
    (acc, status) => {
      acc[status] = (fichas || []).filter((f) => f.status === status).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleAnalyze = async (fichaId: string) => {
    const result = await analyzeMutation.mutateAsync(fichaId);
    if (result.analysis) {
      setSelectedAnalysis(result.analysis);
      setAnalysisDialogOpen(true);
    }
  };

  const handleShowAnalysis = (formData: unknown) => {
    const data = formData as FormDataWithAnalysis;
    if (data?.ai_analysis) {
      setSelectedAnalysis(data.ai_analysis);
      setAnalysisDialogOpen(true);
    }
  };

  const handleUpdateStatus = (fichaId: string, status: "apto" | "nao_apto") => {
    updateStatusMutation.mutate({ fichaId, status });
  };

  const maskCPF = (cpf: string) => {
    if (!cpf || cpf.length < 11) return cpf;
    return `***.***.***-${cpf.slice(-2)}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Fichas de Interesse</h1>
          <p className="text-muted-foreground">
            Gerencie e analise as fichas recebidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou protocolo..."
              className="pl-9 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="apto">Apto</SelectItem>
              <SelectItem value="nao_apto">Não Apto</SelectItem>
              <SelectItem value="faltando_docs">Faltando Docs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div
            key={key}
            className={`bg-card rounded-xl p-4 border cursor-pointer hover:border-accent transition-colors ${
              statusFilter === key ? "border-accent" : ""
            }`}
            onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
          >
            <p className="text-2xl font-bold">{statusCounts[key] || 0}</p>
            <p className="text-sm text-muted-foreground">{config.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocolo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Imóvel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Score IA</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredFichas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhuma ficha encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredFichas.map((ficha) => {
                const formData = ficha.form_data as FormDataWithAnalysis;
                const aiAnalysis = formData?.ai_analysis;
                const property = ficha.property as { title?: string; neighborhood?: string } | null;
                const documents = (ficha.documents || []) as Array<{ id: string }>;

                return (
                  <TableRow key={ficha.id}>
                    <TableCell className="font-mono text-sm">
                      {ficha.protocol || "-"}
                    </TableCell>
                    <TableCell className="font-medium">{ficha.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {maskCPF(ficha.cpf)}
                    </TableCell>
                    <TableCell>{ficha.phone}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {property?.title || property?.neighborhood || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[ficha.status]?.variant || "secondary"}>
                        {statusConfig[ficha.status]?.label || ficha.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {aiAnalysis ? (
                        <button
                          onClick={() => handleShowAnalysis(ficha.form_data)}
                          className="flex items-center justify-center gap-1 mx-auto hover:opacity-80"
                        >
                          <Sparkles className="w-3 h-3 text-accent" />
                          <span className="font-semibold">{aiAnalysis.score}</span>
                        </button>
                      ) : (
                        <Badge variant="secondary">{documents.length} docs</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ficha.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => navigate(`/admin/fichas/${ficha.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Ficha Completa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAnalyze(ficha.id)}
                            disabled={analyzeMutation.isPending}
                          >
                            {analyzeMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Bot className="w-4 h-4 mr-2" />
                            )}
                            Rodar Análise IA
                          </DropdownMenuItem>
                          {aiAnalysis && (
                            <DropdownMenuItem onClick={() => handleShowAnalysis(ficha.form_data)}>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Ver Última Análise
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-success"
                            onClick={() => handleUpdateStatus(ficha.id, "apto")}
                          >
                            <FileCheck className="w-4 h-4 mr-2" />
                            Aprovar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleUpdateStatus(ficha.id, "nao_apto")}
                          >
                            <FileX className="w-4 h-4 mr-2" />
                            Reprovar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Analysis Dialog */}
      <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Análise de IA
            </DialogTitle>
            <DialogDescription>
              Resultado da análise automática da ficha
            </DialogDescription>
          </DialogHeader>

          {selectedAnalysis && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Score */}
                <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Score Geral</span>
                    <span className="text-2xl font-bold">{selectedAnalysis.score}/100</span>
                  </div>
                  <Progress value={selectedAnalysis.score} className="h-2" />
                  <div className="flex items-center justify-between text-sm">
                    <Badge
                      variant={
                        selectedAnalysis.status_sugerido === "apto"
                          ? "approved"
                          : selectedAnalysis.status_sugerido === "nao_apto"
                          ? "rejected"
                          : "secondary"
                      }
                    >
                      {selectedAnalysis.status_sugerido.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Resumo */}
                <div>
                  <h4 className="font-semibold mb-2">Resumo</h4>
                  <p className="text-sm text-muted-foreground">{selectedAnalysis.resumo}</p>
                </div>

                {/* Análise Financeira */}
                <div>
                  <h4 className="font-semibold mb-2">💰 Análise Financeira</h4>
                  <div className="bg-secondary/30 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Renda Informada:</span>
                      <span className="font-medium">
                        R$ {selectedAnalysis.analise_financeira.renda_informada?.toLocaleString("pt-BR") || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor do Aluguel:</span>
                      <span className="font-medium">
                        R$ {selectedAnalysis.analise_financeira.valor_aluguel?.toLocaleString("pt-BR") || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Comprometimento:</span>
                      <span className="font-medium">
                        {selectedAnalysis.analise_financeira.comprometimento_renda}%
                      </span>
                    </div>
                    <p className="text-muted-foreground pt-2 border-t">
                      {selectedAnalysis.analise_financeira.parecer}
                    </p>
                  </div>
                </div>

                {/* Documentação */}
                <div>
                  <h4 className="font-semibold mb-2">📄 Documentação</h4>
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm space-y-2">
                    {selectedAnalysis.documentacao.documentos_recebidos?.length > 0 && (
                      <div>
                        <span className="text-success">✓ Recebidos: </span>
                        {selectedAnalysis.documentacao.documentos_recebidos.join(", ")}
                      </div>
                    )}
                    {selectedAnalysis.documentacao.documentos_faltantes?.length > 0 && (
                      <div>
                        <span className="text-destructive">✗ Faltantes: </span>
                        {selectedAnalysis.documentacao.documentos_faltantes.join(", ")}
                      </div>
                    )}
                    <p className="text-muted-foreground pt-2 border-t">
                      {selectedAnalysis.documentacao.parecer}
                    </p>
                  </div>
                </div>

                {/* Perfil */}
                <div>
                  <h4 className="font-semibold mb-2">👤 Perfil do Locatário</h4>
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm space-y-2">
                    {selectedAnalysis.perfil_locatario.pontos_positivos?.length > 0 && (
                      <div>
                        <span className="text-success font-medium">Pontos Positivos: </span>
                        <ul className="list-disc list-inside pl-2">
                          {selectedAnalysis.perfil_locatario.pontos_positivos.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedAnalysis.perfil_locatario.pontos_atencao?.length > 0 && (
                      <div>
                        <span className="text-warning font-medium">Pontos de Atenção: </span>
                        <ul className="list-disc list-inside pl-2">
                          {selectedAnalysis.perfil_locatario.pontos_atencao.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Riscos */}
                {selectedAnalysis.riscos?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">⚠️ Riscos Identificados</h4>
                    <ul className="bg-destructive/10 rounded-lg p-3 text-sm list-disc list-inside">
                      {selectedAnalysis.riscos.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recomendação */}
                <div>
                  <h4 className="font-semibold mb-2">✅ Recomendação Final</h4>
                  <p className="text-sm bg-accent/10 rounded-lg p-3">
                    {selectedAnalysis.recomendacao_final}
                  </p>
                </div>

                {/* Mensagem WhatsApp */}
                <div>
                  <h4 className="font-semibold mb-2">💬 Sugestão de Mensagem</h4>
                  <div className="bg-success/10 rounded-lg p-3 text-sm">
                    <p className="whitespace-pre-wrap">{selectedAnalysis.mensagem_whatsapp}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedAnalysis.mensagem_whatsapp);
                      }}
                    >
                      Copiar Mensagem
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
