import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TenantData {
  role: string;
  fullName: string;
  cpf: string;
  rg: string;
  birthDate: string;
  maritalStatus: string;
  phone: string;
  email: string;
  occupation: string;
  employmentType: string;
  company: string;
  income: string;
}

interface AddTenantDialogProps {
  fichaId: string;
  currentFormData: Record<string, unknown> | null;
  onSuccess?: () => void;
}

const emptyTenant: TenantData = {
  role: "locatario",
  fullName: "",
  cpf: "",
  rg: "",
  birthDate: "",
  maritalStatus: "",
  phone: "",
  email: "",
  occupation: "",
  employmentType: "",
  company: "",
  income: "",
};

export function AddTenantDialog({ fichaId, currentFormData, onSuccess }: AddTenantDialogProps) {
  const [open, setOpen] = useState(false);
  const [tenant, setTenant] = useState<TenantData>({ ...emptyTenant });
  const queryClient = useQueryClient();

  const onChange = (field: keyof TenantData, value: string) => {
    setTenant((prev) => ({ ...prev, [field]: value }));
  };

  const addTenantMutation = useMutation({
    mutationFn: async () => {
      const fd = currentFormData || {};
      const existing = (fd.additional_tenants || fd.tenants || []) as TenantData[];
      const updatedTenants = [...existing, tenant];

      const { error } = await supabase
        .from("fichas")
        .update({
          form_data: {
            ...fd,
            additional_tenants: updatedTenants,
          } as any,
        })
        .eq("id", fichaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Participante adicionado!", {
        description: `${tenant.role === "fiador" ? "Fiador" : "Locatário"} ${tenant.fullName} foi adicionado à ficha.`,
      });
      queryClient.invalidateQueries({ queryKey: ["ficha", fichaId] });
      queryClient.invalidateQueries({ queryKey: ["fichas"] });
      setTenant({ ...emptyTenant });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error("Erro ao adicionar participante", { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant.fullName.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    if (!tenant.cpf.trim()) {
      toast.error("CPF é obrigatório");
      return;
    }
    addTenantMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="w-4 h-4 mr-2" />
          Adicionar Locatário/Fiador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Participante</DialogTitle>
          <DialogDescription>
            Acrescente um novo locatário (complemento de renda) ou fiador a esta ficha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Função *</Label>
              <Select value={tenant.role} onValueChange={(v) => onChange("role", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="locatario">Locatário (complemento de renda)</SelectItem>
                  <SelectItem value="fiador">Fiador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={tenant.fullName}
                  onChange={(e) => onChange("fullName", e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input
                  value={tenant.cpf}
                  onChange={(e) => onChange("cpf", e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label>RG</Label>
                <Input
                  value={tenant.rg}
                  onChange={(e) => onChange("rg", e.target.value)}
                  placeholder="00.000.000-0"
                />
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={tenant.birthDate}
                  onChange={(e) => onChange("birthDate", e.target.value)}
                />
              </div>
              <div>
                <Label>Estado Civil</Label>
                <Select value={tenant.maritalStatus} onValueChange={(v) => onChange("maritalStatus", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    <SelectItem value="uniao_estavel">União Estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Telefone/WhatsApp</Label>
                <Input
                  value={tenant.phone}
                  onChange={(e) => onChange("phone", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={tenant.email}
                  onChange={(e) => onChange("email", e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label>Profissão</Label>
                <Input
                  value={tenant.occupation}
                  onChange={(e) => onChange("occupation", e.target.value)}
                  placeholder="Sua profissão"
                />
              </div>
              <div>
                <Label>Tipo de Vínculo</Label>
                <Select value={tenant.employmentType} onValueChange={(v) => onChange("employmentType", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clt">CLT</SelectItem>
                    <SelectItem value="autonomo">Autônomo</SelectItem>
                    <SelectItem value="empresario">Empresário</SelectItem>
                    <SelectItem value="aposentado">Aposentado</SelectItem>
                    <SelectItem value="funcionario_publico">Funcionário Público</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa</Label>
                <Input
                  value={tenant.company}
                  onChange={(e) => onChange("company", e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <Label>Renda Mensal</Label>
                <Input
                  value={tenant.income}
                  onChange={(e) => onChange("income", e.target.value)}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={addTenantMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={addTenantMutation.isPending}>
              {addTenantMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
