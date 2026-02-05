import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function GroupsSyncCard() {
  const [syncingGroups, setSyncingGroups] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groupsWithoutNames } = useQuery({
    queryKey: ["integration-status-groups-no-name"],
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("is_group", true)
        .is("group_name", null);
      return count || 0;
    },
    refetchInterval: 60000,
  });

  const syncGroups = async () => {
    setSyncingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-group-names");
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Grupos sincronizados! ✅", description: `${data.updated} de ${data.total} grupos atualizados` });
        queryClient.invalidateQueries({ queryKey: ["integration-status-groups-no-name"] });
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast({ title: "Erro ❌", description: msg, variant: "destructive" });
    } finally {
      setSyncingGroups(false);
    }
  };

  if (!groupsWithoutNames || groupsWithoutNames === 0) return null;

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="font-medium text-sm">{groupsWithoutNames} grupos sem nome</p>
              <p className="text-xs text-muted-foreground">Sincronize para buscar os nomes da Evolution API</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={syncGroups} disabled={syncingGroups}>
            {syncingGroups ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar Grupos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
