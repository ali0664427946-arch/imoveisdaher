import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Download,
  Upload,
  Plus,
  Tag,
  Filter,
  UserPlus,
  Trash2,
  MoreHorizontal,
  X,
  FileSpreadsheet,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  Send,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useContacts, exportContactsToCSV, Contact, ContactFilters } from "@/hooks/useContacts";
import { ImportContactsDialog } from "@/components/contacts/ImportContactsDialog";
import { NewContactDialog } from "@/components/contacts/NewContactDialog";
import { EditContactDialog } from "@/components/contacts/EditContactDialog";
import { ScheduleMessageDialog } from "@/components/whatsapp/ScheduleMessageDialog";
import { SendNowDialog } from "@/components/whatsapp/SendNowDialog";

const originLabels: Record<string, string> = {
  whatsapp_import: "WhatsApp",
  manual: "Manual",
  contact_form: "Formulário",
};

export default function Contacts() {
  const [filters, setFilters] = useState<ContactFilters>({});
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [scheduleContact, setScheduleContact] = useState<Contact | null>(null);
  const [sendNowContact, setSendNowContact] = useState<Contact | null>(null);

  const {
    contacts,
    allTags,
    isLoading,
    deleteContact,
    convertToLead,
    isConverting,
  } = useContacts(filters);

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined }));
  };

  const handleTagFilter = (tag: string) => {
    setFilters((prev) => {
      const currentTags = prev.tags || [];
      if (currentTags.includes(tag)) {
        return { ...prev, tags: currentTags.filter((t) => t !== tag) };
      }
      return { ...prev, tags: [...currentTags, tag] };
    });
  };

  const handleOriginFilter = (origin: string | undefined) => {
    setFilters((prev) => ({ ...prev, origin }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const toggleSelectContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllContacts = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleExportSelected = () => {
    const toExport = contacts.filter((c) => selectedContacts.has(c.id));
    exportContactsToCSV(toExport, "contatos_selecionados");
  };

  const handleExportAll = () => {
    exportContactsToCSV(contacts, "todos_contatos");
  };

  const handleDeleteConfirm = () => {
    if (contactToDelete) {
      deleteContact(contactToDelete.id);
      setContactToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const formatPhone = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    return phone;
  };

  const hasActiveFilters = filters.search || (filters.tags && filters.tags.length > 0) || filters.origin;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Contatos
            </h1>
            <p className="text-sm text-muted-foreground">
              {contacts.length} contatos • {selectedContacts.size} selecionados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ImportContactsDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Importar WhatsApp
                </Button>
              }
            />
            <NewContactDialog />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportAll}>
                  Exportar Todos ({contacts.length})
                </DropdownMenuItem>
                {selectedContacts.size > 0 && (
                  <DropdownMenuItem onClick={handleExportSelected}>
                    Exportar Selecionados ({selectedContacts.size})
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              className="pl-9"
              value={filters.search || ""}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          <Select
            value={filters.origin || "all"}
            onValueChange={(v) => handleOriginFilter(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="whatsapp_import">WhatsApp</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="contact_form">Formulário</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Tag className="w-4 h-4 mr-2" />
                Tags
                {filters.tags && filters.tags.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {filters.tags.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <p className="text-sm font-medium">Filtrar por tags</p>
                {allTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma tag criada</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {allTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={filters.tags?.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleTagFilter(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedContacts.size === contacts.length && contacts.length > 0}
                  onCheckedChange={selectAllContacts}
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Último Contato</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Nenhum contato encontrado</p>
                  <p className="text-sm text-muted-foreground">
                    Importe contatos do WhatsApp ou adicione manualmente
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => toggleSelectContact(contact.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {formatPhone(contact.phone)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {contact.email}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.length > 0 ? (
                        contact.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                      {contact.tags?.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{contact.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {originLabels[contact.origin || ""] || contact.origin}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contact.last_contact_at ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {format(new Date(contact.last_contact_at), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                          <Tag className="w-4 h-4 mr-2" />
                          Editar / Tags
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSendNowContact(contact)}>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar Agora
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setScheduleContact(contact)}>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Agendar Mensagem
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => convertToLead(contact.id)}
                          disabled={isConverting}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Converter para Lead
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setContactToDelete(contact);
                            setDeleteDialogOpen(true);
                          }}
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
      </ScrollArea>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contato "{contactToDelete?.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      {editingContact && (
        <EditContactDialog
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
        />
      )}

      {/* Schedule Message Dialog */}
      {scheduleContact && (
        <ScheduleMessageDialog
          open={!!scheduleContact}
          onOpenChange={(open) => !open && setScheduleContact(null)}
          defaultPhone={scheduleContact.phone}
        />
      )}

      {/* Send Now Dialog */}
      {sendNowContact && (
        <SendNowDialog
          open={!!sendNowContact}
          onOpenChange={(open) => !open && setSendNowContact(null)}
          defaultPhone={sendNowContact.phone}
          contactName={sendNowContact.name}
        />
      )}
    </div>
  );
}
