import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Upload,
  Loader2,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProperties, Property } from "@/hooks/useProperties";
import { NewPropertyDialog } from "@/components/properties/NewPropertyDialog";
import { ImportPropertiesDialog } from "@/components/properties/ImportPropertiesDialog";
import { EditPropertyDialog } from "@/components/properties/EditPropertyDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const formatPrice = (price: number, purpose: string) => {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(price);
  return purpose === "rent" ? `${formatted}/mês` : formatted;
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  inactive: "Suspenso",
  rented: "Alugado",
  sold: "Vendido",
};

const statusVariants: Record<string, "approved" | "secondary" | "pending" | "default"> = {
  active: "approved",
  inactive: "secondary",
  rented: "pending",
  sold: "default",
};

export default function Properties() {
  const {
    properties,
    isLoading,
    createProperty,
    updateProperty,
    deleteProperty,
    suspendProperty,
    publishToPortal,
    refetch,
  } = useProperties();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPurpose, setFilterPurpose] = useState<"all" | "rent" | "sale">("all");
  const [filterPhoto, setFilterPhoto] = useState<"all" | "with" | "without">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [syncingOlx, setSyncingOlx] = useState(false);

  // Get OLX profile URL from settings
  const { data: olxProfileUrl } = useQuery({
    queryKey: ["olx-profile-url"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations_settings")
        .select("value")
        .eq("key", "olx_auto_sync")
        .maybeSingle();
      const settings = data?.value as Record<string, unknown> | null;
      return (settings?.profile_url as string) || null;
    },
  });

  const handleSyncOlx = async () => {
    if (!olxProfileUrl) {
      toast({
        title: "URL não configurada",
        description: "Configure a URL do perfil OLX em Configurações primeiro.",
        variant: "destructive",
      });
      return;
    }
    setSyncingOlx(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-olx", {
        body: { profileUrl: olxProfileUrl },
      });
      if (error) throw error;
      toast({
        title: "Sincronização OLX concluída",
        description: `${data.synced} imóveis sincronizados de ${data.found} encontrados`,
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Erro na sincronização",
        description: err.message || "Falha ao sincronizar com OLX",
        variant: "destructive",
      });
    } finally {
      setSyncingOlx(false);
    }
  };

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.neighborhood.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPurpose =
        filterPurpose === "all" || p.purpose === filterPurpose;
      const hasPhotos = p.photos && p.photos.length > 0;
      const matchesPhoto =
        filterPhoto === "all" ||
        (filterPhoto === "with" && hasPhotos) ||
        (filterPhoto === "without" && !hasPhotos);
      return matchesSearch && matchesPurpose && matchesPhoto;
    });
  }, [properties, searchQuery, filterPurpose, filterPhoto]);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteProperty(deleteId);
      setDeleteId(null);
    }
  };

  const handlePublish = async (propertyId: string, platform: "olx" | "imovelweb") => {
    setPublishingId(propertyId);
    await publishToPortal(propertyId, platform);
    setPublishingId(null);
  };

  const handleSuspend = async (propertyId: string, currentStatus: string) => {
    const shouldSuspend = currentStatus === "active";
    await suspendProperty(propertyId, shouldSuspend);
  };

  const handleSaveProperty = async (
    id: string,
    updates: Partial<Property>
  ) => {
    await updateProperty(id, updates);
    await refetch();
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Imóveis</h1>
          <p className="text-muted-foreground">
            Gerencie e publique seus imóveis nos portais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncOlx}
            disabled={syncingOlx}
            className="gap-2"
          >
            {syncingOlx ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {syncingOlx ? "Sincronizando..." : "Sync OLX"}
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar imóveis..."
              className="pl-9 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={filterPurpose === "all" && filterPhoto === "all" ? "outline" : "default"}
              size="sm"
              onClick={() => { setFilterPurpose("all"); setFilterPhoto("all"); }}
            >
              Todos
            </Button>
            <Button
              variant={filterPurpose === "rent" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPurpose(filterPurpose === "rent" ? "all" : "rent")}
            >
              Aluguel
            </Button>
            <Button
              variant={filterPurpose === "sale" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPurpose(filterPurpose === "sale" ? "all" : "sale")}
            >
              Venda
            </Button>
            <Button
              variant={filterPhoto === "with" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPhoto(filterPhoto === "with" ? "all" : "with")}
            >
              Com foto
            </Button>
            <Button
              variant={filterPhoto === "without" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPhoto(filterPhoto === "without" ? "all" : "without")}
            >
              Sem foto
            </Button>
          </div>
          <ImportPropertiesDialog onSuccess={refetch} />
          <NewPropertyDialog onSubmit={createProperty} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Imóvel</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Publicado</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProperties.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-12 text-muted-foreground"
                >
                  {searchQuery
                    ? "Nenhum imóvel encontrado"
                    : "Nenhum imóvel cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              filteredProperties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground">
                      {property.origin_id || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                        {property.photos && property.photos.length > 0 ? (
                          <img
                            src={property.photos[0].url}
                            alt={property.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Foto
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">{property.title}</span>
                        {property.featured && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Destaque
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{property.type}</TableCell>
                  <TableCell>
                    <span className="font-semibold">
                      {formatPrice(property.price, property.purpose)}
                    </span>
                  </TableCell>
                  <TableCell>{property.neighborhood}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[property.status] || "secondary"}>
                      {statusLabels[property.status] || property.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {property.origin === "olx" && (
                        <Badge variant="olx">OLX</Badge>
                      )}
                      {property.origin === "imovelweb" && (
                        <Badge variant="imovelweb">ImovelWeb</Badge>
                      )}
                      {property.origin === "manual" && (
                        <span className="text-xs text-muted-foreground">
                          Não publicado
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{property.leads_count || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={publishingId === property.id}
                        >
                          {publishingId === property.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="w-4 h-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a
                            href={`/imovel/${property.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setEditingProperty(property)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handlePublish(property.id, "olx")}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Publicar na OLX
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePublish(property.id, "imovelweb")}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Publicar no ImovelWeb
                        </DropdownMenuItem>
                        {property.url_original && (
                          <DropdownMenuItem asChild>
                            <a
                              href={property.url_original}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Ver no Portal
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            handleSuspend(property.id, property.status)
                          }
                        >
                          {property.status === "active" ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              Suspender
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Reativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(property.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editingProperty && (
        <EditPropertyDialog
          property={editingProperty}
          open={!!editingProperty}
          onOpenChange={(open) => {
            if (!open) setEditingProperty(null);
          }}
          onSave={handleSaveProperty}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imóvel?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O imóvel e todas as suas fotos
              serão removidos permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
