# Daher Oficial

Crie um sistema SaaS web chamado “Daher Hub Imóveis” (Portal + CRM de Conversas + Ficha de Documentos + Agente de Análise). O sistema terá um site público como página inicial exibindo os imóveis anunciados pela conta da Daher na OLX e na ImovelWeb, e uma área logada para equipe (CRM, conversas, fichas, análise documental e automações).

Stack obrigatória

Lovable + Supabase

Supabase Auth

Postgres

Storage (arquivos/documentos/fotos)

Edge Functions (integrações + webhooks)

Integração WhatsApp: Evolution API (já existente no meu ecossistema)

IA para análise: OpenAI (via Edge Function)

1) SITE PÚBLICO (PÁGINA INICIAL) — Catálogo de imóveis (SEO + vitrine)
Rotas públicas

/ Home: vitrine com imóveis + busca + destaque

/imoveis lista com filtros

/imovel/:slug página do imóvel (detalhes + galeria + CTA)

/ficha/:propertyId inicia a ficha/documentos do interessado (CTA do imóvel)

Funcionalidades no catálogo

Buscar e filtrar:

bairro, cidade, tipo, faixa de preço, quartos, banheiros, vagas, metragem, “aluguel/venda”

Cards com:

foto principal, título, preço, bairro, tags (ex: “novo”, “perto do metrô”), origem (OLX/ImovelWeb)

Página do imóvel com:

galeria de fotos

descrição

dados principais

botão “Quero alugar/comprar este imóvel” que leva para /ficha/:propertyId

SEO:

slug amigável por endereço/bairro/tipo (sem expor dados sensíveis)

meta title/description automáticos

sitemap automático

schema básico de imóvel (quando possível)

2) SINCRONIZAÇÃO DE IMÓVEIS (OLX + ImovelWeb)
Fonte 1: OLX (oficial)

Implementar integração via OLX API de anúncios publicados com autenticação OAuth. Criar Edge Functions:

GET /sync/olx/publishedAds

busca anúncios ativos/publicados do anunciante Daher

salva/atualiza em properties

GET /sync/olx/adDetails?listId=...

puxa detalhes do anúncio e fotos e atualiza no banco

Armazenar tokens/segredos no Supabase (tabela integrations_settings) e preparar fluxo OAuth para admin conectar a conta. (A OLX possui docs de OAuth e listagem de publicações.)

Fonte 2: ImovelWeb (via feed/webhook/import)

Como a disponibilidade de API direta varia por contrato, implementar 3 modos (o admin escolhe):

Modo A (Feed URL): admin cola uma URL de feed/export do parceiro/CRM e o sistema sincroniza diariamente.

Modo B (Webhooks de lead + catálogo por “carga/feeds”): estrutura pronta para integrar com padrões de feed + webhook do ecossistema GrupoZAP (quando aplicável).

Modo C (Import CSV/Excel): admin importa lista de imóveis com fotos por links (ou upload em lote).

Criar Edge Functions:

POST /sync/imovelweb/feed

POST /sync/import/properties-csv

Banco “unificado” de imóveis

Criar tabela properties como fonte única do site, independentemente do portal.

3) FICHA DO CLIENTE + ENVIO DE DOCUMENTOS (igual ao modelo existente)

Criar a Ficha de Interesse + Documentação acessível pelo CTA do imóvel.

Requisitos da ficha

A ficha deve ser muito parecida com o modelo existente (mesma ideia de etapas e coleta completa), porém construída como formulário do sistema com:

etapas (wizard)

validação

upload de documentos

aceite de termos (checkbox)

envio final com protocolo

A ficha precisa capturar (mínimo):

Dados pessoais do interessado (nome, CPF, RG, data nasc, estado civil)

Contato (telefone/WhatsApp, email)

Endereço atual

Tipo de interesse: aluguel ou compra

Dados financeiros básicos (renda, profissão, empresa, comprovantes)

Pessoas que vão morar (dependentes)

Observações

Documentos exigidos por “tipo de pessoa”:

PF assalariado / autônomo / empresário / aposentado

Upload obrigatório por categoria (PDF/JPG/PNG)

Uploads

Cada documento deve cair no Supabase Storage com pasta:

/fichas/{fichaId}/{categoria}/{arquivo}

Criar tabela documents com:

fichaId, categoria, nomeArquivo, url, status (PENDENTE/OK/REPROVADO), observacao, created_at

Área interna de análise

Criar rota interna:

/analise-documentos

lista fichas recebidas

filtros por status: “Pendente”, “Em análise”, “Aprovado”, “Reprovado”, “Faltando doc”

ao abrir ficha:

ver todos os dados do formulário

ver documentos por categoria

aprovar/reprovar cada documento com observação

botão “Rodar análise IA”

botão “Responder via WhatsApp”

botão “Encaminhar para humano responsável”

4) CRM DE CONVERSAS (WhatsApp + OLX Chat + Inbox + Kanban)

Criar área logada:

/dashboard

/inbox

/kanban

/leads

/conversas/:id

/templates

/importacoes

/usuarios (admin)

/configuracoes (admin)

Kanban (pipeline)

