
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('student','lab_incharge','hod','principal','admin');
CREATE TYPE public.application_status AS ENUM ('submitted','lab_cleared','hod_cleared','principal_approved','rejected');
CREATE TYPE public.application_stage AS ENUM ('lab_incharge','hod','principal','completed');
CREATE TYPE public.due_status AS ENUM ('pending','paid');
CREATE TYPE public.approval_action AS ENUM ('approve','flag','reject');

-- ============ UPDATED_AT TRIGGER FN ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  roll_no TEXT UNIQUE,
  department TEXT NOT NULL DEFAULT 'Unassigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Secure role check function (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- ============ APPLICATIONS ============
CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'submitted',
  current_stage public.application_stage NOT NULL DEFAULT 'lab_incharge',
  submission_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  rejection_reason TEXT,
  chain_of_custody JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_applications_student ON public.applications(student_id);
CREATE INDEX idx_applications_stage ON public.applications(current_stage);

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_documents_application ON public.documents(application_id);

-- ============ DUES ============
CREATE TABLE public.dues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  due_type TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status public.due_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dues ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dues_student ON public.dues(student_id);
CREATE INDEX idx_dues_status ON public.dues(status);

CREATE TRIGGER trg_dues_updated_at
  BEFORE UPDATE ON public.dues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ APPROVALS ============
CREATE TABLE public.approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage public.application_stage NOT NULL,
  action public.approval_action NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_approvals_application ON public.approvals(application_id);

-- ============ CERTIFICATES ============
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  certificate_url TEXT,
  qr_code_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_name TEXT;
  _roll_no TEXT;
  _department TEXT;
  _role public.app_role;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  _roll_no := NULLIF(NEW.raw_user_meta_data->>'roll_no','');
  _department := COALESCE(NULLIF(NEW.raw_user_meta_data->>'department',''),'Unassigned');
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');

  INSERT INTO public.profiles (user_id, full_name, roll_no, department)
  VALUES (NEW.id, _full_name, _roll_no, _department);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- PROFILES
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Approvers view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'lab_incharge') OR
    public.has_role(auth.uid(),'hod') OR
    public.has_role(auth.uid(),'principal') OR
    public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- USER ROLES — readable by self and by admins; never user-writable
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- APPLICATIONS
CREATE POLICY "Students view own applications"
  ON public.applications FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = student_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Approvers view all applications"
  ON public.applications FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'lab_incharge') OR
    public.has_role(auth.uid(),'hod') OR
    public.has_role(auth.uid(),'principal') OR
    public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "Students create own applications"
  ON public.applications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = student_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Approvers update applications"
  ON public.applications FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'lab_incharge') OR
    public.has_role(auth.uid(),'hod') OR
    public.has_role(auth.uid(),'principal') OR
    public.has_role(auth.uid(),'admin')
  );

-- DOCUMENTS
CREATE POLICY "Students view own documents"
  ON public.documents FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.applications a
            JOIN public.profiles p ON p.id = a.student_id
            WHERE a.id = application_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Approvers view all documents"
  ON public.documents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'lab_incharge') OR
    public.has_role(auth.uid(),'hod') OR
    public.has_role(auth.uid(),'principal') OR
    public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "Students upload own documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (SELECT 1 FROM public.applications a
            JOIN public.profiles p ON p.id = a.student_id
            WHERE a.id = application_id AND p.user_id = auth.uid())
  );

-- DUES
CREATE POLICY "Students view own dues"
  ON public.dues FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = student_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Staff view all dues"
  ON public.dues FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'principal') OR
    public.has_role(auth.uid(),'lab_incharge') OR
    public.has_role(auth.uid(),'hod')
  );

CREATE POLICY "Admins manage dues"
  ON public.dues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'principal'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'principal'));

-- APPROVALS
CREATE POLICY "Students view approvals on own applications"
  ON public.approvals FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.applications a
            JOIN public.profiles p ON p.id = a.student_id
            WHERE a.id = application_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Approvers view all approvals"
  ON public.approvals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'lab_incharge') OR
    public.has_role(auth.uid(),'hod') OR
    public.has_role(auth.uid(),'principal') OR
    public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "Approvers create approvals"
  ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (
    approver_id = auth.uid() AND (
      public.has_role(auth.uid(),'lab_incharge') OR
      public.has_role(auth.uid(),'hod') OR
      public.has_role(auth.uid(),'principal') OR
      public.has_role(auth.uid(),'admin')
    )
  );

-- CERTIFICATES — public can read any certificate (QR verification)
CREATE POLICY "Anyone can view certificates"
  ON public.certificates FOR SELECT
  USING (true);

CREATE POLICY "Principal/admin issue certificates"
  ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'principal') OR public.has_role(auth.uid(),'admin'));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('nexus-documents','nexus-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('nexus-certificates','nexus-certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — documents private, organized by user_id folder
CREATE POLICY "Users upload own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'nexus-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users view own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'nexus-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Approvers view all nexus documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'nexus-documents' AND (
      public.has_role(auth.uid(),'lab_incharge') OR
      public.has_role(auth.uid(),'hod') OR
      public.has_role(auth.uid(),'principal') OR
      public.has_role(auth.uid(),'admin')
    )
  );

CREATE POLICY "Anyone can read certificates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'nexus-certificates');

CREATE POLICY "Authenticated upload certificates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nexus-certificates');
