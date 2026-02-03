import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppChat {
  id: string;
  name?: string;
  phone?: string;
  lastMessageTime?: number;
  unreadCount?: number;
  isGroup?: boolean;
}

interface WhatsAppContact {
  id: string;
  pushName?: string;
  name?: string;
  phone: string;
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

    // Get Evolution API credentials
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "Evolution API não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching chats from Evolution API...");

    // Fetch all chats (conversations) from WhatsApp
    const chatsResponse = await fetch(`${evolutionUrl}/chat/findChats/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({}),
    });

    if (!chatsResponse.ok) {
      const errorData = await chatsResponse.json();
      console.error("Error fetching chats:", errorData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Erro ao buscar conversas do WhatsApp",
          details: errorData.message || JSON.stringify(errorData)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatsData = await chatsResponse.json();
    console.log(`Found ${Array.isArray(chatsData) ? chatsData.length : 0} chats`);

    // Process chats to extract contacts
    const contacts: WhatsAppContact[] = [];
    const chats = Array.isArray(chatsData) ? chatsData : [];

    for (const chat of chats) {
      // Skip group chats
      const chatId = chat.id || chat.remoteJid || "";
      if (chatId.includes("@g.us") || chatId.includes("status@broadcast")) {
        continue;
      }

      // Extract phone number from JID (format: 5521999999999@s.whatsapp.net)
      const phone = chatId.replace("@s.whatsapp.net", "").replace("@c.us", "");
      
      if (!phone || phone.length < 8) continue;

      // Get contact name
      const name = chat.name || chat.pushName || chat.contact?.pushName || chat.contact?.name || "";

      // Get last message timestamp
      let lastMessageAt: string | undefined;
      if (chat.lastMsgTimestamp) {
        const timestamp = typeof chat.lastMsgTimestamp === "number" 
          ? chat.lastMsgTimestamp 
          : parseInt(chat.lastMsgTimestamp);
        lastMessageAt = new Date(timestamp * 1000).toISOString();
      }

      contacts.push({
        id: chatId,
        pushName: chat.pushName,
        name: name,
        phone: phone,
        lastMessageAt,
      });
    }

    // Sort by last message time (most recent first)
    contacts.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    console.log(`Processed ${contacts.length} contacts (excluding groups)`);

    // Get existing contacts to mark which are already imported
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Mark contacts that are already imported
    const contactsWithStatus = contacts.map(contact => ({
      ...contact,
      isExistingContact: existingPhones.has(contact.phone) || existingPhones.has(`55${contact.phone}`),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        contacts: contactsWithStatus,
        total: contactsWithStatus.length,
        existingContacts: contactsWithStatus.filter(c => c.isExistingContact).length,
        newContacts: contactsWithStatus.filter(c => !c.isExistingContact).length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching WhatsApp contacts:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
