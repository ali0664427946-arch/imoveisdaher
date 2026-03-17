import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Anti-Ban Configuration ───
const ANTI_BAN = {
  sendWindowStart: 9,   // 09:00
  sendWindowEnd: 20,    // 20:00
  activeDays: [1, 2, 3, 4, 5], // Mon-Fri (0=Sun)
  minIntervalMs: 60_000,  // 60s between messages
  maxIntervalMs: 120_000, // 120s between messages
  typingMinMs: 2_000,     // 2s simulated typing
  typingMaxMs: 8_000,     // 8s simulated typing
  messagesBeforeRest: 10,
  restMinMs: 7 * 60_000,  // 7 min rest
  restMaxMs: 10 * 60_000, // 10 min rest
};

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isSendWindowOpen(): boolean {
  // Get Brasília time (UTC-3)
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const brasiliaTime = new Date(utcMs + brasiliaOffset * 60_000);

  const hour = brasiliaTime.getHours();
  const day = brasiliaTime.getDay();

  const inWindow = hour >= ANTI_BAN.sendWindowStart && hour < ANTI_BAN.sendWindowEnd;
  const activeDay = ANTI_BAN.activeDays.includes(day);

  return inWindow && activeDay;
}

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

    // ─── Check send window ───
    if (!isSendWindowOpen()) {
      console.log("Outside send window (09:00-20:00 Mon-Fri Brasília). Skipping.");
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "outside_send_window" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "").trim();
    const evolutionKey = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();
    const instanceName = (Deno.env.get("EVOLUTION_INSTANCE_NAME") || "").trim();

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - maxAgeMs).toISOString();

    // Expire old pending messages
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

    // Fetch pending messages ready to send
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .gte("scheduled_at", cutoffTime)
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(ANTI_BAN.messagesBeforeRest); // Only fetch up to one burst batch

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

    for (let i = 0; i < pendingMessages.length; i++) {
      const msg = pendingMessages[i];

      // ─── Re-check send window before each message ───
      if (!isSendWindowOpen()) {
        console.log("Send window closed during processing. Stopping.");
        break;
      }

      // ─── Simulated typing delay (2-8s) ───
      const typingDelayMs = randomBetween(ANTI_BAN.typingMinMs, ANTI_BAN.typingMaxMs);
      console.log(`Simulated typing: ${typingDelayMs}ms`);
      await new Promise((r) => setTimeout(r, typingDelayMs));

      // Format phone
      let phone = msg.phone;
      if (!phone.includes("@")) {
        phone = phone.replace(/\D/g, "");
        if (!phone.startsWith("55")) phone = "55" + phone;
      }

      const apiUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
      console.log(`Sending to ${apiUrl} phone=${phone}`);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: phone, text: msg.message }),
      });

      const responseText = await res.text();
      console.log(`Response status=${res.status} body=${responseText.substring(0, 200)}`);
      let data: any;
      try { data = JSON.parse(responseText); } catch { data = { message: responseText }; }

      // Calculate actual delay for logging
      const totalDelayMs = typingDelayMs;

      // Log to centralized send log
      await supabase.from("whatsapp_send_log").insert({
        function_name: "process-scheduled-messages",
        phone,
        status: res.ok ? "success" : "failed",
        delay_ms: totalDelayMs,
        error_message: res.ok ? null : (data.message || "API error"),
        message_preview: msg.message.substring(0, 80),
      }).then(({ error: logErr }) => { if (logErr) console.error("Send log error:", logErr); });

      if (res.ok) {
        await supabase.from("scheduled_messages").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", msg.id);

        // Find or create conversation for this message
        let convId = null;
        let leadId = msg.lead_id;

        if (!leadId) {
          const normalizedPhone = phone.replace(/\D/g, "");
          const phoneVariants = [
            normalizedPhone,
            normalizedPhone.startsWith("55") ? normalizedPhone.slice(2) : `55${normalizedPhone}`,
          ];

          const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .or(phoneVariants.map(p => `phone.eq.${p},phone_normalized.eq.+${p}`).join(","))
            .limit(1)
            .maybeSingle();

          if (existingLead) {
            leadId = existingLead.id;
          } else {
            const { data: newLead } = await supabase
              .from("leads")
              .insert({
                name: `WhatsApp ${normalizedPhone}`,
                phone: normalizedPhone.startsWith("55") ? normalizedPhone.slice(2) : normalizedPhone,
                phone_normalized: `+${normalizedPhone.startsWith("55") ? normalizedPhone : "55" + normalizedPhone}`,
                origin: "agendamento",
                status: "entrou_em_contato",
              })
              .select("id")
              .single();
            leadId = newLead?.id;
          }
        }

        if (leadId) {
          const { data: whatsappConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("lead_id", leadId)
            .eq("channel", "whatsapp")
            .maybeSingle();
          convId = whatsappConv?.id;

          if (!convId) {
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({
                lead_id: leadId,
                channel: "whatsapp",
                last_message_preview: msg.message.substring(0, 100),
                last_message_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            convId = newConv?.id;
          }
        } else if (msg.conversation_id) {
          convId = msg.conversation_id;
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

      // ─── Anti-ban interval between messages (60-120s) ───
      // Only wait if there are more messages to send
      if (i < pendingMessages.length - 1) {
        const intervalMs = randomBetween(ANTI_BAN.minIntervalMs, ANTI_BAN.maxIntervalMs);
        console.log(`Anti-ban interval: ${Math.round(intervalMs / 1000)}s`);
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }

    // If we sent a full batch, log that a rest period should follow
    if (sentCount >= ANTI_BAN.messagesBeforeRest) {
      console.log(`Sent ${sentCount} messages (full batch). Next invocation will be the rest period.`);
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, expired: expiredMessages?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
