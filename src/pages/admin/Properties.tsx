import { useState } from "react";
import { Plus, Search, Filter, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const properties = [
  {
    id: "1",
    title: "Apartamento 2 quartos - Pechincha",
    type: "Apartamento",
    purpose: "rent",
    price: 1800,
    neighborhood: "Pechincha",
    status: "active",
    origin: "olx",
    leads: 5,
  },
  {
    id: "2",
    title: "Casa 3 quartos com piscina - Recreio",
    type: "Casa",
    purpose: "sale",
    price: 850000,
    neighborhood: "Recreio",
    status: "active",
    origin: "imovelweb",
    leads: 12,
  },
  {
    id: "3",
    title: "Sala Comercial 50m² - Barra",
    type: "Comercial",
    purpose: "rent",
    price: 3500,
    neighborhood: "Barra da Tijuca",
    status: "active",
    origin: "manual",
    leads: 3,
  },
  {
    id: "4",
    title: "Apartamento 1 quarto mobiliado - Taquara",
    type: "Apartamento",
    purpose: "rent",
    price: 1200,
    neighborhood: "Taquara",
    status: "inactive",
    origin: "olx",
    leads: 0,
  },
];

const formatPrice = (price: number, purpose: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(price);
  return purpose === "rent" ? `${formatted}/mês` : formatted;
};

export default function Properties() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Imóveis</h1>
          <p className="text-muted-foreground">
            Gerencie seu catálogo de imóveis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar imóveis..." className="pl-9 w-64" />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          <Button variant="hero">
            <Plus className="w-4 h-4" />
            Novo Imóvel
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imóvel</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Foto</span>
                    </div>
                    <span className="font-medium">{property.title}</span>
                  </div>
                </TableCell>
                <TableCell>{property.type}</TableCell>
                <TableCell>
                  <span className="font-semibold">
                    {formatPrice(property.price, property.purpose)}
                  </span>
                </TableCell>
                <TableCell>{property.neighborhood}</TableCell>
                <TableCell>
                  <Badge
                    variant={property.status === "active" ? "approved" : "secondary"}
                  >
                    {property.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      property.origin === "olx"
                        ? "olx"
                        : property.origin === "imovelweb"
                        ? "imovelweb"
                        : "secondary"
                    }
                  >
                    {property.origin === "olx"
                      ? "OLX"
                      : property.origin === "imovelweb"
                      ? "ImovelWeb"
                      : "Manual"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{property.leads}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
