import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Syncing group names...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!evolutionUrl || !evolutionKey || !instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "Evolution API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all group conversations without names
    const { data: groupConvs, error: fetchError } = await supabase
      .from("conversations")
      .select("id, external_thread_id, group_name")
      .eq("is_group", true)
      .is("group_name", null);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${groupConvs?.length || 0} groups without names in database`);

    if (!groupConvs || groupConvs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: "No groups to update" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all groups from Evolution API
    console.log("Fetching all groups from Evolution API...");
    const response = await fetch(
      `${evolutionUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch groups: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `Evolution API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allGroups = await response.json();
    console.log(`Fetched ${allGroups?.length || 0} groups from Evolution API`);

    // Create a map for quick lookup
    const groupMap = new Map<string, string>();
    for (const group of allGroups || []) {
      const jid = group.id || group.jid || group.remoteJid;
      const name = group.subject || group.name || group.pushName;
      if (jid && name) {
        groupMap.set(jid, name);
        console.log(`Group mapping: ${jid} -> ${name}`);
      }
    }

    let updatedCount = 0;

    for (const conv of groupConvs) {
      if (!conv.external_thread_id) continue;

      const groupName = groupMap.get(conv.external_thread_id);
      
      if (groupName) {
        await supabase
          .from("conversations")
          .update({ group_name: groupName })
          .eq("id", conv.id);

        console.log(`Updated group ${conv.id} with name: ${groupName}`);
        updatedCount++;
      } else {
        console.log(`No name found for group: ${conv.external_thread_id}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updatedCount,
        total: groupConvs.length,
        apiGroupsCount: allGroups?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing group names:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
