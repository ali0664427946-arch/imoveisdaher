import { useState, useEffect } from "react";
import { Edit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Property, PropertyPurpose, PropertyStatus } from "@/hooks/useProperties";
import { PropertyPhotoUploader } from "./PropertyPhotoUploader";
import { PropertyFeaturesCheckboxes, PropertyFeatures } from "./PropertyFeaturesCheckboxes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PropertyPhoto {
  id?: string;
  url: string;
  sort_order: number;
  file?: File;
}

interface EditPropertyDialogProps {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Property>, photos?: PropertyPhoto[]) => Promise<void>;
}

export function EditPropertyDialog({
  property,
  open,
  onOpenChange,
  onSave,
}: EditPropertyDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [initialPhotos, setInitialPhotos] = useState<PropertyPhoto[]>([]);
  const [features, setFeatures] = useState<PropertyFeatures>({});
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "apartamento",
    purpose: "rent" as PropertyPurpose,
    price: "",
    neighborhood: "",
    city: "",
    state: "",
    address: "",
    cep: "",
    condominio: "",
    iptu: "",
    area: "",
    bedrooms: "",
    bathrooms: "",
    parking: "",
    status: "active" as PropertyStatus,
    featured: false,
    youtube_url: "",
  });

  // Load property data when dialog opens
  useEffect(() => {
    if (open && property) {
      setFormData({
        title: property.title,
        description: property.description || "",
        type: property.type,
        purpose: property.purpose,
        price: property.price.toString(),
        neighborhood: property.neighborhood,
        city: property.city,
        state: property.state,
        address: property.address || "",
        cep: (property as any).cep || "",
        condominio: (property as any).condominio?.toString() || "",
        iptu: (property as any).iptu?.toString() || "",
        area: property.area?.toString() || "",
        bedrooms: property.bedrooms?.toString() || "",
        bathrooms: property.bathrooms?.toString() || "",
        parking: property.parking?.toString() || "",
        status: property.status,
        featured: property.featured || false,
        youtube_url: (property as any).youtube_url || "",
      });

      // Load features
      setFeatures(((property as any).features as PropertyFeatures) || {});

      // Load existing photos
      loadPropertyPhotos();
    }
  }, [open, property]);

  const loadPropertyPhotos = async () => {
    const { data, error } = await supabase
      .from("property_photos")
      .select("id, url, sort_order")
      .eq("property_id", property.id)
      .order("sort_order", { ascending: true });

    if (!error && data) {
      const loadedPhotos = data.map((p) => ({
        id: p.id,
        url: p.url,
        sort_order: p.sort_order || 0,
      }));
      setPhotos(loadedPhotos);
      setInitialPhotos(loadedPhotos);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Determine which photos to delete, add, or update
      const photosToDelete = initialPhotos.filter(
        (initial) => !photos.some((p) => p.id === initial.id)
      );

      // Delete removed photos from storage and database
      for (const photo of photosToDelete) {
        if (photo.id) {
          // Delete from database
          await supabase.from("property_photos").delete().eq("id", photo.id);

          // Try to delete from storage
          try {
            const url = new URL(photo.url);
            const pathMatch = url.pathname.match(/property-photos\/(.+)$/);
            if (pathMatch) {
              await supabase.storage.from("property-photos").remove([pathMatch[1]]);
            }
          } catch (err) {
            console.error("Error deleting from storage:", err);
          }
        }
      }

      // Upload new photos and update sort orders
      const photosToProcess: PropertyPhoto[] = [];

      for (const photo of photos) {
        if (photo.file) {
          // Upload new file
          const fileName = `${property.id}/${Date.now()}-${photo.file.name}`;
          const { data, error } = await supabase.storage
            .from("property-photos")
            .upload(fileName, photo.file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (error) {
            console.error("Error uploading photo:", error);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("property-photos")
            .getPublicUrl(data.path);

          // Insert new photo record
          await supabase.from("property_photos").insert({
            property_id: property.id,
            url: urlData.publicUrl,
            sort_order: photo.sort_order,
          });
        } else if (photo.id) {
          // Update existing photo sort order
          await supabase
            .from("property_photos")
            .update({ sort_order: photo.sort_order })
            .eq("id", photo.id);
        } else if (!photo.id && !photo.file && photo.url && !photo.url.startsWith("blob:")) {
          // Photo was already uploaded by PropertyPhotoUploader but not yet in DB
          await supabase.from("property_photos").insert({
            property_id: property.id,
            url: photo.url,
            sort_order: photo.sort_order,
          });
        }
      }

      // Save property data
      await onSave(property.id, {
        title: formData.title,
        description: formData.description || null,
        type: formData.type,
        purpose: formData.purpose,
        price: parseFloat(formData.price) || 0,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        address: formData.address || null,
        cep: formData.cep || null,
        condominio: formData.condominio ? parseFloat(formData.condominio) : null,
        iptu: formData.iptu ? parseFloat(formData.iptu) : null,
        area: formData.area ? parseFloat(formData.area) : null,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
        parking: formData.parking ? parseInt(formData.parking) : null,
        status: formData.status,
        featured: formData.featured,
        youtube_url: formData.youtube_url || null,
        features: features,
      } as any);

      toast({
        title: "Imóvel atualizado",
        description: "As alterações foram salvas com sucesso",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving property:", error);
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Cleanup blob URLs
      photos.forEach((photo) => {
        if (photo.url.startsWith("blob:")) {
          URL.revokeObjectURL(photo.url);
        }
      });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Imóvel</DialogTitle>
          <DialogDescription>
            Atualize as informações e fotos do imóvel
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photos Section */}
          <div className="space-y-2">
            <Label>Fotos do Imóvel</Label>
            <PropertyPhotoUploader
              photos={photos}
              onChange={setPhotos}
              propertyId={property.id}
              maxPhotos={20}
            />
          </div>

          {/* Status and Featured */}
          <div className="flex items-center justify-between gap-4 p-4 bg-secondary/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: PropertyStatus) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Suspenso</SelectItem>
                  <SelectItem value="rented">Alugado</SelectItem>
                  <SelectItem value="sold">Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="featured"
                checked={formData.featured}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, featured: checked })
                }
              />
              <Label htmlFor="featured">Destaque</Label>
            </div>
          </div>

          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Apartamento 2 quartos - Pechincha"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Tipo *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartamento">Apartamento</SelectItem>
                  <SelectItem value="casa">Casa</SelectItem>
                  <SelectItem value="cobertura">Cobertura</SelectItem>
                  <SelectItem value="kitnet">Kitnet</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="loja">Loja</SelectItem>
                  <SelectItem value="galpao">Galpão</SelectItem>
                  <SelectItem value="terreno">Terreno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="purpose">Finalidade *</Label>
              <Select
                value={formData.purpose}
                onValueChange={(value: PropertyPurpose) =>
                  setFormData({ ...formData, purpose: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Aluguel</SelectItem>
                  <SelectItem value="sale">Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Preço *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="1500"
                required
              />
            </div>
            <div>
              <Label htmlFor="area">Área (m²)</Label>
              <Input
                id="area"
                type="number"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="condominio">Condomínio (R$)</Label>
              <Input
                id="condominio"
                type="number"
                value={formData.condominio}
                onChange={(e) => setFormData({ ...formData, condominio: e.target.value })}
                placeholder="500"
              />
            </div>
            <div>
              <Label htmlFor="iptu">IPTU (R$)</Label>
              <Input
                id="iptu"
                type="number"
                value={formData.iptu}
                onChange={(e) => setFormData({ ...formData, iptu: e.target.value })}
                placeholder="150"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="bedrooms">Quartos</Label>
              <Input
                id="bedrooms"
                type="number"
                value={formData.bedrooms}
                onChange={(e) =>
                  setFormData({ ...formData, bedrooms: e.target.value })
                }
                placeholder="2"
              />
            </div>
            <div>
              <Label htmlFor="bathrooms">Banheiros</Label>
              <Input
                id="bathrooms"
                type="number"
                value={formData.bathrooms}
                onChange={(e) =>
                  setFormData({ ...formData, bathrooms: e.target.value })
                }
                placeholder="1"
              />
            </div>
            <div>
              <Label htmlFor="parking">Vagas</Label>
              <Input
                id="parking"
                type="number"
                value={formData.parking}
                onChange={(e) => setFormData({ ...formData, parking: e.target.value })}
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="neighborhood">Bairro *</Label>
            <Input
              id="neighborhood"
              value={formData.neighborhood}
              onChange={(e) =>
                setFormData({ ...formData, neighborhood: e.target.value })
              }
              placeholder="Pechincha"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua das Flores, 123"
              />
            </div>
            <div>
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                placeholder="22770-020"
                maxLength={9}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              placeholder="Descreva o imóvel..."
            />
          </div>

          {/* Features */}
          <PropertyFeaturesCheckboxes features={features} onChange={setFeatures} />

          <div>
            <Label htmlFor="youtube_url">Vídeo do YouTube (opcional)</Label>
            <Input
              id="youtube_url"
              value={formData.youtube_url}
              onChange={(e) =>
                setFormData({ ...formData, youtube_url: e.target.value })
              }
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cole o link do vídeo do YouTube. Será exibido apenas no site.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
