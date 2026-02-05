import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Building2,
  Users,
  FileText,
  Bot,
  Loader2,
  Sparkles,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DocumentUploader,
  UploadedDocument,
} from "@/components/fichas/DocumentUploader";
import { WhatsAppButton } from "@/components/fichas/WhatsAppButton";
import { ScheduleMessageDialog } from "@/components/whatsapp/ScheduleMessageDialog";
import {
  useFichaById,
  useAnalyzeFicha,
  useUpdateFichaStatus,
  AIAnalysis,
} from "@/hooks/useFichas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

const employmentTypeLabels: Record<string, string> = {
  clt: "CLT",
  autonomo: "Autônomo",
  empresario: "Empresário",
  aposentado: "Aposentado",
  funcionario_publico: "Funcionário Público",
};

interface FormDataWithAnalysis {
  ai_analysis?: AIAnalysis;
  ai_analyzed_at?: string;
  [key: string]: unknown;
}

export default function FichaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ficha, isLoading, refetch } = useFichaById(id);
  const analyzeMutation = useAnalyzeFicha();
  const updateStatusMutation = useUpdateFichaStatus();

  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!ficha) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Ficha não encontrada</p>
      </div>
    );
  }

  const formData = ficha.form_data as FormDataWithAnalysis;
  const aiAnalysis = formData?.ai_analysis;
  const aiAnalyses = (ficha.ai_analyses || []) as unknown as AIAnalysis[];
  const property = ficha.property as {
    title?: string;
    price?: number;
    neighborhood?: string;
    type?: string;
  } | null;
  const docs = (ficha.documents || []) as Array<{
    id: string;
    category: string;
    file_name: string;
    file_url: string;
    status: string;
    mime_type?: string;
  }>;

  const handleAnalyze = async () => {
    await analyzeMutation.mutateAsync(ficha.id);
    refetch();
  };

  const handleUpdateStatus = (status: "apto" | "nao_apto" | "em_analise" | "faltando_docs") => {
    updateStatusMutation.mutate({ fichaId: ficha.id, status });
  };

  const maskCPF = (cpf: string) => {
    if (!cpf || cpf.length < 11) return cpf;
    return `***.***.***-${cpf.slice(-2)}`;
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-heading font-bold">{ficha.full_name}</h1>
              <Badge variant={statusConfig[ficha.status]?.variant || "secondary"}>
                {statusConfig[ficha.status]?.label || ficha.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Protocolo: {ficha.protocol || "-"} • Criada em{" "}
              {format(new Date(ficha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <WhatsAppButton
            phone={ficha.phone}
            fichaId={ficha.id}
            suggestedMessage={aiAnalysis?.mensagem_whatsapp || ""}
            variant="outline"
          />
          <ScheduleMessageDialog
            defaultPhone={ficha.phone}
            fichaId={ficha.id}
            defaultMessage={aiAnalysis?.mensagem_whatsapp || ""}
          />
          <Button
            variant="outline"
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bot className="w-4 h-4 mr-2" />
            )}
            Analisar com IA
          </Button>
          <Button
            variant="outline"
            className="text-success border-success/30 hover:bg-success/10"
            onClick={() => handleUpdateStatus("apto")}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Aprovar
          </Button>
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => handleUpdateStatus("nao_apto")}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reprovar
          </Button>
        </div>
      </div>

      {/* AI Analysis Banner */}
      {aiAnalysis && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <span className="font-medium">Análise IA</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{aiAnalysis.score}</span>
                  <span className="text-muted-foreground">/100</span>
                </div>
                <Progress value={aiAnalysis.score} className="w-32 h-2" />
                <Badge
                  variant={
                    aiAnalysis.status_sugerido === "apto"
                      ? "approved"
                      : aiAnalysis.status_sugerido === "nao_apto"
                      ? "rejected"
                      : "secondary"
                  }
                >
                  {aiAnalysis.status_sugerido.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-md truncate">
                {aiAnalysis.resumo}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="dados" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dados">
            <User className="w-4 h-4 mr-2" />
            Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileText className="w-4 h-4 mr-2" />
            Documentos ({docs.length})
          </TabsTrigger>
          <TabsTrigger value="analises">
            <Sparkles className="w-4 h-4 mr-2" />
            Histórico IA ({aiAnalyses.length + (aiAnalysis ? 1 : 0)})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dados Pessoais */}
        <TabsContent value="dados" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" />
                  Informações Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome Completo</p>
                    <p className="font-medium">{ficha.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPF</p>
                    <p className="font-medium font-mono">{maskCPF(ficha.cpf)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">RG</p>
                    <p className="font-medium">{ficha.rg || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium">
                      {ficha.birth_date
                        ? format(new Date(ficha.birth_date), "dd/MM/yyyy")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estado Civil</p>
                    <p className="font-medium capitalize">{ficha.marital_status || "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="w-5 h-5" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone/WhatsApp</p>
                    <p className="font-medium">{ficha.phone}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(ficha.phone)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium">{ficha.email || "-"}</p>
                  </div>
                  {ficha.email && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(ficha.email!)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  Endereço Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">
                  {ficha.address_street
                    ? `${ficha.address_street}, ${ficha.address_number || "S/N"}`
                    : "-"}
                </p>
                {ficha.address_complement && (
                  <p className="text-muted-foreground">{ficha.address_complement}</p>
                )}
                <p className="text-muted-foreground">
                  {ficha.address_neighborhood}, {ficha.address_city} - {ficha.address_state}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  CEP: {ficha.address_cep || "-"}
                </p>
              </CardContent>
            </Card>

            {/* Professional */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="w-5 h-5" />
                  Dados Profissionais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Ocupação</p>
                    <p className="font-medium">{ficha.occupation || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo de Vínculo</p>
                    <p className="font-medium">
                      {ficha.employment_type
                        ? employmentTypeLabels[ficha.employment_type] || ficha.employment_type
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Empresa</p>
                    <p className="font-medium">{ficha.company || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Renda Mensal</p>
                    <p className="font-medium text-success">
                      {formatCurrency(ficha.income)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Residents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  Moradores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Quantidade</p>
                    <p className="font-medium">
                      {ficha.residents_count || 1} pessoa(s)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Animais de Estimação</p>
                    <p className="font-medium">{ficha.has_pets ? "Sim" : "Não"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Property Interest */}
            {property && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5" />
                    Imóvel de Interesse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">{property.title}</p>
                  <p className="text-muted-foreground">
                    {property.type} • {property.neighborhood}
                  </p>
                  <p className="text-lg font-bold text-accent">
                    {formatCurrency(property.price || 0)}/mês
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Observations */}
          {ficha.observations && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {ficha.observations}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documentos Enviados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentUploader
                fichaId={ficha.id}
                documents={docs.map((d) => ({
                  id: d.id,
                  category: d.category,
                  file_name: d.file_name,
                  file_url: d.file_url,
                  status: d.status,
                  mime_type: d.mime_type,
                }))}
                onDocumentsChange={() => refetch()}
                readOnly
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Histórico IA */}
        <TabsContent value="analises">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Histórico de Análises IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiAnalysis ? (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-6">
                    {/* Current Analysis */}
                    <div className="border rounded-xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {formData?.ai_analyzed_at
                                ? format(
                                    new Date(formData.ai_analyzed_at as string),
                                    "dd/MM/yyyy 'às' HH:mm",
                                    { locale: ptBR }
                                  )
                                : "Análise mais recente"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-bold">{aiAnalysis.score}</span>
                          <span className="text-muted-foreground">/100</span>
                          <Badge
                            variant={
                              aiAnalysis.status_sugerido === "apto"
                                ? "approved"
                                : aiAnalysis.status_sugerido === "nao_apto"
                                ? "rejected"
                                : "secondary"
                            }
                          >
                            {aiAnalysis.status_sugerido.replace("_", " ").toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold mb-2">Resumo</h4>
                        <p className="text-muted-foreground">{aiAnalysis.resumo}</p>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">💰 Análise Financeira</h4>
                        <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span>Renda Informada:</span>
                            <span className="font-medium">
                              {formatCurrency(aiAnalysis.analise_financeira?.renda_informada)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Valor do Aluguel:</span>
                            <span className="font-medium">
                              {formatCurrency(aiAnalysis.analise_financeira?.valor_aluguel)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Comprometimento:</span>
                            <span className="font-medium">
                              {aiAnalysis.analise_financeira?.comprometimento_renda}%
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground pt-2 border-t">
                            {aiAnalysis.analise_financeira?.parecer}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">📄 Documentação</h4>
                        <div className="bg-secondary/30 rounded-lg p-4 text-sm space-y-2">
                          {aiAnalysis.documentacao?.documentos_recebidos?.length > 0 && (
                            <div>
                              <span className="text-success">✓ Recebidos: </span>
                              {aiAnalysis.documentacao.documentos_recebidos.join(", ")}
                            </div>
                          )}
                          {aiAnalysis.documentacao?.parecer && (
                            <p className="text-muted-foreground pt-2 border-t">
                              {aiAnalysis.documentacao.parecer}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">👤 Perfil do Locatário</h4>
                        <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                          {aiAnalysis.perfil_locatario?.pontos_positivos?.length > 0 && (
                            <div>
                              <span className="text-success font-medium">Pontos Positivos: </span>
                              <ul className="list-disc list-inside pl-2">
                                {aiAnalysis.perfil_locatario.pontos_positivos.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiAnalysis.perfil_locatario?.pontos_atencao?.length > 0 && (
                            <div className="mt-2">
                              <span className="text-warning font-medium">Pontos de Atenção: </span>
                              <ul className="list-disc list-inside pl-2">
                                {aiAnalysis.perfil_locatario.pontos_atencao.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {aiAnalysis.riscos?.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">⚠️ Riscos Identificados</h4>
                          <ul className="bg-destructive/10 rounded-lg p-4 list-disc list-inside">
                            {aiAnalysis.riscos.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold mb-2">✅ Recomendação Final</h4>
                        <p className="bg-accent/10 rounded-lg p-4">
                          {aiAnalysis.recomendacao_final}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">💬 Sugestão de Mensagem WhatsApp</h4>
                        <div className="bg-success/10 rounded-lg p-4">
                          <p className="whitespace-pre-wrap text-sm">
                            {aiAnalysis.mensagem_whatsapp}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => copyToClipboard(aiAnalysis.mensagem_whatsapp)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar Mensagem
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma análise realizada ainda</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={handleAnalyze}
                    disabled={analyzeMutation.isPending}
                  >
                    {analyzeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Bot className="w-4 h-4 mr-2" />
                    )}
                    Executar Primeira Análise
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
