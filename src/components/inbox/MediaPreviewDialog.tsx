import { useState } from "react";
import { Download, X, FileText, ExternalLink, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrl: string;
  mediaType: "image" | "pdf" | "video" | "audio" | "other";
  fileName?: string;
}

export function MediaPreviewDialog({
  open,
  onOpenChange,
  mediaUrl,
  mediaType,
  fileName,
}: MediaPreviewDialogProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const handleDownload = () => {
    window.open(mediaUrl, "_blank");
  };

  // Blob-based download to bypass ad blocker blocking Supabase URLs
  const handleBlobDownload = async () => {
    setPdfDownloading(true);
    try {
      const response = await fetch(mediaUrl);
      if (!response.ok) throw new Error("Falha ao baixar");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "documento.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch {
      window.open(mediaUrl, "_blank");
    } finally {
      setPdfDownloading(false);
    }
  };

  // Blob-based open in new tab to bypass ad blocker
  const handleBlobOpen = async () => {
    setPdfDownloading(true);
    try {
      const response = await fetch(mediaUrl);
      if (!response.ok) throw new Error("Falha ao abrir");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      window.open(mediaUrl, "_blank");
    } finally {
      setPdfDownloading(false);
    }
  };

  const resetState = () => {
    setImageLoading(true);
    setImageError(false);
    setZoom(1);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetState();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm font-medium truncate flex-1">
            {fileName || (mediaType === "image" ? "Imagem" : mediaType === "video" ? "Vídeo" : mediaType === "audio" ? "Áudio" : "Documento")}
          </DialogTitle>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {mediaType === "image" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDownload}
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex items-center justify-center overflow-auto bg-black/5 dark:bg-black/20" style={{ minHeight: "400px", maxHeight: "calc(90vh - 60px)" }}>
          {mediaType === "image" ? (
            <>
              {imageLoading && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
              )}
              {imageError ? (
                <div className="flex flex-col items-center gap-3 p-8">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="w-8 h-8 text-destructive" />
                  </div>
                  <p className="text-sm text-muted-foreground">Não foi possível carregar a imagem</p>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" /> Abrir no navegador
                  </Button>
                </div>
              ) : (
                <img
                  src={mediaUrl}
                  alt={fileName || "Imagem"}
                  className="transition-transform duration-200"
                  style={{ transform: `scale(${zoom})`, maxWidth: "100%", maxHeight: "calc(90vh - 60px)", objectFit: "contain" }}
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageLoading(false);
                    setImageError(true);
                  }}
                />
              )}
            </>
          ) : mediaType === "pdf" ? (
            <div className="flex flex-col items-center gap-4 p-8">
              <FileText className="w-16 h-16 text-accent" />
              <p className="text-sm font-medium">{fileName || "Documento PDF"}</p>
              <Button onClick={handleBlobDownload} disabled={pdfDownloading}>
                {pdfDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Baixar PDF
              </Button>
            </div>
          ) : mediaType === "video" ? (
            <video
              src={mediaUrl}
              controls
              className="max-w-full max-h-[calc(90vh-60px)]"
              style={{ objectFit: "contain" }}
            >
              Seu navegador não suporta reprodução de vídeo.
            </video>
          ) : mediaType === "audio" ? (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">{fileName || "Áudio"}</p>
              <audio src={mediaUrl} controls className="w-full max-w-md" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 p-8">
              <FileText className="w-16 h-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{fileName || "Arquivo"}</p>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" /> Baixar arquivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
