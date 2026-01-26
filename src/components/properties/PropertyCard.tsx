import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Bed, Bath, Car, Maximize, MapPin } from "lucide-react";
import { motion } from "framer-motion";

export interface Property {
  id: string;
  title: string;
  price: number;
  purpose: "rent" | "sale";
  type: string;
  neighborhood: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  area: number;
  imageUrl: string;
  featured?: boolean;
  isNew?: boolean;
  origin?: "olx" | "imovelweb" | "import";
}

interface PropertyCardProps {
  property: Property;
  index?: number;
}

export function PropertyCard({ property, index = 0 }: PropertyCardProps) {
  const formatPrice = (price: number, purpose: string) => {
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(price);
    
    return purpose === "rent" ? `${formatted}/mês` : formatted;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link to={`/imovel/${property.id}`} className="block">
        <article className="property-card group">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src={property.imageUrl}
              alt={property.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-2">
              {property.purpose === "rent" ? (
                <Badge variant="rent">Aluguel</Badge>
              ) : (
                <Badge variant="sale">Venda</Badge>
              )}
              {property.isNew && <Badge variant="new">Novo</Badge>}
              {property.featured && <Badge variant="featured">Destaque</Badge>}
            </div>

            {/* Origin badge */}
            {property.origin && (
              <div className="absolute top-3 right-3">
                <Badge variant={property.origin === "olx" ? "olx" : "imovelweb"}>
                  {property.origin === "olx" ? "OLX" : "ImovelWeb"}
                </Badge>
              </div>
            )}

            {/* Price */}
            <div className="absolute bottom-3 left-3">
              <span className="text-xl font-heading font-bold text-white drop-shadow-lg">
                {formatPrice(property.price, property.purpose)}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-heading font-semibold text-foreground line-clamp-1 mb-1 group-hover:text-accent transition-colors">
              {property.title}
            </h3>
            
            <div className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
              <MapPin className="w-3.5 h-3.5" />
              <span className="line-clamp-1">{property.neighborhood}, {property.city}</span>
            </div>

            {/* Features */}
            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <div className="flex items-center gap-1">
                <Bed className="w-4 h-4" />
                <span>{property.bedrooms}</span>
              </div>
              <div className="flex items-center gap-1">
                <Bath className="w-4 h-4" />
                <span>{property.bathrooms}</span>
              </div>
              <div className="flex items-center gap-1">
                <Car className="w-4 h-4" />
                <span>{property.parking}</span>
              </div>
              <div className="flex items-center gap-1">
                <Maximize className="w-4 h-4" />
                <span>{property.area}m²</span>
              </div>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
