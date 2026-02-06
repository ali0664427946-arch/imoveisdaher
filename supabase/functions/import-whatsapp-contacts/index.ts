import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ContactToImport {
  phone: string;
  name?: string;
  notes?: string;
  lastMessageAt?: string;
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

    // Get existing contacts to avoid duplicates
    const { data: existingContacts } = await adminClient
      .from("contacts")
      .select("phone, phone_normalized");

    const existingPhones = new Set<string>();
    if (existingContacts) {
      for (const contact of existingContacts) {
        if (contact.phone) {
          existingPhones.add(contact.phone.replace(/\D/g, ""));
        }
        if (contact.phone_normalized) {
          existingPhones.add(contact.phone_normalized.replace(/\D/g, ""));
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
          message: "Todos os contatos já existem"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare contacts to insert
    const contactsToInsert = newContacts.map(contact => {
      const cleanPhone = contact.phone.replace(/\D/g, "");
      const phoneNormalized = cleanPhone.startsWith("55") ? `+${cleanPhone}` : `+55${cleanPhone}`;
      
      return {
        name: contact.name || `Contato ${cleanPhone.slice(-4)}`,
        phone: cleanPhone.startsWith("55") ? cleanPhone.slice(2) : cleanPhone,
        phone_normalized: phoneNormalized,
        origin: "whatsapp_import",
        last_contact_at: contact.lastMessageAt || null,
        notes: contact.notes || "Importado do histórico do WhatsApp",
        created_by: userId,
        tags: [],
      };
    });

    // Insert in batches of 50
    const batchSize = 50;
    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
      const batch = contactsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await adminClient
        .from("contacts")
        .insert(batch)
        .select();

      if (error) {
        console.error(`Error importing batch ${i / batchSize + 1}:`, error);
        errors.push(error.message);
      } else {
        imported += data?.length || 0;
      }
    }

    console.log(`Imported ${imported} contacts, skipped ${contacts.length - newContacts.length}`);

    // Log activity
    await adminClient.from("activity_log").insert({
      action: "whatsapp_contacts_imported",
      entity_type: "contacts",
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
