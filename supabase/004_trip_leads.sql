-- Personalized itinerary requests are retained for one year.
CREATE TABLE IF NOT EXISTS trip_leads (
  id UUID PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  destination_slug VARCHAR(255) NOT NULL,
  travel_date DATE,
  total_days SMALLINT NOT NULL,
  budget_per_day NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  interests JSONB NOT NULL,
  pace VARCHAR(16) NOT NULL,
  avoid_crowds BOOLEAN NOT NULL DEFAULT FALSE,
  locale VARCHAR(2) NOT NULL,
  itinerary JSONB NOT NULL,
  itinerary_consent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  privacy_notice_version VARCHAR(20) NOT NULL,
  newsletter_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  newsletter_consent_at TIMESTAMPTZ,
  email_status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '12 months')
);

CREATE INDEX IF NOT EXISTS idx_trip_leads_expires_at ON trip_leads (expires_at);
