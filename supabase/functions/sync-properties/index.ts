import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface OLXProperty {
  id: string;
  title: string;
  description: string;
  price: number;
  type: string;
  address?: {
    street?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  images?: string[];
  url?: string;
}

interface ImovelWebProperty {
  codigo: string;
  titulo: string;
  descricao: string;
  preco: number;
  tipo: string;
  endereco?: {
    logradouro?: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  areaUtil?: number;
  dormitorios?: number;
  banheiros?: number;
  vagas?: number;
  fotos?: string[];
  link?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const source = url.searchParams.get("source") || "olx";
    const webhookSecret = req.headers.get("x-webhook-secret");

    // Validate webhook secret for security
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    console.log(`Received webhook from ${source}:`, JSON.stringify(body).slice(0, 500));

    let processedProperties: any[] = [];

    if (source === "olx") {
      processedProperties = await processOLXWebhook(supabase, body);
    } else if (source === "imovelweb") {
      processedProperties = await processImovelWebWebhook(supabase, body);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid source" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "property_sync",
      entity_type: "property",
      metadata: {
        source,
        count: processedProperties.length,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`Synced ${processedProperties.length} properties from ${source}`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: processedProperties.length,
        source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processOLXWebhook(supabase: any, data: any) {
  const properties: OLXProperty[] = Array.isArray(data) ? data : data.properties || [data];
  const processed: any[] = [];

  for (const prop of properties) {
    const propertyData = {
      origin: "olx" as const,
      origin_id: prop.id,
      title: prop.title,
      description: prop.description || null,
      price: prop.price,
      type: prop.type || "apartamento",
      address: prop.address?.street || null,
      neighborhood: prop.address?.neighborhood || "Centro",
      city: prop.address?.city || "Rio de Janeiro",
      state: prop.address?.state || "RJ",
      area: prop.area || null,
      bedrooms: prop.bedrooms || 0,
      bathrooms: prop.bathrooms || 0,
      parking: prop.parking || 0,
      url_original: prop.url || null,
      purpose: "rent" as const,
      status: "active" as const,
    };

    // Upsert property (insert or update if exists)
    const { data: upserted, error } = await supabase
      .from("properties")
      .upsert(propertyData, {
        onConflict: "origin,origin_id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error upserting OLX property:", error);
      continue;
    }

    // Sync photos if provided
    if (prop.images && prop.images.length > 0 && upserted) {
      await syncPropertyPhotos(supabase, upserted.id, prop.images);
    }

    processed.push(upserted);
  }

  return processed;
}

async function processImovelWebWebhook(supabase: any, data: any) {
  const properties: ImovelWebProperty[] = Array.isArray(data) ? data : data.imoveis || [data];
  const processed: any[] = [];

  for (const prop of properties) {
    const propertyData = {
      origin: "imovelweb" as const,
      origin_id: prop.codigo,
      title: prop.titulo,
      description: prop.descricao || null,
      price: prop.preco,
      type: prop.tipo || "apartamento",
      address: prop.endereco?.logradouro || null,
      neighborhood: prop.endereco?.bairro || "Centro",
      city: prop.endereco?.cidade || "Rio de Janeiro",
      state: prop.endereco?.uf || "RJ",
      area: prop.areaUtil || null,
      bedrooms: prop.dormitorios || 0,
      bathrooms: prop.banheiros || 0,
      parking: prop.vagas || 0,
      url_original: prop.link || null,
      purpose: "rent" as const,
      status: "active" as const,
    };

    // Upsert property
    const { data: upserted, error } = await supabase
      .from("properties")
      .upsert(propertyData, {
        onConflict: "origin,origin_id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error upserting ImovelWeb property:", error);
      continue;
    }

    // Sync photos if provided
    if (prop.fotos && prop.fotos.length > 0 && upserted) {
      await syncPropertyPhotos(supabase, upserted.id, prop.fotos);
    }

    processed.push(upserted);
  }

  return processed;
}

async function syncPropertyPhotos(supabase: any, propertyId: string, imageUrls: string[]) {
  // Remove existing photos
  await supabase
    .from("property_photos")
    .delete()
    .eq("property_id", propertyId);

  // Insert new photos
  const photos = imageUrls.map((url, index) => ({
    property_id: propertyId,
    url,
    sort_order: index,
  }));

  const { error } = await supabase.from("property_photos").insert(photos);
  if (error) {
    console.error("Error syncing photos:", error);
  }
}
