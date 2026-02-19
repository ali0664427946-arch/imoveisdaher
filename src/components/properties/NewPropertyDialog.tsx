import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { PropertyPurpose } from "@/hooks/useProperties";
import { PropertyPhotoUploader } from "./PropertyPhotoUploader";
import { PropertyFeaturesCheckboxes, PropertyFeatures } from "./PropertyFeaturesCheckboxes";

interface PropertyPhoto {
  url: string;
  sort_order: number;
  file?: File;
}

interface NewPropertyDialogProps {
  onSubmit: (property: {
    title: string;
    description?: string | null;
    type: string;
    purpose: PropertyPurpose;
    price: number;
    neighborhood: string;
    city: string;
    state?: string;
    address?: string | null;
    cep?: string | null;
    condominio?: number | null;
    iptu?: number | null;
    area?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    parking?: number | null;
    youtube_url?: string | null;
    features?: PropertyFeatures;
    photos?: PropertyPhoto[];
  }) => Promise<any>;
}

export function NewPropertyDialog({ onSubmit }: NewPropertyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [features, setFeatures] = useState<PropertyFeatures>({});
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "apartamento",
    purpose: "rent" as PropertyPurpose,
    price: "",
    neighborhood: "",
    city: "Rio de Janeiro",
    state: "RJ",
    address: "",
    cep: "",
    condominio: "",
    iptu: "",
    area: "",
    bedrooms: "",
    bathrooms: "",
    parking: "",
    youtube_url: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await onSubmit({
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
      youtube_url: formData.youtube_url || null,
      features: features,
      photos: photos,
    });

    // Reset form
    setFormData({
      title: "",
      description: "",
      type: "apartamento",
      purpose: "rent",
      price: "",
      neighborhood: "",
      city: "Rio de Janeiro",
      state: "RJ",
      address: "",
      cep: "",
      condominio: "",
      iptu: "",
      area: "",
      bedrooms: "",
      bathrooms: "",
      parking: "",
      youtube_url: "",
    });
    setPhotos([]);
    setFeatures({});
    setIsLoading(false);
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Cleanup blob URLs when closing
      photos.forEach((photo) => {
        if (photo.url.startsWith("blob:")) {
          URL.revokeObjectURL(photo.url);
        }
      });
      setPhotos([]);
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="hero">
          <Plus className="w-4 h-4" />
          Novo Imóvel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Imóvel</DialogTitle>
          <DialogDescription>
            Preencha as informações e adicione fotos do imóvel
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photos Section */}
          <div className="space-y-2">
            <Label>Fotos do Imóvel</Label>
            <PropertyPhotoUploader
              photos={photos}
              onChange={setPhotos}
              maxPhotos={20}
            />
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
                onValueChange={(value: PropertyPurpose) => setFormData({ ...formData, purpose: value })}
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
                onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                placeholder="2"
              />
            </div>
            <div>
              <Label htmlFor="bathrooms">Banheiros</Label>
              <Input
                id="bathrooms"
                type="number"
                value={formData.bathrooms}
                onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cole o link do vídeo do YouTube. Será exibido apenas no site.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Adicionar Imóvel"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
