-- ============================================
-- MIGRACIÓN COMPLETA - MedStream Platform
-- ============================================

-- 1. ENUM TYPES
-- ============================================

-- Roles de la aplicación (incluye "resident" que representa "Residentes y médicos en formación")
CREATE TYPE public.app_role AS ENUM ('visitor', 'patient', 'doctor', 'resident', 'admin');

-- Estado de verificación de doctores y residentes
CREATE TYPE public.doctor_status AS ENUM ('pending', 'approved', 'rejected');

-- Estado de los lives
CREATE TYPE public.live_status AS ENUM ('live', 'ended', 'processing_recording', 'recording_ready');

-- Tipo de transacción de wallet
CREATE TYPE public.transaction_type AS ENUM ('topup', 'purchase', 'refund', 'subscription', 'earning');

-- Estado de transacción
CREATE TYPE public.transaction_status AS ENUM ('initiated', 'paid', 'failed');

-- Estado de chat
CREATE TYPE public.chat_status AS ENUM ('active', 'closed');

-- Tipo de archivo en vault
CREATE TYPE public.vault_file_type AS ENUM ('pdf', 'image', 'study');

-- Tipo de contenido de doctor
CREATE TYPE public.content_type AS ENUM ('video', 'pdf', 'image');

-- Estado de sesión clínica
CREATE TYPE public.clinical_session_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');

-- Tipo de participante en chat
CREATE TYPE public.chat_participant_type AS ENUM ('patient', 'doctor', 'resident');

-- 2. TABLAS PRINCIPALES
-- ============================================

-- Perfiles de usuario
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles de usuario (separado para seguridad)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'patient',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Perfiles de doctores (extendido)
CREATE TABLE public.doctor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    specialty TEXT NOT NULL,
    license TEXT NOT NULL,
    cedula_profesional TEXT, -- Cédula profesional escaneada
    numero_consejo TEXT, -- Número de consejo
    bio TEXT,
    status public.doctor_status NOT NULL DEFAULT 'pending',
    consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    rating DECIMAL(3,2) NOT NULL DEFAULT 0,
    total_consultations INTEGER NOT NULL DEFAULT 0,
    followers_count INTEGER NOT NULL DEFAULT 0,
    -- Double Check options
    available_for_double_check BOOLEAN NOT NULL DEFAULT false,
    available_for_clinical_sessions BOOLEAN NOT NULL DEFAULT false,
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Perfiles de residentes (extendido)
CREATE TABLE public.resident_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    institution TEXT NOT NULL,
    specialty TEXT NOT NULL,
    year INTEGER NOT NULL DEFAULT 1,
    titulo_medicina TEXT, -- Comprobante de título de medicina
    cedula_profesional TEXT, -- Cédula profesional
    status public.doctor_status NOT NULL DEFAULT 'pending',
    followers_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallets
CREATE TABLE public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transacciones de wallet
CREATE TABLE public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type public.transaction_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    status public.transaction_status NOT NULL DEFAULT 'initiated',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lives
CREATE TABLE public.lives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    specialty TEXT NOT NULL,
    status public.live_status NOT NULL DEFAULT 'live',
    viewer_count INTEGER NOT NULL DEFAULT 0,
    likes_count INTEGER NOT NULL DEFAULT 0,
    thumbnail_url TEXT,
    recording_price DECIMAL(10,2),
    tags TEXT[] DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
);

-- Likes en lives
CREATE TABLE public.live_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_id UUID NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(live_id, user_id)
);

-- Suscripciones a doctores/residentes
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    price_paid DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE(subscriber_id, creator_id)
);

-- Seguidores
CREATE TABLE public.followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(follower_id, followed_id)
);

-- Grabaciones
CREATE TABLE public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_id UUID REFERENCES public.lives(id) ON DELETE SET NULL,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    specialty TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    thumbnail_url TEXT,
    video_url TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compras de grabaciones
CREATE TABLE public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, recording_id)
);

-- Entitlements (permisos especiales)
CREATE TABLE public.entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'chat', 'premium', etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, type)
);

