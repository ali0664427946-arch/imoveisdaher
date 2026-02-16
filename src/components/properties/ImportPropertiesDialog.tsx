import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ParsedProperty {
  codigo: string;
  titulo: string;
  descricao: string;
  tipo: string;
  status_anuncio: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  area_util: number;
  area_total: number;
  valor_venda: number;
  valor_aluguel: number;
  condominio: number;
  iptu: number;
  beneficios: string;
}

function parseSpreadsheet(file: File): Promise<ParsedProperty[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        const properties: ParsedProperty[] = rows.map((row) => ({
          codigo: String(row["Código do Imóvel"] || "").trim(),
          titulo: String(row["Título do imóvel"] || "").trim(),
          descricao: String(row["Descrição"] || "").trim(),
          tipo: String(row["Tipo do imóvel"] || "").trim(),
          status_anuncio: String(row["Status do anúncio"] || "Ativo").trim(),
          cep: String(row["CEP"] || "").trim(),
          endereco: String(row["Endereço"] || "").trim(),
          bairro: String(row["Bairro"] || "").trim(),
          cidade: String(row["Cidade"] || "").trim(),
          estado: String(row["Estado"] || "").trim(),
          quartos: Number(row["Quartos"]) || 0,
          suites: Number(row["Suítes"]) || 0,
          banheiros: Number(row["Banheiros"]) || 0,
          vagas: Number(row["Vagas"]) || 0,
          area_util: Number(row["Área útil"]) || 0,
          area_total: Number(row["Área total"]) || 0,
          valor_venda: Number(row["Valor de Venda"]) || 0,
          valor_aluguel: Number(row["Valor do aluguel"]) || 0,
          condominio: Number(row["Condomínio/mês"]) || 0,
          iptu: Number(row["IPTU/ano"]) || 0,
          beneficios: String(row["Benefícios do imóvel"] || "").trim(),
        }));

        resolve(properties.filter((p) => p.codigo));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}

export function ImportPropertiesDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedProperty[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    try {
      const props = await parseSpreadsheet(f);
      setParsed(props);
    } catch {
      toast({ title: "Erro ao ler planilha", description: "Verifique se o formato está correto.", variant: "destructive" });
      setParsed(null);
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-properties-batch", {
        body: { properties: parsed },
      });
      if (error) throw error;
      setResult({ inserted: data.inserted, updated: data.updated, errors: data.errors });
      toast({
        title: "Importação concluída",
        description: `${data.inserted} novos, ${data.updated} atualizados${data.errors > 0 ? `, ${data.errors} erros` : ""}`,
      });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParsed(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Imóveis via Planilha</DialogTitle>
          <DialogDescription>
            Envie a planilha exportada do Canal Pro (XLSX ou CSV) para importar os imóveis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <span className="font-medium">{file.name}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar a planilha
                </p>
                <p className="text-xs text-muted-foreground">XLSX, XLS ou CSV</p>
              </div>
            )}
          </div>

          {/* Preview */}
          {parsed && !result && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm">
                {parsed.length} imóveis encontrados na planilha
              </p>
              <div className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                {parsed.slice(0, 10).map((p) => (
                  <div key={p.codigo} className="flex justify-between">
                    <span>{p.codigo} - {p.tipo}</span>
                    <span>
                      {p.valor_venda > 0
                        ? `R$ ${p.valor_venda.toLocaleString("pt-BR")}`
                        : `R$ ${p.valor_aluguel.toLocaleString("pt-BR")}/mês`}
                    </span>
                  </div>
                ))}
                {parsed.length > 10 && (
                  <p className="text-center">... e mais {parsed.length - 10}</p>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Importação concluída</span>
              </div>
              <div className="text-sm space-y-1">
                <p>✅ {result.inserted} imóveis novos inseridos</p>
                <p>↻ {result.updated} imóveis atualizados</p>
                {result.errors > 0 && (
                  <p className="text-destructive flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {result.errors} erros
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {result ? (
              <Button onClick={() => setOpen(false)}>Fechar</Button>
            ) : (
              <Button
                onClick={handleImport}
                disabled={!parsed || parsed.length === 0 || importing}
                className="gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar {parsed?.length || 0} imóveis
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
