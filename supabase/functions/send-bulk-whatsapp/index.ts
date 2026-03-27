// Bulk WhatsApp Send - processes CSV-based mass messaging with anti-ban
import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BulkRecipient {
  phone: string;
  name?: string;
  [key: string]: string | undefined;
}

interface BulkSendRequest {
  recipients: BulkRecipient[];
  messageTemplate: string;
  campaignName?: string;
}

function replaceVariables(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recipients, messageTemplate, campaignName }: BulkSendRequest = await req.json();

    if (!recipients?.length || !messageTemplate) {
      return new Response(
        JSON.stringify({ error: "recipients and messageTemplate are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recipients.length > 500) {
      return new Response(
        JSON.stringify({ error: "Maximum 500 recipients per batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Schedule each message with staggered times (respecting anti-ban)
    const now = new Date();
    const scheduledMessages = [];
    let currentDelay = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const personalizedMessage = replaceVariables(messageTemplate, recipient);

      // Calculate delay: 60-120s between messages, 7-10min rest every 10 messages
      if (i > 0 && i % 10 === 0) {
        // Rest period: 7-10 minutes
        currentDelay += (7 + Math.random() * 3) * 60 * 1000;
      } else if (i > 0) {
        // Normal interval: 60-120 seconds
        currentDelay += (60 + Math.random() * 60) * 1000;
      }

      const scheduledAt = new Date(now.getTime() + currentDelay);

      scheduledMessages.push({
        phone: recipient.phone.replace(/\D/g, ""),
        message: personalizedMessage,
        scheduled_at: scheduledAt.toISOString(),
        created_by: user.id,
        status: "pending",
        metadata: {
          campaign: campaignName || `Envio em massa ${now.toISOString()}`,
          recipient_name: recipient.name,
          bulk_batch: true,
          batch_index: i,
          batch_total: recipients.length,
        },
      });
    }

    // Insert all scheduled messages
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inserted, error: insertError } = await adminClient
      .from("scheduled_messages")
      .insert(scheduledMessages)
      .select("id");

    if (insertError) {
      console.error("Error inserting bulk messages:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to schedule messages", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log activity
    await adminClient.from("activity_log").insert({
      action: "bulk_whatsapp_scheduled",
      entity_type: "campaign",
      user_id: user.id,
      metadata: {
        campaign_name: campaignName,
        total_recipients: recipients.length,
        total_scheduled: inserted?.length || 0,
        estimated_duration_min: Math.round(currentDelay / 60000),
      },
    });

    const estimatedEndTime = new Date(now.getTime() + currentDelay);

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: inserted?.length || 0,
        total: recipients.length,
        estimatedEndTime: estimatedEndTime.toISOString(),
        estimatedDurationMin: Math.round(currentDelay / 60000),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bulk send error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
