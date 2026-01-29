import { useState, useRef } from "react";
import { ImagePlus, X, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { applyWatermark } from "@/lib/watermark";
interface PropertyPhoto {
  id?: string;
  url: string;
  sort_order: number;
  file?: File;
  isUploading?: boolean;
}

interface PropertyPhotoUploaderProps {
  photos: PropertyPhoto[];
  onChange: (photos: PropertyPhoto[]) => void;
  propertyId?: string;
  maxPhotos?: number;
}

export function PropertyPhotoUploader({
  photos,
  onChange,
  propertyId,
  maxPhotos = 20,
}: PropertyPhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${maxPhotos} fotos permitidas`,
        variant: "destructive",
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    
    // Validate file types
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const invalidFiles = filesToUpload.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      toast({
        title: "Formato inválido",
        description: "Apenas JPG, PNG e WEBP são aceitos",
        variant: "destructive",
      });
      return;
    }

    // Validate file sizes (max 10MB)
    const oversizedFiles = filesToUpload.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "Arquivo muito grande",
        description: "Máximo de 10MB por foto",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const newPhotos: PropertyPhoto[] = [];

      for (const file of filesToUpload) {
        // Apply watermark to the image before upload
        let processedFile: File;
        try {
          processedFile = await applyWatermark(file, "/watermark-logo.png", 0.5);
        } catch (watermarkError) {
          console.warn("Could not apply watermark, using original:", watermarkError);
          processedFile = file;
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(processedFile);
        const sortOrder = photos.length + newPhotos.length;

        if (propertyId) {
          // Upload directly if we have a property ID
          const fileName = `${propertyId}/${Date.now()}-${file.name}`;
          const { data, error } = await supabase.storage
            .from("property-photos")
            .upload(fileName, processedFile, {
              cacheControl: "3600",
              upsert: false,
            });

          if (error) throw error;

          const { data: urlData } = supabase.storage
            .from("property-photos")
            .getPublicUrl(data.path);

          newPhotos.push({
            url: urlData.publicUrl,
            sort_order: sortOrder,
          });
        } else {
          // Store file for later upload
          newPhotos.push({
            url: previewUrl,
            sort_order: sortOrder,
            file: processedFile,
          });
        }
      }

      onChange([...photos, ...newPhotos]);
      toast({
        title: "Fotos adicionadas",
        description: `${newPhotos.length} foto(s) adicionada(s)`,
      });
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast({
        title: "Erro ao fazer upload",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePhoto = async (index: number) => {
    const photo = photos[index];
    
    // If photo was already uploaded and we have a property ID, delete from storage
    if (propertyId && photo.id) {
      try {
        // Extract file path from URL
        const url = new URL(photo.url);
        const pathMatch = url.pathname.match(/property-photos\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from("property-photos").remove([pathMatch[1]]);
        }
      } catch (error) {
        console.error("Error deleting photo:", error);
      }
    }

    // Revoke object URL if it's a blob
    if (photo.url.startsWith("blob:")) {
      URL.revokeObjectURL(photo.url);
    }

    const updatedPhotos = photos
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, sort_order: i }));
    
    onChange(updatedPhotos);
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= photos.length) return;
    
    const updatedPhotos = [...photos];
    const [movedPhoto] = updatedPhotos.splice(fromIndex, 1);
    updatedPhotos.splice(toIndex, 0, movedPhoto);
    
    onChange(updatedPhotos.map((p, i) => ({ ...p, sort_order: i })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {photos.length} de {maxPhotos} fotos
        </span>
        {photos.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Arraste para reordenar
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo.url}
            className="relative aspect-square rounded-lg overflow-hidden border bg-secondary group"
          >
            <img
              src={photo.url}
              alt={`Foto ${index + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Overlay with controls */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={() => movePhoto(index, index - 1)}
                disabled={index === 0}
              >
                <GripVertical className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-red-500/80"
                onClick={() => removePhoto(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Badge for main photo */}
            {index === 0 && (
              <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                Capa
              </div>
            )}

            {/* Uploading state */}
            {photo.isUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
        ))}

        {/* Add photo button */}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
          >
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs">Adicionar</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
