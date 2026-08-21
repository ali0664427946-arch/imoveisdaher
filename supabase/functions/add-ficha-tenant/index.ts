import { createClient } from "npm:@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const str = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const fichaId = str(body?.fichaId, 64);
    const t = body?.tenant ?? {};

    const fullName = str(t.fullName ?? t.full_name, 200);
    const cpf = str(t.cpf, 20);

    if (!/^[0-9a-f-]{36}$/i.test(fichaId)) {
      return new Response(
        JSON.stringify({ success: false, error: "fichaId inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!fullName || !cpf) {
      return new Response(
        JSON.stringify({ success: false, error: "Nome completo e CPF são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ficha, error: fetchError } = await supabase
      .from("fichas")
      .select("id, form_data")
      .eq("id", fichaId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!ficha) {
      return new Response(
        JSON.stringify({ success: false, error: "Ficha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fd = (ficha.form_data ?? {}) as Record<string, unknown>;
    const existing = Array.isArray(fd.additional_tenants)
      ? (fd.additional_tenants as unknown[])
      : Array.isArray(fd.tenants)
        ? (fd.tenants as unknown[])
        : [];

    if (existing.length >= 2) {
      return new Response(
        JSON.stringify({ success: false, error: "Limite de 3 participantes na ficha atingido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Stored in snake_case — the format read by the ficha views
    const newTenant = {
      role: t.role === "fiador" ? "fiador" : "locatario",
      full_name: fullName,
      cpf,
      rg: str(t.rg, 40),
      birth_date: str(t.birthDate ?? t.birth_date, 20) || null,
      marital_status: str(t.maritalStatus ?? t.marital_status, 40),
      phone: str(t.phone, 30),
      email: str(t.email, 200),
      occupation: str(t.occupation, 120),
      employment_type: str(t.employmentType ?? t.employment_type, 40),
      company: str(t.company, 200),
      income: str(t.income, 40),
      added_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("fichas")
      .update({
        form_data: { ...fd, additional_tenants: [...existing, newTenant] },
      })
      .eq("id", fichaId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, tenant: newTenant }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("add-ficha-tenant error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
