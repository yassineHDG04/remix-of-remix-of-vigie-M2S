# -*- coding: utf-8 -*-
"""
Agent vocal Vigie — mène l'appel de relance en darija.

Rôle strict et borné : demander la cause du retard, l'enregistrer, annoncer
le temps restant, puis raccrocher. L'agent ne négocie jamais de délai et ne
décide rien sur le dossier (voir le cahier des charges §5).

Garde-fous de coût (voir la discussion "quel modèle / comment limiter") :
  - AGENT_MAX_CALL_SECONDS  : coupure dure de la durée de l'appel (le levier
    le plus efficace, car le coût Realtime scale avec la durée, pas le texte).
  - AGENT_MAX_RESPONSE_TOKENS : plafonne la longueur de CHAQUE tour de parole
    IA (empêche l'agent de "broder").
  - MAX_TURNS : nombre de tours d'échange après lequel on force la clôture,
    même si la coupure de durée n'est pas encore atteinte.

Testable SANS SIP ni téléphone via le LiveKit Agents Playground (voir README.md).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import timedelta

import httpx
from dotenv import load_dotenv
from livekit import agents, api
from livekit.agents import Agent, AgentSession, JobContext, RoomInputOptions, function_tool
from livekit.plugins import noise_cancellation, openai, silero
from livekit.plugins.openai.realtime.realtime_model import InputAudioTranscription

from .voice_config import VoiceConfig, estimate_ai_cost_usd

load_dotenv()

log = logging.getLogger("vigie.agent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# ---------- Configuration (garde-fous de coût) ----------
MAX_CALL_SECONDS = int(os.getenv("AGENT_MAX_CALL_SECONDS", "100"))
MAX_RESPONSE_TOKENS = int(os.getenv("AGENT_MAX_RESPONSE_TOKENS", "200"))
MAX_TURNS = int(os.getenv("AGENT_MAX_TURNS", "6"))
VIGIE_API_BASE_URL = os.getenv("VIGIE_API_BASE_URL", "http://127.0.0.1:8000")
VIGIE_API_KEY = os.getenv("VIGIE_API_KEY", "")
SIP_TRUNK_ID = os.getenv("SIP_TRUNK_ID", "")
WHATSAPP_CALLS_ACCESS_TOKEN = os.getenv("WHATSAPP_CALLS_ACCESS_TOKEN", "")

# Contexte de démo utilisé si l'agent est rejoint manuellement (Playground)
# sans métadonnées de job fournies par le backend.
DEMO_CONTEXT = {
    "call_id": None,  # None -> pas de webhook posté (mode test pur)
    "dossier_id": None,
    "ref_m2s": "DOS-2026-00999",
    "remaining_label": "3h 29min",
    "next_call_label": "1h 39min",
    "stage": 1,
}


@dataclass
class CallState:
    """État accumulé pendant l'appel, pour le webhook de fin d'appel."""
    ref_m2s: str
    remaining_label: str
    next_call_label: str
    stage: int
    call_id: str | None
    dossier_id: str | None
    turns: list[dict] = field(default_factory=list)
    delay_reason: str | None = None
    delay_category: str | None = None
    outcome: str | None = None  # cause_captee | non_joignable | hors_sujet | refus
    ended: bool = False
    posted: bool = False  # empêche un double-envoi du résultat au backend
    api_base_url: str = ""  # URL du backend, résolue par appel (metadata > env) — voir entrypoint()
    connected_at_monotonic: float | None = None
    voice_engine_used: str | None = None
    models_used: dict[str, str] = field(default_factory=dict)
    pipeline_fallback: bool = False
    call_channel_used: str | None = None
    fallback_reason: str | None = None
    whatsapp_call_id: str | None = None
    transport_cost_per_minute_usd: float = 0.0


def build_instructions(ctx: CallState) -> str:
    """System message — darija stricte, courte, bornée. Le temps restant est
    INJECTÉ (jamais calculé par le modèle), conformément à la règle du CDC §5.2."""
    return f"""Tu es l'assistant vocal de l'assurance, tu appelles un constateur au sujet d'un dossier en retard.

