import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, User } from "lucide-react";

export interface TenantData {
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

interface TenantFormProps {
  index: number;
  data: Partial<TenantData>;
  onChange: (field: keyof TenantData, value: string) => void;
  onRemove?: () => void;
  isPrimary?: boolean;
}

export function TenantForm({
  index,
  data,
  onChange,
  onRemove,
  isPrimary = false,
}: TenantFormProps) {
  return (
    <div className="border rounded-xl p-4 md:p-6 bg-card/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
            <User className="w-4 h-4 text-accent" />
          </div>
          <h3 className="font-semibold">
            {isPrimary ? "Locatário Principal" : `Locatário ${index + 1}`}
          </h3>
        </div>
        {onRemove && !isPrimary && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor={`fullName-${index}`}>Nome Completo *</Label>
          <Input
            id={`fullName-${index}`}
            placeholder="Digite o nome completo"
            value={data.fullName || ""}
            onChange={(e) => onChange("fullName", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`cpf-${index}`}>CPF *</Label>
          <Input
            id={`cpf-${index}`}
            placeholder="000.000.000-00"
            value={data.cpf || ""}
            onChange={(e) => onChange("cpf", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`rg-${index}`}>RG</Label>
          <Input
            id={`rg-${index}`}
            placeholder="00.000.000-0"
            value={data.rg || ""}
            onChange={(e) => onChange("rg", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`birthDate-${index}`}>Data de Nascimento</Label>
          <Input
            id={`birthDate-${index}`}
            type="date"
            value={data.birthDate || ""}
            onChange={(e) => onChange("birthDate", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`maritalStatus-${index}`}>Estado Civil</Label>
          <Select
            value={data.maritalStatus || ""}
            onValueChange={(v) => onChange("maritalStatus", v)}
          >
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
          <Label htmlFor={`phone-${index}`}>Telefone/WhatsApp *</Label>
          <Input
            id={`phone-${index}`}
            placeholder="(00) 00000-0000"
            value={data.phone || ""}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`email-${index}`}>E-mail</Label>
          <Input
            id={`email-${index}`}
            type="email"
            placeholder="seu@email.com"
            value={data.email || ""}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`occupation-${index}`}>Profissão</Label>
          <Input
            id={`occupation-${index}`}
            placeholder="Sua profissão"
            value={data.occupation || ""}
            onChange={(e) => onChange("occupation", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`employmentType-${index}`}>Tipo de Vínculo</Label>
          <Select
            value={data.employmentType || ""}
            onValueChange={(v) => onChange("employmentType", v)}
          >
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
          <Label htmlFor={`company-${index}`}>Empresa</Label>
          <Input
            id={`company-${index}`}
            placeholder="Nome da empresa"
            value={data.company || ""}
            onChange={(e) => onChange("company", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`income-${index}`}>Renda Mensal</Label>
          <Input
            id={`income-${index}`}
            placeholder="R$ 0,00"
            value={data.income || ""}
            onChange={(e) => onChange("income", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
