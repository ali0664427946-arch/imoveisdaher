import { useState } from "react";
import { Search, MapPin, Home, DollarSign, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchFiltersProps {
  onSearch?: (filters: SearchFiltersState) => void;
  variant?: "hero" | "inline";
}

export interface SearchFiltersState {
  query: string;
  purpose: string;
  type: string;
  neighborhood: string;
  priceMin: string;
  priceMax: string;
}

export function SearchFilters({ onSearch, variant = "inline" }: SearchFiltersProps) {
  const [filters, setFilters] = useState<SearchFiltersState>({
    query: "",
    purpose: "",
    type: "",
    neighborhood: "",
    priceMin: "",
    priceMax: "",
  });

  const handleChange = (key: keyof SearchFiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(filters);
  };

  if (variant === "hero") {
    return (
      <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto">
        <div className="glass rounded-2xl p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por bairro, cidade ou tipo..."
                  value={filters.query}
                  onChange={(e) => handleChange("query", e.target.value)}
                  className="pl-10 h-12 bg-background/80 border-0"
                />
              </div>
            </div>

            {/* Purpose */}
            <Select value={filters.purpose} onValueChange={(v) => handleChange("purpose", v)}>
              <SelectTrigger className="h-12 bg-background/80 border-0">
                <SelectValue placeholder="Finalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rent">Alugar</SelectItem>
                <SelectItem value="sale">Comprar</SelectItem>
              </SelectContent>
            </Select>

            {/* Search Button */}
            <Button type="submit" variant="hero" size="lg" className="h-12">
              <Search className="w-5 h-5" />
              Buscar
            </Button>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="mt-4 flex flex-wrap gap-4">
            <Select value={filters.type} onValueChange={(v) => handleChange("type", v)}>
              <SelectTrigger className="w-[160px] bg-background/60 border-0 h-10">
                <Home className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="cobertura">Cobertura</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.neighborhood} onValueChange={(v) => handleChange("neighborhood", v)}>
              <SelectTrigger className="w-[180px] bg-background/60 border-0 h-10">
                <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Bairro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="centro">Centro</SelectItem>
                <SelectItem value="jardins">Jardins</SelectItem>
                <SelectItem value="pinheiros">Pinheiros</SelectItem>
                <SelectItem value="moema">Moema</SelectItem>
                <SelectItem value="vila-mariana">Vila Mariana</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priceMax} onValueChange={(v) => handleChange("priceMax", v)}>
              <SelectTrigger className="w-[180px] bg-background/60 border-0 h-10">
                <DollarSign className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Preço até" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2000">Até R$ 2.000</SelectItem>
                <SelectItem value="3000">Até R$ 3.000</SelectItem>
                <SelectItem value="5000">Até R$ 5.000</SelectItem>
                <SelectItem value="10000">Até R$ 10.000</SelectItem>
                <SelectItem value="500000">Até R$ 500.000</SelectItem>
                <SelectItem value="1000000">Até R$ 1.000.000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl p-4 shadow-card">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar..."
              value={filters.query}
              onChange={(e) => handleChange("query", e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Select value={filters.purpose} onValueChange={(v) => handleChange("purpose", v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Finalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rent">Alugar</SelectItem>
            <SelectItem value="sale">Comprar</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(v) => handleChange("type", v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apartamento">Apartamento</SelectItem>
            <SelectItem value="casa">Casa</SelectItem>
            <SelectItem value="comercial">Comercial</SelectItem>
            <SelectItem value="terreno">Terreno</SelectItem>
          </SelectContent>
        </Select>

        <Button type="submit">
          <Search className="w-4 h-4" />
          Buscar
        </Button>
      </div>
    </form>
  );
}
