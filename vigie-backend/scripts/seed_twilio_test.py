"""Insère UN dossier de test dont le temps restant est exactement 4h (le seuil
de la relance IA n°1 par défaut : relance1_min=240) — pour le scénario Twilio.

Usage :  python -m scripts.seed_twilio_test
"""
from datetime import datetime, timedelta

from app.config import config
from app.importer import import_dossiers_list
from app.schemas import ConstateurIn, DossierImportIn

if config.database_url.startswith("sqlite") and not config.use_supabase:
    from app.database import Base, engine
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

SLA_HOURS = 6.0        # doit correspondre à settings.sla_hours (défaut)
REMAINING_TARGET = 4.0  # heures restantes voulues à l'import = seuil relance1

now = datetime.utcnow()
arrival = now - timedelta(hours=(SLA_HOURS - REMAINING_TARGET))  # = now - 2h

item = DossierImportIn(
    ref_m2s="DOS-2026-TWILIO-TEST",
    constateur=ConstateurIn(nom="Test Constateur (Twilio)", telephone="+212600000000", zone="Casablanca"),
    arrival_at=arrival,
)

res = import_dossiers_list([item])
print(f"Import : {res.imported} importé(s), {len(res.skipped_existing)} déjà présent(s).")
print(f"Arrivée simulée : {arrival.isoformat()} UTC  ->  temps restant ≈ {REMAINING_TARGET:.0f}h")
print("Lance un tick (POST /api/engine/tick) ou attends 15s : la relance IA n°1 devrait se déclencher.")