RÈGLES STRICTES (à respecter absolument) :
- Présente-toi clairement comme un assistant vocal IA dès la première phrase.
- Objectif unique : (1) demander la cause du retard du dossier {ctx.ref_m2s}, (2) l'enregistrer via
  la fonction record_delay_reason, (3) annoncer le temps restant, (4) clore poliment l'appel via end_call.
- Langue : darija marocaine naturelle et courtoise, TELLE QU'ELLE EST PARLÉE au Maroc — c'est-à-dire
  mélangée naturellement avec du français (ex. "assurance", "dossier", "rendez-vous", "d'accord",
  "exactement", des chiffres). Ce mélange est NORMAL et ATTENDU, ne force jamais un darija "pur" qui
  sonnerait artificiel. Jamais d'arabe littéraire (fossha).
- Concision extrême : 1 à 2 phrases courtes par tour de parole. Pas de blabla, pas de répétition.
- Pose une seule question à la fois, avec un ton calme et professionnel. N'accuse jamais le constateur.
- N'invente jamais une cause, un nom, un numéro, une date ou une référence. Si l'audio est mauvais,
  demande de répéter. Pour confirmer des chiffres, répète-les séparément. Le clavier DTMF peut être
  proposé en secours lorsqu'une référence numérique doit être confirmée.
- Le temps restant est FIXE, on te le donne : "{ctx.remaining_label}". Ne le calcule jamais toi-même,
  ne l'invente jamais, répète-le tel quel.
- Le prochain rappel (si le dossier reste non validé) est dans : "{ctx.next_call_label}".
- Ne négocie JAMAIS de délai, ne fais AUCUNE promesse, ne donne aucune information sensible.
- Si le constateur pose une question hors sujet : réponds en une phrase brève, recentre, continue le script.
- Dès que tu as la cause du retard, appelle IMMÉDIATEMENT record_delay_reason avec le verbatim et
  la catégorie la plus proche parmi : desaccord_parties, zone_hors_km, expertise_en_cours,
  pieces_manquantes, injoignable_tiers, autre.
- Si tu tombes sur un répondeur / messagerie vocale, appelle flag_voicemail puis end_call immédiatement.
- Après plusieurs incompréhensions, n'invente aucune réponse : indique qu'un humain reprendra le suivi
  et termine proprement l'appel.
- Une fois la cause enregistrée et le délai annoncé, remercie brièvement et appelle end_call.
- Déroulé attendu (4 tours maximum) :
  1) Salue, annonce l'objet de l'appel (dossier {ctx.ref_m2s} en retard), demande la cause.
  2) Écoute la réponse, appelle record_delay_reason.
  3) Confirme avoir noté, annonce le temps restant ("{ctx.remaining_label}").
  4) Remercie et appelle end_call.

