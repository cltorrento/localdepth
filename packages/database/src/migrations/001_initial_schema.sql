-- LocalDepth Database Schema
-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- Users & Roles Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'editor', -- admin, editor, author, brand
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- Destinations Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- country, region, city
  parent_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
  country VARCHAR(255) NOT NULL,
  description TEXT,
  hero_image_id UUID,
  hero_image_url TEXT,
  best_time_to_visit VARCHAR(255),
  currency VARCHAR(10) DEFAULT 'EUR',
  language VARCHAR(50),
  average_daily_budget NUMERIC(10, 2),
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, published
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_destinations_slug ON destinations(slug);
CREATE INDEX IF NOT EXISTS idx_destinations_status ON destinations(status);

-- -------------------------------------------------------------
-- Places Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- attraction, restaurant, hotel, transport, neighborhood, experience
  description JSONB,
  address TEXT,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  zoom INTEGER DEFAULT 15,
  google_maps_url TEXT,
  apple_maps_url TEXT,
  open_street_map_url TEXT,
  price_level SMALLINT CHECK (price_level BETWEEN 1 AND 4),
  opening_hours JSONB,
  images JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  affiliate_id UUID,
  affiliate_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  seo_title VARCHAR(255),
  seo_description TEXT,
  
  -- LocalDepth Proprietary Metrics
  local_score NUMERIC(3, 1),
  value_score NUMERIC(3, 1),
  crowd_level VARCHAR(20), -- low, moderate, high
  best_time VARCHAR(100),
  walkability BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_places_slug ON places(slug);
CREATE INDEX IF NOT EXISTS idx_places_destination_id ON places(destination_id);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);

-- -------------------------------------------------------------
-- Guides Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT,
  content JSONB,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  guide_type VARCHAR(50) NOT NULL DEFAULT 'general',
  duration_days INTEGER,
  estimated_budget NUMERIC(10, 2),
  difficulty VARCHAR(20), -- easy, moderate, hard
  hero_image_id UUID,
  hero_image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  places JSONB DEFAULT '[]'::jsonb,
  faqs JSONB DEFAULT '[]'::jsonb,
  related JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  seo_title VARCHAR(255),
  seo_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guides_slug ON guides(slug);
CREATE INDEX IF NOT EXISTS idx_guides_destination_id ON guides(destination_id);
CREATE INDEX IF NOT EXISTS idx_guides_status ON guides(status);

-- -------------------------------------------------------------
-- Itineraries Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  total_days INTEGER NOT NULL,
  total_budget NUMERIC(10, 2),
  summary TEXT,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  guide_id UUID REFERENCES guides(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_itineraries_slug ON itineraries(slug);
CREATE INDEX IF NOT EXISTS idx_itineraries_destination ON itineraries(destination_id);

-- -------------------------------------------------------------
-- Media Files Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  url TEXT NOT NULL,
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- Recommendations Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255),
  type VARCHAR(50) NOT NULL, -- place, guide, itinerary
  item_id UUID NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