-- Historia Clínica del Paciente (persistente)
CREATE TABLE public.medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_type public.vault_file_type NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    date_of_study TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vault Files (archivos compartibles con doctores - temporales)
CREATE TABLE public.vault_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    medical_history_id UUID REFERENCES public.medical_history(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    file_type public.vault_file_type NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Acceso a vault (temporal, se borra después de la consulta)
CREATE TABLE public.vault_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    consultation_id UUID, -- Se borra cuando termina la consulta
    UNIQUE(file_id, doctor_id)
);

-- Chat Sessions (con restricción de tipos de participantes)
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant1_type public.chat_participant_type NOT NULL,
    participant2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant2_type public.chat_participant_type NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count_1 INTEGER NOT NULL DEFAULT 0,
    unread_count_2 INTEGER NOT NULL DEFAULT 0,
    status public.chat_status NOT NULL DEFAULT 'active',
    is_double_check BOOLEAN NOT NULL DEFAULT false, -- Si es segunda opinión
    original_consultation_id UUID, -- Referencia a consulta original si es double check
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- RESTRICCIÓN: No permitir chat Patient-Resident
    CONSTRAINT no_patient_resident_chat CHECK (
        NOT (
            (participant1_type = 'patient' AND participant2_type = 'resident') OR
            (participant1_type = 'resident' AND participant2_type = 'patient')
        )
    )
);

-- Chat Messages
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grupos de Residentes
CREATE TABLE public.resident_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    specialty TEXT,
    image_url TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membresía en grupos de residentes
CREATE TABLE public.resident_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.resident_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- Actividad en grupos de residentes
CREATE TABLE public.resident_group_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.resident_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sesiones Clínicas (colaboración entre médicos)
CREATE TABLE public.clinical_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    case_summary TEXT,
    specialty TEXT NOT NULL,
    status public.clinical_session_status NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invitaciones a sesiones clínicas
CREATE TABLE public.clinical_session_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.clinical_sessions(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status public.clinical_session_status NOT NULL DEFAULT 'pending',
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, doctor_id)
);

-- Contenido subido por doctores/residentes
CREATE TABLE public.doctor_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type public.content_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    category TEXT,
    price DECIMAL(10,2) DEFAULT 0, -- Residentes pagan 50% menos
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consultas médicas (para tracking de Double Check)
CREATE TABLE public.consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_session_id UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    diagnosis TEXT,
    notes TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
);

-- 3. FUNCIONES DE SEGURIDAD
-- ============================================

-- Función para verificar rol (evita recursión en RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
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

-- Función para obtener el rol de un usuario
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
$$;

-- Función para verificar si es doctor aprobado
CREATE OR REPLACE FUNCTION public.is_approved_doctor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.doctor_profiles
        WHERE user_id = _user_id
        AND status = 'approved'
    )
$$;

-- Función para verificar si es residente aprobado
CREATE OR REPLACE FUNCTION public.is_approved_resident(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.resident_profiles
        WHERE user_id = _user_id
        AND status = 'approved'
    )
$$;

-- Función para calcular precio para residentes (50% descuento)
CREATE OR REPLACE FUNCTION public.get_price_for_user(_base_price DECIMAL, _user_id UUID)
RETURNS DECIMAL
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE 
        WHEN public.has_role(_user_id, 'resident') THEN _base_price * 0.5
        ELSE _base_price
    END
$$;

-- 4. TRIGGERS
-- ============================================

-- Función para crear perfil, rol y wallet automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _role public.app_role;
    _name TEXT;
