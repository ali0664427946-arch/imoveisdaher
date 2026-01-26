import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { mockProperties } from "@/data/mockProperties";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bed,
  Bath,
  Car,
  Maximize,
  MapPin,
  Phone,
  MessageCircle,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  // Find property by ID
  const property = mockProperties.find((p) => p.id === id);

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold mb-4">Imóvel não encontrado</h1>
          <Button asChild>
            <Link to="/imoveis">Voltar para listagem</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Mock gallery images
  const galleryImages = [
    property.imageUrl,
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop",
  ];

  const formatPrice = (price: number, purpose: string) => {
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(price);
    return purpose === "rent" ? `${formatted}/mês` : formatted;
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="bg-secondary/50 py-4">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
            <span>/</span>
            <Link to="/imoveis" className="hover:text-foreground transition-colors">Imóveis</Link>
            <span>/</span>
            <span className="text-foreground">{property.title}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gallery */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-muted">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImageIndex}
                  src={galleryImages[currentImageIndex]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </AnimatePresence>

              {/* Navigation */}
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Thumbnails */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {galleryImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentImageIndex ? "bg-white w-6" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>

              {/* Badges */}
              <div className="absolute top-4 left-4 flex gap-2">
                {property.purpose === "rent" ? (
                  <Badge variant="rent">Aluguel</Badge>
                ) : (
                  <Badge variant="sale">Venda</Badge>
                )}
                {property.featured && <Badge variant="featured">Destaque</Badge>}
              </div>

              {/* Actions */}
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? "fill-destructive text-destructive" : ""}`} />
                </button>
                <button className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-lg">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Title & Location */}
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold mb-2">
                {property.title}
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{property.neighborhood}, {property.city}</span>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: Bed, value: property.bedrooms, label: "Quartos" },
                { icon: Bath, value: property.bathrooms, label: "Banheiros" },
                { icon: Car, value: property.parking, label: "Vagas" },
                { icon: Maximize, value: `${property.area}m²`, label: "Área" },
              ].map((item, i) => (
                <div key={i} className="bg-secondary/50 rounded-xl p-4 text-center">
                  <item.icon className="w-6 h-6 mx-auto mb-2 text-accent" />
                  <div className="text-xl font-heading font-bold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <h2 className="text-xl font-heading font-semibold mb-4">Descrição</h2>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <p>
                  Excelente {property.type} localizado em {property.neighborhood}, 
                  uma das regiões mais valorizadas de {property.city}. 
                  O imóvel conta com acabamento de alto padrão, ambientes amplos e bem iluminados.
                </p>
                <p>
                  Com {property.area}m² de área útil, o imóvel oferece {property.bedrooms} quartos, 
                  {property.bathrooms} banheiros e {property.parking} vagas de garagem. 
                  Ideal para famílias que buscam conforto e qualidade de vida.
                </p>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <h2 className="text-xl font-heading font-semibold mb-4">Comodidades</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  "Portaria 24h",
                  "Piscina",
                  "Academia",
                  "Salão de Festas",
                  "Playground",
                  "Churrasqueira",
                  "Pet Friendly",
                  "Elevador",
                  "Ar Condicionado",
                ].map((amenity, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Price Card */}
              <div className="bg-card rounded-2xl p-6 shadow-card">
                <div className="mb-6">
                  <span className="text-sm text-muted-foreground">
                    {property.purpose === "rent" ? "Aluguel" : "Venda"}
                  </span>
                  <div className="text-3xl font-heading font-bold text-accent">
                    {formatPrice(property.price, property.purpose)}
                  </div>
                  {property.purpose === "rent" && (
                    <span className="text-sm text-muted-foreground">+ taxas</span>
                  )}
                </div>

                <div className="space-y-3">
                  <Button variant="hero" size="lg" className="w-full" asChild>
                    <Link to={`/ficha/${property.id}`}>
                      <Building2 className="w-5 h-5" />
                      Tenho interesse
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" className="w-full">
                    <MessageCircle className="w-5 h-5" />
                    WhatsApp
                  </Button>
                  <Button variant="ghost" size="lg" className="w-full">
                    <Phone className="w-5 h-5" />
                    Ligar agora
                  </Button>
                </div>
              </div>

              {/* Agent Card */}
              <div className="bg-card rounded-2xl p-6 shadow-card">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xl font-bold text-primary-foreground">D</span>
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold">Daher Hub</h3>
                    <p className="text-sm text-muted-foreground">Corretor responsável</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Atendimento de Seg a Sáb</span>
                </div>
              </div>

              {/* Origin Badge */}
              {property.origin && (
                <div className="text-center text-sm text-muted-foreground">
                  Anúncio via{" "}
                  <Badge variant={property.origin === "olx" ? "olx" : "imovelweb"}>
                    {property.origin === "olx" ? "OLX" : "ImovelWeb"}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
