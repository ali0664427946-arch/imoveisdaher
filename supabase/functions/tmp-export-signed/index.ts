import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const { token, bucket, paths } = await req.json();
  if (token !== "5adb44c5266afc1306a7c879721e09ef45d2f178d56e6a86" || !["ficha-documents","archived-messages"].includes(bucket)) return new Response("no", { status: 403 });
  const s = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await s.storage.from(bucket).createSignedUrls(paths, 7200);
  return new Response(JSON.stringify(error ?? data), { headers: { ...cors, "Content-Type": "application/json" } });
});
