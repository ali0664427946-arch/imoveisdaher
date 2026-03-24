import { useState, useRef } from "react";
import { Upload, X, FileText, Image, Loader2, Eye, Plus } from "lucide-react";
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
import { compressImage, formatFileSize } from "@/lib/imageCompression";

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
  maxFiles?: number;
}

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { id: "rg_cnh", label: "RG ou CNH", required: true },
  { id: "cpf", label: "CPF", required: true },
  { id: "comprovante_renda", label: "Comprovante de Renda", required: true },
  { id: "contracheque", label: "Contracheques (últimos 3)", required: false, maxFiles: 3 },
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
  tenantLabel?: string;
  categoryPrefix?: string;
  hiddenCategories?: string[];
}

export function DocumentUploader({
  fichaId,
  documents,
  onDocumentsChange,
  readOnly = false,
  tenantLabel,
  categoryPrefix = "",
  hiddenCategories = [],
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const prefixCategory = (catId: string) => categoryPrefix ? `${categoryPrefix}_${catId}` : catId;

  const getDocumentByCategory = (category: string) => {
    return documents.find((d) => d.category === prefixCategory(category));
  };

  // For multi-file categories, get all documents matching the base category
  const getDocumentsByCategory = (category: string) => {
    const prefix = prefixCategory(category);
    return documents.filter((d) => d.category === prefix || d.category.startsWith(`${prefix}_`));
  };

  const handleFileSelect = async (
    category: string,
    file: File | undefined,
    slotIndex?: number
  ) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato não suportado", {
        description: "Use JPG, PNG, WebP ou PDF",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande", {
        description: "Tamanho máximo: 10MB",
      });
      return;
    }

    // For multi-file: use suffix _1, _2, _3
    const catConfig = DOCUMENT_CATEGORIES.find(c => c.id === category);
    const isMultiFile = (catConfig?.maxFiles ?? 1) > 1;
    let prefixedCategory: string;
    
    if (isMultiFile && slotIndex !== undefined && slotIndex > 0) {
      prefixedCategory = prefixCategory(`${category}_${slotIndex + 1}`);
    } else {
      prefixedCategory = prefixCategory(category);
    }

    setUploading(prefixedCategory);

    let processedFile = file;
    if (file.type.startsWith("image/")) {
      try {
        const originalSize = file.size;
        processedFile = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
          maxSizeMB: 2,
        });
        
        if (processedFile.size < originalSize) {
          toast.info("Imagem comprimida", {
            description: `${formatFileSize(originalSize)} → ${formatFileSize(processedFile.size)}`,
          });
        }
      } catch (error) {
        console.error("Compression failed, using original:", error);
      }
    }

    try {
      const fileExt = processedFile.name.split(".").pop() || "jpg";
      const fileName = `${fichaId || "temp"}/${prefixedCategory}_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ficha-documents")
        .upload(fileName, processedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("ficha-documents")
        .getPublicUrl(fileName);

      const newDoc: UploadedDocument = {
        category: prefixedCategory,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: processedFile.size,
        mime_type: processedFile.type,
        status: "pendente",
      };

      if (fichaId) {
        const { error: dbError } = await supabase
          .from("documents")
          .insert({
            ficha_id: fichaId,
            category: prefixedCategory,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: processedFile.size,
            mime_type: processedFile.type,
          });

        if (dbError) throw dbError;
      }

      const updatedDocs = documents.filter((d) => d.category !== prefixedCategory);
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

  const handleRemove = async (fullCategory: string) => {
    const doc = documents.find((d) => d.category === fullCategory);
    if (!doc) return;

    try {
      const path = doc.file_url.split("/").slice(-2).join("/");
      await supabase.storage.from("ficha-documents").remove([path]);

      if (doc.id) {
        await supabase.from("documents").delete().eq("id", doc.id);
      }

      onDocumentsChange(documents.filter((d) => d.category !== fullCategory));
      toast.success("Documento removido");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Erro ao remover documento");
    }
  };

  const handlePreview = async (doc: UploadedDocument) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);
    
    const isPdf = doc.mime_type?.includes("pdf") || doc.file_name?.toLowerCase().endsWith(".pdf");
    setPreviewType(isPdf ? "pdf" : "image");
    
    try {
      let filePath = "";
      
      if (doc.file_url.includes("/ficha-documents/")) {
        const urlParts = doc.file_url.split("/ficha-documents/");
        filePath = decodeURIComponent(urlParts[urlParts.length - 1]);
      } else {
        filePath = doc.file_url.split("/").pop() || "";
      }
      
      const { data, error } = await supabase.storage
        .from("ficha-documents")
        .createSignedUrl(filePath, 86400);
      
      if (error) {
        console.error("Error creating signed URL:", error);
        setPreviewError("Erro ao acessar documento. O arquivo pode não existir no storage.");
        return;
      }
      
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      console.error("Preview error:", error);
      setPreviewError("Erro ao carregar documento");
    } finally {
      setPreviewLoading(false);
    }
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

  const renderSingleFileCategory = (cat: DocumentCategory) => {
    const doc = getDocumentByCategory(cat.id);
    const isUploading = uploading === prefixCategory(cat.id);

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
                  handleRemove(doc.category);
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
          accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
          onChange={(e) => handleFileSelect(cat.id, e.target.files?.[0])}
        />
      </div>
    );
  };

  const renderMultiFileCategory = (cat: DocumentCategory) => {
    const maxFiles = cat.maxFiles ?? 1;
    const uploadedDocs = getDocumentsByCategory(cat.id);
    const canAddMore = uploadedDocs.length < maxFiles && !readOnly;

    return (
      <div
        key={cat.id}
        className="border-2 border-dashed rounded-xl p-4 transition-colors md:col-span-2"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-secondary">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm flex items-center gap-2">
              {cat.label}
              {cat.required && !readOnly && (
                <span className="text-destructive">*</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {uploadedDocs.length}/{maxFiles} arquivo(s) enviado(s)
            </p>
          </div>
        </div>

        {/* Uploaded files list */}
        {uploadedDocs.length > 0 && (
          <div className="space-y-2 mb-3">
            {uploadedDocs.map((doc, idx) => {
              const isUploadingThis = uploading === doc.category;
              return (
                <div
                  key={doc.category}
                  className="flex items-center justify-between gap-3 bg-secondary/30 rounded-lg p-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-accent/20">
                      {isUploadingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      ) : doc.mime_type?.includes("pdf") ? (
                        <FileText className="w-4 h-4 text-accent" />
                      ) : (
                        <Image className="w-4 h-4 text-accent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">Arquivo {idx + 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {getStatusBadge(doc.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handlePreview(doc)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(doc.category)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add more button */}
        {canAddMore && (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={() => {
              const slotIndex = uploadedDocs.length;
              const inputKey = `${cat.id}_slot_${slotIndex}`;
              inputRefs.current[inputKey]?.click();
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar contracheque ({uploadedDocs.length}/{maxFiles})
          </Button>
        )}

        {/* Hidden inputs for each possible slot */}
        {Array.from({ length: maxFiles }).map((_, idx) => {
          const inputKey = `${cat.id}_slot_${idx}`;
          return (
            <input
              key={inputKey}
              ref={(el) => (inputRefs.current[inputKey] = el)}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
              onChange={(e) => {
                handleFileSelect(cat.id, e.target.files?.[0], idx);
                // Reset input so the same file can be re-selected
                if (e.target) e.target.value = "";
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      {tenantLabel && (
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
            <FileText className="w-3 h-3 text-accent" />
          </div>
          <h4 className="font-semibold text-sm">{tenantLabel}</h4>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOCUMENT_CATEGORIES.filter((cat) => !hiddenCategories.includes(cat.id)).map((cat) => {
          if ((cat.maxFiles ?? 1) > 1) {
            return renderMultiFileCategory(cat);
          }
          return renderSingleFileCategory(cat);
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewUrl !== null || previewLoading || previewError !== null} onOpenChange={() => {
        setPreviewUrl(null);
        setPreviewError(null);
        setPreviewLoading(false);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[400px]">
            {previewLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-muted-foreground">Carregando documento...</p>
              </div>
            ) : previewError ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-destructive font-medium">{previewError}</p>
                <p className="text-sm text-muted-foreground">
                  Verifique se você está logado e tem permissão para acessar este documento.
                </p>
              </div>
            ) : previewType === "pdf" ? (
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
                onLoad={() => setPreviewLoading(false)}
                onError={(e) => {
                  if (e.currentTarget.src && e.currentTarget.src !== window.location.href) {
                    setPreviewError("Não foi possível carregar a imagem");
                  }
                }}
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
