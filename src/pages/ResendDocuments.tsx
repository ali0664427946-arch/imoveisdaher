import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DocumentUploader,
  UploadedDocument,
} from "@/components/fichas/DocumentUploader";
import {
  Search,
  Loader2,
  FileText,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export default function ResendDocuments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProtocol = searchParams.get("protocolo") || "";

  const [protocol, setProtocol] = useState(initialProtocol);
  const [searching, setSearching] = useState(false);
  const [ficha, setFicha] = useState<any>(null);
  const [existingDocs, setExistingDocs] = useState<UploadedDocument[]>([]);
  const [newDocs, setNewDocs] = useState<UploadedDocument[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handleSearch = async () => {
    if (!protocol.trim()) {
      toast.error("Digite o número do protocolo");
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("fichas")
        .select(`
          id, full_name, protocol, status, form_data,
          property:properties(title, neighborhood),
          documents:documents(id, category, file_name, file_url, file_size, mime_type, status)
        `)
        .eq("protocol", protocol.trim().toUpperCase())
        .single();

      if (error || !data) {
        toast.error("Protocolo não encontrado", {
          description: "Verifique o número e tente novamente.",
        });
        return;
      }

      setFicha(data);
      setExistingDocs(
        (data.documents || []).map((d: any) => ({
          id: d.id,
          category: d.category,
          file_name: d.file_name,
          file_url: d.file_url,
          file_size: d.file_size,
          mime_type: d.mime_type,
          status: d.status,
        }))
      );
      setNewDocs([]);
    } catch (err) {
      toast.error("Erro ao buscar ficha");
    } finally {
      setSearching(false);
    }
  };

  // Determine tenants
  const getTenants = () => {
    if (!ficha) return [];
    const tenants = [{ name: ficha.full_name, index: 0 }];
    const formData = ficha.form_data as any;
    if (formData?.additional_tenants) {
      formData.additional_tenants.forEach((t: any, i: number) => {
        if (t.full_name) {
          tenants.push({ name: t.full_name, index: i + 1 });
        }
      });
    }
    return tenants;
  };

  const allDocs = [...existingDocs, ...newDocs];
  const tenants = getTenants();
  const hasMultipleTenants = tenants.length > 1;

  const handleDocsChange = (updatedDocs: UploadedDocument[]) => {
    // Separate existing (with id) from new
    const existing = updatedDocs.filter((d) =>
      existingDocs.some((e) => e.id === d.id && d.id)
    );
    const added = updatedDocs.filter(
      (d) => !d.id || !existingDocs.some((e) => e.id === d.id)
    );
    setExistingDocs(existing);
    setNewDocs(added);
  };

  const handleSubmit = () => {
    if (newDocs.length === 0) {
      toast.info("Nenhum documento novo foi adicionado");
      return;
    }
    setSubmitted(true);
    toast.success(`${newDocs.length} documento(s) enviado(s) com sucesso!`);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-secondary/30 py-12 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-2xl font-heading font-bold mb-2">
            Documentos Enviados!
          </h1>
          <p className="text-muted-foreground mb-6">
            {newDocs.length} documento(s) adicionado(s) à ficha{" "}
            <strong>{ficha?.protocol}</strong>.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate("/")} variant="hero">
              Voltar para o Início
            </Button>
          </div>
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
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-3xl font-heading font-bold mb-2">
              Reenviar Documentos
            </h1>
            <p className="text-muted-foreground">
              Use o protocolo da sua ficha para enviar documentos pendentes
            </p>
          </div>

          <div className="bg-card rounded-2xl shadow-card p-6 md:p-8">
            {!ficha ? (
              /* Search by protocol */
              <div className="space-y-6">
                <div>
                  <Label htmlFor="protocol">Número do Protocolo</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="protocol"
                      placeholder="Ex: DH-20260303-1234"
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="font-mono"
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={searching}
                      variant="hero"
                    >
                      {searching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    O protocolo foi enviado na confirmação da sua ficha de
                    interesse.
                  </p>
                </div>
              </div>
            ) : (
              /* Ficha found - show docs */
              <div className="space-y-6">
                {/* Ficha info */}
                <div className="bg-secondary/50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Protocolo:{" "}
                      <span className="font-mono font-bold text-accent">
                        {ficha.protocol}
                      </span>
                    </p>
                    <p className="font-semibold">{ficha.full_name}</p>
                    {ficha.property && (
                      <p className="text-sm text-muted-foreground">
                        {ficha.property.title} • {ficha.property.neighborhood}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFicha(null);
                      setExistingDocs([]);
                      setNewDocs([]);
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Trocar
                  </Button>
                </div>

                {/* Documents per tenant */}
                <div>
                  <h3 className="text-lg font-heading font-semibold mb-2">
                    Documentos
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Envie os documentos que faltam. Documentos já enviados
                    aparecem abaixo.
                  </p>
                  <p className="text-sm mb-6 font-semibold">
                    Para fins de comprovação aceitamos imposto de renda ou
                    contracheque + CTPS (parte da qualificação e contrato).
                  </p>

                  <div className="space-y-6">
                    {tenants.map((tenant, idx) => (
                      <div key={idx}>
                        <DocumentUploader
                          fichaId={ficha.id}
                          documents={allDocs}
                          onDocumentsChange={handleDocsChange}
                          tenantLabel={
                            hasMultipleTenants
                              ? idx === 0
                                ? `Locatário Principal — ${tenant.name}`
                                : `Locatário ${idx + 1} — ${tenant.name}`
                              : undefined
                          }
                          categoryPrefix={
                            hasMultipleTenants ? `loc${idx}` : ""
                          }
                        />
                        {idx < tenants.length - 1 && (
                          <div className="border-b my-4" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSubmit}
                    variant="hero"
                    disabled={newDocs.length === 0}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Enviar {newDocs.length} Documento(s)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
