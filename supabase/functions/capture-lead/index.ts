import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Normalize phone number to E.164 format
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, "");
  
  // Brazilian format: add country code if not present
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.length === 12 || digits.length === 13) {
    return `+${digits}`;
  }
  
  return digits.length > 0 ? `+${digits}` : null;
}

// Extract property code from message text (e.g., "CA0121A" from OLX/ZapImóveis)
function extractPropertyCodeFromMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  
  // Pattern for property codes like CA0121A, AP0234B, etc.
  const codeMatch = message.match(/Código do anúncio:\s*([A-Z]{2}\d{4}[A-Z]?)/i);
  if (codeMatch) return codeMatch[1].toUpperCase();
  
  // Alternative pattern for id-XXXXX in URLs
  const urlIdMatch = message.match(/id-(\d+)/);
  if (urlIdMatch) return urlIdMatch[1];
  
  return null;
}

// OLX contact/inquiry webhook format (from Grupo ZAP / OLX Pro)
interface OLXInquiry {
  ad_id?: string;
  contact_id?: string;
  name: string;
  phone?: string;
  ddd?: string;
  email?: string;
  message?: string;
  created_at?: string;
  // Grupo ZAP fields
  clientListingId?: string;  // Your property code (e.g., "LO0007", "CA0121A")
  originListingId?: string;  // OLX internal listing ID
  originLeadId?: string;     // OLX internal lead ID
  leadOrigin?: string;       // Source (e.g., "Grupo OLX", "Olx Validacao")
  timestamp?: string;
}

// ImovelWeb contact webhook format
interface ImovelWebInquiry {
  imovel_id: string;
  nome: string;
  telefone?: string;
  email?: string;
  mensagem?: string;
  data?: string;
}

// Generic inquiry format for website forms
interface WebsiteInquiry {
  property_id?: string;
  property_slug?: string;
  name: string;
  phone?: string;
  email?: string;
  message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const source = url.searchParams.get("source") || "website";
    const webhookSecret = req.headers.get("x-webhook-secret");