BEGIN
    -- Obtener rol y nombre de los metadatos
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
    _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    
    -- Crear perfil
    INSERT INTO public.profiles (id, email, name, avatar_url)
    VALUES (NEW.id, NEW.email, _name, NEW.raw_user_meta_data->>'avatar_url');
    
    -- Crear rol
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role);
    
    -- Crear wallet para pacientes y residentes
    IF _role IN ('patient', 'resident') THEN
        INSERT INTO public.wallets (user_id, balance)
        VALUES (NEW.id, 0);
    END IF;
    
    -- Crear perfil de doctor si aplica
    IF _role = 'doctor' THEN
        INSERT INTO public.doctor_profiles (user_id, specialty, license, status)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'specialty', 'General'),
            COALESCE(NEW.raw_user_meta_data->>'license', ''),
            'pending'
        );
    END IF;
    
    -- Crear perfil de residente si aplica
    IF _role = 'resident' THEN
        INSERT INTO public.resident_profiles (user_id, institution, specialty, year, status)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'institution', ''),
            COALESCE(NEW.raw_user_meta_data->>'specialty', 'General'),
            COALESCE((NEW.raw_user_meta_data->>'year')::INTEGER, 1),
            'pending'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger para nuevos usuarios
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctor_profiles_updated_at BEFORE UPDATE ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_resident_profiles_updated_at BEFORE UPDATE ON public.resident_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_medical_history_updated_at BEFORE UPDATE ON public.medical_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_resident_groups_updated_at BEFORE UPDATE ON public.resident_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clinical_sessions_updated_at BEFORE UPDATE ON public.clinical_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctor_content_updated_at BEFORE UPDATE ON public.doctor_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para actualizar contador de miembros en grupos
CREATE OR REPLACE FUNCTION public.update_group_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.resident_groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.resident_groups SET member_count = member_count - 1 WHERE id = OLD.group_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER on_group_member_change
    AFTER INSERT OR DELETE ON public.resident_group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_group_member_count();

-- Trigger para actualizar contador de likes en lives
CREATE OR REPLACE FUNCTION public.update_live_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.lives SET likes_count = likes_count + 1 WHERE id = NEW.live_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.lives SET likes_count = likes_count - 1 WHERE id = OLD.live_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER on_live_like_change
    AFTER INSERT OR DELETE ON public.live_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_live_likes_count();

-- Trigger para actualizar contador de seguidores
CREATE OR REPLACE FUNCTION public.update_followers_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Actualizar en doctor_profiles si existe
        UPDATE public.doctor_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.followed_id;
        -- Actualizar en resident_profiles si existe
        UPDATE public.resident_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.followed_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.doctor_profiles SET followers_count = followers_count - 1 WHERE user_id = OLD.followed_id;
        UPDATE public.resident_profiles SET followers_count = followers_count - 1 WHERE user_id = OLD.followed_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER on_follower_change
    AFTER INSERT OR DELETE ON public.followers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_followers_count();

-- 5. ROW LEVEL SECURITY
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_group_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_session_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- USER ROLES POLICIES (solo lectura para el usuario, admin puede modificar)
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- DOCTOR PROFILES POLICIES
CREATE POLICY "Doctor profiles are viewable by everyone" ON public.doctor_profiles FOR SELECT USING (true);
CREATE POLICY "Doctors can update own profile" ON public.doctor_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage doctor profiles" ON public.doctor_profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RESIDENT PROFILES POLICIES
CREATE POLICY "Resident profiles are viewable by everyone" ON public.resident_profiles FOR SELECT USING (true);
CREATE POLICY "Residents can update own profile" ON public.resident_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage resident profiles" ON public.resident_profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- WALLETS POLICIES
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);

-- WALLET TRANSACTIONS POLICIES
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- LIVES POLICIES
CREATE POLICY "Lives are viewable by everyone" ON public.lives FOR SELECT USING (true);
CREATE POLICY "Approved doctors can create lives" ON public.lives FOR INSERT WITH CHECK (public.is_approved_doctor(auth.uid()));
CREATE POLICY "Approved residents can create lives" ON public.lives FOR INSERT WITH CHECK (public.is_approved_resident(auth.uid()));
CREATE POLICY "Creators can update own lives" ON public.lives FOR UPDATE USING (auth.uid() = doctor_id);
CREATE POLICY "Creators can delete own lives" ON public.lives FOR DELETE USING (auth.uid() = doctor_id);

-- LIVE LIKES POLICIES
CREATE POLICY "Anyone can view likes" ON public.live_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON public.live_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike own likes" ON public.live_likes FOR DELETE USING (auth.uid() = user_id);

-- SUBSCRIPTIONS POLICIES
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = subscriber_id OR auth.uid() = creator_id);
CREATE POLICY "Users can create subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY "Users can cancel own subscriptions" ON public.subscriptions FOR UPDATE USING (auth.uid() = subscriber_id);

-- FOLLOWERS POLICIES
CREATE POLICY "Anyone can view followers" ON public.followers FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON public.followers FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.followers FOR DELETE USING (auth.uid() = follower_id);

