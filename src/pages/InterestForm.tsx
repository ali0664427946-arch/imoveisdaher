import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  Phone,
  Home,
  Briefcase,
  Users,
  CheckCircle,
  Building2,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  DocumentUploader,
  UploadedDocument,
} from "@/components/fichas/DocumentUploader";

const STEPS = [
  { id: 1, title: "Dados Pessoais", icon: User },
  { id: 2, title: "Contato", icon: Phone },
  { id: 3, title: "Endereço", icon: Home },
  { id: 4, title: "Profissional", icon: Briefcase },
  { id: 5, title: "Moradores", icon: Users },
  { id: 6, title: "Documentos", icon: FileText },
  { id: 7, title: "Confirmação", icon: CheckCircle },
];

interface FormData {
  fullName: string;
  cpf: string;
  rg: string;
  birthDate: string;
  maritalStatus: string;
  phone: string;
  email: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  occupation: string;
  employmentType: string;
  company: string;
  income: string;
  residentsCount: string;
  hasPets: string;
  observations: string;
}

export default function InterestForm() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<FormData>>({});
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedProtocol, setSubmittedProtocol] = useState<string | null>(null);

  // Fetch property from database
  const { data: property } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!propertyId,
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const parseIncome = (incomeStr: string): number => {
    if (!incomeStr) return 0;
    const cleaned = incomeStr
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.cpf || !formData.phone) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create ficha
      const { data: ficha, error: fichaError } = await supabase
        .from("fichas")
        .insert({
          full_name: formData.fullName,
          cpf: formData.cpf.replace(/\D/g, ""),
          rg: formData.rg,
          phone: formData.phone,
          email: formData.email,
          birth_date: formData.birthDate || null,
          marital_status: formData.maritalStatus,
          address_cep: formData.cep,
          address_street: formData.street,
          address_number: formData.number,
          address_complement: formData.complement,
          address_neighborhood: formData.neighborhood,
          address_city: formData.city,
          address_state: formData.state || "RJ",
          occupation: formData.occupation,
          company: formData.company,
          employment_type: formData.employmentType as any,
          income: parseIncome(formData.income || ""),
          residents_count: parseInt(formData.residentsCount || "1"),
          has_pets: formData.hasPets === "sim",
          observations: formData.observations,
          property_id: propertyId || null,
          status: "pendente",
        })
        .select()
        .single();

      if (fichaError) throw fichaError;

      // Save documents to database (already uploaded to storage)
      if (documents.length > 0 && ficha) {
        const docsToInsert = documents.map((doc) => ({
          ficha_id: ficha.id,
          category: doc.category,
          file_name: doc.file_name,
          file_url: doc.file_url,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
        }));

        await supabase.from("documents").insert(docsToInsert);
      }

      setSubmittedProtocol(ficha.protocol);
      toast.success("Ficha enviada com sucesso!");
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Erro ao enviar ficha. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number, purpose: string) => {
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(price);
    return purpose === "rent" ? `${formatted}/mês` : formatted;
  };

  // Success screen
  if (submittedProtocol) {
    return (
      <div className="min-h-screen bg-secondary/30 py-12 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-2xl font-heading font-bold mb-2">
            Ficha Enviada com Sucesso!
          </h1>
          <p className="text-muted-foreground mb-6">
            Sua ficha de interesse foi recebida e será analisada em breve.
          </p>
          <div className="bg-card rounded-xl p-4 mb-6">
            <p className="text-sm text-muted-foreground">Seu protocolo:</p>
            <p className="text-xl font-mono font-bold text-accent">
              {submittedProtocol}
            </p>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Guarde este número para acompanhar o status da sua solicitação.
            Entraremos em contato pelo telefone ou e-mail informados.
          </p>
          <Button onClick={() => navigate("/")} variant="hero">
            Voltar para o Início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4">
              <Building2 className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-3xl font-heading font-bold mb-2">
              Ficha de Interesse
            </h1>
            {property && (
              <p className="text-muted-foreground">
                {property.title} • {formatPrice(property.price, property.purpose)}
              </p>
            )}
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div className="relative flex items-center w-full">
                    {index > 0 && (
                      <div
                        className={`absolute left-0 right-1/2 h-0.5 -translate-y-1/2 top-1/2 ${
                          currentStep > step.id ? "bg-accent" : "bg-border"
                        }`}
                      />
                    )}
                    {index < STEPS.length - 1 && (
                      <div
                        className={`absolute left-1/2 right-0 h-0.5 -translate-y-1/2 top-1/2 ${
                          currentStep > step.id ? "bg-accent" : "bg-border"
                        }`}
                      />
                    )}
                    <div
                      className={`relative z-10 mx-auto w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        currentStep >= step.id
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currentStep > step.id ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                  <span
                    className={`mt-2 text-xs hidden md:block ${
                      currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-card rounded-2xl shadow-card p-6 md:p-8">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: Personal Data */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Dados Pessoais</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="fullName">Nome Completo *</Label>
                      <Input
                        id="fullName"
                        placeholder="Digite seu nome completo"
                        value={formData.fullName || ""}
                        onChange={(e) => handleInputChange("fullName", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        placeholder="000.000.000-00"
                        value={formData.cpf || ""}
                        onChange={(e) => handleInputChange("cpf", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rg">RG</Label>
                      <Input
                        id="rg"
                        placeholder="00.000.000-0"
                        value={formData.rg || ""}
                        onChange={(e) => handleInputChange("rg", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="birthDate">Data de Nascimento</Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={formData.birthDate || ""}
                        onChange={(e) => handleInputChange("birthDate", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maritalStatus">Estado Civil</Label>
                      <Select
                        value={formData.maritalStatus || ""}
                        onValueChange={(v) => handleInputChange("maritalStatus", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                          <SelectItem value="uniao_estavel">União Estável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Contact */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Contato</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                      <Input
                        id="phone"
                        placeholder="(00) 00000-0000"
                        value={formData.phone || ""}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={formData.email || ""}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Address */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Endereço Atual</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        placeholder="00000-000"
                        value={formData.cep || ""}
                        onChange={(e) => handleInputChange("cep", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="street">Rua</Label>
                      <Input
                        id="street"
                        placeholder="Nome da rua"
                        value={formData.street || ""}
                        onChange={(e) => handleInputChange("street", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="number">Número</Label>
                      <Input
                        id="number"
                        placeholder="000"
                        value={formData.number || ""}
                        onChange={(e) => handleInputChange("number", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="complement">Complemento</Label>
                      <Input
                        id="complement"
                        placeholder="Apto, Bloco, etc."
                        value={formData.complement || ""}
                        onChange={(e) => handleInputChange("complement", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        placeholder="Bairro"
                        value={formData.neighborhood || ""}
                        onChange={(e) => handleInputChange("neighborhood", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        placeholder="Cidade"
                        value={formData.city || ""}
                        onChange={(e) => handleInputChange("city", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        placeholder="RJ"
                        value={formData.state || "RJ"}
                        onChange={(e) => handleInputChange("state", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Professional */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Dados Profissionais</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="occupation">Profissão</Label>
                      <Input
                        id="occupation"
                        placeholder="Sua profissão"
                        value={formData.occupation || ""}
                        onChange={(e) => handleInputChange("occupation", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="employmentType">Tipo de Vínculo</Label>
                      <Select
                        value={formData.employmentType || ""}
                        onValueChange={(v) => handleInputChange("employmentType", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clt">CLT</SelectItem>
                          <SelectItem value="autonomo">Autônomo</SelectItem>
                          <SelectItem value="empresario">Empresário</SelectItem>
                          <SelectItem value="aposentado">Aposentado</SelectItem>
                          <SelectItem value="funcionario_publico">Funcionário Público</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="company">Empresa</Label>
                      <Input
                        id="company"
                        placeholder="Nome da empresa"
                        value={formData.company || ""}
                        onChange={(e) => handleInputChange("company", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="income">Renda Mensal</Label>
                      <Input
                        id="income"
                        placeholder="R$ 0,00"
                        value={formData.income || ""}
                        onChange={(e) => handleInputChange("income", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Residents */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Moradores</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="residentsCount">Quantas pessoas irão morar?</Label>
                      <Select
                        value={formData.residentsCount || ""}
                        onValueChange={(v) => handleInputChange("residentsCount", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 pessoa</SelectItem>
                          <SelectItem value="2">2 pessoas</SelectItem>
                          <SelectItem value="3">3 pessoas</SelectItem>
                          <SelectItem value="4">4 pessoas</SelectItem>
                          <SelectItem value="5">5 ou mais pessoas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="hasPets">Possui animais de estimação?</Label>
                      <Select
                        value={formData.hasPets || ""}
                        onValueChange={(v) => handleInputChange("hasPets", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="observations">Observações</Label>
                      <Textarea
                        id="observations"
                        placeholder="Alguma observação adicional..."
                        value={formData.observations || ""}
                        onChange={(e) => handleInputChange("observations", e.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Documents */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Documentos</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    Envie os documentos necessários para análise. Formatos aceitos: PDF, JPG, PNG (máx. 10MB cada).
                  </p>
                  <DocumentUploader
                    documents={documents}
                    onDocumentsChange={setDocuments}
                  />
                </div>
              )}

              {/* Step 7: Confirmation */}
              {currentStep === 7 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Confirmação</h2>
                  <div className="bg-secondary/50 rounded-xl p-6">
                    <h3 className="font-semibold mb-4">Resumo dos Dados</h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Nome</dt>
                        <dd className="font-medium">{formData.fullName || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">CPF</dt>
                        <dd className="font-medium">{formData.cpf || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Telefone</dt>
                        <dd className="font-medium">{formData.phone || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">E-mail</dt>
                        <dd className="font-medium">{formData.email || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Profissão</dt>
                        <dd className="font-medium">{formData.occupation || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Renda</dt>
                        <dd className="font-medium">{formData.income || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Documentos enviados</dt>
                        <dd className="font-medium">{documents.length} arquivo(s)</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-muted rounded-xl">
                    <Checkbox
                      id="terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                    />
                    <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                      Li e aceito os{" "}
                      <Link to="/termos" className="text-accent hover:underline">
                        Termos de Uso
                      </Link>{" "}
                      e a{" "}
                      <Link to="/privacidade" className="text-accent hover:underline">
                        Política de Privacidade
                      </Link>
                      . Autorizo o uso dos meus dados para análise de crédito e contato comercial.
                    </label>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>

              {currentStep < STEPS.length ? (
                <Button onClick={nextStep} variant="hero">
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  variant="hero"
                  disabled={!acceptedTerms || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Enviar Ficha
                      <CheckCircle className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
