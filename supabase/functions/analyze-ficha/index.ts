import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FichaData {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  marital_status: string | null;
  occupation: string | null;
  company: string | null;
  employment_type: string | null;
  income: number | null;
  residents_count: number | null;
  has_pets: boolean | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  property?: {
    title: string;
    price: number;
    type: string;
    neighborhood: string;
  };
  documents?: Array<{
    category: string;
    status: string;
    file_name: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fichaId } = await req.json();

    if (!fichaId) {
      return new Response(
        JSON.stringify({ error: "fichaId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ficha data with property and documents
    const { data: ficha, error: fichaError } = await supabase
      .from("fichas")
      .select(`
        *,
        property:properties(title, price, type, neighborhood),
        documents(category, status, file_name)
      `)
      .eq("id", fichaId)
      .single();

    if (fichaError || !ficha) {
      console.error("Error fetching ficha:", fichaError);
      return new Response(
        JSON.stringify({ error: "Ficha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fichaData = ficha as FichaData;

    // Prepare analysis prompt
    const systemPrompt = `Você é um analista de crédito imobiliário especializado em locações. Sua tarefa é analisar fichas de interesse para aluguel de imóveis e fornecer uma avaliação detalhada.

Você deve analisar:
1. Capacidade financeira (renda vs valor do aluguel)
2. Documentação apresentada
3. Perfil do locatário
4. Riscos potenciais
5. Recomendação final

IMPORTANTE: 
- Mascare dados sensíveis como CPF completo em sua resposta
- Seja objetivo e profissional
- Sugira uma mensagem de WhatsApp para o corretor enviar ao cliente

Responda em formato JSON com a estrutura:
{
  "score": número de 0 a 100,
  "status_sugerido": "apto" | "nao_apto" | "faltando_docs",
  "resumo": "resumo da análise em 2-3 frases",
  "analise_financeira": {
    "renda_informada": número,
    "valor_aluguel": número,
    "comprometimento_renda": número em porcentagem,
    "parecer": "texto explicativo"
  },
  "documentacao": {
    "documentos_recebidos": ["lista de docs"],
    "documentos_faltantes": ["lista de docs faltantes"],
    "parecer": "texto explicativo"
  },
  "perfil_locatario": {
    "pontos_positivos": ["lista"],
    "pontos_atencao": ["lista"],
    "parecer": "texto explicativo"
  },
  "riscos": ["lista de riscos identificados"],
  "recomendacao_final": "texto com recomendação detalhada",
  "mensagem_whatsapp": "mensagem sugerida para enviar ao cliente"
}`;

    const userPrompt = `Analise a seguinte ficha de interesse:

**Dados do Interessado:**
- Nome: ${fichaData.full_name}
- CPF: ${fichaData.cpf ? fichaData.cpf.substring(0, 3) + ".***.***-" + fichaData.cpf.slice(-2) : "Não informado"}
- Telefone: ${fichaData.phone}
- Email: ${fichaData.email || "Não informado"}
- Data de Nascimento: ${fichaData.birth_date || "Não informado"}
- Estado Civil: ${fichaData.marital_status || "Não informado"}

**Dados Profissionais:**
- Ocupação: ${fichaData.occupation || "Não informado"}
- Empresa: ${fichaData.company || "Não informado"}
- Tipo de Vínculo: ${fichaData.employment_type || "Não informado"}
- Renda: ${fichaData.income ? `R$ ${fichaData.income.toLocaleString("pt-BR")}` : "Não informado"}

**Residência:**
- Endereço: ${fichaData.address_street || ""} ${fichaData.address_number || ""}, ${fichaData.address_neighborhood || ""} - ${fichaData.address_city || ""} / ${fichaData.address_state || ""}
- CEP: ${fichaData.address_cep || "Não informado"}
- Quantidade de Moradores: ${fichaData.residents_count || "Não informado"}
- Possui Pets: ${fichaData.has_pets ? "Sim" : "Não"}

**Imóvel de Interesse:**
${fichaData.property ? `
- Título: ${fichaData.property.title}
- Tipo: ${fichaData.property.type}
- Bairro: ${fichaData.property.neighborhood}
- Valor: R$ ${fichaData.property.price.toLocaleString("pt-BR")}
` : "Não vinculado a um imóvel específico"}

**Documentos Enviados:**
${fichaData.documents && fichaData.documents.length > 0 
  ? fichaData.documents.map(d => `- ${d.category}: ${d.status === "ok" ? "✓ OK" : d.status === "reprovado" ? "✗ Reprovado" : "⏳ Pendente"}`).join("\n")
  : "Nenhum documento enviado ainda"}

Por favor, realize a análise completa desta ficha.`;

    console.log("Calling Lovable AI for analysis...");

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Por favor, adicione mais créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao chamar serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const analysisContent = aiData.choices?.[0]?.message?.content;

    if (!analysisContent) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch (e) {
      console.error("Failed to parse AI response:", analysisContent);
      return new Response(
        JSON.stringify({ error: "Erro ao processar resposta da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update ficha with analysis results in form_data
    const { error: updateError } = await supabase
      .from("fichas")
      .update({
        form_data: {
          ...(ficha.form_data as object || {}),
          ai_analysis: analysis,
          ai_analyzed_at: new Date().toISOString(),
        },
      })
      .eq("id", fichaId);

    if (updateError) {
      console.error("Error updating ficha:", updateError);
    }

    // Log the activity
    await supabase.from("activity_log").insert({
      action: "ai_analysis",
      entity_type: "ficha",
      entity_id: fichaId,
      metadata: {
        score: analysis.score,
        status_sugerido: analysis.status_sugerido,
      },
    });

    console.log("Analysis completed successfully for ficha:", fichaId);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-ficha:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
