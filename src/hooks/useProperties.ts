import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Enums } from "@/integrations/supabase/types";

export type PropertyStatus = Enums<"property_status">;
export type PropertyPurpose = Enums<"property_purpose">;
export type PropertyOrigin = Enums<"property_origin">;

export interface Property {
  id: string;
  title: string;
  description: string | null;
  type: string;
  purpose: PropertyPurpose;
  price: number;
  neighborhood: string;
  city: string;
  state: string;
  address: string | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  status: PropertyStatus;
  origin: PropertyOrigin;
  origin_id: string | null;
  url_original: string | null;
  featured: boolean | null;
  created_at: string;
  updated_at: string;
  photos?: { url: string; sort_order: number | null }[];
  leads_count?: number;
}

interface CreatePropertyInput {
  title: string;
  description?: string | null;
  type: string;
  purpose: PropertyPurpose;
  price: number;
  neighborhood: string;
  city: string;
  state?: string;
  address?: string | null;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  status?: PropertyStatus;
  featured?: boolean;
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select(`
          *,
          photos:property_photos(url, sort_order)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get leads count for each property
      const { data: leadsCounts } = await supabase
        .from("leads")
        .select("property_id")
        .not("property_id", "is", null);

      const countsMap = (leadsCounts || []).reduce((acc: Record<string, number>, lead) => {
        if (lead.property_id) {
          acc[lead.property_id] = (acc[lead.property_id] || 0) + 1;
        }
        return acc;
      }, {});

      const propertiesWithCounts = (data || []).map((p) => ({
        ...p,
        leads_count: countsMap[p.id] || 0,
      }));

      setProperties(propertiesWithCounts as Property[]);
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast({
        title: "Erro ao carregar imóveis",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createProperty = async (property: CreatePropertyInput) => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .insert({
          ...property,
          status: property.status || "active",
          origin: "manual",
          state: property.state || "RJ",
        })
        .select()
        .single();

      if (error) throw error;

      setProperties((prev) => [{ ...data, photos: [], leads_count: 0 } as Property, ...prev]);

      toast({
        title: "Imóvel criado",
        description: "O imóvel foi adicionado com sucesso",
      });

      return data;
    } catch (error) {
      console.error("Error creating property:", error);
      toast({
        title: "Erro ao criar imóvel",
        description: "Tente novamente",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateProperty = async (id: string, updates: Partial<CreatePropertyInput>) => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      setProperties((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data } : p))
      );

      toast({
        title: "Imóvel atualizado",
        description: "As alterações foram salvas",
      });

      return data;
    } catch (error) {
      console.error("Error updating property:", error);
      toast({
        title: "Erro ao atualizar imóvel",
        description: "Tente novamente",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteProperty = async (id: string) => {
    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setProperties((prev) => prev.filter((p) => p.id !== id));

      toast({
        title: "Imóvel excluído",
        description: "O imóvel foi removido",
      });
    } catch (error) {
      console.error("Error deleting property:", error);
      toast({
        title: "Erro ao excluir imóvel",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const publishToPortal = async (propertyId: string, platform: "olx" | "imovelweb") => {
    try {
      const { data, error } = await supabase.functions.invoke("publish-property", {
        body: { propertyId, platform },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: data.simulated ? "Publicação pendente" : "Publicado com sucesso",
          description: data.message,
        });

        // Refresh to get updated origin info
        await fetchProperties();
      } else {
        throw new Error(data.error || "Falha na publicação");
      }

      return data;
    } catch (error: any) {
      console.error("Publish error:", error);
      toast({
        title: "Erro ao publicar",
        description: error.message || "Falha ao publicar no portal",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  return {
    properties,
    isLoading,
    createProperty,
    updateProperty,
    deleteProperty,
    publishToPortal,
    refetch: fetchProperties,
  };
}
