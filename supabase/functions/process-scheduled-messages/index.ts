import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Processing scheduled messages...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    // Only send messages scheduled within the last 7 days
    // Messages older than that are expired and should NOT be sent
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoffTime = new Date(now.getTime() - maxAgeMs).toISOString();

    // First, expire old pending messages that are too old to send
    const { data: expiredMessages } = await supabase
      .from("scheduled_messages")
      .update({
        status: "failed",
        error_message: "Expirada: mensagem não foi enviada dentro do prazo de 7 dias",
      })
      .eq("status", "pending")
      .lt("scheduled_at", cutoffTime)
      .select("id");

    if (expiredMessages && expiredMessages.length > 0) {
      console.log(`Expired ${expiredMessages.length} old scheduled messages`);
    }

    // Now fetch only recent pending messages within the valid time window
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .gte("scheduled_at", cutoffTime)
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, expired: expiredMessages?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;

    for (const msg of pendingMessages) {
      let phone = msg.phone.replace(/\D/g, "");
      if (!phone.startsWith("55")) phone = "55" + phone;

      const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: phone, text: msg.message }),
      });

      const data = await res.json();

      if (res.ok) {
        await supabase.from("scheduled_messages").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", msg.id);

        let convId = msg.conversation_id;
        if (!convId && msg.lead_id) {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("lead_id", msg.lead_id)
            .eq("channel", "whatsapp")
            .maybeSingle();
          convId = conv?.id;
        }

        if (convId) {
          await supabase.from("messages").insert({
            conversation_id: convId,
            direction: "outbound",
            content: msg.message,
            message_type: "text",
            provider: "evolution",
            sent_status: "sent",
          });

          await supabase.from("conversations").update({
            last_message_preview: msg.message.substring(0, 100),
            last_message_at: new Date().toISOString(),
          }).eq("id", convId);
        }

        sentCount++;
      } else {
        await supabase.from("scheduled_messages").update({
          status: "failed",
          error_message: data.message || "Failed",
        }).eq("id", msg.id);
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
