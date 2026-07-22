"""Notifications de hand-off humain via M2S API WhatsApp."""

from __future__ import annotations

import logging
import re
import uuid

import httpx

from ..config import config
from ..time_utils import utcnow

log = logging.getLogger("vigie.whatsapp")


_REASON_LABELS = {
    "sla_echu": "SLA arrivé à échéance",
    "seuil_1h": "Seuil d'intervention humaine atteint",
    "tentatives_epuisees": "Tentatives automatiques épuisées",
}


def _digits(value: str) -> str:
    """Conserve uniquement les chiffres d'un numéro de téléphone."""
    return re.sub(r"\D", "", value or "")


def _resolve_target() -> tuple[str, str, str]:
    """Retourne le destinataire, la clé M2S API et l'instance expéditrice.

    Priorité :
    1. profil sélectionné dans la liste déroulante de Nida'a ;
    2. valeurs du fichier .env comme solution de secours.

    Les anciennes colonnes whatsapp_token et whatsapp_phone_number_id
    sont réutilisées respectivement pour la clé API M2S et l'ID d'instance.
    """
    from ..repo import get_repo

    try:
        repo = get_repo()
        settings = repo.get_settings()

        if settings.selected_whatsapp_id:
            contact = repo.get_whatsapp_contact(settings.selected_whatsapp_id)

            if contact and contact.numero:
                return (
                    contact.numero,
                    (
                        contact.whatsapp_token
                        or config.m2s_whatsapp_api_key
                    ).strip(),
                    (
                        contact.whatsapp_phone_number_id
                        or config.m2s_whatsapp_instance_id
                    ).strip(),
                )

    except Exception:
        log.exception(
            "Impossible de récupérer le profil WhatsApp sélectionné. "
            "Utilisation de la configuration .env."
        )

    return (
        config.zineb_whatsapp,
        config.m2s_whatsapp_api_key.strip(),
        config.m2s_whatsapp_instance_id.strip(),
    )

def _build_message(
    ref_m2s: str,
    constateur_nom: str,
    telephone: str,
    remaining_label: str,
    reason: str,
) -> str:
    """Construit le message d'alerte envoyé au superviseur."""
    reason_label = _REASON_LABELS.get(reason, reason.replace("_", " ").capitalize())

    return (
        "⚠️ Intervention humaine requise\n\n"
        f"Le dossier {ref_m2s} est arrivé au stade de l'intervention humaine.\n\n"
        "Veuillez le traiter le plus tôt possible via le site web Nida'a "
        "en appelant le constateur associé.\n\n"
        f"Constateur : {constateur_nom or 'Non renseigné'}\n"
        f"Téléphone : {telephone or 'Non renseigné'}\n"
        f"Motif : {reason_label}\n"
        f"Temps restant SLA : {remaining_label}"
    )


def notify_handoff(
    dossier_id: str,
    ref_m2s: str,
    constateur_nom: str,
    telephone: str,
    remaining_label: str,
    reason: str,
) -> bool:
    """Envoie une notification de hand-off par M2S API WhatsApp."""

    api_url = config.m2s_whatsapp_api_url.strip().rstrip("/")

    recipient_value, api_key, instance_id = _resolve_target()
    recipient = _digits(recipient_value)

    message = _build_message(
        ref_m2s=ref_m2s,
        constateur_nom=constateur_nom,
        telephone=telephone,
        remaining_label=remaining_label,
        reason=reason,
    )

    if not api_url or not api_key or not instance_id or not recipient:
        log.error(
            "Alerte WhatsApp non envoyée : configuration M2S API incomplète. "
            "Vérifiez M2S_WHATSAPP_API_URL, M2S_WHATSAPP_API_KEY, "
            "M2S_WHATSAPP_INSTANCE_ID et ZINEB_WHATSAPP."
        )
        return False

    # UUID stable : si le moteur traite deux fois le même hand-off,
    # M2S API retournera le message existant au lieu d'envoyer un doublon.
    idempotency_key = str(
        uuid.uuid5(uuid.NAMESPACE_URL, f"vigie-handoff:{dossier_id}")
    )

    payload = {
        "instance_id": instance_id,
        "recipient": recipient,
        "text": message,
        "idempotency_key": idempotency_key,
        "metadata": {
            "source": "vigie-nidaa",
            "event_type": "handoff_humain",
            "dossier_id": dossier_id,
            "ref_m2s": ref_m2s,
            "reason": reason,
        },
    }

    url = f"{api_url}/messages/text"

    try:
        response = httpx.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
            },
            timeout=15.0,
        )
        response.raise_for_status()

        data = response.json().get("data", {})
        message_id = str(data.get("message_id") or "")
        message_status = str(data.get("status") or "accepted")

        if not message_id:
            log.error(
                "M2S API a accepté l'alerte pour %s mais n'a renvoyé aucun message_id.",
                ref_m2s,
            )
            return False

        from ..repo import get_repo

        repo = get_repo()
        settings = repo.get_settings()

        repo.record_whatsapp_alert(
            {
                "dossier_id": dossier_id,
                "whatsapp_contact_id": settings.selected_whatsapp_id,
                "m2s_message_id": message_id,
                "instance_id": instance_id,
                "recipient": recipient,
                "status": message_status,
                "accepted_at": utcnow(),
            }
        )

        log.info(
            "Alerte WhatsApp enregistrée pour %s : message_id=%s, statut=%s",
            ref_m2s,
            message_id,
            message_status,
        )
        return True

    except httpx.HTTPStatusError as exc:
        log.error(
            "M2S API a refusé l'alerte WhatsApp pour %s : HTTP %s — %s",
            ref_m2s,
            exc.response.status_code,
            exc.response.text,
        )
        return False

    except Exception:
        log.exception(
            "Erreur pendant l'envoi de l'alerte WhatsApp pour %s",
            ref_m2s,
        )
        return False
