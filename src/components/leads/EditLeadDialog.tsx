import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Lead {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

interface EditLeadDialogProps {
  lead: Lead;
  trigger?: React.ReactNode;
}

export function EditLeadDialog({ lead, trigger }: EditLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [notes, setNotes] = useState(lead.notes || "");
  const queryClient = useQueryClient();

  // Reset form when lead changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(lead.name);
      setPhone(lead.phone || "");
      setEmail(lead.email || "");
      setNotes(lead.notes || "");
    }
  }, [open, lead]);

  const updateLead = useMutation({
    mutationFn: async () => {
      // Normalize phone: remove non-digits
      const normalizedPhone = phone.replace(/\D/g, "");
      
      const { data, error } = await supabase
        .from("leads")
        .update({
          name,
          phone: normalizedPhone,
          phone_normalized: normalizedPhone ? `+55${normalizedPhone}` : null,
          email: email || null,
          notes: notes || null,
        })
        .eq("id", lead.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Lead atualizado!", {
        description: "As informações foram salvas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar lead", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateLead.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
          <DialogDescription>
            Atualize as informações do lead. Certifique-se de incluir o DDD no telefone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone (com DDD)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="21999998888"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Exemplo: 21999998888 (DDD + número)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre o lead..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={updateLead.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateLead.isPending}>
              {updateLead.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
