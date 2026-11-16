-- Row Level Security.
-- El backend se conecta con DATABASE_URL (rol postgres, que ignora RLS).
-- Activar RLS sin políticas bloquea el acceso directo desde la API REST de
-- Supabase con la clave anónima: las tablas solo son accesibles vía backend.
ALTER TABLE IF EXISTS users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS destinations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS places               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS guides               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS itineraries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recommendations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trip_leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS destination_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS destination_ratings  ENABLE ROW LEVEL SECURITY;
