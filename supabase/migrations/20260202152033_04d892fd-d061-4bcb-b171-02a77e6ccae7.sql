-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add a setting for OLX auto-sync profile URL
INSERT INTO integrations_settings (key, value)
VALUES ('olx_auto_sync', '{"enabled": false, "profile_url": null, "last_sync_at": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;