Exemple de ton (à adapter, ne pas réciter mot pour mot) :
"Salam, ana l'assistant AI dyal l'assurance. Kan3yyet lik 3la dossier {ctx.ref_m2s} li baqi machi
validé ou t3ettel. Chnou sabab dyal te3ttal ?"
"""


class VigieAgent(Agent):
    def __init__(self, state: CallState) -> None:
        self.state = state
        super().__init__(instructions=build_instructions(state))

    async def on_enter(self) -> None:
        await self.session.generate_reply()

    # ---------- Function tools (le modèle les appelle lui-même) ----------
    @function_tool
    async def record_delay_reason(self, verbatim: str, categorie: str) -> str:
        """Enregistre la cause du retard donnée par le constateur.

        Args:
            verbatim: ce que le constateur a dit, tel quel (darija).
            categorie: une catégorie parmi desaccord_parties, zone_hors_km,
                expertise_en_cours, pieces_manquantes, injoignable_tiers, autre.
        """
        self.state.delay_reason = verbatim
        self.state.delay_category = categorie
        self.state.outcome = "cause_captee"
        log.info("Cause captée: %s (%s)", verbatim, categorie)
        return "Cause enregistrée."

    @function_tool
    async def flag_voicemail(self) -> str:
        """À appeler si un répondeur / une messagerie vocale est détecté."""
        self.state.outcome = "non_joignable"
        log.info("Répondeur détecté — appel marqué non_joignable")
        return "Répondeur détecté, fin d'appel."

    @function_tool
    async def end_call(self, ctx: agents.RunContext) -> str:
        """À appeler pour clore poliment l'appel une fois l'objectif atteint."""
        self.state.ended = True
        log.info("Fin d'appel demandée par l'agent (outcome=%s)", self.state.outcome)
        await _hangup(ctx.session, self.state)
        return "Appel terminé."


async def _disconnect_whatsapp_connector(state: CallState) -> None:
    if state.call_channel_used != "whatsapp" or not state.whatsapp_call_id:
        return
    from livekit.agents import get_job_context

    job_ctx = get_job_context()
    if job_ctx is None:
        return
    try:
        await job_ctx.api.connector.disconnect_whatsapp_call(
            api.DisconnectWhatsAppCallRequest(
                whatsapp_call_id=state.whatsapp_call_id,
                whatsapp_api_key=WHATSAPP_CALLS_ACCESS_TOKEN,
                disconnect_reason=api.DisconnectWhatsAppCallRequest.BUSINESS_INITIATED,
            )
        )
        log.info("Connecteur WhatsApp déconnecté proprement (%s).", state.whatsapp_call_id)
    except Exception:
        # Un webhook terminate peut avoir nettoyé la session juste avant nous.
        log.debug("Session WhatsApp déjà terminée ou nettoyage refusé", exc_info=True)


async def _hangup(session: AgentSession, state: CallState | None = None) -> None:
    """Raccroche pour de vrai.

    IMPORTANT : session.aclose() arrête seulement le traitement audio côté IA —
    l'appel téléphonique (participant SIP) reste connecté et le constateur
    entend du silence jusqu'à ce qu'IL raccroche lui-même. Pour raccrocher
    réellement côté agent, il faut supprimer la room LiveKit, ce qui déconnecte
    tous les participants, y compris la jambe SIP (documenté par LiveKit :
    "Without room deletion, SIP calls remain connected and users hear silence").
    """
    from livekit.agents import get_job_context

    # Laisse le temps à la dernière phrase (ex. "chokran, bslama") de finir de
    # se jouer avant de couper la ligne, sinon le constateur l'entend hachée.
    if session.current_speech:
        try:
            await session.current_speech.wait_for_playout()
        except Exception:
            pass
    await asyncio.sleep(0.3)

    job_ctx = get_job_context()
    if job_ctx is None:
        await session.aclose()
        return
    try:
        if state is not None:
            await _disconnect_whatsapp_connector(state)
        await job_ctx.api.room.delete_room(api.DeleteRoomRequest(room=job_ctx.room.name))
        log.info("Room supprimée -> appel raccroché pour de vrai.")
    except Exception:
        log.exception("Échec de la suppression de room (raccroché malgré tout côté IA)")
    finally:
        await session.aclose()


async def post_result_to_backend(state: CallState) -> None:
    """Poste le résultat au backend (POST /api/webhooks/calls/{id}/result),
    exactement le contrat attendu par app/routers/calls.py.

    Idempotent : ne poste qu'UNE SEULE FOIS par appel (state.posted), même si
    cette fonction est déclenchée plusieurs fois (ex. shutdown callback qui
    se déclencherait deux fois dans un cas limite)."""
    if state.posted:
        log.debug("Résultat déjà posté pour call_id=%s — ignoré (idempotence).", state.call_id)
        return
    state.posted = True

    duration_sec = 0
    if state.connected_at_monotonic is not None:
        duration_sec = max(0, round(time.monotonic() - state.connected_at_monotonic))
    estimated_cost_usd = estimate_ai_cost_usd(state.voice_engine_used or "", duration_sec)
    estimated_transport_cost_usd = max(
        0.0,
        state.transport_cost_per_minute_usd * (duration_sec / 60.0),
    )

    if not state.call_id:
        log.info("[TEST — pas de call_id] Résultat qui aurait été posté : %s", {
            "status": "pris" if state.outcome == "cause_captee" else (state.outcome or "echec"),
            "delay_reason": state.delay_reason,
            "delay_category": state.delay_category,
            "transcript": state.turns,
            "voice_engine_used": state.voice_engine_used,
            "models_used": state.models_used,
            "estimated_cost_usd": estimated_cost_usd,
            "call_channel_used": state.call_channel_used,
            "fallback_reason": state.fallback_reason,
            "estimated_transport_cost_usd": estimated_transport_cost_usd,
        })
        return
    status = "pris" if state.outcome == "cause_captee" else (
        "repondeur" if state.outcome == "non_joignable" and state.turns
        else "non_joignable" if state.outcome == "non_joignable"
        else "echec"
    )
    payload = {
        "status": status,
        "duration_sec": duration_sec,
        "delay_reason": state.delay_reason,
        "delay_category": state.delay_category,
        "transcript": state.turns,
        "voice_engine_used": state.voice_engine_used,
        "models_used": state.models_used,
        "estimated_cost_usd": estimated_cost_usd,
        "call_channel_used": state.call_channel_used,
        "fallback_reason": state.fallback_reason,
        "estimated_transport_cost_usd": estimated_transport_cost_usd,
    }
    url = f"{state.api_base_url or VIGIE_API_BASE_URL}/api/webhooks/calls/{state.call_id}/result"
    try:
        headers = {"X-API-Key": VIGIE_API_KEY} if VIGIE_API_KEY else {}
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
        log.info("Résultat posté au backend pour call_id=%s", state.call_id)
    except Exception:
        log.exception("Échec de l'envoi du résultat au backend (%s)", url)


async def dossier_is_still_callable(state: CallState) -> bool:
    """Pré-vol obligatoire juste avant de composer le numéro.

    Un dispatch LiveKit peut attendre quelques secondes dans une file. Entre sa
    création et son exécution, M2S peut avoir validé le dossier. Le worker
    revérifie donc l'état courant et échoue fermé si le backend est injoignable :
    mieux vaut reporter une relance que déranger un constateur après validation.
    """
    if not state.dossier_id:
        return True  # Playground / démo sans dossier réel.
    if not VIGIE_API_KEY:
        log.error("VIGIE_API_KEY absente : pré-vol dossier impossible, appel annulé.")
        state.delay_reason = "Appel annulé : pré-vol de validation M2S indisponible."
        return False

    url = (
        f"{state.api_base_url or VIGIE_API_BASE_URL}"
        f"/api/dossiers/{state.dossier_id}/call-eligibility"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url, headers={"X-API-Key": VIGIE_API_KEY})
            response.raise_for_status()
        payload = response.json()
        if payload.get("callable") is True:
            return True
        reason = payload.get("reason") or "ineligible"
        log.info("Appel annulé au pré-vol pour %s : %s", state.ref_m2s, reason)
        state.delay_reason = f"Appel annulé avant composition : {reason}."
        return False
    except Exception:
        log.exception("Pré-vol dossier impossible (%s) — appel annulé par sécurité", url)
        state.delay_reason = "Appel annulé : impossible de vérifier le statut M2S."
        return False


async def enforce_hard_cutoff(session: AgentSession, state: CallState, max_seconds: int) -> None:
    """Garde-fou de coût n°1 : coupe l'appel après max_seconds, quoi qu'il arrive.
    C'est le levier principal (le coût Realtime scale avec la durée)."""
    await asyncio.sleep(max_seconds)
    if state.ended:
        return
    log.warning("Coupure dure atteinte (%ss) — clôture forcée de l'appel", max_seconds)
    try:
        await session.generate_reply(
            instructions="Le temps est écoulé. Remercie très brièvement le constateur en une "
                         "phrase et termine la conversation immédiatement, sans rien ajouter."
        )
    except Exception:
        pass
    state.outcome = state.outcome or "non_joignable"
    state.ended = True
    await _hangup(session, state)


