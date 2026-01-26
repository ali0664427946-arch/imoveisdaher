import { PropertyCard, type Property } from "./PropertyCard";

interface PropertyGridProps {
  properties: Property[];
  loading?: boolean;
}

export function PropertyGrid({ properties, loading }: PropertyGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <PropertyCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">
          Nenhum imóvel encontrado com os filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {properties.map((property, index) => (
        <PropertyCard key={property.id} property={property} index={index} />
      ))}
    </div>
  );
}

function PropertyCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-card shadow-card animate-pulse">
      <div className="aspect-[4/3] bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-px bg-muted mt-4" />
        <div className="flex justify-between pt-2">
          <div className="h-4 bg-muted rounded w-8" />
          <div className="h-4 bg-muted rounded w-8" />
          <div className="h-4 bg-muted rounded w-8" />
          <div className="h-4 bg-muted rounded w-12" />
        </div>
      </div>
    </div>
  );
}
