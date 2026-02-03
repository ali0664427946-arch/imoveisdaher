import { useState } from "react";
import { FileText, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTemplates, replaceVariables, type Template } from "@/hooks/useTemplates";

interface TemplateSelectorProps {
  onSelect: (content: string) => void;
  variables?: Record<string, string>;
  channel?: string;
}

export function TemplateSelector({ onSelect, variables = {}, channel }: TemplateSelectorProps) {
  const { templates, isLoading } = useTemplates();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase());
    
    const matchesChannel = !channel || !t.channel || t.channel === channel;
    
    return matchesSearch && matchesChannel;
  });

  const handleSelect = (template: Template) => {
    const processedContent = replaceVariables(template.content, variables);
    onSelect(processedContent);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />
          Templates
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>
        <ScrollArea className="h-64">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum template encontrado
            </div>
          ) : (
            <div className="p-1">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{template.name}</span>
                    {template.channel && (
                      <Badge variant="secondary" className="text-xs">
                        {template.channel}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
