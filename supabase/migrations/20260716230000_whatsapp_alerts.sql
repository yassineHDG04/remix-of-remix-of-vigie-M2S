-- Suivi idempotent des alertes de hand-off envoyées via la plateforme m2s-api.
-- Cette table permet au backend de rapprocher chaque webhook de statut du
-- dossier Vigie qui a déclenché le message WhatsApp.

CREATE TABLE IF NOT EXISTS public.whatsapp_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL UNIQUE
    REFERENCES public.dossiers(id) ON DELETE CASCADE,
  whatsapp_contact_id uuid
    REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  m2s_message_id text NOT NULL UNIQUE,
  instance_id text NOT NULL DEFAULT '',
  recipient text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'sent', 'delivered', 'read', 'failed')),
  failure_reason text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  last_event_id text,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_alerts_status_idx
  ON public.whatsapp_alerts(status);
CREATE INDEX IF NOT EXISTS whatsapp_alerts_last_event_at_idx
  ON public.whatsapp_alerts(last_event_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_alerts TO authenticated;
GRANT ALL ON public.whatsapp_alerts TO service_role;
ALTER TABLE public.whatsapp_alerts ENABLE ROW LEVEL SECURITY;

-- Les administrateurs/superviseurs peuvent consulter le suivi dans Vigie.
DROP POLICY IF EXISTS whatsapp_alerts_read_roles ON public.whatsapp_alerts;
CREATE POLICY whatsapp_alerts_read_roles
  ON public.whatsapp_alerts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'superviseur')
  );

-- Seul le compte moteur interne (ou service_role) écrit les statuts provenant
-- de m2s-api. Le frontend ne peut donc pas fabriquer un accusé de lecture.
DROP POLICY IF EXISTS whatsapp_alerts_service_insert ON public.whatsapp_alerts;
CREATE POLICY whatsapp_alerts_service_insert
  ON public.whatsapp_alerts FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
      COALESCE(auth.jwt() ->> 'email', '') = 'moteur@vigie.internal'
      AND public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS whatsapp_alerts_service_update ON public.whatsapp_alerts;
CREATE POLICY whatsapp_alerts_service_update
  ON public.whatsapp_alerts FOR UPDATE TO authenticated
  USING (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
      COALESCE(auth.jwt() ->> 'email', '') = 'moteur@vigie.internal'
      AND public.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    COALESCE(auth.role(), '') = 'service_role'
    OR (
      COALESCE(auth.jwt() ->> 'email', '') = 'moteur@vigie.internal'
      AND public.has_role(auth.uid(), 'admin')
    )
  );

DROP TRIGGER IF EXISTS set_whatsapp_alerts_updated_at ON public.whatsapp_alerts;
CREATE TRIGGER set_whatsapp_alerts_updated_at
  BEFORE UPDATE ON public.whatsapp_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.whatsapp_alerts IS
  'Suivi des alertes de hand-off envoyées par Vigie via la plateforme m2s-api.';
