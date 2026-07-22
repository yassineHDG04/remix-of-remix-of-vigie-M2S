"""Couche d'accès aux données (repository) — Option A.

Le moteur métier (engine.py) ne connaît QUE ce module. Deux implémentations
interchangeables selon la config :

  * SqlRepo       : SQLAlchemy (SQLite en dev/mock, ou Postgres via DATABASE_URL).
  * SupabaseRepo  : API Supabase (supabase-py) avec la service role key.
                    -> écrit dans la MÊME base que le frontend Lovable Cloud,
                       sans connexion Postgres directe.

On choisit via config.use_supabase. La logique d'escalade reste identique ;
seule la façon de lire/écrire change.

Toutes les dates échangées sont des datetime NAIFS en UTC (comme le moteur).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from .config import config
from .time_utils import parse_utc_datetime, utcnow


# ============================================================
#  Dataclasses (objets "plats", sans ORM ni relations)
# ============================================================
@dataclass
class SettingsRow:
    id: int
    nb_relances_ia: int
    relance1_min: int
    relance2_min: int
    relance3_min: int
    relance4_min: int
    humain_min: int
    retry_interval_min: int
    max_attempts: int
    call_window_start: str
    call_window_end: str
    sla_hours: float
    zineb_whatsapp: str
    selected_whatsapp_id: Optional[str] = None
    sip_trunk_id: str = ""
    sip_caller_id: str = ""
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    openai_api_key: str = ""
    vigie_api_base_url: str = ""
    agent_max_call_seconds: int = 60
    agent_max_response_tokens: int = 200
    agent_max_turns: int = 6
    voice_engine: str = "realtime"
    realtime_model: str = "gpt-realtime"
    stt_provider: str = "openai"
    stt_model: str = "gpt-4o-mini-transcribe"
    stt_language: str = "ar"
    llm_model: str = "gpt-4o-mini"
    tts_provider: str = "openai"
    tts_model: str = "gpt-4o-mini-tts"
    tts_voice_id: str = "ash"
    m2s_sync_mode: str = ""
    m2s_dossiers_api_url: str = ""
    m2s_poll_interval_seconds: int = 300
    call_channel: str = "sip"
    whatsapp_max_attempts: int = 2


@dataclass
class WhatsappContactRow:
    id: str
    label: str
    numero: str
    whatsapp_token: str
    whatsapp_phone_number_id: str


@dataclass
class DossierRow:
    id: str
    ref_m2s: str
    constateur_id: str
    constateur_nom: str
    constateur_telephone: str
    constateur_zone: str
    arrival_at: datetime
    sla_hours: float
    deadline_at: datetime
    status: str
    current_stage: int
    stage_attempts: int
    stage_answered: int
    next_action_at: Optional[datetime]
    handoff_reason: Optional[str]
    validated_at: Optional[datetime]
    handoff_acknowledged_at: Optional[datetime] = None
    handoff_acknowledged_by: Optional[str] = None
    matricule: str = ""
    num_tel_client: str = ""
    nom_assurance: str = ""
    adresse: str = ""
    zone: str = ""
    assure: str = ""
    vehicule: str = ""
    date_sinistre: Optional[datetime] = None


@dataclass
class CallRow:
    id: str
    dossier_id: str
    stage: int
    attempt_no: int
    started_at: datetime
    ended_at: Optional[datetime]
    duration_sec: int
    status: str
    outcome: Optional[str]
    delay_reason: Optional[str]
    delay_category: Optional[str]
    provider_ref: Optional[str]
    voice_engine_used: Optional[str] = None
    models_used: Optional[dict] = None
    estimated_cost_usd: float = 0.0
    call_channel_used: Optional[str] = None
    fallback_reason: Optional[str] = None
    provider_connected_at: Optional[datetime] = None
    estimated_transport_cost_usd: float = 0.0


@dataclass
class TranscriptRow:
    turn_no: int
    speaker: str
    text: str
    ts: datetime


# ============================================================
#  Utils datetime
# ============================================================
def _parse_dt(v) -> Optional[datetime]:
    return parse_utc_datetime(v)


def _iso(v: Optional[datetime]) -> Optional[str]:
    return v.isoformat() if v else None


# ============================================================
#  SqlRepo — SQLAlchemy (dev/mock local)
# ============================================================
class SqlRepo:
    def __init__(self):
        from .database import Base, engine, SessionLocal
        self._Session = SessionLocal
        self._engine = engine
        self._Base = Base

    # -- helpers de conversion ORM -> dataclass --
    @staticmethod
    def _dossier(d) -> DossierRow:
        c = d.constateur
        return DossierRow(
            id=d.id, ref_m2s=d.ref_m2s, constateur_id=d.constateur_id,
            constateur_nom=c.nom if c else "", constateur_telephone=c.telephone if c else "",
            constateur_zone=c.zone if c else "",
            arrival_at=d.arrival_at, sla_hours=d.sla_hours, deadline_at=d.deadline_at,
            status=d.status, current_stage=d.current_stage, stage_attempts=d.stage_attempts,
            stage_answered=d.stage_answered, next_action_at=d.next_action_at,
            handoff_reason=d.handoff_reason, validated_at=d.validated_at,
            handoff_acknowledged_at=getattr(d, "handoff_acknowledged_at", None),
            handoff_acknowledged_by=getattr(d, "handoff_acknowledged_by", None),
            matricule=getattr(d, "matricule", "") or "",
            num_tel_client=getattr(d, "num_tel_client", "") or "",
            nom_assurance=getattr(d, "nom_assurance", "") or "",
            adresse=getattr(d, "adresse", "") or "",
            zone=getattr(d, "zone", "") or "",
            assure=getattr(d, "assure", "") or "",
            vehicule=getattr(d, "vehicule", "") or "",
            date_sinistre=getattr(d, "date_sinistre", None),
        )

    @staticmethod
    def _call(c) -> CallRow:
        return CallRow(
            id=c.id, dossier_id=c.dossier_id, stage=c.stage, attempt_no=c.attempt_no,
            started_at=c.started_at, ended_at=c.ended_at, duration_sec=c.duration_sec,
            status=c.status, outcome=c.outcome, delay_reason=c.delay_reason,
            delay_category=c.delay_category, provider_ref=c.provider_ref,
            voice_engine_used=getattr(c, "voice_engine_used", None),
            models_used=getattr(c, "models_used", None) or {},
            estimated_cost_usd=getattr(c, "estimated_cost_usd", 0.0) or 0.0,
            call_channel_used=getattr(c, "call_channel_used", None),
            fallback_reason=getattr(c, "fallback_reason", None),
            provider_connected_at=getattr(c, "provider_connected_at", None),
            estimated_transport_cost_usd=(
                getattr(c, "estimated_transport_cost_usd", 0.0) or 0.0
            ),
        )

    # -- settings --
    def get_settings(self) -> SettingsRow:
        from .models import Settings
        with self._Session() as db:
            s = db.get(Settings, 1)
            if not s:
                s = Settings(id=1, zineb_whatsapp=config.zineb_whatsapp)
                db.add(s); db.commit(); db.refresh(s)
            return SettingsRow(
                id=s.id, nb_relances_ia=s.nb_relances_ia, relance1_min=s.relance1_min,
                relance2_min=s.relance2_min, relance3_min=s.relance3_min, relance4_min=s.relance4_min,
                humain_min=s.humain_min, retry_interval_min=s.retry_interval_min,
                max_attempts=s.max_attempts, call_window_start=s.call_window_start,
                call_window_end=s.call_window_end, sla_hours=s.sla_hours, zineb_whatsapp=s.zineb_whatsapp,
                selected_whatsapp_id=getattr(s, "selected_whatsapp_id", None),
                sip_trunk_id=getattr(s, "sip_trunk_id", "") or "",
                sip_caller_id=getattr(s, "sip_caller_id", "") or "",
                livekit_url=getattr(s, "livekit_url", "") or "",
                livekit_api_key=getattr(s, "livekit_api_key", "") or "",
                livekit_api_secret=getattr(s, "livekit_api_secret", "") or "",
                openai_api_key=getattr(s, "openai_api_key", "") or "",
                vigie_api_base_url=getattr(s, "vigie_api_base_url", "") or "",
                agent_max_call_seconds=getattr(s, "agent_max_call_seconds", 60) or 60,
                agent_max_response_tokens=getattr(s, "agent_max_response_tokens", 200) or 200,
                agent_max_turns=getattr(s, "agent_max_turns", 6) or 6,
                voice_engine=getattr(s, "voice_engine", "realtime") or "realtime",
                realtime_model=getattr(s, "realtime_model", "gpt-realtime") or "gpt-realtime",
                stt_provider=getattr(s, "stt_provider", "openai") or "openai",
                stt_model=getattr(s, "stt_model", "gpt-4o-mini-transcribe") or "gpt-4o-mini-transcribe",
                stt_language=getattr(s, "stt_language", "ar") or "ar",
                llm_model=getattr(s, "llm_model", "gpt-4o-mini") or "gpt-4o-mini",
                tts_provider=getattr(s, "tts_provider", "openai") or "openai",
                tts_model=getattr(s, "tts_model", "gpt-4o-mini-tts") or "gpt-4o-mini-tts",
                tts_voice_id=getattr(s, "tts_voice_id", "ash") or "ash",
                m2s_sync_mode=getattr(s, "m2s_sync_mode", "") or "",
                m2s_dossiers_api_url=getattr(s, "m2s_dossiers_api_url", "") or "",
                m2s_poll_interval_seconds=getattr(s, "m2s_poll_interval_seconds", 300) or 300,
                call_channel=getattr(s, "call_channel", "sip") or "sip",
                whatsapp_max_attempts=getattr(s, "whatsapp_max_attempts", 2) or 2,
            )

    def update_settings(self, values: dict) -> SettingsRow:
        from .models import Settings
        with self._Session() as db:
            s = db.get(Settings, 1)
            if not s:
                s = Settings(id=1); db.add(s)
            for k, v in values.items():
                setattr(s, k, v)
            db.commit()
        return self.get_settings()

    # -- dossiers --
    def list_dossiers(self, status: Optional[str] = None) -> list[DossierRow]:
        from .models import Dossier
        with self._Session() as db:
            q = db.query(Dossier)
            if status:
                q = q.filter(Dossier.status == status)
            return [self._dossier(d) for d in q.order_by(Dossier.deadline_at).all()]

    def get_dossier(self, dossier_id: str) -> Optional[DossierRow]:
        from .models import Dossier
        with self._Session() as db:
            d = db.get(Dossier, dossier_id)
            return self._dossier(d) if d else None

    def get_dossier_by_ref(self, ref_m2s: str) -> Optional[DossierRow]:
        from .models import Dossier
        with self._Session() as db:
            d = db.query(Dossier).filter_by(ref_m2s=ref_m2s).first()
            return self._dossier(d) if d else None

    def update_dossier(self, dossier_id: str, values: dict) -> None:
        from .models import Dossier
        with self._Session() as db:
            d = db.get(Dossier, dossier_id)
            if not d:
                return
            for k, v in values.items():
                setattr(d, k, v)
            db.commit()

    def get_or_create_constateur(self, nom: str, telephone: str, zone: str) -> str:
        from .models import Constateur
        with self._Session() as db:
            c = db.query(Constateur).filter_by(telephone=telephone).first()
            if not c:
                c = Constateur(nom=nom, telephone=telephone, zone=zone)
                db.add(c); db.commit(); db.refresh(c)
            return c.id

    def insert_dossier(self, values: dict) -> str:
        from .models import Dossier
        with self._Session() as db:
            d = Dossier(**values)
            db.add(d); db.commit(); db.refresh(d)
            return d.id

    def update_m2s_fields(self, dossier_id: str, values: dict) -> None:
        """Actualise les données métier reçues de M2S sur le schéma local."""
        allowed = {
            "assure", "num_tel_client", "matricule", "vehicule",
            "nom_assurance", "adresse", "zone", "date_sinistre",
            "constateur_id",
        }
        self.update_dossier(dossier_id, {k: v for k, v in values.items() if k in allowed})

    def apply_m2s_status(self, dossier_id: str, status: str) -> bool:
        """Applique une transition provenant exclusivement du canal M2S."""
        dossier = self.get_dossier(dossier_id)
        if not dossier or dossier.status == status:
            return False
        # Une validation est terminale : un polling incomplet ne doit jamais
        # rouvrir silencieusement un dossier déjà validé.
        if status != "valide" or dossier.status == "valide":
            return False
        self.update_dossier(dossier_id, {
            "status": "valide", "validated_at": datetime.utcnow(), "next_action_at": None,
        })
        return True

    def get_m2s_webhook_event(self, event_id: str) -> Optional[dict]:
        from .models import M2SWebhookEvent
        with self._Session() as db:
            event = db.get(M2SWebhookEvent, event_id)
            if not event:
                return None
            return {
                "event_id": event.event_id,
                "payload_sha256": event.payload_sha256,
                "processing_status": event.processing_status,
                "dossier_id": event.dossier_id,
                "received_at": event.received_at,
            }

    def claim_m2s_webhook_event(self, event_id: str, payload_sha256: str) -> bool:
        from sqlalchemy.exc import IntegrityError
        from .models import M2SWebhookEvent

        with self._Session() as db:
            existing = db.get(M2SWebhookEvent, event_id)
            if existing:
                stale_processing = (
                    existing.processing_status == "processing"
                    and (datetime.utcnow() - existing.received_at).total_seconds() >= 300
                )
                if (
                    existing.payload_sha256 == payload_sha256
                    and (existing.processing_status == "failed" or stale_processing)
                ):
                    existing.processing_status = "processing"
                    existing.error_message = None
                    existing.processed_at = None
                    existing.received_at = datetime.utcnow()
                    db.commit()
                    return True
                return False
            try:
                db.add(M2SWebhookEvent(event_id=event_id, payload_sha256=payload_sha256))
                db.commit()
                return True
            except IntegrityError:
                db.rollback()
                return False

    def complete_m2s_webhook_event(
        self, event_id: str, *, processing_status: str,
        dossier_id: str | None = None, error_message: str | None = None,
    ) -> None:
        from .models import M2SWebhookEvent
        with self._Session() as db:
            event = db.get(M2SWebhookEvent, event_id)
            if not event:
                return
            event.processing_status = processing_status
            event.dossier_id = dossier_id
            event.error_message = error_message
            event.processed_at = datetime.utcnow()
            db.commit()

    def acknowledge_handoff(self, dossier_id: str, by: str = "Zineb (WhatsApp)") -> Optional[DossierRow]:
        """Marque le hand-off humain comme pris en charge (ex. bouton WhatsApp)."""
        self.update_dossier(dossier_id, {
            "handoff_acknowledged_at": datetime.utcnow(), "handoff_acknowledged_by": by,
        })
        return self.get_dossier(dossier_id)

    # -- whatsapp contacts --
    def get_whatsapp_contact(self, contact_id: str) -> Optional[WhatsappContactRow]:
        from .models import WhatsappContact
        with self._Session() as db:
            c = db.get(WhatsappContact, contact_id)
            if not c:
                return None
            return WhatsappContactRow(
                id=c.id, label=c.label, numero=c.numero,
                whatsapp_token=c.whatsapp_token, whatsapp_phone_number_id=c.whatsapp_phone_number_id,
            )

    # -- suivi des alertes WhatsApp M2S --
    def record_whatsapp_alert(self, values: dict) -> None:
        """Enregistre une alerte sans faire régresser son statut existant."""
        from .models import WhatsappAlert

        payload = dict(values)
        for field in ("accepted_at", "sent_at", "delivered_at", "read_at", "failed_at"):
            if field in payload:
                payload[field] = _parse_dt(payload[field])

        with self._Session() as db:
            alert = (
                db.query(WhatsappAlert)
                .filter_by(dossier_id=payload["dossier_id"])
                .first()
            )

            if alert:
                # Une réponse idempotente ou une relance peut actualiser le
                # routage, mais ne doit pas remettre read/delivered à accepted.
                for key, value in payload.items():
                    if key not in {"status", "accepted_at", "id", "dossier_id"}:
                        setattr(alert, key, value)
                alert.updated_at = utcnow()
            else:
                alert = WhatsappAlert(**payload)
                db.add(alert)

            db.commit()

    def update_whatsapp_alert_status(
        self,
        m2s_message_id: str,
        status: str,
        event_id: str | None = None,
        event_at: datetime | None = None,
        failure_reason: str | None = None,
    ) -> bool:
        """Applique un événement M2S de façon idempotente et monotone."""
        from .models import WhatsappAlert

        normal_ranks = {"accepted": 0, "sent": 1, "delivered": 2, "read": 3}
        if status not in normal_ranks and status != "failed":
            return False

        with self._Session() as db:
            alert = (
                db.query(WhatsappAlert)
                .filter_by(m2s_message_id=m2s_message_id)
                .first()
            )
            if not alert:
                return False

            if event_id and alert.last_event_id == event_id:
                return True

            event_datetime = _parse_dt(event_at) or utcnow()
            last_event_datetime = _parse_dt(alert.last_event_at)
            if last_event_datetime and event_datetime < last_event_datetime:
                return True

            current_status = alert.status
            if current_status == status:
                return True
            if status == "failed" and current_status in {"delivered", "read"}:
                return True
            if status in normal_ranks and current_status in normal_ranks:
                if normal_ranks[status] <= normal_ranks[current_status]:
                    return True

            alert.status = status
            alert.last_event_id = event_id
            alert.last_event_at = event_datetime
            alert.updated_at = utcnow()

            timestamp_fields = {
                "sent": "sent_at",
                "delivered": "delivered_at",
                "read": "read_at",
                "failed": "failed_at",
            }
            timestamp_field = timestamp_fields.get(status)
            if timestamp_field and not getattr(alert, timestamp_field):
                setattr(alert, timestamp_field, event_datetime)

            if status == "failed":
                alert.failure_reason = failure_reason or "Échec WhatsApp non précisé"
            elif current_status == "failed":
                alert.failure_reason = None
                alert.failed_at = None

            db.commit()
            return True

    # -- calls --
    def list_calls(self, dossier_id: str) -> list[CallRow]:
        from .models import Call
        with self._Session() as db:
            rows = db.query(Call).filter_by(dossier_id=dossier_id).order_by(Call.started_at).all()
            return [self._call(c) for c in rows]

    def has_call_in_progress(self, dossier_id: str) -> bool:
        from .models import Call
        with self._Session() as db:
            return db.query(Call).filter_by(dossier_id=dossier_id, status="en_cours").first() is not None

    def get_call(self, call_id: str) -> Optional[CallRow]:
        from .models import Call
        with self._Session() as db:
            c = db.get(Call, call_id)
            return self._call(c) if c else None

    def get_call_by_provider_ref(self, provider_ref: str) -> Optional[CallRow]:
        from .models import Call
        with self._Session() as db:
            c = db.query(Call).filter_by(provider_ref=provider_ref).first()
            return self._call(c) if c else None

    def insert_call(self, values: dict) -> str:
        from .models import Call
        with self._Session() as db:
            c = Call(**values)
            db.add(c); db.commit(); db.refresh(c)
            return c.id

    def update_call(self, call_id: str, values: dict) -> None:
        from .models import Call
        with self._Session() as db:
            c = db.get(Call, call_id)
            if not c:
                return
            for k, v in values.items():
                setattr(c, k, v)
            db.commit()

    def insert_transcript(self, call_id: str, turns: list[dict]) -> None:
        from .models import TranscriptTurn
        if not turns:
            return
        with self._Session() as db:
            for i, t in enumerate(turns, start=1):
                db.add(TranscriptTurn(call_id=call_id, turn_no=i,
                                      speaker=t.get("speaker", "ia"), text=t.get("text", ""),
                                      ts=datetime.utcnow()))
            db.commit()

    def get_transcript(self, call_id: str) -> list[TranscriptRow]:
        from .models import TranscriptTurn
        with self._Session() as db:
            rows = db.query(TranscriptTurn).filter_by(call_id=call_id).order_by(TranscriptTurn.turn_no).all()
            return [TranscriptRow(turn_no=t.turn_no, speaker=t.speaker, text=t.text, ts=t.ts) for t in rows]

    # -- kpi helpers --
    def count_calls_since(self, since: datetime, status: Optional[str] = None) -> int:
        from .models import Call
        with self._Session() as db:
            q = db.query(Call).filter(Call.started_at >= since)
            if status:
                q = q.filter(Call.status == status)
            return q.count()


# ============================================================
#  SupabaseRepo — API Supabase (prod Lovable Cloud)
# ============================================================
class SupabaseRepo:
    """Implémentation via l'API Supabase.

    Lovable Cloud n'expose PAS la service role key : impossible de la récupérer,
    même via l'API de gestion du projet. On s'authentifie donc comme un compte
    de service ORDINAIRE (email + mot de passe, rôle admin dans user_roles),
    et on passe par les policies RLS déjà en place pour ce rôle — au lieu de
    les contourner avec une clé toute-puissante.

    Fonctionnement : create_client() prend la clé "anon" (publique, pas un
    secret — nécessaire pour l'en-tête apikey exigé par la passerelle Supabase).
    Ensuite sign_in_with_password() authentifie le compte moteur ; supabase-py
    met alors AUTOMATIQUEMENT à jour l'en-tête Authorization de toutes les
    requêtes suivantes (table(), etc.) avec le jeton de ce compte, y compris
    après un rafraîchissement automatique. Donc RLS voit auth.uid() = ce compte,
    avec role='admin' -> autorisé par les policies existantes.
    """

    def __init__(self):
        from supabase import create_client
        if not (config.supabase_url and config.supabase_anon_key):
            raise RuntimeError(
                "USE_SUPABASE=true mais SUPABASE_URL / SUPABASE_ANON_KEY manquent dans .env."
            )
        if not (config.supabase_service_email and config.supabase_service_password):
            raise RuntimeError(
                "USE_SUPABASE=true mais SUPABASE_SERVICE_EMAIL / SUPABASE_SERVICE_PASSWORD "
                "manquent dans .env (compte de service créé côté Lovable, voir README)."
            )
        self.sb = create_client(config.supabase_url, config.supabase_anon_key)
        self._sign_in()

    def _sign_in(self) -> None:
        res = self.sb.auth.sign_in_with_password({
            "email": config.supabase_service_email,
            "password": config.supabase_service_password,
        })
        if not (res and res.session and res.session.access_token):
            raise RuntimeError(
                "Échec de connexion du compte de service Supabase "
                f"({config.supabase_service_email}). Vérifie l'email/mot de passe, "
                "et que le compte a bien role='admin' dans user_roles."
            )

    def _ensure_session(self) -> None:
        """Filet de sécurité : si la session est absente/expirée malgré l'auto-refresh
        de supabase-py, on se reconnecte explicitement plutôt que d'échouer."""
        try:
            session = self.sb.auth.get_session()
        except Exception:
            session = None
        if not session:
            self._sign_in()

    def _tbl(self, name: str):
        """Point d'entrée unique vers une table : garantit une session valide
        avant chaque requête (filet de sécurité en plus de l'auto-refresh)."""
        self._ensure_session()
        return self.sb.table(name)

    # -- conversion JSON -> dataclass --
    @staticmethod
    def _dossier(r: dict) -> DossierRow:
        c = r.get("constateurs") or {}
        return DossierRow(
            id=r["id"], ref_m2s=r["ref_m2s"], constateur_id=r.get("constateur_id", ""),
            constateur_nom=c.get("nom", ""), constateur_telephone=c.get("telephone", ""),
            constateur_zone=c.get("zone", ""),
            arrival_at=_parse_dt(r["arrival_at"]), sla_hours=r.get("sla_hours", 6.0),
            deadline_at=_parse_dt(r["deadline_at"]), status=r["status"],
            current_stage=r.get("current_stage", 0), stage_attempts=r.get("stage_attempts", 0),
            stage_answered=r.get("stage_answered", 0), next_action_at=_parse_dt(r.get("next_action_at")),
            handoff_reason=r.get("handoff_reason"), validated_at=_parse_dt(r.get("validated_at")),
            handoff_acknowledged_at=_parse_dt(r.get("handoff_acknowledged_at")),
            handoff_acknowledged_by=r.get("handoff_acknowledged_by"),
            matricule=r.get("matricule") or "", num_tel_client=r.get("num_tel_client") or "",
            nom_assurance=r.get("nom_assurance") or "", adresse=r.get("adresse") or "",
            zone=r.get("zone") or "",
            assure=r.get("assure") or "", vehicule=r.get("vehicule") or "",
            date_sinistre=_parse_dt(r.get("date_sinistre")),
        )

    @staticmethod
    def _call(r: dict) -> CallRow:
        return CallRow(
            id=r["id"], dossier_id=r["dossier_id"], stage=r["stage"], attempt_no=r["attempt_no"],
            started_at=_parse_dt(r["started_at"]), ended_at=_parse_dt(r.get("ended_at")),
            duration_sec=r.get("duration_sec", 0), status=r["status"], outcome=r.get("outcome"),
            delay_reason=r.get("delay_reason"), delay_category=r.get("delay_category"),
            provider_ref=r.get("provider_ref"),
            voice_engine_used=r.get("voice_engine_used"),
            models_used=r.get("models_used") or {},
            estimated_cost_usd=float(r.get("estimated_cost_usd") or 0),
            call_channel_used=r.get("call_channel_used"),
            fallback_reason=r.get("fallback_reason"),
            provider_connected_at=_parse_dt(r.get("provider_connected_at")),
            estimated_transport_cost_usd=float(
                r.get("estimated_transport_cost_usd") or 0
            ),
        )

    # Vue aplatie construite pendant les TP 1 à 4. Elle conserve le contrat
    # historique de DossierRow tout en lisant les tables normalisées.
    _DOSSIER_SEL = "*"

    # -- settings --
    def get_settings(self) -> SettingsRow:
        res = self._tbl("settings").select("*").eq("id", 1).execute()
        if not res.data:
            self._tbl("settings").insert({"id": 1, "zineb_whatsapp": config.zineb_whatsapp}).execute()
            res = self._tbl("settings").select("*").eq("id", 1).execute()
        r = res.data[0]
        return SettingsRow(**{k: r[k] for k in SettingsRow.__dataclass_fields__ if k in r})

    def update_settings(self, values: dict) -> SettingsRow:
        self._tbl("settings").update(values).eq("id", 1).execute()
        return self.get_settings()

    # -- dossiers --
    def list_dossiers(self, status: Optional[str] = None) -> list[DossierRow]:
        q = self._tbl("v_dossiers_complets").select(self._DOSSIER_SEL).order("deadline_at")
        if status:
            q = q.eq("status", status)
        return [self._dossier(r) for r in (q.execute().data or [])]

    def get_dossier(self, dossier_id: str) -> Optional[DossierRow]:
        res = (
            self._tbl("v_dossiers_complets")
            .select(self._DOSSIER_SEL)
            .eq("id", dossier_id)
            .execute()
        )
        return self._dossier(res.data[0]) if res.data else None

    def get_dossier_by_ref(self, ref_m2s: str) -> Optional[DossierRow]:
        res = (
            self._tbl("v_dossiers_complets")
            .select(self._DOSSIER_SEL)
            .eq("ref_m2s", ref_m2s)
            .execute()
        )
        return self._dossier(res.data[0]) if res.data else None

    def update_dossier(self, dossier_id: str, values: dict) -> None:
        payload = {k: (_iso(v) if isinstance(v, datetime) else v) for k, v in values.items()}
        self._tbl("dossiers").update(payload).eq("id", dossier_id).execute()

    def get_or_create_constateur(self, nom: str, telephone: str, zone: str) -> str:
        res = self._tbl("constateurs").select("id").eq("telephone", telephone).execute()
        if res.data:
            return res.data[0]["id"]
        ins = self._tbl("constateurs").insert({"nom": nom, "telephone": telephone, "zone": zone}).execute()
        return ins.data[0]["id"]

    def insert_dossier(self, values: dict) -> str:
        payload = {
            "p_ref_m2s": values["ref_m2s"],
            "p_constateur_id": values["constateur_id"],
            "p_dossier_id": values.get("id"),
            "p_arrival_at": _iso(values.get("arrival_at")),
            "p_sla_hours": values.get("sla_hours", 24),
            "p_deadline_at": _iso(values.get("deadline_at")),
            "p_status": values.get("status", "en_retard"),
            "p_current_stage": values.get("current_stage", 0),
            "p_validated_at": _iso(values.get("validated_at")),
            "p_final_category": values.get("final_category"),
            "p_assure": values.get("assure", ""),
            "p_num_tel_client": values.get("num_tel_client", ""),
            "p_matricule": values.get("matricule", ""),
            "p_vehicule": values.get("vehicule", ""),
            "p_nom_assurance": values.get("nom_assurance", ""),
            "p_adresse": values.get("adresse", ""),
            "p_zone": values.get("zone", ""),
            "p_date_sinistre": _iso(values.get("date_sinistre")),
        }
        self._ensure_session()
        res = self.sb.rpc("create_dossier_normalise", payload).execute()
        created_id = res.data
        if isinstance(created_id, list):
            created_id = created_id[0] if created_id else None
        if not created_id:
            raise RuntimeError("La création normalisée du dossier n'a renvoyé aucun identifiant.")
        return str(created_id)

    def update_m2s_fields(self, dossier_id: str, values: dict) -> None:
        payload = {
            "p_dossier_id": dossier_id,
            "p_assure": values.get("assure", ""),
            "p_num_tel_client": values.get("num_tel_client", ""),
            "p_matricule": values.get("matricule", ""),
            "p_vehicule": values.get("vehicule", ""),
            "p_nom_assurance": values.get("nom_assurance", ""),
            "p_adresse": values.get("adresse", ""),
            "p_zone": values.get("zone", ""),
            "p_date_sinistre": _iso(values.get("date_sinistre")),
        }
        self._ensure_session()
        self.sb.rpc("update_dossier_m2s", payload).execute()
        if values.get("constateur_id"):
            self.update_dossier(dossier_id, {"constateur_id": values["constateur_id"]})

    def apply_m2s_status(self, dossier_id: str, status: str) -> bool:
        dossier = self.get_dossier(dossier_id)
        if not dossier or dossier.status == status:
            return False
        if status != "valide" or dossier.status == "valide":
            return False
        self.update_dossier(dossier_id, {
            "status": "valide", "validated_at": datetime.utcnow(), "next_action_at": None,
        })
        return True

    def get_m2s_webhook_event(self, event_id: str) -> Optional[dict]:
        result = (
            self._tbl("m2s_webhook_events")
            .select("event_id,payload_sha256,processing_status,dossier_id,received_at")
            .eq("event_id", event_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def claim_m2s_webhook_event(self, event_id: str, payload_sha256: str) -> bool:
        self._ensure_session()
        result = self.sb.rpc("claim_m2s_webhook_event", {
            "p_event_id": event_id,
            "p_payload_sha256": payload_sha256,
        }).execute()
        claimed = result.data
        if isinstance(claimed, list):
            claimed = claimed[0] if claimed else False
        return bool(claimed)

    def complete_m2s_webhook_event(
        self, event_id: str, *, processing_status: str,
        dossier_id: str | None = None, error_message: str | None = None,
    ) -> None:
        self._tbl("m2s_webhook_events").update({
            "processing_status": processing_status,
            "dossier_id": dossier_id,
            "error_message": error_message,
            "processed_at": _iso(datetime.utcnow()),
        }).eq("event_id", event_id).execute()

    def acknowledge_handoff(self, dossier_id: str, by: str = "Zineb (WhatsApp)") -> Optional[DossierRow]:
        """Marque le hand-off humain comme pris en charge (ex. bouton WhatsApp)."""
        self.update_dossier(dossier_id, {
            "handoff_acknowledged_at": datetime.utcnow(), "handoff_acknowledged_by": by,
        })
        return self.get_dossier(dossier_id)

    # -- whatsapp contacts --
    def get_whatsapp_contact(self, contact_id: str) -> Optional[WhatsappContactRow]:
        res = self._tbl("whatsapp_contacts").select("*").eq("id", contact_id).execute()
        if not res.data:
            return None
        r = res.data[0]
        return WhatsappContactRow(
            id=r["id"], label=r.get("label", ""),
            numero=r.get("number_whatsapp", "") or r.get("numero", ""),
            whatsapp_token=r.get("whatsapp_token", "") or r.get("WHATSAPP_TOKEN", ""),
            whatsapp_phone_number_id=r.get("whatsapp_phone_number_id", "") or r.get("WHATSAPP_PHONE_NUMBER_ID", ""),
        )
    # -- suivi des alertes WhatsApp M2S --
    def record_whatsapp_alert(self, values: dict) -> None:
        """Crée le lien entre un dossier Vigie et le message M2S envoyé.

        Si le dossier possède déjà une alerte, seules les informations de
        routage sont actualisées : un statut read/delivered existant ne doit
        jamais être remis à accepted.
        """
        existing = (
            self._tbl("whatsapp_alerts")
            .select("id, status")
            .eq("dossier_id", values["dossier_id"])
            .limit(1)
            .execute()
        )

        payload = {
            key: (_iso(value) if isinstance(value, datetime) else value)
            for key, value in values.items()
        }

        if existing.data:
            payload.pop("status", None)
            payload.pop("accepted_at", None)

            (
                self._tbl("whatsapp_alerts")
                .update(payload)
                .eq("id", existing.data[0]["id"])
                .execute()
            )
            return

        self._tbl("whatsapp_alerts").insert(payload).execute()

    def update_whatsapp_alert_status(
        self,
        m2s_message_id: str,
        status: str,
        event_id: str | None = None,
        event_at: datetime | None = None,
        failure_reason: str | None = None,
    ) -> bool:
        """
        Met à jour le statut d'une alerte WhatsApp sans régression.

        - Ignore un événement déjà traité.
        - Ignore les doublons de statut.
        - Empêche delivered -> sent et read -> delivered.
        - Autorise failed -> sent/delivered/read après une relance réussie.
        """
        normal_ranks = {
            "accepted": 0,
            "sent": 1,
            "delivered": 2,
            "read": 3,
        }

        if status not in normal_ranks and status != "failed":
            return False

        result = (
            self._tbl("whatsapp_alerts")
            .select(
                "id,status,sent_at,delivered_at,read_at,failed_at,"
                "failure_reason,last_event_id,last_event_at"
            )
            .eq("m2s_message_id", m2s_message_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            return False

        current = result.data[0]
        current_status = current.get("status")

        # Même événement renvoyé par M2S
        if event_id and current.get("last_event_id") == event_id:
            return True

        event_datetime = _parse_dt(event_at) or utcnow()
        last_event_datetime = _parse_dt(current.get("last_event_at"))

        # Événement plus ancien que celui déjà traité
        if last_event_datetime and event_datetime < last_event_datetime:
            return True

        # Même statut reçu plusieurs fois
        if current_status == status:
            return True

        # Un échec tardif ne doit pas remplacer delivered ou read
        if status == "failed" and current_status in {"delivered", "read"}:
            return True

        # Empêcher toute régression : read -> delivered, delivered -> sent, etc.
        if status in normal_ranks and current_status in normal_ranks:
            if normal_ranks[status] <= normal_ranks[current_status]:
                return True

        payload = {
            "status": status,
            "last_event_id": event_id,
            "last_event_at": _iso(event_datetime),
        }

        timestamp_columns = {
            "sent": "sent_at",
            "delivered": "delivered_at",
            "read": "read_at",
            "failed": "failed_at",
        }

        timestamp_column = timestamp_columns.get(status)

        # Conserver la date du premier passage dans chaque statut
        if timestamp_column and not current.get(timestamp_column):
            payload[timestamp_column] = _iso(event_datetime)

        if status == "failed":
            payload["failure_reason"] = failure_reason or "Échec WhatsApp non précisé"

        elif current_status == "failed":
            # La relance a réussi : supprimer l'erreur courante
            payload["failure_reason"] = None
            payload["failed_at"] = None

        (
            self._tbl("whatsapp_alerts")
            .update(payload)
            .eq("id", current["id"])
            .execute()
        )

        return True
    # -- calls --
    def list_calls(self, dossier_id: str) -> list[CallRow]:
        res = self._tbl("calls").select("*").eq("dossier_id", dossier_id).order("started_at").execute()
        return [self._call(r) for r in (res.data or [])]

    def has_call_in_progress(self, dossier_id: str) -> bool:
        res = self._tbl("calls").select("id").eq("dossier_id", dossier_id).eq("status", "en_cours").execute()
        return bool(res.data)

    def get_call(self, call_id: str) -> Optional[CallRow]:
        res = self._tbl("calls").select("*").eq("id", call_id).execute()
        return self._call(res.data[0]) if res.data else None

    def get_call_by_provider_ref(self, provider_ref: str) -> Optional[CallRow]:
        res = self._tbl("calls").select("*").eq("provider_ref", provider_ref).execute()
        return self._call(res.data[0]) if res.data else None

    def insert_call(self, values: dict) -> str:
        payload = {k: (_iso(v) if isinstance(v, datetime) else v) for k, v in values.items()}
        ins = self._tbl("calls").insert(payload).execute()
        return ins.data[0]["id"]

    def update_call(self, call_id: str, values: dict) -> None:
        payload = {k: (_iso(v) if isinstance(v, datetime) else v) for k, v in values.items()}
        self._tbl("calls").update(payload).eq("id", call_id).execute()

    def insert_transcript(self, call_id: str, turns: list[dict]) -> None:
        if not turns:
            return
        now = datetime.utcnow()
        rows = [{"call_id": call_id, "turn_no": i, "speaker": t.get("speaker", "ia"),
                 "text": t.get("text", ""), "ts": _iso(now)} for i, t in enumerate(turns, start=1)]
        self._tbl("transcript_turns").insert(rows).execute()

    def get_transcript(self, call_id: str) -> list[TranscriptRow]:
        res = self._tbl("transcript_turns").select("turn_no, speaker, text, ts") \
            .eq("call_id", call_id).order("turn_no").execute()
        return [TranscriptRow(turn_no=r["turn_no"], speaker=r["speaker"], text=r["text"],
                              ts=_parse_dt(r["ts"])) for r in (res.data or [])]

    # -- kpi helpers --
    def count_calls_since(self, since: datetime, status: Optional[str] = None) -> int:
        q = self._tbl("calls").select("id", count="exact").gte("started_at", _iso(since))
        if status:
            q = q.eq("status", status)
        return q.execute().count or 0


# ============================================================
#  Sélection de l'implémentation
# ============================================================
_repo = None


def get_repo():
    global _repo
    if _repo is None:
        _repo = SupabaseRepo() if config.use_supabase else SqlRepo()
    return _repo


def new_uuid() -> str:
    return str(uuid.uuid4())
