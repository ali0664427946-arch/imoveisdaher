import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cleanDescription(raw: string): string {
  if (!raw) return "";
  // Decode HTML entities
  let text = raw
    .replace(/\\&lt;br\\&gt;/g, "\n")
    .replace(/&lt;br&gt;/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\&amp;/g, "&")
    .replace(/&amp;/g, "&");
  
  // Remove boilerplate footer
  const cutPatterns = [
    "Não perca tempo e entre em contato",
    "Pensou em Imóvel? Venha ser Feliz",
    "Atenção: Possuímos rigorosa política",
  ];
  for (const pattern of cutPatterns) {
    const idx = text.indexOf(pattern);
    if (idx > 0) {
      text = text.substring(0, idx);
    }
  }
  
  // Clean up trailing whitespace/newlines and " -"
  text = text.replace(/[\s\n-]+$/, "").trim();
  // Remove double+ newlines
  text = text.replace(/\n{3,}/g, "\n\n");
  
  return text;
}

function mapType(tipo: string): string {
  const map: Record<string, string> = {
    "Apartamento": "apartamento",
    "Casa": "casa",
    "Casa de condomínio": "casa",
    "Lote/Terreno": "terreno",
    "Ponto comercial/Loja/Box": "comercial",
    "Sala/Conjunto": "sala",
  };
  return map[tipo] || tipo.toLowerCase();
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

    const { properties } = await req.json();
    
    if (!Array.isArray(properties) || properties.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No properties provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Importing ${properties.length} properties...`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const p of properties) {
      const hasRentPrice = p.valor_aluguel && p.valor_aluguel > 0;
      const hasSalePrice = p.valor_venda && p.valor_venda > 0;
      const purpose = hasRentPrice ? "rent" : "sale";
      const price = hasRentPrice ? p.valor_aluguel : p.valor_venda;
      const status = p.status_anuncio === "Inativo" ? "inactive" : "active";

      // Parse features from beneficios string
      const featuresObj: Record<string, boolean> = {};
      if (p.beneficios) {
        const items = String(p.beneficios).split(",").map((s: string) => s.trim()).filter(Boolean);
        for (const item of items) {
          featuresObj[item.toLowerCase()] = true;
        }
      }

      const propertyData = {
        origin: "import" as const,
        origin_id: p.codigo,
        title: p.titulo,
        description: cleanDescription(p.descricao || ""),
        price: price || 0,
        type: mapType(p.tipo || ""),
        address: p.endereco || null,
        neighborhood: p.bairro || "Centro",
        city: p.cidade || "Rio de Janeiro",
        state: "RJ",
        area: p.area_util || null,
        bedrooms: p.quartos || 0,
        bathrooms: p.banheiros || 0,
        parking: p.vagas || 0,
        purpose,
        status,
        features: Object.keys(featuresObj).length > 0 ? featuresObj : {},
      };

      // Check if property already exists (by origin_id across any origin)
      const { data: existing } = await supabase
        .from("properties")
        .select("id")
        .eq("origin_id", p.codigo)
        .maybeSingle();

      let error;
      if (existing) {
        // Update existing
        const { error: updateErr } = await supabase
          .from("properties")
          .update(propertyData)
          .eq("id", existing.id);
        error = updateErr;
        if (!error) {
          updated++;
          console.log(`↻ ${p.codigo} - updated`);
        }
      } else {
        // Insert new
        const { error: insertErr } = await supabase
          .from("properties")
          .insert(propertyData);
        error = insertErr;
        if (!error) {
          inserted++;
          console.log(`✓ ${p.codigo} - inserted`);
        }
      }

      if (error) {
        console.error(`Error ${p.codigo}:`, error.message);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, updated, errors, total: properties.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Import error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
