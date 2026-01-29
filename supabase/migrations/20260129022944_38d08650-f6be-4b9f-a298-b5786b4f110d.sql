-- Crear usuarios ficticios para pruebas (insertando en auth.users directamente con el service role)
-- Nota: Estos son usuarios de prueba con contraseña hasheada genérica

-- Primero, creamos las entradas en auth.users usando una función especial
-- Ya que no podemos insertar directamente, usaremos los perfiles públicos existentes

-- Actualizar doctor existente con mejor información
UPDATE doctor_profiles 
SET bio = 'Cardiólogo certificado con más de 15 años de experiencia en diagnóstico y tratamiento de enfermedades cardiovasculares. Especialista en ecocardiografía y cateterismo.',
    location = 'Guadalajara, Jalisco',
    available_for_double_check = true,
    available_for_clinical_sessions = true,
    consultation_fee = 500,
    rating = 4.8,
    total_consultations = 150
WHERE user_id = '0d1158ad-2e89-49f3-9c2e-8b4a84af7a20';

UPDATE doctor_profiles 
SET specialty = 'Medicina General',
    bio = 'Médico general con amplia experiencia en atención primaria y medicina preventiva.',
    location = 'Ciudad de México',
    available_for_double_check = true,
    consultation_fee = 300,
    rating = 4.5,
    total_consultations = 89
WHERE user_id = '226c9f29-a9a8-4d41-b2a9-7ec5d9732bf7';

-- Actualizar el nombre para que sea más buscable
UPDATE profiles SET name = 'Dr. Ricardo Verificado' WHERE id = '226c9f29-a9a8-4d41-b2a9-7ec5d9732bf7';