async def _dial_out(
    ctx: JobContext,
    phone: str,
    trunk_id: str = "",
    caller_id: str = "",
    max_call_seconds: int = MAX_CALL_SECONDS,
) -> bool:
    """Compose l'appel SIP sortant vers le constateur et attend la réponse.

    trunk_id/caller_id : reçus en priorité depuis les métadonnées du dispatch
    (settings.sip_trunk_id / sip_caller_id, réglables depuis Paramètres ->
    Téléphonie IA côté dashboard). Repli sur la variable d'environnement
    SIP_TRUNK_ID si non fournis (utile pour un test manuel au Playground).

    Renvoie True si l'appel a été décroché, False sinon (non-joignable, refusé,
    messagerie vocale détectée côté opérateur avant même le décroché...).
    Ne lève jamais : toute erreur est traitée comme un échec d'appel normal.
    """
    effective_trunk = trunk_id or SIP_TRUNK_ID
    if not effective_trunk:
        log.error("Aucun sip_trunk_id (ni métadonnées, ni SIP_TRUNK_ID env) — impossible de composer l'appel réel.")
        return False
    try:
        kwargs = dict(
            sip_trunk_id=effective_trunk,
            sip_call_to=phone,
            room_name=ctx.room.name,
            participant_identity=f"sip_{phone}",
            participant_name="Constateur",
            wait_until_answered=True,   # bloque jusqu'à décroché / échec
            max_call_duration=timedelta(seconds=max_call_seconds + 15),  # filet de sécurité côté SIP aussi
        )
        if caller_id:
            kwargs["sip_number"] = caller_id  # identifiant d'appelant affiché au constateur
        await ctx.api.sip.create_sip_participant(api.CreateSIPParticipantRequest(**kwargs))
        log.info("Appel décroché par %s (trunk=%s)", phone, effective_trunk)
        return True
    except Exception as e:
        log.warning("Appel non abouti vers %s : %s", phone, e)
        return False


