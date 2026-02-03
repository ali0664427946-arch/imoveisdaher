import { useEffect, useState } from "react";
import { FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTemplates, extractVariables, type Template } from "@/hooks/useTemplates";
import type { Database } from "@/integrations/supabase/types";

type Channel = Database["public"]["Enums"]["conversation_channel"];

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
}

const variableExamples = [
  { name: "nome", description: "Nome do lead" },
  { name: "imovel", description: "Título do imóvel" },
  { name: "bairro", description: "Bairro do imóvel" },
  { name: "preco", description: "Preço do imóvel" },
  { name: "data", description: "Data/horário" },
];

export function TemplateDialog({ open, onOpenChange, templateId }: TemplateDialogProps) {
  const { templates, createTemplate, updateTemplate, isCreating, isUpdating } = useTemplates();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [channel, setChannel] = useState<Channel | "">("");

  const existingTemplate = templateId
    ? templates.find((t) => t.id === templateId)
    : null;

  const isEditing = !!existingTemplate;
  const variables = extractVariables(content);

  useEffect(() => {
    if (existingTemplate) {
      setName(existingTemplate.name);
      setContent(existingTemplate.content);
      setChannel(existingTemplate.channel || "");
    } else {
      setName("");
      setContent("");
      setChannel("");
    }
  }, [existingTemplate, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !content.trim()) return;

    const data = {
      name: name.trim(),
      content: content.trim(),
      channel: channel || null,
      variables: variables.length > 0 ? variables : null,
    };

    if (isEditing && templateId) {
      updateTemplate(
        { id: templateId, ...data },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createTemplate(data, { onSuccess: () => onOpenChange(false) });
    }
  };

  const insertVariable = (varName: string) => {
    setContent((prev) => prev + `{{${varName}}}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {isEditing ? "Editar Template" : "Novo Template"}
            </DialogTitle>
            <DialogDescription>
              Use variáveis como {`{{nome}}`} para personalizar a mensagem
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Template</Label>
                <Input
                  id="name"
                  placeholder="Ex: Boas-vindas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="channel">Canal</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="olx_chat">OLX Chat</SelectItem>
                    <SelectItem value="internal">Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="content">Conteúdo da Mensagem</Label>
              <Textarea
                id="content"
                placeholder={`Olá {{nome}}, tudo bem?\n\nVi que você tem interesse no imóvel {{imovel}} em {{bairro}}...`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="mt-1 font-mono text-sm"
              />
            </div>

            {/* Variable Buttons */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Inserir variável
              </Label>
              <div className="flex flex-wrap gap-2">
                {variableExamples.map((v) => (
                  <Button
                    key={v.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(v.name)}
                    title={v.description}
                  >
                    {`{{${v.name}}}`}
                  </Button>
                ))}
              </div>
            </div>

            {/* Preview of detected variables */}
            {variables.length > 0 && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Variáveis detectadas:
                </p>
                <div className="flex flex-wrap gap-1">
                  {variables.map((v) => (
                    <Badge key={v} variant="secondary">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isCreating || isUpdating || !name.trim() || !content.trim()}
            >
              {isCreating || isUpdating
                ? "Salvando..."
                : isEditing
                ? "Salvar Alterações"
                : "Criar Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
