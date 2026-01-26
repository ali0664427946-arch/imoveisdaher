-- ============================================
-- DAHER HUB IMÓVEIS - DATABASE SCHEMA
-- ============================================

-- 1. ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'agent');
CREATE TYPE public.property_purpose AS ENUM ('rent', 'sale');
CREATE TYPE public.property_origin AS ENUM ('olx', 'imovelweb', 'import', 'manual');
CREATE TYPE public.property_status AS ENUM ('active', 'inactive', 'rented', 'sold');
CREATE TYPE public.lead_status AS ENUM ('novo', 'nao_atendeu', 'retornar', 'nao_quis_reuniao', 'reuniao_marcada', 'fechado');
CREATE TYPE public.conversation_channel AS ENUM ('whatsapp', 'olx_chat', 'internal', 'email');
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.ficha_status AS ENUM ('pendente', 'em_analise', 'apto', 'nao_apto', 'faltando_docs');
CREATE TYPE public.document_status AS ENUM ('pendente', 'ok', 'reprovado');
CREATE TYPE public.employment_type AS ENUM ('clt', 'autonomo', 'empresario', 'aposentado', 'funcionario_publico');

-- 2. USER ROLES TABLE (Security Critical)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin or agent
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 3. PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_team_member(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. PROPERTIES TABLE
-- ============================================
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin property_origin NOT NULL DEFAULT 'manual',
  origin_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  purpose property_purpose NOT NULL,
  type TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'RJ',
  address TEXT,
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  parking INTEGER DEFAULT 0,
  area DECIMAL(10,2),
  url_original TEXT,
  status property_status NOT NULL DEFAULT 'active',
  featured BOOLEAN DEFAULT false,
  slug TEXT UNIQUE,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Public can view active properties
CREATE POLICY "Public can view active properties" ON public.properties
  FOR SELECT USING (status = 'active');

-- Team can view all properties
CREATE POLICY "Team can view all properties" ON public.properties
  FOR SELECT USING (public.is_team_member(auth.uid()));

-- Only team can manage properties
CREATE POLICY "Team can manage properties" ON public.properties
  FOR ALL USING (public.is_team_member(auth.uid()));

-- 5. PROPERTY PHOTOS TABLE
-- ============================================
CREATE TABLE public.property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view property photos" ON public.property_photos
  FOR SELECT USING (true);

CREATE POLICY "Team can manage property photos" ON public.property_photos
  FOR ALL USING (public.is_team_member(auth.uid()));

-- 6. LEADS TABLE
-- ============================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  phone_normalized TEXT,
  email TEXT,
  origin TEXT,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status lead_status NOT NULL DEFAULT 'novo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view all leads" ON public.leads
  FOR SELECT USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team can manage leads" ON public.leads
  FOR ALL USING (public.is_team_member(auth.uid()));

-- 7. CONVERSATIONS TABLE
-- ============================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  channel conversation_channel NOT NULL DEFAULT 'whatsapp',
  external_thread_id TEXT,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view conversations" ON public.conversations
  FOR SELECT USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team can manage conversations" ON public.conversations
  FOR ALL USING (public.is_team_member(auth.uid()));

-- 8. MESSAGES TABLE
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  direction message_direction NOT NULL,
  message_type TEXT DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  provider TEXT,
  provider_payload JSONB,
  sent_status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view messages" ON public.messages
  FOR SELECT USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team can manage messages" ON public.messages
  FOR ALL USING (public.is_team_member(auth.uid()));

-- 9. FICHAS TABLE
-- ============================================
CREATE TABLE public.fichas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol TEXT UNIQUE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  status ficha_status NOT NULL DEFAULT 'pendente',
  -- Personal Data
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  rg TEXT,
  birth_date DATE,
  marital_status TEXT,
  -- Contact
  phone TEXT NOT NULL,
  email TEXT,
  -- Address
  address_cep TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  -- Professional
  occupation TEXT,
  employment_type employment_type,
  company TEXT,
  income DECIMAL(12,2),
  -- Residents
  residents_count INTEGER DEFAULT 1,
  has_pets BOOLEAN DEFAULT false,
  -- Other
  observations TEXT,
  form_data JSONB,
  analyzed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fichas ENABLE ROW LEVEL SECURITY;

-- Public can create fichas (for form submission)
CREATE POLICY "Anyone can create fichas" ON public.fichas
  FOR INSERT WITH CHECK (true);

-- Team can view and manage all fichas
CREATE POLICY "Team can view fichas" ON public.fichas
  FOR SELECT USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team can manage fichas" ON public.fichas
  FOR UPDATE USING (public.is_team_member(auth.uid()));

-- 10. DOCUMENTS TABLE
-- ============================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id UUID REFERENCES public.fichas(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status document_status NOT NULL DEFAULT 'pendente',
  observation TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Public can upload documents (via ficha form)
CREATE POLICY "Anyone can upload documents" ON public.documents
  FOR INSERT WITH CHECK (true);

-- Team can view and manage all documents
CREATE POLICY "Team can view documents" ON public.documents
  FOR SELECT USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team can manage documents" ON public.documents
  FOR UPDATE USING (public.is_team_member(auth.uid()));

-- 11. MESSAGE TEMPLATES TABLE
-- ============================================
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel conversation_channel,
  content TEXT NOT NULL,
  variables TEXT[],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view templates" ON public.templates
  FOR SELECT USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team can manage templates" ON public.templates
  FOR ALL USING (public.is_team_member(auth.uid()));

-- 12. INTEGRATIONS SETTINGS TABLE
-- ============================================
CREATE TABLE public.integrations_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage integrations" ON public.integrations_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 13. ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view activity log" ON public.activity_log
  FOR SELECT USING (public.is_team_member(auth.uid()));

CREATE POLICY "Anyone can insert activity log" ON public.activity_log
  FOR INSERT WITH CHECK (true);

-- 14. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_purpose ON public.properties(purpose);
CREATE INDEX idx_properties_neighborhood ON public.properties(neighborhood);
CREATE INDEX idx_properties_slug ON public.properties(slug);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_user_id);
CREATE INDEX idx_conversations_lead ON public.conversations(lead_id);
CREATE INDEX idx_conversations_assigned ON public.conversations(assigned_user_id);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_fichas_status ON public.fichas(status);
CREATE INDEX idx_fichas_property ON public.fichas(property_id);
CREATE INDEX idx_documents_ficha ON public.documents(ficha_id);

-- 15. UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fichas_updated_at BEFORE UPDATE ON public.fichas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. GENERATE PROTOCOL FOR FICHAS
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_ficha_protocol()
RETURNS TRIGGER AS $$
BEGIN
  NEW.protocol = 'DH-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_ficha_protocol BEFORE INSERT ON public.fichas
  FOR EACH ROW WHEN (NEW.protocol IS NULL)
  EXECUTE FUNCTION public.generate_ficha_protocol();