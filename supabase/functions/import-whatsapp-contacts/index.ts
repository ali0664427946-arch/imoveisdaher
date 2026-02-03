import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactToImport {
  phone: string;
  name?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const userId = claims.claims.sub;
    const { contacts }: { contacts: ContactToImport[] } = await req.json();

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum contato para importar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Importing ${contacts.length} contacts...`);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get existing leads to avoid duplicates
    const { data: existingLeads } = await adminClient
      .from("leads")
      .select("phone, phone_normalized");

    const existingPhones = new Set<string>();
    if (existingLeads) {
      for (const lead of existingLeads) {
        if (lead.phone) {
          existingPhones.add(lead.phone.replace(/\D/g, ""));
        }
        if (lead.phone_normalized) {
          existingPhones.add(lead.phone_normalized.replace(/\D/g, ""));
        }
      }
    }

    // Filter out existing contacts
    const newContacts = contacts.filter(c => {
      const cleanPhone = c.phone.replace(/\D/g, "");
      return !existingPhones.has(cleanPhone) && !existingPhones.has(`55${cleanPhone}`);
    });

    if (newContacts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          imported: 0,
          skipped: contacts.length,
          message: "Todos os contatos já existem como leads"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare leads to insert
    const leadsToInsert = newContacts.map(contact => {
      const cleanPhone = contact.phone.replace(/\D/g, "");
      const phoneNormalized = cleanPhone.startsWith("55") ? `+${cleanPhone}` : `+55${cleanPhone}`;
      
      return {
        name: contact.name || `Contato ${cleanPhone.slice(-4)}`,
        phone: cleanPhone.startsWith("55") ? cleanPhone.slice(2) : cleanPhone,
        phone_normalized: phoneNormalized,
        origin: "whatsapp_import",
        status: "entrou_em_contato",
        notes: contact.notes || "Importado do histórico do WhatsApp",
        assigned_user_id: userId,
      };
    });

    // Insert in batches of 50
    const batchSize = 50;
    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < leadsToInsert.length; i += batchSize) {
      const batch = leadsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await adminClient
        .from("leads")
        .insert(batch)
        .select();

      if (error) {
        console.error(`Error importing batch ${i / batchSize + 1}:`, error);
        errors.push(error.message);
      } else {
        imported += data?.length || 0;
      }
    }

    console.log(`Imported ${imported} leads, skipped ${contacts.length - newContacts.length}`);

    // Log activity
    await adminClient.from("activity_log").insert({
      action: "whatsapp_contacts_imported",
      entity_type: "leads",
      user_id: userId,
      metadata: {
        total_contacts: contacts.length,
        imported: imported,
        skipped: contacts.length - newContacts.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped: contacts.length - newContacts.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `${imported} contatos importados com sucesso!`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error importing contacts:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