def _openai_auth(api_key: str | None) -> dict[str, str]:
    """N'envoie pas ``api_key=None`` aux plugins qui distinguent absent/null."""
    return {"api_key": api_key} if api_key else {}


def build_realtime_session(
    voice: VoiceConfig,
    api_key: str | None,
    max_response_tokens: int,
) -> AgentSession:
    """Construit le moteur speech-to-speech historique, sans démarrer le job."""
    return AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=voice.realtime_model,
            voice="marin",
            modalities=["audio"],
            max_response_output_tokens=max_response_tokens,
            turn_detection=None,
            input_audio_transcription=InputAudioTranscription(
                model="gpt-4o-transcribe",
                language="ar",
                prompt=(
                    "Conversation téléphonique en darija marocaine mélangée avec du "
                    "français, entre un assistant IA d'assurance et un constateur "
                    "M2S. Vocabulaire fréquent : dossier, assurance, constateur, "
                    "sinistre, expertise, kilométrage, désaccord, pièces, rendez-vous, "
                    "délai, expert, zone."
                ),
            ),
            **_openai_auth(api_key),
        ),
    )


def build_pipeline_session(
    voice: VoiceConfig,
    api_key: str | None,
    max_response_tokens: int,
) -> AgentSession:
    """Construit STT -> LLM -> TTS au démarrage du job courant.

    Le premier chantier prend en charge OpenAI de bout en bout afin de réutiliser
    la clé déjà configurée et d'éviter de prétendre supporter un fournisseur non
    testé. Les champs provider restent présents pour permettre une extension
    ultérieure explicite.
    """
    voice.validate_pipeline()
    auth = _openai_auth(api_key)
    return AgentSession(
        vad=silero.VAD.load(),
        stt=openai.STT(
            model=voice.stt_model,
            language=voice.stt_language,
            **auth,
        ),
        llm=openai.LLM(
            model=voice.llm_model,
            max_completion_tokens=max_response_tokens,
            temperature=0.2,
            **auth,
        ),
        tts=openai.TTS(
            model=voice.tts_model,
            voice=voice.tts_voice_id,
            instructions=(
                "Parle en darija marocaine naturelle, avec les mots français du "
                "contexte assurance. Ton calme, professionnel et phrases courtes."
            ),
            **auth,
        ),
    )


