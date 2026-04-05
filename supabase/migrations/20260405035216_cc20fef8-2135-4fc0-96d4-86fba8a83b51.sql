
-- ==========================================
-- 1. HOSPITALS TABLE
-- ==========================================
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  type TEXT NOT NULL DEFAULT 'public',
  level TEXT DEFAULT '3er nivel',
  specialties JSONB DEFAULT '[]'::jsonb,
  hours TEXT,
  zone TEXT,
  image_url TEXT,
  lat NUMERIC,
  lng NUMERIC,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active hospitals" ON public.hospitals
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage hospitals" ON public.hospitals
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- 2. HOSPITAL REVIEWS TABLE
-- ==========================================
CREATE TABLE public.hospital_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hospital_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hospital reviews" ON public.hospital_reviews
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reviews" ON public.hospital_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON public.hospital_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage reviews" ON public.hospital_reviews
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- 3. MARKETPLACE VENDORS TABLE
-- ==========================================
CREATE TABLE public.marketplace_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  phone TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved vendors" ON public.marketplace_vendors
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Vendor owners can manage own" ON public.marketplace_vendors
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all vendors" ON public.marketplace_vendors
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- 4. MARKETPLACE CATEGORIES TABLE
-- ==========================================
CREATE TABLE public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  icon TEXT DEFAULT 'Package',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active categories" ON public.marketplace_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON public.marketplace_categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- 5. MARKETPLACE PRODUCTS TABLE
-- ==========================================
CREATE TABLE public.marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.marketplace_vendors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active products" ON public.marketplace_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Vendor owners can manage own products" ON public.marketplace_products
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.marketplace_vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.marketplace_vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all products" ON public.marketplace_products
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- 6. MARKETPLACE ORDERS TABLE
-- ==========================================
CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.marketplace_vendors(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  shipping_address JSONB,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own orders" ON public.marketplace_orders
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can create orders" ON public.marketplace_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Vendors can view orders for their products" ON public.marketplace_orders
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.marketplace_vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  );

