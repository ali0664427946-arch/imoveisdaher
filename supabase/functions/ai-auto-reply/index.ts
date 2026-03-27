// AI Auto-Reply for WhatsApp - Daher Imóveis
import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um atendente virtual da Daher Imóveis, especialista em venda e locação de imóveis em Jacarepaguá e Rio de Janeiro.

Regras:
- Seja objetivo, profissional e cordial
- Responda em português do Brasil
- Use emojis com moderação (máx 2 por mensagem)
- Se o cliente perguntar sobre um imóvel específico, informe que um corretor entrará em contato
- Sempre conduza o cliente para atendimento humano quando necessário
- NÃO invente informações sobre imóveis, preços ou disponibilidade
- Se não souber a resposta, diga que vai verificar e retornar
- Mantenha respostas curtas (máx 3 parágrafos)
- Horário de atendimento humano: seg-sex 07:00 às 20:00

Informações da empresa:
- Nome: Daher Imóveis
- Especialidade: Venda e locação de imóveis
- Região: Jacarepaguá e Rio de Janeiro
- Atendimento via WhatsApp`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { message, phone, conversationId, senderName } = await req.json();

    if (!message || !conversationId) {
      return new Response(
        JSON.stringify({ error: "message and conversationId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if AI auto-reply is enabled
    const { data: aiSettings } = await supabase
      .from("integrations_settings")
      .select("value")
      .eq("key", "ai_auto_reply")
      .maybeSingle();

    const settings = aiSettings?.value as {
      enabled: boolean;
      system_prompt?: string;
      max_history?: number;
    } | null;

    if (!settings?.enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: "AI auto-reply is disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recent conversation history for context
    const maxHistory = settings.max_history || 10;
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("content, direction, created_at")
      .eq("conversation_id", conversationId)
      .eq("message_type", "text")
      .order("created_at", { ascending: false })
      .limit(maxHistory);

    // Build conversation context
    const conversationHistory = (recentMessages || [])
      .reverse()
      .filter((m) => m.content)
      .map((m) => ({
        role: m.direction === "inbound" ? "user" as const : "assistant" as const,
        content: m.content!,
      }));

    // Add the new incoming message
    conversationHistory.push({ role: "user", content: message });

    const systemPrompt = settings.system_prompt || SYSTEM_PROMPT;

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const replyContent = aiData.choices?.[0]?.message?.content;

    if (!replyContent) {
      console.error("No reply content from AI");
      return new Response(
        JSON.stringify({ error: "No reply generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send the reply via Evolution API
    let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    let evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    let instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    try {
      const { data: dbConfig } = await supabase
        .from("integrations_settings")
        .select("value")
        .eq("key", "evolution_api")
        .maybeSingle();
      if (dbConfig?.value) {
        const cfg = dbConfig.value as { base_url: string; api_key: string; instance_name: string };
        if (cfg.base_url) evolutionUrl = cfg.base_url;
        if (cfg.api_key) evolutionKey = cfg.api_key;
        if (cfg.instance_name) instanceName = cfg.instance_name;
      }
    } catch (_e) { /* use env vars */ }

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = evolutionUrl.replace(/\/+$/, "").trim();

    // Format phone for sending
    const cleanPhone = phone.replace(/\D/g, "");
    const sendPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Send via Evolution API
    const sendRes = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: sendPhone,
        text: replyContent,
      }),
    });

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      console.error("Evolution API send error:", sendData);
      return new Response(
        JSON.stringify({ error: "Failed to send reply", details: sendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save AI reply as outbound message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "outbound",
      content: replyContent,
      message_type: "text",
      provider: "evolution",
      sent_status: "sent",
      provider_payload: { ai_generated: true, model: "gemini-2.5-flash", evolution_response: sendData },
    });

    // Update conversation
    await supabase
      .from("conversations")
      .update({
        last_message_preview: replyContent.substring(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    // Log to send log
    await supabase.from("whatsapp_send_log").insert({
      function_name: "ai-auto-reply",
      phone: sendPhone,
      status: "success",
      delay_ms: 0,
      message_preview: replyContent.substring(0, 80),
      metadata: { ai_model: "gemini-2.5-flash", sender_name: senderName },
    });

    console.log(`AI auto-reply sent to ${sendPhone}: ${replyContent.substring(0, 50)}...`);

    return new Response(
      JSON.stringify({ success: true, reply: replyContent, messageId: sendData.key?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI auto-reply error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
