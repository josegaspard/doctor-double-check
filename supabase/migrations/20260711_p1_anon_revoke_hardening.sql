-- P1-1 · Endurecimiento (defensa en profundidad): revoca escrituras innecesarias
-- del rol anon sobre las tablas de public. Supabase concede ALL a anon/authenticated
-- por default y hoy el ÚNICO control es RLS; esto añade una segunda capa: aunque
-- alguien introduzca por error una policy permisiva, anon no podrá escribir.
-- NO toca SELECT (las páginas públicas: news, landing, etc. siguen leyendo vía RLS).
-- NO toca authenticated (la app sigue funcionando igual).
-- Reversible: GRANT INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO anon;

-- Quita escritura de datos y operaciones peligrosas a usuarios anónimos.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;

-- Que las tablas futuras nazcan igual de restringidas para anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon;
