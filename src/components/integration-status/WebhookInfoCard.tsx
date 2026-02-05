import { Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface WebhookInfoCardProps {
  title: string;
  description: string;
  endpoint: string;
  events: string;
  method?: string;
}

export function WebhookInfoCard({ title, description, endpoint, events, method = "POST" }: WebhookInfoCardProps) {
  const { toast } = useToast();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Server className="w-4 h-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <code className="flex-1 p-3 bg-muted rounded-lg text-xs font-mono break-all">
            {endpoint}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(endpoint);
              toast({ title: "URL copiada!" });
            }}
          >
            Copiar
          </Button>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Eventos necessários:</strong> {events}</p>
          <p><strong>Método:</strong> {method}</p>
        </div>
      </CardContent>
    </Card>
  );
}
