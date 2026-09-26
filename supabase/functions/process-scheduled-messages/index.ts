import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Anti-Ban Configuration ───
const ANTI_BAN = {
  sendWindowStart: 7,   // 07:00
  sendWindowEnd: 20,    // 20:00
  activeDays: [1, 2, 3, 4, 5, 6], // Mon-Sat (0=Sun)
  minIntervalMs: 60_000,  // 60s between messages
  maxIntervalMs: 120_000, // 120s between messages
  typingMinMs: 2_000,     // 2s simulated typing
  typingMaxMs: 8_000,     // 8s simulated typing
  messagesBeforeRest: 10,
  restMinMs: 7 * 60_000,  // 7 min rest
  restMaxMs: 10 * 60_000, // 10 min rest
  // ── Regras conservadoras da Área do Corretor ──
  brokerMinIntervalMs: 2 * 60_000,   // 2 min
  brokerMaxIntervalMs: 4 * 60_000,   // 4 min
  brokerDailyCap: 20,                // Máx 20 msgs / 24h por corretor
};

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getEvolutionErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "Falha no envio pela Evolution API";

  const payload = data as Record<string, unknown>;
  const response = payload.response && typeof payload.response === "object"
    ? payload.response as Record<string, unknown>
    : undefined;
  const candidate = response?.message ?? payload.message ?? payload.error;

  if (Array.isArray(candidate)) return candidate.map(String).join("; ");
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  return "Falha no envio pela Evolution API";
}

function isTransientConnectionError(message: string, status: number): boolean {
  const normalized = message.toLowerCase();
  return status >= 500 || [
    "connection closed",
    "connection reset",
    "socket hang up",
    "timeout",
    "timed out",
    "temporarily unavailable",
    "service unavailable",
  ].some((fragment) => normalized.includes(fragment));
}

