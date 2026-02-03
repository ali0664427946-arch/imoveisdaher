import { useState, useRef } from "react";
import { Upload, X, FileText, Image, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadedDocument {
  id?: string;
  category: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  status: string;
}

interface DocumentCategory {
  id: string;
  label: string;
  required: boolean;
}

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { id: "rg_cnh", label: "RG ou CNH", required: true },
  { id: "cpf", label: "CPF", required: true },
  { id: "comprovante_renda", label: "Comprovante de Renda", required: true },
  { id: "comprovante_residencia", label: "Comprovante de Residência", required: true },
  { id: "ctps", label: "Carteira de Trabalho", required: false },
  { id: "imposto_renda", label: "Declaração IR", required: false },
  { id: "extrato_bancario", label: "Extrato Bancário", required: false },
  { id: "rgi", label: "RGI do Imóvel", required: false },
  { id: "outros", label: "Outros", required: false },
];

interface DocumentUploaderProps {
  fichaId?: string;
  documents: UploadedDocument[];
  onDocumentsChange: (docs: UploadedDocument[]) => void;
  readOnly?: boolean;
}

export function DocumentUploader({
  fichaId,
  documents,
  onDocumentsChange,
  readOnly = false,
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getDocumentByCategory = (category: string) => {
    return documents.find((d) => d.category === category);
  };

  const handleFileSelect = async (
    category: string,
    file: File | undefined
  ) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato não suportado", {
        description: "Use JPG, PNG, WebP ou PDF",
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande", {
        description: "Tamanho máximo: 10MB",
      });
      return;
    }

    setUploading(category);

    try {
      // Generate unique file path
      const fileExt = file.name.split(".").pop();
      const fileName = `${fichaId || "temp"}/${category}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ficha-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("ficha-documents")
        .getPublicUrl(fileName);

      const newDoc: UploadedDocument = {
        category,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        status: "pendente",
      };

      // If fichaId exists, save to database
      if (fichaId) {
        const { data: savedDoc, error: dbError } = await supabase
          .from("documents")
          .insert({
            ficha_id: fichaId,
            category,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.type,
          })
          .select()
          .single();

        if (dbError) throw dbError;
        newDoc.id = savedDoc.id;
      }

      // Update documents list
      const updatedDocs = documents.filter((d) => d.category !== category);
      updatedDocs.push(newDoc);
      onDocumentsChange(updatedDocs);

      toast.success("Documento enviado!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar documento");
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (category: string) => {
    const doc = getDocumentByCategory(category);
    if (!doc) return;

    try {
      // Remove from storage
      const path = doc.file_url.split("/").slice(-2).join("/");
      await supabase.storage.from("ficha-documents").remove([path]);

      // Remove from database if exists
      if (doc.id) {
        await supabase.from("documents").delete().eq("id", doc.id);
      }

      // Update state
      onDocumentsChange(documents.filter((d) => d.category !== category));
      toast.success("Documento removido");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Erro ao remover documento");
    }
  };

  const handlePreview = (doc: UploadedDocument) => {
    setPreviewUrl(doc.file_url);
    setPreviewType(doc.mime_type?.includes("pdf") ? "pdf" : "image");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "approved" | "rejected" | "pending"> = {
      ok: "approved",
      reprovado: "rejected",
      pendente: "pending",
    };
    const labels: Record<string, string> = {
      ok: "Aprovado",
      reprovado: "Reprovado",
      pendente: "Pendente",
    };
    return (
      <Badge variant={variants[status] || "pending"} className="text-xs">
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOCUMENT_CATEGORIES.map((cat) => {
          const doc = getDocumentByCategory(cat.id);
          const isUploading = uploading === cat.id;

          return (
            <div
              key={cat.id}
              className={`border-2 rounded-xl p-4 transition-colors ${
                doc
                  ? "border-solid bg-secondary/30"
                  : "border-dashed hover:border-accent"
              } ${readOnly ? "" : "cursor-pointer"}`}
              onClick={() => {
                if (!readOnly && !doc && !isUploading) {
                  inputRefs.current[cat.id]?.click();
                }
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      doc ? "bg-accent/20" : "bg-secondary"
                    }`}
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    ) : doc?.mime_type?.includes("pdf") ? (
                      <FileText className="w-5 h-5 text-accent" />
                    ) : doc ? (
                      <Image className="w-5 h-5 text-accent" />
                    ) : (
                      <Upload className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm flex items-center gap-2">
                      {cat.label}
                      {cat.required && !readOnly && (
                        <span className="text-destructive">*</span>
                      )}
                    </p>
                    {doc ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.file_name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {readOnly ? "Não enviado" : "Clique para enviar"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc && getStatusBadge(doc.status)}
                  {doc && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(doc);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {doc && !readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(cat.id);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <input
                ref={(el) => (inputRefs.current[cat.id] = el)}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) =>
                  handleFileSelect(cat.id, e.target.files?.[0])
                }
              />
            </div>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[400px]">
            {previewType === "pdf" ? (
              <iframe
                src={previewUrl || ""}
                className="w-full h-[70vh] rounded-lg"
                title="PDF Preview"
              />
            ) : (
              <img
                src={previewUrl || ""}
                alt="Document preview"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { DOCUMENT_CATEGORIES };
export type { UploadedDocument, DocumentCategory };