    // Validate webhook secret for external sources
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    if ((source === "olx" || source === "imovelweb") && expectedSecret && webhookSecret !== expectedSecret) {
      console.error("Invalid webhook secret for", source);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    console.log(`Received lead from ${source}:`, JSON.stringify(body).slice(0, 500));

    let lead: any = null;

    switch (source) {
      case "olx":
        lead = await processOLXInquiry(supabase, body);
        break;
      case "imovelweb":
        lead = await processImovelWebInquiry(supabase, body);
        break;
      case "website":
      default:
        lead = await processWebsiteInquiry(supabase, body);
        break;
    }

    if (!lead) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create lead" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create conversation for the lead (for inbox)
    const { data: conversation } = await supabase.from("conversations").insert({
      lead_id: lead.id,
      channel: source === "olx" ? "olx_chat" : source === "imovelweb" ? "internal" : "whatsapp",
      last_message_preview: lead.notes || `Novo lead via ${source}`,
      last_message_at: new Date().toISOString(),
      unread_count: 1,
    }).select().single();

    // Create the initial message from the lead
    if (conversation && lead.notes) {
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        content: lead.notes,
        direction: "inbound",
        message_type: "text",
        sent_status: "delivered",
        provider: source,
      });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "lead_captured",
      entity_type: "lead",
      entity_id: lead.id,
      metadata: {
        source,
        name: lead.name,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`Lead captured from ${source}:`, lead.id);

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Lead capture error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processOLXInquiry(supabase: any, data: OLXInquiry | OLXInquiry[]) {
  // Handle array or single inquiry
  const inquiries = Array.isArray(data) ? data : [data];
  let lastLead = null;

  for (const inquiry of inquiries) {
    // Find property by clientListingId (your property code like "LO0007", "CA0121A")
    // or by ad_id, or by extracting code from message
    let propertyId = null;
    
    // Priority: clientListingId > ad_id > extracted from message
    const propertyCode = inquiry.clientListingId || inquiry.ad_id || extractPropertyCodeFromMessage(inquiry.message);
    
    console.log(`OLX lead - clientListingId: ${inquiry.clientListingId}, ad_id: ${inquiry.ad_id}, extracted: ${extractPropertyCodeFromMessage(inquiry.message)}`);
    
    if (propertyCode) {
      // Try to find by origin_id first (exact match)
      let { data: property } = await supabase
        .from("properties")
        .select("id, origin_id, title")
        .eq("origin_id", propertyCode)
        .maybeSingle();
      
      // If not found, try searching in origin_id with partial match
      if (!property) {
        const { data: partialMatch } = await supabase
          .from("properties")
          .select("id, origin_id, title")
          .ilike("origin_id", `%${propertyCode}%`)
          .limit(1)
          .maybeSingle();
        
        property = partialMatch;
      }
      
      propertyId = property?.id || null;
      console.log(`Property lookup for code "${propertyCode}": found = ${!!property}, propertyId = ${propertyId}, title = ${property?.title || 'N/A'}`);
    }
    
    // Build phone from ddd + phone if available
    let phoneNumber = inquiry.phone;
    if (inquiry.ddd && inquiry.phone) {
      phoneNumber = `${inquiry.ddd}${inquiry.phone}`;
    }

    const phoneNormalized = normalizePhone(phoneNumber);

    // Check for existing lead with same phone
    if (phoneNormalized) {
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("phone_normalized", phoneNormalized)
        .maybeSingle();

      if (existingLead) {
        // Update existing lead with new property interest
        const { data: updated, error } = await supabase
          .from("leads")
          .update({
            property_id: propertyId || undefined,
            notes: inquiry.message ? `OLX: ${inquiry.message}` : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLead.id)
          .select()
          .single();

        if (!error) {
          lastLead = updated;
          continue;
        }
      }
    }

    // Create new lead
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        name: inquiry.name,
        phone: phoneNumber || null,
        phone_normalized: phoneNormalized,
        email: inquiry.email || null,
        origin: "olx",
        property_id: propertyId,
        notes: inquiry.message || null,
        status: "entrou_em_contato",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating OLX lead:", error);
      continue;
    }

    lastLead = lead;
  }

  return lastLead;
}

async function processImovelWebInquiry(supabase: any, data: ImovelWebInquiry | ImovelWebInquiry[]) {
  const inquiries = Array.isArray(data) ? data : [data];
  let lastLead = null;

  for (const inquiry of inquiries) {
    // Find property by origin_id
    let propertyId = null;
    if (inquiry.imovel_id) {
      const { data: property } = await supabase
        .from("properties")
        .select("id")
        .eq("origin", "imovelweb")
        .eq("origin_id", inquiry.imovel_id)
        .maybeSingle();
      
      propertyId = property?.id || null;
    }

    const phoneNormalized = normalizePhone(inquiry.telefone);

    // Check for existing lead
    if (phoneNormalized) {
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("phone_normalized", phoneNormalized)
        .maybeSingle();

      if (existingLead) {
        const { data: updated, error } = await supabase
          .from("leads")
          .update({
            property_id: propertyId || undefined,
            notes: inquiry.mensagem ? `ImovelWeb: ${inquiry.mensagem}` : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLead.id)
          .select()
          .single();

        if (!error) {
          lastLead = updated;
          continue;
        }
      }
    }

    // Create new lead
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        name: inquiry.nome,
        phone: inquiry.telefone || null,
        phone_normalized: phoneNormalized,
        email: inquiry.email || null,
        origin: "imovelweb",
        property_id: propertyId,
        notes: inquiry.mensagem || null,
        status: "entrou_em_contato",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating ImovelWeb lead:", error);
      continue;
    }

    lastLead = lead;
  }

  return lastLead;
}

async function processWebsiteInquiry(supabase: any, data: WebsiteInquiry) {
  let propertyId = data.property_id || null;

  // Find property by slug if ID not provided
  if (!propertyId && data.property_slug) {
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", data.property_slug)
      .maybeSingle();
    
    propertyId = property?.id || null;
  }

  const phoneNormalized = normalizePhone(data.phone);

  // Check for existing lead
  if (phoneNormalized) {
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("phone_normalized", phoneNormalized)
      .maybeSingle();

    if (existingLead) {
      const { data: updated, error } = await supabase
        .from("leads")
        .update({
          property_id: propertyId || undefined,
          notes: data.message ? `Site: ${data.message}` : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLead.id)
        .select()
        .single();

      if (!error) {
        return updated;
      }
    }
  }

  // Create new lead
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      name: data.name,
      phone: data.phone || null,
      phone_normalized: phoneNormalized,
      email: data.email || null,
      origin: "website",
      property_id: propertyId,
      notes: data.message || null,
      status: "entrou_em_contato",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating website lead:", error);
    return null;
  }

  return lead;
}
