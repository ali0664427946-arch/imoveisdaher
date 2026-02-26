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
  Home,
  Users,
  CheckCircle,
  Building2,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  DocumentUploader,
  UploadedDocument,
} from "@/components/fichas/DocumentUploader";
import { TenantForm, TenantData } from "@/components/fichas/TenantForm";

const STEPS = [
  { id: 1, title: "Imóvel", icon: Building2 },
  { id: 2, title: "Locatários", icon: User },
  { id: 3, title: "Endereço", icon: Home },
  { id: 4, title: "Moradores", icon: Users },
  { id: 5, title: "Documentos", icon: FileText },
  { id: 6, title: "Confirmação", icon: CheckCircle },
];

interface AddressData {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface ResidentsData {
  residentsCount: string;
  hasPets: string;
  observations: string;
}

const emptyTenant: Partial<TenantData> = {
  fullName: "",
  cpf: "",
  rg: "",
  birthDate: "",
  maritalStatus: "",
  phone: "",
  email: "",
  occupation: "",
  employmentType: "",
  company: "",
  income: "",
};

export default function InterestForm() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Property selection (for standalone form)
  const [propertyCode, setPropertyCode] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(propertyId || null);
  const [searchingProperty, setSearchingProperty] = useState(false);
  
  // Multiple tenants (up to 3)
  const [tenants, setTenants] = useState<Partial<TenantData>[]>([{ ...emptyTenant }]);
  
  // Address data
  const [addressData, setAddressData] = useState<Partial<AddressData>>({});
  
  // Residents data
  const [residentsData, setResidentsData] = useState<Partial<ResidentsData>>({});
  