Colunas:

Entrou em contato

Não atendeu

Retornar

Não quis reunião

Reunião marcada

Cliente fechado

Templates

Templates com variáveis: {{nome}}, {{bairro}}, {{imovel_titulo}}, {{imovel_url}}, {{preco}}, {{tipo}}, {{responsavel}}

Templates por canal:

WhatsApp

OLX Chat

Ambos

Integração OLX Chat (oficial, quando habilitado)

Preparar:

POST /webhooks/olx/chat (receber mensagens)

POST /send/olx/chat (responder)
(OLX tem documentação de integração de chat e webhooks.)

WhatsApp (Evolution API)

POST /send/whatsapp para enviar mensagem pro lead

Registrar histórico em messages

5) AGENTE DE ANÁLISE DOCUMENTAL (IA) + RESPOSTA AUTOMÁTICA NO WHATSAPP

Objetivo: quando o cliente enviar a ficha e documentos, o sistema roda um agente que:

verifica se todos os documentos obrigatórios foram enviados

verifica se cada documento está legível (heurística: tamanho, extensão, preview, e se possível análise via visão)

aplica regras de elegibilidade (checklist)

gera resultado:

APTO

NÃO APTO

PENDENTE (faltam docs)

escreve um relatório interno e sugere mensagem pronta

envia a mensagem para o cliente via WhatsApp (com confirmação do usuário, ou modo automático configurável)

Como “treinar” (sem complicação)

Criar no banco:

tabela agent_rules

tipo_interesse (aluguel/compra)

perfil (assalariado/autonomo/empresario/aposentado)

checklist JSON (docs obrigatórios + regras)

textos padrões de retorno (apto/nao_apto/pendente)

tabela agent_examples

exemplos de casos aprovados/reprovados (dados mascarados) para reforçar padrão

Criar Edge Function:

POST /agent/analisar-ficha
Input:
{
"fichaId": "...",
"modo": "precheck|final"
}
Processo:

Busca ficha + docs + regras aplicáveis

Monta prompt do agente com:

checklist

evidências (quais docs existem)

campos preenchidos

Retorna JSON estruturado:
{
"status": "APTO|NAO_APTO|PENDENTE",
"motivos": ["..."],
"docs_faltando": ["..."],
"mensagem_whatsapp_sugerida": "...",
"confianca": 0-1
}
Salvar resultado em agent_reports e logar em activity_log.

Envio WhatsApp

Criar Edge Function:

POST /agent/enviar-resposta-whatsapp

Puxa mensagem_whatsapp_sugerida

Envia via Evolution API

Registra em messages

Regras de segurança

O agente deve sempre escrever no relatório:

“Análise preliminar automática. Revisão final humana recomendada.”

Não expor CPF/RG completos no chat ou logs; mascarar.

6) MODELO DE DADOS (Supabase)
Tabelas principais

profiles (id, name, role)

properties

id, origin (olx|imovelweb|import), origin_id, title, description, price, neighborhood, city, state, type, purpose (rent|sale), bedrooms, bathrooms, parking, area, url_original, status (active|inactive), featured, updated_at

property_photos

id, property_id, url, order

leads

id, name, phone, phone_normalized, email, origin, property_id (nullable), owner_user_id, created_at

conversations

id, lead_id, channel (whatsapp|olx_chat|internal), external_thread_id, status_kanban, last_message_at, next_action_at, assigned_user_id

messages

id, conversation_id, direction, message_type, text, media_url, provider, provider_payload, sent_status, created_at

templates

fichas

id, property_id, lead_id, status (PENDENTE|EM_ANALISE|APTO|NAO_APTO|FALTANDO_DOCS), form_data jsonb, created_at

documents

id, ficha_id, categoria, file_url, file_name, status, observacao, created_at

agent_rules

agent_examples

agent_reports

id, ficha_id, status, motivos jsonb, docs_faltando jsonb, mensagem_sugerida, confianca, created_at

integrations_settings (keys/values: OLX OAuth, feed url, evolution baseUrl/apiKey/instance etc.)

activity_log

RLS

admin vê tudo

agent vê o que está atribuído (leads, conversas, fichas atribuídas)

7) CONFIGURAÇÕES (Admin) — “só configurar e correr pro abraço”

Tela /configuracoes com:

OLX:

client_id, client_secret, redirect_uri, conectar via OAuth, botão “Sincronizar agora”

ImovelWeb:

modo de integração (Feed URL / Webhook / Import CSV)

campo “Feed URL”

Evolution API:

baseUrl, apiKey, instance

Agente:

ligar/desligar envio automático

editar checklist por perfil

templates de mensagens (apto/não apto/pendente)

8) MVP (ordem de construção dentro do Lovable)

Banco + Auth + roles

Catálogo público consumindo properties

Sincronização OLX para preencher properties

Ficha + Upload de documentos + Storage + tela interna de análise

Inbox/Kanban/Templates + WhatsApp send

Agente de análise + relatório + resposta WhatsApp

Plug ImovelWeb via feed/import

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://imoveisdaher.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4148d436-00eb-4eca-9ec5-1ba393908114).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