async function sendWithRetry(
  apiUrl: string,
  evolutionKey: string,
  reqBody: Record<string, unknown>,
): Promise<{ response: Response; data: any; errorMessage: string; attempts: number }> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: evolutionKey },
    body: JSON.stringify(reqBody),
  });
  const responseText = await response.text();
  let data: any;
  try { data = JSON.parse(responseText); } catch { data = { message: responseText }; }
  console.log(`Send status=${response.status} body=${responseText.substring(0, 200)}`);
  return { response, data, errorMessage: getEvolutionErrorMessage(data), attempts: 1 };
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
      console.log("Outside send window (07:00-20:00 Mon-Sat Brasília). Skipping.");
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "outside_send_window" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Evolution API credentials from DB (with env var fallback)
    let evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "").trim();
    let evolutionKey = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();
    let instanceName = (Deno.env.get("EVOLUTION_INSTANCE_NAME") || "").trim();
    let integrationType = "qrcode";

    try {
      const { data: dbConfig } = await supabase
        .from("integrations_settings")
        .select("value")
        .eq("key", "evolution_api")
        .maybeSingle();
      if (dbConfig?.value) {
        const cfg = dbConfig.value as { base_url: string; api_key: string; instance_name: string; integration_type?: string };
        if (cfg.base_url) evolutionUrl = cfg.base_url.replace(/\/+$/, "").trim();
        if (cfg.api_key) evolutionKey = cfg.api_key.trim();
        if (cfg.instance_name) instanceName = cfg.instance_name.trim();
        if (cfg.integration_type) integrationType = cfg.integration_type;
      }
    } catch (e) { console.error("Failed to load DB config:", e); }
    const isEvogo = integrationType === "evogo";

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
      .limit(1000); // A paused older message must not hide newer scheduled messages.

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eligibleMessages = (pendingMessages || []).filter((message) => {
      const metadata = (message.metadata || {}) as Record<string, unknown>;
      const retryAfter = typeof metadata.retry_after === "string"
        ? Date.parse(metadata.retry_after)
        : 0;
      return !retryAfter || retryAfter <= Date.now();
    });

    if (eligibleMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, expired: expiredMessages?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;

    // Enforce spacing across separate cron invocations, not by sleeping inside a worker.
    const { data: lastSend } = await supabase
      .from("whatsapp_send_log")
      .select("created_at")
      .eq("function_name", "process-scheduled-messages")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIsBroker = (eligibleMessages[0].metadata as Record<string, unknown> | null)?.source === "corretor";
    const minSpacing = nextIsBroker ? ANTI_BAN.brokerMinIntervalMs : ANTI_BAN.minIntervalMs;
    if (lastSend && Date.now() - Date.parse(lastSend.created_at) < minSpacing) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "anti_ban_spacing" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process one message per cron execution. This prevents overlapping workers and
    // lets the one-minute scheduler provide the spacing between sends.
    for (let i = 0; i < Math.min(eligibleMessages.length, 1); i++) {
      const msg = eligibleMessages[i];
      const meta = (msg.metadata || {}) as Record<string, unknown>;
      const isBroker = meta.source === "corretor";

      // ─── Re-check send window before each message ───
      if (!isSendWindowOpen()) {
        console.log("Send window closed during processing. Stopping.");
        break;
      }

      // ─── Broker daily cap (20 sent in last 24h) ───
      if (isBroker && msg.created_by) {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: sentInWindow } = await supabase
          .from("scheduled_messages")
          .select("id", { count: "exact", head: true })
          .eq("created_by", msg.created_by)
          .eq("status", "sent")
          .gte("sent_at", since24h);
        if ((sentInWindow ?? 0) >= ANTI_BAN.brokerDailyCap) {
          console.log(`Broker ${msg.created_by} reached daily cap (${ANTI_BAN.brokerDailyCap}). Skipping.`);
          await supabase.from("scheduled_messages").update({
            status: "failed",
            error_message: `Limite diário do corretor atingido (${ANTI_BAN.brokerDailyCap}/24h). Reagende mais tarde.`,
          }).eq("id", msg.id);
          continue;
        }
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

      const apiUrl = isEvogo
        ? `${evolutionUrl}/send/text`
        : `${evolutionUrl}/message/sendText/${instanceName}`;
      const reqBody = isEvogo
        ? { instance: instanceName, number: phone, text: msg.message }
        : { number: phone, text: msg.message };
      console.log(`Sending to ${apiUrl} phone=${phone}`);
      const { response: res, errorMessage: evolutionError, attempts } = await sendWithRetry(
        apiUrl,
        evolutionKey,
        reqBody,
      );
      const transientFailure = !res.ok && isTransientConnectionError(evolutionError, res.status);

      // Calculate actual delay for logging
      const totalDelayMs = typingDelayMs;

      // Log to centralized send log
      await supabase.from("whatsapp_send_log").insert({
        function_name: "process-scheduled-messages",
        phone,
        status: res.ok ? "success" : "failed",
        delay_ms: totalDelayMs,
        error_message: res.ok ? null : transientFailure
          ? `${evolutionError} (tentativa agendada; mantida na fila)`
          : evolutionError,
        message_preview: msg.message.substring(0, 80),
        metadata: { attempts, transient: transientFailure },
      }).then(({ error: logErr }) => { if (logErr) console.error("Send log error:", logErr); });

      if (res.ok) {
        await supabase.from("scheduled_messages").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
          metadata: { ...meta, retry_after: null, last_attempt_at: new Date().toISOString() },
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
      } else if (transientFailure) {
        const retryAfter = new Date(Date.now() + 30 * 60_000).toISOString();
        await supabase.from("scheduled_messages").update({
          error_message: `${evolutionError} — falha temporária; nova tentativa automática pendente`,
          metadata: { ...meta, retry_after: retryAfter, last_attempt_at: new Date().toISOString() },
        }).eq("id", msg.id);
        console.warn(`Message ${msg.id} kept pending after ${attempts} temporary connection failures. Retry after ${retryAfter}.`);
      } else {
        await supabase.from("scheduled_messages").update({
          status: "failed",
          error_message: evolutionError,
        }).eq("id", msg.id);
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
