import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface PropertyFeatures {
  area_servico?: boolean;
  armarios_cozinha?: boolean;
  armarios_quarto?: boolean;
  mobiliado?: boolean;
  ar_condicionado?: boolean;
  churrasqueira?: boolean;
  varanda?: boolean;
  quarto_servico?: boolean;
  condominio_fechado?: boolean;
  seguranca_24h?: boolean;
  area_murada?: boolean;
  permitido_animais?: boolean;
  portao_eletronico?: boolean;
  academia?: boolean;
  piscina?: boolean;
  elevador?: boolean;
}

export const PROPERTY_FEATURES = {
  property: [
    { key: "area_servico", label: "Área de serviço" },
    { key: "armarios_cozinha", label: "Armários na cozinha" },
    { key: "armarios_quarto", label: "Armários no quarto" },
    { key: "mobiliado", label: "Mobiliado" },
    { key: "ar_condicionado", label: "Ar condicionado" },
    { key: "churrasqueira", label: "Churrasqueira" },
    { key: "varanda", label: "Varanda" },
    { key: "quarto_servico", label: "Quarto de serviço" },
  ],
  condo: [
    { key: "condominio_fechado", label: "Condomínio fechado" },
    { key: "seguranca_24h", label: "Segurança 24h" },
    { key: "area_murada", label: "Área murada" },
    { key: "permitido_animais", label: "Permitido animais" },
    { key: "portao_eletronico", label: "Portão eletrônico" },
    { key: "academia", label: "Academia" },
    { key: "piscina", label: "Piscina" },
    { key: "elevador", label: "Elevador" },
  ],
} as const;

interface PropertyFeaturesCheckboxesProps {
  features: PropertyFeatures;
  onChange: (features: PropertyFeatures) => void;
}

export function PropertyFeaturesCheckboxes({ features, onChange }: PropertyFeaturesCheckboxesProps) {
  const toggle = (key: string) => {
    onChange({ ...features, [key]: !features[key as keyof PropertyFeatures] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-3">Detalhes do imóvel</h4>
        <div className="grid grid-cols-2 gap-3">
          {PROPERTY_FEATURES.property.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <Checkbox
                id={`feature-${item.key}`}
                checked={!!features[item.key as keyof PropertyFeatures]}
                onCheckedChange={() => toggle(item.key)}
              />
              <Label htmlFor={`feature-${item.key}`} className="text-sm font-normal cursor-pointer">
                {item.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">Detalhes do condomínio</h4>
        <div className="grid grid-cols-2 gap-3">
          {PROPERTY_FEATURES.condo.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <Checkbox
                id={`feature-${item.key}`}
                checked={!!features[item.key as keyof PropertyFeatures]}
                onCheckedChange={() => toggle(item.key)}
              />
              <Label htmlFor={`feature-${item.key}`} className="text-sm font-normal cursor-pointer">
                {item.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
