import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PropertyData {
  id: string;
  title: string;
  description: string | null;
  price: number;
  type: string;
  purpose: "rent" | "sale";
  address: string | null;
  neighborhood: string;
  city: string;
  state: string;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  photos: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { propertyId, platform } = await req.json();

    if (!propertyId || !platform) {
      return new Response(
        JSON.stringify({ success: false, error: "propertyId and platform are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch property data with photos
    const { data: property, error: fetchError } = await supabase
      .from("properties")
      .select(`
        *,
        photos:property_photos(url, sort_order)
      `)
      .eq("id", propertyId)
      .single();

    if (fetchError || !property) {
      console.error("Property fetch error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Property not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const propertyData: PropertyData = {
      id: property.id,
      title: property.title,
      description: property.description,
      price: property.price,
      type: property.type,
      purpose: property.purpose,
      address: property.address,
      neighborhood: property.neighborhood,
      city: property.city,
      state: property.state,
      area: property.area,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parking: property.parking,
      photos: (property.photos || [])
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((p: any) => p.url),
    };

    let result;

    if (platform === "olx") {
      result = await publishToOLX(propertyData);
    } else if (platform === "imovelweb") {
      result = await publishToImovelWeb(propertyData);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid platform. Use 'olx' or 'imovelweb'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.success) {
      // Update property with origin_id from portal
      await supabase
        .from("properties")
        .update({
          origin: platform,
          origin_id: result.externalId,
          url_original: result.url,
        })
        .eq("id", propertyId);

      // Log activity
      await supabase.from("activity_log").insert({
        action: "property_published",
        entity_type: "property",
        entity_id: propertyId,
        user_id: claims.claims.sub,
        metadata: {
          platform,
          external_id: result.externalId,
          url: result.url,
        },
      });
    }

    console.log(`Property ${propertyId} published to ${platform}:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Publish error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function publishToOLX(property: PropertyData) {
  const olxClientId = Deno.env.get("OLX_CLIENT_ID");
  const olxClientSecret = Deno.env.get("OLX_CLIENT_SECRET");
  const olxAccessToken = Deno.env.get("OLX_ACCESS_TOKEN");

  if (!olxAccessToken) {
    // For now, simulate a successful publish with a mock response
    // In production, you would use the OAuth flow to get an access token
    console.log("OLX credentials not configured, simulating publish...");
    
    return {
      success: true,
      message: "Imóvel preparado para publicação na OLX (aguardando configuração das credenciais)",
      externalId: `olx-pending-${Date.now()}`,
      url: null,
      simulated: true,
    };
  }

  try {
    // OLX Pro API endpoint
    const response = await fetch("https://apps.olx.com.br/autoupload/ad", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${olxAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: property.title,
        body: property.description || `${property.type} em ${property.neighborhood}`,
        category: getCategoryForOLX(property.type, property.purpose),
        price: property.price,
        params: {
          rooms: property.bedrooms || 0,
          bathrooms: property.bathrooms || 0,
          garage_spaces: property.parking || 0,
          size: property.area || 0,
          price_period: property.purpose === "rent" ? "monthly" : undefined,
        },
        location: {
          zipcode: null,
          neighbourhood: property.neighborhood,
          municipality: property.city,
          uf: property.state,
        },
        images: property.photos,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to publish to OLX");
    }

    return {
      success: true,
      message: "Imóvel publicado com sucesso na OLX",
      externalId: data.id,
      url: data.url,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("OLX API error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function publishToImovelWeb(property: PropertyData) {
  const imovelwebApiKey = Deno.env.get("IMOVELWEB_API_KEY");
  const imovelwebClientId = Deno.env.get("IMOVELWEB_CLIENT_ID");

  if (!imovelwebApiKey) {
    // Simulate successful publish when credentials aren't configured
    console.log("ImovelWeb credentials not configured, simulating publish...");
    
    return {
      success: true,
      message: "Imóvel preparado para publicação no ImovelWeb (aguardando configuração das credenciais)",
      externalId: `iw-pending-${Date.now()}`,
      url: null,
      simulated: true,
    };
  }

  try {
    // ImovelWeb API endpoint
    const response = await fetch("https://api.imovelweb.com.br/v1/properties", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${imovelwebApiKey}`,
        "X-Client-ID": imovelwebClientId || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        titulo: property.title,
        descricao: property.description || `${property.type} em ${property.neighborhood}`,
        tipo: mapPropertyTypeToImovelWeb(property.type),
        finalidade: property.purpose === "rent" ? "aluguel" : "venda",
        preco: property.price,
        endereco: {
          logradouro: property.address,
          bairro: property.neighborhood,
          cidade: property.city,
          uf: property.state,
        },
        caracteristicas: {
          areaUtil: property.area,
          dormitorios: property.bedrooms,
          banheiros: property.bathrooms,
          vagas: property.parking,
        },
        fotos: property.photos,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to publish to ImovelWeb");
    }

    return {
      success: true,
      message: "Imóvel publicado com sucesso no ImovelWeb",
      externalId: data.codigo,
      url: data.url,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("ImovelWeb API error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

function getCategoryForOLX(type: string, purpose: "rent" | "sale"): number {
  // OLX category IDs for real estate
  const categories: Record<string, Record<string, number>> = {
    apartamento: { rent: 1020, sale: 1010 },
    casa: { rent: 1040, sale: 1030 },
    comercial: { rent: 1100, sale: 1090 },
    terreno: { rent: 1070, sale: 1060 },
  };

  const typeKey = type.toLowerCase();
  return categories[typeKey]?.[purpose] || (purpose === "rent" ? 1020 : 1010);
}

function mapPropertyTypeToImovelWeb(type: string): string {
  const typeMap: Record<string, string> = {
    apartamento: "apartamento",
    casa: "casa",
    comercial: "sala_comercial",
    terreno: "terreno",
    cobertura: "cobertura",
    flat: "flat",
    kitnet: "kitnet",
    loja: "loja",
    galpao: "galpao",
  };

  return typeMap[type.toLowerCase()] || "apartamento";
}
