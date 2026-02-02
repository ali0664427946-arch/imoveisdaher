import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchFilters } from "@/components/properties/SearchFilters";
import { PropertyGrid } from "@/components/properties/PropertyGrid";
import { type Property } from "@/components/properties/PropertyCard";
import { SlidersHorizontal, Grid3X3, List, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PropertiesList() {
  const [searchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties-list", searchParams.toString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(`
          *,
          property_photos (url, sort_order)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((p): Property => ({
        id: p.id,
        title: p.title,
        price: Number(p.price),
        purpose: p.purpose as "rent" | "sale",
        type: p.type,
        neighborhood: p.neighborhood,
        city: p.city,
        bedrooms: p.bedrooms ?? 0,
        bathrooms: p.bathrooms ?? 0,
        parking: p.parking ?? 0,
        area: p.area ? Number(p.area) : undefined,
        imageUrl: p.property_photos?.[0]?.url,
        featured: p.featured ?? false,
        origin: p.origin,
      }));
    },
  });

  const sortedProperties = useMemo(() => {
    const sorted = [...properties];
    switch (sortBy) {
      case "price-asc":
        return sorted.sort((a, b) => a.price - b.price);
      case "price-desc":
        return sorted.sort((a, b) => b.price - a.price);
      case "area-desc":
        return sorted.sort((a, b) => (b.area ?? 0) - (a.area ?? 0));
      default:
        return sorted;
    }
  }, [properties, sortBy]);

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <div className="bg-primary py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground mb-4">
              Encontre seu imóvel ideal
            </h1>
            <p className="text-primary-foreground/70">
              Explore nossa seleção de imóveis para aluguel e venda no Rio de Janeiro e região.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="container mx-auto px-4 -mt-8 relative z-10 mb-8">
        <SearchFilters />
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 pb-20">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-accent" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">{sortedProperties.length}</strong> imóveis encontrados
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="price-asc">Menor preço</SelectItem>
                <SelectItem value="price-desc">Maior preço</SelectItem>
                <SelectItem value="area-desc">Maior área</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="rounded-none"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="rounded-none"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Properties Grid */}
        <PropertyGrid properties={sortedProperties} loading={isLoading} />
      </div>
    </div>
  );
}
