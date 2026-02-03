import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  Upload,
  Users,
  Check,
  UserPlus,
  Search,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWhatsAppContacts, WhatsAppContact } from "@/hooks/useWhatsAppContacts";

interface ImportContactsDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ImportContactsDialog({ trigger, onSuccess }: ImportContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const {
    contacts,
    selectedContacts,
    isFetching,
    isImporting,
    fetchContacts,
    toggleContact,
    selectAllNew,
    clearSelection,
    importSelected,
    newContactsCount,
    existingLeadsCount,
  } = useWhatsAppContacts();

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = search.toLowerCase();
    return (
      contact.phone.includes(search) ||
      contact.name?.toLowerCase().includes(searchLower) ||
      contact.pushName?.toLowerCase().includes(searchLower)
    );
  });

  const handleImport = () => {
    importSelected();
    if (onSuccess) {
      onSuccess();
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "";
    }
  };

  const formatPhone = (phone: string) => {
    // Format as (XX) XXXXX-XXXX for Brazilian numbers
    const clean = phone.replace(/\D/g, "");
    if (clean.length === 13 && clean.startsWith("55")) {
      const ddd = clean.slice(2, 4);
      const first = clean.slice(4, 9);
      const last = clean.slice(9);
      return `(${ddd}) ${first}-${last}`;
    }
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Importar do WhatsApp
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Importar Contatos do WhatsApp
          </DialogTitle>
          <DialogDescription>
            Busque os contatos do histórico de conversas do WhatsApp e importe como leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fetch button and stats */}
          <div className="flex items-center justify-between gap-4">
            <Button
              onClick={fetchContacts}
              disabled={isFetching}
              variant="outline"
            >
              {isFetching ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {contacts.length > 0 ? "Atualizar Lista" : "Buscar Contatos"}
                </>
              )}
            </Button>

            {contacts.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{contacts.length} total</Badge>
                <Badge variant="default" className="bg-green-600">{newContactsCount} novos</Badge>
                <Badge variant="outline">{existingLeadsCount} já importados</Badge>
              </div>
            )}
          </div>

          {/* Search and selection controls */}
          {contacts.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllNew}
                  disabled={newContactsCount === 0}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Selecionar Novos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedContacts.size === 0}
                >
                  Limpar
                </Button>
              </div>

              {/* Contacts list */}
              <ScrollArea className="h-[350px] border rounded-md p-2">
                <div className="space-y-1">
                  {filteredContacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      isSelected={selectedContacts.has(contact.id)}
                      onToggle={() => toggleContact(contact.id)}
                      formatPhone={formatPhone}
                      formatDate={formatDate}
                    />
                  ))}
                  {filteredContacts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {search ? "Nenhum contato encontrado" : "Nenhum contato disponível"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Empty state */}
          {contacts.length === 0 && !isFetching && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Clique em "Buscar Contatos" para carregar</p>
              <p className="text-sm">os contatos do histórico do WhatsApp</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedContacts.size > 0 && (
              <span>
                {selectedContacts.size} contato{selectedContacts.size > 1 ? "s" : ""} selecionado{selectedContacts.size > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || selectedContacts.size === 0}
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Importar Selecionados
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ContactRowProps {
  contact: WhatsAppContact;
  isSelected: boolean;
  onToggle: () => void;
  formatPhone: (phone: string) => string;
  formatDate: (date?: string) => string;
}

function ContactRow({ contact, isSelected, onToggle, formatPhone, formatDate }: ContactRowProps) {
  const displayName = contact.name || contact.pushName || `Contato ${contact.phone.slice(-4)}`;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${
        isSelected ? "bg-primary/10" : ""
      } ${contact.isExistingLead ? "opacity-60" : ""}`}
      onClick={() => !contact.isExistingLead && onToggle()}
    >
      <Checkbox
        checked={isSelected}
        disabled={contact.isExistingLead}
        onCheckedChange={() => !contact.isExistingLead && onToggle()}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{displayName}</span>
          {contact.isExistingLead && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Já é lead
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatPhone(contact.phone)}</span>
          {contact.lastMessageAt && (
            <>
              <span>•</span>
              <span>{formatDate(contact.lastMessageAt)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