-- RECORDINGS POLICIES
CREATE POLICY "Recordings are viewable by everyone" ON public.recordings FOR SELECT USING (true);
CREATE POLICY "Creators can manage own recordings" ON public.recordings FOR ALL USING (auth.uid() = doctor_id);

-- PURCHASES POLICIES
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create purchases" ON public.purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ENTITLEMENTS POLICIES
CREATE POLICY "Users can view own entitlements" ON public.entitlements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage entitlements" ON public.entitlements FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- MEDICAL HISTORY POLICIES (solo el paciente)
CREATE POLICY "Patients can view own medical history" ON public.medical_history FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients can manage own medical history" ON public.medical_history FOR ALL USING (auth.uid() = patient_id);

-- VAULT FILES POLICIES
CREATE POLICY "Patients can view own vault files" ON public.vault_files FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Doctors can view files with access" ON public.vault_files FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vault_access WHERE file_id = id AND doctor_id = auth.uid())
);
CREATE POLICY "Patients can manage own vault files" ON public.vault_files FOR ALL USING (auth.uid() = patient_id);

-- VAULT ACCESS POLICIES
CREATE POLICY "Patients can manage vault access for own files" ON public.vault_access FOR ALL USING (
    EXISTS (SELECT 1 FROM public.vault_files WHERE id = file_id AND patient_id = auth.uid())
);
CREATE POLICY "Doctors can view own access" ON public.vault_access FOR SELECT USING (auth.uid() = doctor_id);

-- CHAT SESSIONS POLICIES
CREATE POLICY "Participants can view own sessions" ON public.chat_sessions FOR SELECT USING (
    auth.uid() = participant1_id OR auth.uid() = participant2_id
);
CREATE POLICY "Authenticated users can create sessions" ON public.chat_sessions FOR INSERT WITH CHECK (
    auth.uid() = participant1_id
);
CREATE POLICY "Participants can update own sessions" ON public.chat_sessions FOR UPDATE USING (
    auth.uid() = participant1_id OR auth.uid() = participant2_id
);

-- CHAT MESSAGES POLICIES
CREATE POLICY "Participants can view messages" ON public.chat_messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chat_sessions 
        WHERE id = session_id 
        AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
);
CREATE POLICY "Participants can send messages" ON public.chat_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.chat_sessions 
        WHERE id = session_id 
        AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
);
CREATE POLICY "Participants can update message read status" ON public.chat_messages FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.chat_sessions 
        WHERE id = session_id 
        AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
);

-- RESIDENT GROUPS POLICIES
CREATE POLICY "Everyone can view groups" ON public.resident_groups FOR SELECT USING (true);
CREATE POLICY "Admins and creators can manage groups" ON public.resident_groups FOR ALL USING (
    auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')
);

-- RESIDENT GROUP MEMBERS POLICIES
CREATE POLICY "Everyone can view group members" ON public.resident_group_members FOR SELECT USING (true);
CREATE POLICY "Residents can join groups" ON public.resident_group_members FOR INSERT WITH CHECK (
    auth.uid() = user_id AND public.has_role(auth.uid(), 'resident')
);
CREATE POLICY "Members can leave groups" ON public.resident_group_members FOR DELETE USING (auth.uid() = user_id);

-- RESIDENT GROUP ACTIVITY POLICIES
CREATE POLICY "Group members can view activity" ON public.resident_group_activity FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.resident_group_members WHERE group_id = resident_group_activity.group_id AND user_id = auth.uid())
);
CREATE POLICY "Group members can post activity" ON public.resident_group_activity FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.resident_group_members WHERE group_id = resident_group_activity.group_id AND user_id = auth.uid())
);

-- CLINICAL SESSIONS POLICIES
CREATE POLICY "Doctors can view clinical sessions" ON public.clinical_sessions FOR SELECT USING (
    auth.uid() = organizer_id OR 
    EXISTS (SELECT 1 FROM public.clinical_session_invitations WHERE session_id = id AND doctor_id = auth.uid())
);
CREATE POLICY "Approved doctors can create clinical sessions" ON public.clinical_sessions FOR INSERT WITH CHECK (
    public.is_approved_doctor(auth.uid())
);
CREATE POLICY "Organizers can update own sessions" ON public.clinical_sessions FOR UPDATE USING (auth.uid() = organizer_id);