CREATE POLICY "Vendors can update order status" ON public.marketplace_orders
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.marketplace_vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.marketplace_vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all orders" ON public.marketplace_orders
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- SEED DATA: HOSPITALS (20 real CDMX hospitals)
-- ==========================================
INSERT INTO public.hospitals (name, address, phone, website, type, level, specialties, hours, zone, image_url, lat, lng, description) VALUES
('Hospital General de México Dr. Eduardo Liceaga', 'Dr. Balmis 148, Doctores, Cuauhtémoc, CDMX', '55 2789 2000', 'https://hgm.salud.gob.mx', 'public', '3er nivel', '["Oncología","Cardiología","Neurocirugía","Traumatología","Medicina Interna","Pediatría","Cirugía General"]', 'Urgencias 24h', 'Centro', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Hospital_General_de_M%C3%A9xico.jpg/1200px-Hospital_General_de_M%C3%A9xico.jpg', 19.4117, -99.1528, 'Uno de los hospitales más grandes y emblemáticos de México, referencia nacional en investigación y atención especializada.'),
('Instituto Nacional de Ciencias Médicas y Nutrición Salvador Zubirán', 'Vasco de Quiroga 15, Belisario Domínguez, Tlalpan, CDMX', '55 5487 0900', 'https://www.incmnsz.mx', 'public', '3er nivel', '["Nutrición","Endocrinología","Gastroenterología","Infectología","Nefrología","Cirugía General"]', 'Lun-Vie 7:00-20:00, Urgencias 24h', 'Sur', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/INCMNSZ.jpg/1200px-INCMNSZ.jpg', 19.2925, -99.2222, 'Instituto de referencia nacional en nutrición, enfermedades metabólicas y enfermedades infecciosas.'),
('Instituto Nacional de Cardiología Ignacio Chávez', 'Juan Badiano 1, Belisario Domínguez Sección XVI, Tlalpan, CDMX', '55 5573 2911', 'https://www.cardiologia.org.mx', 'public', '3er nivel', '["Cardiología","Cirugía Cardiovascular","Electrofisiología","Hemodinámica","Cardiología Pediátrica"]', 'Lun-Vie 7:00-20:00, Urgencias 24h', 'Sur', 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Instituto_Nacional_de_Cardiología.jpg', 19.2932, -99.2174, 'Centro líder en cardiología y cirugía cardiovascular en América Latina.'),
('Hospital Infantil de México Federico Gómez', 'Dr. Márquez 162, Doctores, Cuauhtémoc, CDMX', '55 5228 9917', 'https://www.himfg.edu.mx', 'public', '3er nivel', '["Pediatría","Oncología Pediátrica","Cirugía Pediátrica","Neonatología","Neurología Pediátrica"]', 'Urgencias 24h', 'Centro', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/HospitalInfantildeMexico.jpg/800px-HospitalInfantildeMexico.jpg', 19.4156, -99.1513, 'Hospital pediátrico de referencia nacional, pionero en investigación y tratamiento infantil.'),
('Instituto Nacional de Cancerología (INCan)', 'Av. San Fernando 22, Belisario Domínguez, Tlalpan, CDMX', '55 5628 0400', 'https://www.incan.salud.gob.mx', 'public', '3er nivel', '["Oncología","Radioterapia","Quimioterapia","Cirugía Oncológica","Medicina Nuclear"]', 'Lun-Vie 7:00-20:00', 'Sur', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/INCan_Mexico.jpg/800px-INCan_Mexico.jpg', 19.2936, -99.2195, 'Centro de excelencia en el diagnóstico y tratamiento del cáncer en México.'),
('Centro Médico ABC Campus Observatorio', 'Sur 136 No. 116, Las Américas, Álvaro Obregón, CDMX', '55 5230 8000', 'https://www.centromedicoabc.com', 'private', '3er nivel', '["Cardiología","Oncología","Neurocirugía","Traumatología","Pediatría","Ginecología","Cirugía Robótica"]', '24 horas', 'Poniente', 'https://centromedicoabc.com/wp-content/uploads/2023/01/campus-observatorio.jpg', 19.3973, -99.1967, 'Hospital privado de clase mundial con tecnología de punta y certificación internacional.'),
('Centro Médico ABC Campus Santa Fe', 'Av. Carlos Graef Fernández 154, Santa Fe, CDMX', '55 1103 1600', 'https://www.centromedicoabc.com', 'private', '3er nivel', '["Urgencias","Traumatología","Cardiología","Oncología","Maternidad","Cirugía General"]', '24 horas', 'Poniente', 'https://centromedicoabc.com/wp-content/uploads/2023/01/campus-santa-fe.jpg', 19.3591, -99.2792, 'Campus moderno del ABC en la zona de Santa Fe con instalaciones de última generación.'),
('Hospital Ángeles Pedregal', 'Camino a Santa Teresa 1055, Heroes de Padierna, Magdalena Contreras, CDMX', '55 5449 5500', 'https://www.hospitalesangeles.com/pedregal', 'private', '3er nivel', '["Cardiología","Neurocirugía","Oncología","Ginecología","Urología","Ortopedia"]', '24 horas', 'Sur', 'https://www.hospitalesangeles.com/images/hospitales/pedregal.jpg', 19.3125, -99.2283, 'Parte de la red de Hospitales Ángeles, con amplia infraestructura y especialistas de alto nivel.'),
('Hospital Ángeles Lomas', 'Vialidad de la Barranca 240, Hacienda de las Palmas, Huixquilucan, Edo. Méx.', '55 5246 5000', 'https://www.hospitalesangeles.com/lomas', 'private', '3er nivel', '["Cardiología","Oncología","Traumatología","Neurocirugía","Pediatría","Ginecología"]', '24 horas', 'Poniente', 'https://www.hospitalesangeles.com/images/hospitales/lomas.jpg', 19.3936, -99.2863, 'Hospital de alta especialidad en la zona de Lomas con infraestructura de primer nivel.'),
('Hospital Español', 'Av. Ejército Nacional 613, Granada, Miguel Hidalgo, CDMX', '55 5255 9600', 'https://www.hespanol.com', 'private', '2do nivel', '["Medicina Interna","Cirugía General","Ginecología","Pediatría","Traumatología","Cardiología"]', '24 horas', 'Poniente', 'https://www.hespanol.com/images/hospital-fachada.jpg', 19.4375, -99.1847, 'Institución con más de 100 años de tradición médica en la Ciudad de México.'),
('Hospital Médica Sur', 'Puente de Piedra 150, Toriello Guerra, Tlalpan, CDMX', '55 5424 7200', 'https://www.medicasur.com.mx', 'private', '3er nivel', '["Oncología","Trasplantes","Cardiología","Neurocirugía","Gastroenterología","Neumología"]', '24 horas', 'Sur', 'https://www.medicasur.com.mx/images/fachada.jpg', 19.3036, -99.1633, 'Hospital privado líder en trasplantes y tratamiento oncológico con certificación internacional.'),
('Instituto Nacional de Neurología y Neurocirugía Manuel Velasco Suárez', 'Insurgentes Sur 3877, La Fama, Tlalpan, CDMX', '55 5606 3822', 'https://www.innn.salud.gob.mx', 'public', '3er nivel', '["Neurología","Neurocirugía","Psiquiatría","Neuropsicología","Neurofisiología"]', 'Lun-Vie 7:00-20:00, Urgencias 24h', 'Sur', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/INNN.jpg/800px-INNN.jpg', 19.2814, -99.1647, 'Instituto de referencia nacional e internacional en neurociencias.'),
('Hospital General Dr. Manuel Gea González', 'Calz. de Tlalpan 4800, Belisario Domínguez, Tlalpan, CDMX', '55 4000 3000', 'https://www.hospitalgea.salud.gob.mx', 'public', '3er nivel', '["Cirugía Plástica","Dermatología","Cirugía General","Medicina Interna","Traumatología"]', 'Urgencias 24h', 'Sur', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/HospitalGeaGonzalez.jpg/800px-HospitalGeaGonzalez.jpg', 19.2978, -99.1506, 'Reconocido por su clínica de cirugía plástica reconstructiva y programa de quemados.'),
('Hospital 20 de Noviembre ISSSTE', 'Av. Félix Cuevas 540, Del Valle, Benito Juárez, CDMX', '55 5200 5003', 'https://www.gob.mx/issste', 'public', '3er nivel', '["Cardiología","Oncología","Trasplantes","Neurocirugía","Hematología","Medicina Interna"]', 'Urgencias 24h', 'Centro', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Hospital_20_de_Noviembre.jpg/800px-Hospital_20_de_Noviembre.jpg', 19.3722, -99.1722, 'Centro médico del ISSSTE de alta especialidad con programa de trasplantes.'),
('Hospital Star Médica Centro', 'Av. Juárez 64, Centro Histórico, Cuauhtémoc, CDMX', '55 1084 5600', 'https://www.starmedica.com', 'private', '2do nivel', '["Urgencias","Medicina Interna","Cirugía General","Ginecología","Traumatología"]', '24 horas', 'Centro', 'https://www.starmedica.com/images/centro.jpg', 19.4333, -99.1425, 'Hospital privado en el corazón de la ciudad con atención de urgencias 24 horas.'),
('Hospital Ángeles México', 'Agrarismo 208, Escandón, Miguel Hidalgo, CDMX', '55 5516 9260', 'https://www.hospitalesangeles.com/mexico', 'private', '3er nivel', '["Cardiología","Oncología","Neurología","Traumatología","Cirugía General","Urología"]', '24 horas', 'Poniente', 'https://www.hospitalesangeles.com/images/hospitales/mexico.jpg', 19.4028, -99.1786, 'Hospital de especialidades con unidad de terapia intensiva y quirófanos de última generación.'),
('Instituto Nacional de Pediatría', 'Insurgentes Sur 3700-C, Insurgentes Cuicuilco, Coyoacán, CDMX', '55 1084 0900', 'https://www.pediatria.gob.mx', 'public', '3er nivel', '["Pediatría","Oncología Pediátrica","Cardiología Pediátrica","Genética","Inmunología"]', 'Lun-Vie 7:00-20:00, Urgencias 24h', 'Sur', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/INP_Mexico.jpg/800px-INP_Mexico.jpg', 19.3006, -99.1758, 'Instituto de referencia en atención pediátrica especializada y sub-especialidades.'),
('Hospital La Raza IMSS', 'Calz. Vallejo esq. Jacarandas, La Raza, Azcapotzalco, CDMX', '55 5724 5900', 'https://www.imss.gob.mx', 'public', '3er nivel', '["Oncología","Trasplantes","Cardiología","Neurocirugía","Pediatría","Urgencias"]', 'Urgencias 24h', 'Norte', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Hospital_La_Raza.jpg/800px-Hospital_La_Raza.jpg', 19.4694, -99.1531, 'Centro médico emblemático del IMSS con programa de trasplantes y oncología.'),
('Hospital Siglo XXI IMSS', 'Av. Cuauhtémoc 330, Doctores, Cuauhtémoc, CDMX', '55 5627 6900', 'https://www.imss.gob.mx', 'public', '3er nivel', '["Traumatología","Cardiología","Oncología","Neurocirugía","Medicina Interna","Urgencias"]', 'Urgencias 24h', 'Centro', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/CMN_Siglo_XXI.jpg/800px-CMN_Siglo_XXI.jpg', 19.4061, -99.1533, 'Centro Médico Nacional Siglo XXI, uno de los complejos hospitalarios más importantes de América Latina.'),
('Hospital Christus Muguerza Alta Especialidad', 'Av. Hidalgo 2525, Obispado, Monterrey, N.L.', '81 8399 3400', 'https://www.christusmuguerza.com.mx', 'private', '3er nivel', '["Cardiología","Oncología","Neurocirugía","Trasplantes","Traumatología","Medicina Interna"]', '24 horas', 'Norte', 'https://www.christusmuguerza.com.mx/images/alta-especialidad.jpg', 25.6714, -100.3353, 'Hospital de alta especialidad en Monterrey con tecnología de vanguardia y atención integral.');

-- ==========================================
-- SEED DATA: MARKETPLACE CATEGORIES
-- ==========================================
INSERT INTO public.marketplace_categories (name_es, name_en, icon, sort_order) VALUES
('Instrumental Quirúrgico', 'Surgical Instruments', 'Scissors', 1),
('Equipo de Diagnóstico', 'Diagnostic Equipment', 'Stethoscope', 2),
('Insumos de Laboratorio', 'Laboratory Supplies', 'FlaskConical', 3),
('Equipo de Protección', 'Protective Equipment', 'Shield', 4),
('Mobiliario Médico', 'Medical Furniture', 'Armchair', 5),
('Farmacéuticos', 'Pharmaceuticals', 'Pill', 6),
('Imagenología', 'Imaging', 'ScanLine', 7),
('Rehabilitación', 'Rehabilitation', 'HeartPulse', 8);

-- ==========================================
-- SEED DATA: MARKETPLACE VENDORS (approved)
-- ==========================================
INSERT INTO public.marketplace_vendors (name, description, logo_url, website, phone, location, status) VALUES
('Medline México', 'Distribuidor global de insumos médicos y quirúrgicos con presencia en más de 125 países.', 'https://www.medline.com/images/logo.svg', 'https://www.medline.com/mx', '55 5000 1234', 'CDMX, México', 'approved'),
('3M Salud México', 'División de productos para la salud de 3M, líder en cintas quirúrgicas, apósitos y equipos de monitoreo.', 'https://multimedia.3m.com/mws/media/1706463O/3m-logo.png', 'https://www.3m.com.mx/healthcare', '55 5270 2222', 'Estado de México', 'approved'),
('BD México (Becton Dickinson)', 'Líder mundial en tecnología médica: jeringas, agujas, catéteres y sistemas de diagnóstico.', 'https://www.bd.com/assets/images/logo-bd.svg', 'https://www.bd.com/es-mx', '55 5999 8000', 'CDMX, México', 'approved'),
('Degasa', 'Fabricante mexicano líder de algodón, gasas, vendajes y material de curación desde 1951.', NULL, 'https://www.degasa.com', '33 3668 1818', 'Guadalajara, Jalisco', 'approved'),
('Hergom Medical', 'Distribuidor de equipo médico especializado: ultrasonido, monitores, ventiladores y mobiliario hospitalario.', NULL, 'https://www.hergom.com.mx', '55 5563 4200', 'CDMX, México', 'approved'),
('Productos Científicos SA (PROCISA)', 'Distribuidor de equipos de laboratorio, reactivos y consumibles para diagnóstico clínico.', NULL, 'https://www.procisa.com.mx', '55 5611 0078', 'CDMX, México', 'approved');

-- ==========================================
-- SEED DATA: MARKETPLACE PRODUCTS
-- ==========================================
INSERT INTO public.marketplace_products (vendor_id, name, description, category, price, currency, image_url, stock, is_active)
SELECT v.id, p.name, p.description, p.category, p.price, 'MXN', p.image_url, p.stock, true
FROM (VALUES
  ('Medline México', 'Kit de Sutura Quirúrgica', 'Kit completo de sutura con porta-agujas, pinzas y tijeras de acero inoxidable. Incluye 12 piezas.', 'Instrumental Quirúrgico', 2850.00, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400', 50),
  ('Medline México', 'Bata Quirúrgica Estéril', 'Bata desechable estéril nivel AAMI 3, puños de punto y cierre trasero. Caja de 20 piezas.', 'Equipo de Protección', 1200.00, 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=400', 200),
  ('3M Salud México', 'Estetoscopio Littmann Classic III', 'Estetoscopio de doble campana con tecnología de sintonización ajustable. Garantía de 5 años.', 'Equipo de Diagnóstico', 3500.00, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', 30),
  ('3M Salud México', 'Cinta Micropore 3M (12 rollos)', 'Cinta quirúrgica hipoalergénica de 2.5cm x 9.1m. Caja con 12 rollos.', 'Insumos de Laboratorio', 450.00, 'https://images.unsplash.com/photo-1583947581924-860bda6a26df?w=400', 500),
  ('BD México (Becton Dickinson)', 'Jeringa BD Ultra-Fine 1ml (100 pzas)', 'Jeringas de insulina con aguja integrada 31G x 8mm. Caja de 100 unidades.', 'Insumos de Laboratorio', 890.00, 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400', 300),
  ('BD México (Becton Dickinson)', 'Catéter IV BD Insyte 20G', 'Catéter intravenoso con aletas de fijación y válvula anti-reflujo. Caja de 50 unidades.', 'Insumos de Laboratorio', 1650.00, 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=400', 150),
  ('Degasa', 'Gasa Estéril 10x10cm (200 sobres)', 'Gasa de algodón 100% estéril en sobres individuales. Caja de 200 sobres de 5 piezas cada uno.', 'Insumos de Laboratorio', 380.00, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', 1000),
  ('Degasa', 'Algodón Plisado 500g', 'Algodón absorbente de alta calidad para uso médico y quirúrgico.', 'Insumos de Laboratorio', 120.00, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400', 800),
  ('Hergom Medical', 'Monitor de Signos Vitales Multiparámetro', 'Monitor portátil con ECG, SpO2, NIBP y temperatura. Pantalla a color de 12 pulgadas.', 'Equipo de Diagnóstico', 45000.00, 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=400', 10),
  ('Hergom Medical', 'Camilla de Exploración Hidráulica', 'Camilla con ajuste hidráulico de altura, respaldo reclinable y porta-rollo integrado.', 'Mobiliario Médico', 18500.00, 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=400', 15),
  ('Productos Científicos SA (PROCISA)', 'Centrífuga Clínica 12 Tubos', 'Centrífuga de sobremesa para 12 tubos, velocidad variable hasta 4000 RPM con temporizador digital.', 'Insumos de Laboratorio', 12800.00, 'https://images.unsplash.com/photo-1582719471384-894fbb16f461?w=400', 8),
  ('Productos Científicos SA (PROCISA)', 'Microscopio Binocular LED', 'Microscopio binocular con iluminación LED, 4 objetivos (4x/10x/40x/100x) y platina mecánica.', 'Equipo de Diagnóstico', 8900.00, 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400', 12)
) AS p(vendor_name, name, description, category, price, image_url, stock)
JOIN public.marketplace_vendors v ON v.name = p.vendor_name;