  // Documents
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  
  // Form state
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedProtocol, setSubmittedProtocol] = useState<string | null>(null);

  // Fetch property from database (if propertyId is provided)
  const { data: property } = useQuery({
    queryKey: ["property", selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return null;
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", selectedPropertyId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!selectedPropertyId,
  });

  // Search property by slug or ID
  const handleSearchProperty = async () => {
    if (!propertyCode.trim()) {
      toast.error("Digite o código do imóvel");
      return;
    }
    
    setSearchingProperty(true);
    try {
      // Try to find by slug first, then by ID
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, price, purpose, neighborhood")
        .or(`slug.eq.${propertyCode.trim()},id.eq.${propertyCode.trim()}`)
        .eq("status", "active")
        .limit(1)
        .single();
      
      if (error || !data) {
        toast.error("Imóvel não encontrado", {
          description: "Verifique o código e tente novamente",
        });
        return;
      }
      
      setSelectedPropertyId(data.id);
      toast.success("Imóvel encontrado!");
    } catch (error) {
      toast.error("Erro ao buscar imóvel");
    } finally {
      setSearchingProperty(false);
    }
  };

  // Tenant handlers
  const handleTenantChange = (index: number, field: keyof TenantData, value: string) => {
    setTenants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addTenant = () => {
    if (tenants.length < 3) {
      setTenants(prev => [...prev, { ...emptyTenant }]);
    }
  };

  const removeTenant = (index: number) => {
    if (tenants.length > 1 && index > 0) {
      setTenants(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Address handlers
  const handleAddressChange = (field: keyof AddressData, value: string) => {
    setAddressData(prev => ({ ...prev, [field]: value }));
  };

  // Residents handlers
  const handleResidentsChange = (field: keyof ResidentsData, value: string) => {
    setResidentsData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
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
    const primaryTenant = tenants[0];
    if (!primaryTenant?.fullName || !primaryTenant?.cpf || !primaryTenant?.phone) {
      toast.error("Preencha os campos obrigatórios do locatário principal");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare additional tenants data
      const additionalTenants = tenants.slice(1).filter(t => t.fullName && t.cpf);
      
      // Create ficha for primary tenant
      const { data: ficha, error: fichaError } = await supabase
        .from("fichas")
        .insert({
          full_name: primaryTenant.fullName,
          cpf: primaryTenant.cpf.replace(/\D/g, ""),
          rg: primaryTenant.rg || null,
          phone: primaryTenant.phone,
          email: primaryTenant.email || null,
          birth_date: primaryTenant.birthDate || null,
          marital_status: primaryTenant.maritalStatus || null,
          address_cep: addressData.cep || null,
          address_street: addressData.street || null,
          address_number: addressData.number || null,
          address_complement: addressData.complement || null,
          address_neighborhood: addressData.neighborhood || null,
          address_city: addressData.city || null,
          address_state: addressData.state || "RJ",
          occupation: primaryTenant.occupation || null,
          company: primaryTenant.company || null,
          employment_type: primaryTenant.employmentType ? (primaryTenant.employmentType as any) : null,
          income: parseIncome(primaryTenant.income || "") || null,
          residents_count: parseInt(residentsData.residentsCount || "1"),
          has_pets: residentsData.hasPets === "sim",
          observations: residentsData.observations,
          property_id: selectedPropertyId || null,
          status: "pendente",
          form_data: {
            additional_tenants: additionalTenants.map(t => ({
              full_name: t.fullName,
              cpf: t.cpf?.replace(/\D/g, ""),
              rg: t.rg,
              phone: t.phone,
              email: t.email,
              birth_date: t.birthDate,
              marital_status: t.maritalStatus,
              occupation: t.occupation,
              company: t.company,
              employment_type: t.employmentType,
              income: parseIncome(t.income || ""),
            })),
          },
        })
        .select()
        .single();

      if (fichaError) throw fichaError;

      // Save documents to database (already uploaded to storage)
      if (documents.length > 0 && ficha) {
        const docsToInsert = documents.map(doc => ({
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
              {/* Step 1: Property Selection */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Imóvel de Interesse</h2>
                  
                  {property ? (
                    <div className="bg-secondary/50 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-6 h-6 text-accent" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{property.title}</h3>
                          <p className="text-muted-foreground">{property.neighborhood}</p>
                          <p className="text-accent font-bold mt-2">
                            {formatPrice(property.price, property.purpose)}
                          </p>
                        </div>
                      </div>
                      {!propertyId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => setSelectedPropertyId(null)}
                        >
                          Trocar imóvel
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        Digite o código do imóvel que você deseja alugar ou comprar.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Código do imóvel (ex: apartamento-centro-001)"
                          value={propertyCode}
                          onChange={(e) => setPropertyCode(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearchProperty()}
                        />
                        <Button
                          onClick={handleSearchProperty}
                          disabled={searchingProperty}
                          variant="hero"
                        >
                          {searchingProperty ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Você pode encontrar o código na página do imóvel ou com seu corretor.
                        Caso não tenha o código, pode prosseguir sem selecionar um imóvel específico.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Tenants */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-heading font-semibold">Locatários</h2>
                      <p className="text-sm text-muted-foreground">
                        Adicione até 3 locatários para esta ficha
                      </p>
                    </div>
                    {tenants.length < 3 && (
                      <Button variant="outline" size="sm" onClick={addTenant}>
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-6">
                    {tenants.map((tenant, index) => (
                      <TenantForm
                        key={index}
                        index={index}
                        data={tenant}
                        onChange={(field, value) => handleTenantChange(index, field, value)}
                        onRemove={index > 0 ? () => removeTenant(index) : undefined}
                        isPrimary={index === 0}
                      />
                    ))}
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
                        value={addressData.cep || ""}
                        onChange={(e) => handleAddressChange("cep", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="street">Rua</Label>
                      <Input
                        id="street"
                        placeholder="Nome da rua"
                        value={addressData.street || ""}
                        onChange={(e) => handleAddressChange("street", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="number">Número</Label>
                      <Input
                        id="number"
                        placeholder="000"
                        value={addressData.number || ""}
                        onChange={(e) => handleAddressChange("number", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="complement">Complemento</Label>
                      <Input
                        id="complement"
                        placeholder="Apto, Bloco, etc."
                        value={addressData.complement || ""}
                        onChange={(e) => handleAddressChange("complement", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        placeholder="Bairro"
                        value={addressData.neighborhood || ""}
                        onChange={(e) => handleAddressChange("neighborhood", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        placeholder="Cidade"
                        value={addressData.city || ""}
                        onChange={(e) => handleAddressChange("city", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        placeholder="RJ"
                        value={addressData.state || "RJ"}
                        onChange={(e) => handleAddressChange("state", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Residents */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Moradores</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="residentsCount">Quantas pessoas irão morar?</Label>
                      <Select
                        value={residentsData.residentsCount || ""}
                        onValueChange={(v) => handleResidentsChange("residentsCount", v)}
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
                        value={residentsData.hasPets || ""}
                        onValueChange={(v) => handleResidentsChange("hasPets", v)}
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
                        value={residentsData.observations || ""}
                        onChange={(e) => handleResidentsChange("observations", e.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Documents */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Documentos</h2>
                  <p className="text-muted-foreground text-sm mb-2">
                    Envie os documentos necessários para análise. Formatos aceitos: PDF, JPG, PNG (máx. 10MB cada).
                  </p>
                  <p className="text-sm mb-6 font-semibold">
                    Para fins de comprovação aceitamos imposto de renda ou contracheque + CTPS (parte da qualificação e contrato).
                  </p>
                  <DocumentUploader
                    documents={documents}
                    onDocumentsChange={setDocuments}
                  />
                </div>
              )}

              {/* Step 6: Confirmation */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-heading font-semibold mb-6">Confirmação</h2>
                  <div className="bg-secondary/50 rounded-xl p-6">
                    <h3 className="font-semibold mb-4">Resumo dos Dados</h3>
                    
                    {/* Property */}
                    {property && (
                      <div className="mb-4 pb-4 border-b">
                        <dt className="text-muted-foreground text-sm">Imóvel</dt>
                        <dd className="font-medium">{property.title}</dd>
                      </div>
                    )}
                    
                    {/* Tenants summary */}
                    <div className="space-y-4">
                      {tenants.filter(t => t.fullName).map((tenant, index) => (
                        <div key={index} className="pb-4 border-b last:border-0">
                          <h4 className="text-sm font-medium text-accent mb-2">
                            {index === 0 ? "Locatário Principal" : `Locatário ${index + 1}`}
                          </h4>
                          <dl className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <dt className="text-muted-foreground">Nome</dt>
                              <dd className="font-medium">{tenant.fullName || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">CPF</dt>
                              <dd className="font-medium">{tenant.cpf || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Telefone</dt>
                              <dd className="font-medium">{tenant.phone || "-"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Renda</dt>
                              <dd className="font-medium">{tenant.income || "-"}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t">
                      <dt className="text-muted-foreground text-sm">Documentos enviados</dt>
                      <dd className="font-medium">{documents.length} arquivo(s)</dd>
                    </div>
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