-- CLINICAL SESSION INVITATIONS POLICIES
CREATE POLICY "Invited doctors can view invitations" ON public.clinical_session_invitations FOR SELECT USING (
    auth.uid() = doctor_id OR 
    EXISTS (SELECT 1 FROM public.clinical_sessions WHERE id = session_id AND organizer_id = auth.uid())
);
CREATE POLICY "Organizers can create invitations" ON public.clinical_session_invitations FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.clinical_sessions WHERE id = session_id AND organizer_id = auth.uid())
);
CREATE POLICY "Invited doctors can respond to invitations" ON public.clinical_session_invitations FOR UPDATE USING (
    auth.uid() = doctor_id
);

-- DOCTOR CONTENT POLICIES
CREATE POLICY "Public content is viewable by everyone" ON public.doctor_content FOR SELECT USING (is_public = true);
CREATE POLICY "Private content viewable by creator" ON public.doctor_content FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "Creators can manage own content" ON public.doctor_content FOR ALL USING (auth.uid() = creator_id);

-- CONSULTATIONS POLICIES
CREATE POLICY "Participants can view consultations" ON public.consultations FOR SELECT USING (
    auth.uid() = patient_id OR auth.uid() = doctor_id
);
CREATE POLICY "Doctors can create consultations" ON public.consultations FOR INSERT WITH CHECK (
    auth.uid() = doctor_id
);
CREATE POLICY "Participants can update consultations" ON public.consultations FOR UPDATE USING (
    auth.uid() = patient_id OR auth.uid() = doctor_id
);

-- 6. STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('vault-files', 'vault-files', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-history', 'medical-history', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('doctor-content', 'doctor-content', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- STORAGE POLICIES

-- Avatars (público)
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Vault Files (solo paciente y doctores con acceso)
CREATE POLICY "Patients can access own vault files" ON storage.objects FOR SELECT USING (
    bucket_id = 'vault-files' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Patients can upload vault files" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'vault-files' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Patients can delete own vault files" ON storage.objects FOR DELETE USING (
    bucket_id = 'vault-files' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Medical History (solo paciente)
CREATE POLICY "Patients can access own medical history" ON storage.objects FOR SELECT USING (
    bucket_id = 'medical-history' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Patients can upload medical history" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'medical-history' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Patients can delete own medical history" ON storage.objects FOR DELETE USING (
    bucket_id = 'medical-history' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Doctor Content
CREATE POLICY "Public doctor content is accessible" ON storage.objects FOR SELECT USING (bucket_id = 'doctor-content');
CREATE POLICY "Doctors can upload content" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'doctor-content' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Doctors can manage own content" ON storage.objects FOR UPDATE USING (
    bucket_id = 'doctor-content' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Doctors can delete own content" ON storage.objects FOR DELETE USING (
    bucket_id = 'doctor-content' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Thumbnails (público)
CREATE POLICY "Thumbnails are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
CREATE POLICY "Creators can upload thumbnails" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Documents (cédulas, títulos, etc. - privado)
CREATE POLICY "Users can access own documents" ON storage.objects FOR SELECT USING (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can upload documents" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Admins can view all documents" ON storage.objects FOR SELECT USING (
    bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin')
);

-- 7. REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.lives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.resident_group_activity;

-- 8. INDEXES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_doctor_profiles_status ON public.doctor_profiles(status);
CREATE INDEX idx_resident_profiles_status ON public.resident_profiles(status);
CREATE INDEX idx_lives_status ON public.lives(status);
CREATE INDEX idx_lives_doctor_id ON public.lives(doctor_id);
CREATE INDEX idx_recordings_doctor_id ON public.recordings(doctor_id);
CREATE INDEX idx_chat_sessions_participants ON public.chat_sessions(participant1_id, participant2_id);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX idx_vault_access_doctor ON public.vault_access(doctor_id);
CREATE INDEX idx_vault_access_file ON public.vault_access(file_id);
CREATE INDEX idx_medical_history_patient ON public.medical_history(patient_id);
CREATE INDEX idx_followers_followed ON public.followers(followed_id);
CREATE INDEX idx_subscriptions_creator ON public.subscriptions(creator_id);
CREATE INDEX idx_clinical_sessions_organizer ON public.clinical_sessions(organizer_id);