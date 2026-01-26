import { useState } from "react";
import { Search, Filter, MoreHorizontal, Eye, FileCheck, FileX, Bot } from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fichas = [
  {
    id: "1",
    protocol: "DH-20260126-1234",
    name: "João Silva",
    cpf: "***.***.***-12",
    phone: "(21) 99999-1234",
    property: "Apt 2 quartos - Pechincha",
    status: "pendente",
    docsCount: 4,
    createdAt: "26/01/2026 14:30",
  },
  {
    id: "2",
    protocol: "DH-20260126-5678",
    name: "Maria Santos",
    cpf: "***.***.***-56",
    phone: "(21) 99999-5678",
    property: "Casa 3 quartos - Recreio",
    status: "em_analise",
    docsCount: 6,
    createdAt: "26/01/2026 12:15",
  },
  {
    id: "3",
    protocol: "DH-20260125-9012",
    name: "Carlos Oliveira",
    cpf: "***.***.***-90",
    phone: "(21) 99999-9012",
    property: "Sala Comercial - Barra",
    status: "apto",
    docsCount: 5,
    createdAt: "25/01/2026 10:00",
  },
  {
    id: "4",
    protocol: "DH-20260125-3456",
    name: "Ana Costa",
    cpf: "***.***.***-34",
    phone: "(21) 99999-3456",
    property: "Apt 1 quarto - Taquara",
    status: "faltando_docs",
    docsCount: 2,
    createdAt: "25/01/2026 09:00",
  },
  {
    id: "5",
    protocol: "DH-20260124-7890",
    name: "Pedro Lima",
    cpf: "***.***.***-78",
    phone: "(21) 99999-7890",
    property: "Casa Jacarepaguá",
    status: "nao_apto",
    docsCount: 4,
    createdAt: "24/01/2026 16:45",
  },
];

const statusConfig: Record<string, { label: string; variant: "pending" | "analyzing" | "approved" | "rejected" | "secondary" }> = {
  pendente: { label: "Pendente", variant: "pending" },
  em_analise: { label: "Em Análise", variant: "analyzing" },
  apto: { label: "Apto", variant: "approved" },
  nao_apto: { label: "Não Apto", variant: "rejected" },
  faltando_docs: { label: "Faltando Docs", variant: "secondary" },
};

export default function Fichas() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredFichas = statusFilter === "all"
    ? fichas
    : fichas.filter((f) => f.status === statusFilter);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Fichas de Interesse</h1>
          <p className="text-muted-foreground">
            Gerencie e analise as fichas recebidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou protocolo..." className="pl-9 w-64" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="apto">Apto</SelectItem>
              <SelectItem value="nao_apto">Não Apto</SelectItem>
              <SelectItem value="faltando_docs">Faltando Docs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = fichas.filter((f) => f.status === key).length;
          return (
            <div
              key={key}
              className="bg-card rounded-xl p-4 border cursor-pointer hover:border-accent transition-colors"
              onClick={() => setStatusFilter(key)}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm text-muted-foreground">{config.label}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocolo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Imóvel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Docs</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFichas.map((ficha) => (
              <TableRow key={ficha.id}>
                <TableCell className="font-mono text-sm">
                  {ficha.protocol}
                </TableCell>
                <TableCell className="font-medium">{ficha.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ficha.cpf}
                </TableCell>
                <TableCell>{ficha.phone}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {ficha.property}
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig[ficha.status].variant}>
                    {statusConfig[ficha.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{ficha.docsCount}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ficha.createdAt}
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
                        Ver Ficha Completa
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Bot className="w-4 h-4 mr-2" />
                        Rodar Análise IA
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-success">
                        <FileCheck className="w-4 h-4 mr-2" />
                        Aprovar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <FileX className="w-4 h-4 mr-2" />
                        Reprovar
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
