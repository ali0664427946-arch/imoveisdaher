import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FichaStatusCount {
  status: string;
  count: number;
}

interface DashboardMetrics {
  totalFichas: number;
  fichasByStatus: FichaStatusCount[];
  totalLeads: number;
  totalProperties: number;
  activeConversations: number;
  conversionRate: number;
  avgAnalysisTime: number; // in hours
  fichasThisMonth: number;
  leadsThisMonth: number;
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async (): Promise<DashboardMetrics> => {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Parallel queries for better performance
      const [
        fichasResult,
        leadsResult,
        propertiesResult,
        conversationsResult,
        fichasThisMonthResult,
        leadsThisMonthResult,
        analyzedFichasResult,
      ] = await Promise.all([
        // All fichas with status
        supabase.from("fichas").select("status, created_at, analyzed_at"),
        // Total leads
        supabase.from("leads").select("id, status", { count: "exact" }),
        // Active properties
        supabase.from("properties").select("id", { count: "exact" }).eq("status", "active"),
        // Active conversations (with unread messages)
        supabase.from("conversations").select("id", { count: "exact" }).gt("unread_count", 0),
        // Fichas this month
        supabase.from("fichas").select("id", { count: "exact" }).gte("created_at", firstDayOfMonth),
        // Leads this month
        supabase.from("leads").select("id", { count: "exact" }).gte("created_at", firstDayOfMonth),
        // Fichas with analysis for avg time calculation
        supabase.from("fichas").select("created_at, analyzed_at").not("analyzed_at", "is", null),
      ]);

      // Process fichas by status
      const fichas = fichasResult.data || [];
      const statusCounts: Record<string, number> = {};
      fichas.forEach((f) => {
        statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
      });

      const fichasByStatus: FichaStatusCount[] = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      }));

      // Calculate conversion rate (apto / total analyzed)
      const totalAnalyzed = fichas.filter((f) => f.status !== "pendente" && f.status !== "em_analise").length;
      const aptos = fichas.filter((f) => f.status === "apto").length;
      const conversionRate = totalAnalyzed > 0 ? (aptos / totalAnalyzed) * 100 : 0;

      // Calculate average analysis time
      const analyzedFichas = analyzedFichasResult.data || [];
      let totalAnalysisTime = 0;
      analyzedFichas.forEach((f) => {
        if (f.created_at && f.analyzed_at) {
          const created = new Date(f.created_at).getTime();
          const analyzed = new Date(f.analyzed_at).getTime();
          totalAnalysisTime += (analyzed - created) / (1000 * 60 * 60); // hours
        }
      });
      const avgAnalysisTime = analyzedFichas.length > 0 ? totalAnalysisTime / analyzedFichas.length : 0;

      return {
        totalFichas: fichas.length,
        fichasByStatus,
        totalLeads: leadsResult.count || 0,
        totalProperties: propertiesResult.count || 0,
        activeConversations: conversationsResult.count || 0,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgAnalysisTime: Math.round(avgAnalysisTime * 10) / 10,
        fichasThisMonth: fichasThisMonthResult.count || 0,
        leadsThisMonth: leadsThisMonthResult.count || 0,
      };
    },
    staleTime: 30000, // 30 seconds
  });
}
