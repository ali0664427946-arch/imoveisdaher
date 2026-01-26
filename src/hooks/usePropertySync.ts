import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncResult {
  success: boolean;
  synced?: number;
  source?: string;
  error?: string;
}

export function usePropertySync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const syncFromOLX = async (properties: any[]) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-properties", {
        body: properties,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (error) throw error;

      const result = data as SyncResult;
      
      if (result.success) {
        toast({
          title: "Sincronização OLX concluída",
          description: `${result.synced} imóveis sincronizados`,
        });
      } else {
        throw new Error(result.error || "Erro desconhecido");
      }

      return result;
    } catch (error: any) {
      console.error("OLX sync error:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Falha ao sincronizar com OLX",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsSyncing(false);
    }
  };

  const syncFromImovelWeb = async (properties: any[]) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-properties?source=imovelweb", {
        body: properties,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (error) throw error;

      const result = data as SyncResult;
      
      if (result.success) {
        toast({
          title: "Sincronização ImovelWeb concluída",
          description: `${result.synced} imóveis sincronizados`,
        });
      } else {
        throw new Error(result.error || "Erro desconhecido");
      }

      return result;
    } catch (error: any) {
      console.error("ImovelWeb sync error:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Falha ao sincronizar com ImovelWeb",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsSyncing(false);
    }
  };

  const importFromFeedUrl = async (feedUrl: string) => {
    setIsSyncing(true);
    try {
      // This would typically call a separate edge function that fetches and parses the XML feed
      toast({
        title: "Importação iniciada",
        description: "Buscando imóveis do feed...",
      });

      // For now, show a message that this needs backend implementation
      toast({
        title: "Em desenvolvimento",
        description: "A importação via feed URL será implementada em breve",
      });

      return { success: true };
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message || "Falha ao importar do feed",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isSyncing,
    syncFromOLX,
    syncFromImovelWeb,
    importFromFeedUrl,
  };
}