def attach_transcript_capture(
    session: AgentSession,
    state: CallState,
    max_turns: int,
) -> None:
    """Branche la même capture et la même limite de tours aux deux moteurs."""

    @session.on("conversation_item_added")
    def _on_item(event) -> None:  # noqa: ANN001
        try:
            item = event.item
            role = getattr(item, "role", None)
            text = getattr(item, "text_content", None) or ""
            if not text:
                return
            speaker = "ia" if role == "assistant" else "constateur"
            state.turns.append({"speaker": speaker, "text": text})
            if len(state.turns) > max_turns * 2:
                log.warning("Limite de tours atteinte (%s) — clôture", max_turns)
                state.ended = True
                asyncio.create_task(_hangup(session, state))
        except Exception:
            log.exception("Erreur de capture de tour de parole")


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    meta = ctx.job.metadata or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}
    call_ctx = {**DEMO_CONTEXT, **meta}
    outbound_phone = meta.get("phone")  # présent UNIQUEMENT en appel réel (dispatché par le backend)
    if not meta:
        log.info("Aucune métadonnée de job — mode DÉMO (Playground). Contexte : %s", call_ctx)

    state = CallState(
        ref_m2s=call_ctx["ref_m2s"],
        remaining_label=call_ctx["remaining_label"],
        next_call_label=call_ctx["next_call_label"],
        stage=call_ctx["stage"],
        call_id=call_ctx.get("call_id"),
        dossier_id=call_ctx.get("dossier_id"),
        api_base_url=meta.get("vigie_api_base_url") or VIGIE_API_BASE_URL,
        call_channel_used=meta.get("call_channel") or ("sip" if outbound_phone else None),
        whatsapp_call_id=meta.get("whatsapp_call_id") or None,
        transport_cost_per_minute_usd=float(
            meta.get("transport_cost_per_minute_usd") or 0.0
        ),
    )
    cutoff_task: asyncio.Task | None = None  # créé plus bas UNIQUEMENT si l'appel est décroché

    # --- Config effective de CET appel : Paramètres (dashboard) > .env du worker ---
    # Permet de changer ces réglages depuis /parametres, sans redéployer/redémarrer
    # le worker (contrairement à LIVEKIT_URL/API_KEY/API_SECRET qui, eux, servent à
    # l'ENREGISTREMENT du worker et restent lus une seule fois au démarrage).
    effective_max_call_seconds = int(meta.get("agent_max_call_seconds") or MAX_CALL_SECONDS)
    effective_max_response_tokens = int(meta.get("agent_max_response_tokens") or MAX_RESPONSE_TOKENS)
    effective_max_turns = int(meta.get("agent_max_turns") or MAX_TURNS)
    effective_openai_api_key = meta.get("openai_api_key") or None  # None -> repli sur OPENAI_API_KEY env (SDK)
    voice = VoiceConfig.from_metadata(meta)

    # --- CORRECTIF IMPORTANT ---
    # On poste le résultat via un SHUTDOWN CALLBACK, pas juste après
    # `await session.start()`. Dans les versions récentes de livekit-agents,
    # session.start() ne bloque PLUS jusqu'à la fin réelle de l'appel — il rend
    # la main dès que la session démarre. Poster le résultat juste après cette
    # ligne l'envoyait donc AVANT même que la conversation n'ait eu lieu (état
    # vide, status="echec"), pendant que la vraie conversation continuait en
    # arrière-plan sans jamais être sauvegardée. Le shutdown callback, lui, est
    # garanti par LiveKit de s'exécuter à la fin RÉELLE du job (voir doc
    # "Post-processing and cleanup").
    async def _post_on_shutdown(*_args) -> None:
        if cutoff_task is not None:
            cutoff_task.cancel()  # la coupure dure n'est plus utile, l'appel est fini
        await post_result_to_backend(state)

    ctx.add_shutdown_callback(_post_on_shutdown)

    # --- Appel réel : SIP compose ici ; WhatsApp est déjà initié par le backend ---
    if outbound_phone:
        if not await dossier_is_still_callable(state):
            state.outcome = None
            return  # le shutdown callback archive l'annulation sans composer le numéro
        if state.call_channel_used == "whatsapp":
            ringing_timeout = int(meta.get("whatsapp_ringing_timeout_seconds") or 35)
            try:
                # Le participant CONNECTOR n'apparaît qu'après acceptation et
                # négociation SDP. On ne parle donc jamais dans une room vide.
                await asyncio.wait_for(
                    ctx.wait_for_participant(),
                    timeout=max(10, ringing_timeout + 10),
                )
                answered = True
                log.info("Appel WhatsApp décroché par %s", outbound_phone)
            except TimeoutError:
                answered = False
                await _disconnect_whatsapp_connector(state)
                log.info("Appel WhatsApp sans réponse vers %s", outbound_phone)
        else:
            answered = await _dial_out(
                ctx,
                outbound_phone,
                trunk_id=meta.get("sip_trunk_id", ""),
                caller_id=meta.get("sip_caller_id", ""),
                max_call_seconds=effective_max_call_seconds,
            )
        if not answered:
            state.outcome = "non_joignable"
            return  # le shutdown callback ci-dessus postera cet état ; rien à transcrire

    # À partir d'ici la jambe téléphonique est connectée (ou le Playground est
    # prêt) : la durée et le garde-fou sont identiques pour les deux moteurs.
    state.connected_at_monotonic = time.monotonic()

    def _use_realtime(*, fallback_from_pipeline: bool = False, reason: str = "") -> AgentSession:
        state.voice_engine_used = "realtime"
        state.models_used = voice.models_used("realtime")
        if fallback_from_pipeline:
            state.pipeline_fallback = True
            state.models_used.update({
                "fallback_from": "pipeline",
                "fallback_reason": reason or "initialization_error",
            })
        return build_realtime_session(
            voice,
            effective_openai_api_key,
            effective_max_response_tokens,
        )

    if voice.voice_engine == "pipeline":
        try:
            session = build_pipeline_session(
                voice,
                effective_openai_api_key,
                effective_max_response_tokens,
            )
            state.voice_engine_used = "pipeline"
            state.models_used = voice.models_used("pipeline")
        except Exception as exc:
            log.exception(
                "Initialisation du pipeline impossible — bascule automatique vers Realtime"
            )
            session = _use_realtime(
                fallback_from_pipeline=True,
                reason=type(exc).__name__,
            )
    else:
        session = _use_realtime()

    attach_transcript_capture(session, state, effective_max_turns)
    cutoff_task = asyncio.create_task(
        enforce_hard_cutoff(session, state, effective_max_call_seconds)
    )

    async def _start(selected_session: AgentSession) -> None:
        await selected_session.start(
            room=ctx.room,
            agent=VigieAgent(state),
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVCTelephony(),
            ),
        )

    try:
        await _start(session)
    except Exception as exc:
        if state.voice_engine_used != "pipeline":
            state.delay_reason = "Échec d'initialisation du moteur vocal."
            raise

        # Certains plugins ne contactent le fournisseur qu'au session.start().
        # Cette seconde garde couvre donc aussi l'initialisation réseau réelle.
        log.exception(
            "Démarrage du pipeline impossible — bascule automatique vers Realtime"
        )
        cutoff_task.cancel()
        try:
            await session.aclose()
        except Exception:
            log.debug("Session pipeline déjà fermée après l'échec de démarrage", exc_info=True)

        session = _use_realtime(
            fallback_from_pipeline=True,
            reason=type(exc).__name__,
        )
        attach_transcript_capture(session, state, effective_max_turns)
        cutoff_task = asyncio.create_task(
            enforce_hard_cutoff(session, state, effective_max_call_seconds)
        )
        await _start(session)

    # Rien à faire ici après `await session.start()` : ce point peut être atteint
    # bien avant la fin réelle de l'appel selon la version de livekit-agents. Le
    # shutdown callback (_post_on_shutdown, enregistré plus haut) se charge de
    # façon fiable de la coupure du garde-fou et du webhook, à la fin RÉELLE du job.


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint, agent_name="vigie-agent"))
