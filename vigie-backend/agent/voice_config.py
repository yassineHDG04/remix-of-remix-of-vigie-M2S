"""Configuration pure du moteur vocal, sans dépendance LiveKit.

La table ``settings`` est transmise dans les métadonnées du job par le backend.
Les variables d'environnement ne sont que des replis pour le Playground et les
anciennes installations. Cette séparation rend la configuration testable sans
charger les modèles audio.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping


SUPPORTED_ENGINES = {"realtime", "pipeline"}
SUPPORTED_PIPELINE_PROVIDERS = {"openai"}

# Estimation prudente de la partie IA uniquement, hors opérateur SIP.
# Elle sert à comparer les moteurs avec une unité constante. Le coût facturé
# reste celui exposé par les tableaux de bord OpenAI/LiveKit.
ESTIMATED_AI_COST_PER_CONNECTED_MINUTE_USD = {
    "realtime": 0.050,
    "pipeline": 0.010,
}


def _value(metadata: Mapping[str, object], key: str, env_key: str, default: str) -> str:
    raw = metadata.get(key)
    if raw is not None and str(raw).strip():
        return str(raw).strip()
    return os.getenv(env_key, default).strip() or default


@dataclass(frozen=True)
class VoiceConfig:
    voice_engine: str
    realtime_model: str
    stt_provider: str
    stt_model: str
    stt_language: str
    llm_model: str
    tts_provider: str
    tts_model: str
    tts_voice_id: str

    @classmethod
    def from_metadata(cls, metadata: Mapping[str, object]) -> "VoiceConfig":
        requested_engine = _value(metadata, "voice_engine", "VOICE_ENGINE", "realtime").lower()
        voice_engine = requested_engine if requested_engine in SUPPORTED_ENGINES else "realtime"
        return cls(
            voice_engine=voice_engine,
            realtime_model=_value(
                metadata, "realtime_model", "OPENAI_REALTIME_MODEL", "gpt-realtime"
            ),
            stt_provider=_value(metadata, "stt_provider", "STT_PROVIDER", "openai").lower(),
            stt_model=_value(
                metadata, "stt_model", "OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe"
            ),
            stt_language=_value(metadata, "stt_language", "OPENAI_INPUT_LANGUAGE", "ar"),
            llm_model=_value(metadata, "llm_model", "OPENAI_LLM_MODEL", "gpt-4o-mini"),
            tts_provider=_value(metadata, "tts_provider", "TTS_PROVIDER", "openai").lower(),
            tts_model=_value(metadata, "tts_model", "OPENAI_TTS_MODEL", "gpt-4o-mini-tts"),
            tts_voice_id=_value(metadata, "tts_voice_id", "OPENAI_TTS_VOICE", "ash"),
        )

    def validate_pipeline(self) -> None:
        if self.stt_provider not in SUPPORTED_PIPELINE_PROVIDERS:
            raise ValueError(f"Fournisseur STT non supporté : {self.stt_provider}")
        if self.tts_provider not in SUPPORTED_PIPELINE_PROVIDERS:
            raise ValueError(f"Fournisseur TTS non supporté : {self.tts_provider}")
        required = {
            "stt_model": self.stt_model,
            "stt_language": self.stt_language,
            "llm_model": self.llm_model,
            "tts_model": self.tts_model,
            "tts_voice_id": self.tts_voice_id,
        }
        missing = [name for name, value in required.items() if not value.strip()]
        if missing:
            raise ValueError(f"Configuration pipeline incomplète : {', '.join(missing)}")

    def models_used(self, engine: str | None = None) -> dict[str, str]:
        selected = engine or self.voice_engine
        if selected == "realtime":
            return {"realtime_model": self.realtime_model}
        return {
            "stt_provider": self.stt_provider,
            "stt_model": self.stt_model,
            "stt_language": self.stt_language,
            "llm_model": self.llm_model,
            "tts_provider": self.tts_provider,
            "tts_model": self.tts_model,
            "tts_voice_id": self.tts_voice_id,
        }


def estimate_ai_cost_usd(engine: str, duration_sec: int) -> float:
    """Estime la partie IA à partir de la durée connectée, sans coût SIP."""
    seconds = max(0, duration_sec)
    rate = ESTIMATED_AI_COST_PER_CONNECTED_MINUTE_USD.get(engine, 0.0)
    return round((seconds / 60.0) * rate, 6)

