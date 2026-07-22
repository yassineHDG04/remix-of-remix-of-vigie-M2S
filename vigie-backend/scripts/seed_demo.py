"""Insère des dossiers de démonstration (temps restants variés) via la couche repo.
Usage :  python -m scripts.seed_demo
"""
from datetime import datetime, timedelta

from app.config import config
from app.importer import import_dossiers_list
from app.schemas import ConstateurIn, DossierImportIn

# En dev SQLite, s'assurer que les tables existent.
if config.database_url.startswith("sqlite") and not config.use_supabase:
    from app import models  # noqa: F401  (enregistre les tables sur Base.metadata)
    from app.database import Base, engine
    Base.metadata.create_all(bind=engine)

now = datetime.utcnow()
DEMO = [
    # (ref, nom, tel, zone, heures_écoulées)  restant = 6h - écoulé
    ("DOS-2026-00142", "Karim Belhaj", "+212661123456", "Casablanca", 5.2),   # ~48 min -> hand-off direct
    ("DOS-2026-00147", "Salma Bennani", "+212664446622", "Tanger", 4.4),      # ~1h36 -> étape 3
    ("DOS-2026-00155", "Hicham Ouazzani", "+212665557733", "Agadir", 3.8),    # ~2h12 -> étape 2
    ("DOS-2026-00160", "Leila Chraibi", "+212666668844", "Fès", 2.5),         # ~3h30 -> étape 1
    ("DOS-2026-00175", "Rachid Alaoui", "+212669992277", "Marrakech", 0.5),   # ~5h30 -> en attente
]

items = [
    DossierImportIn(
        ref_m2s=ref,
        constateur=ConstateurIn(nom=nom, telephone=tel, zone=zone),
        arrival_at=now - timedelta(hours=ago),
    )
    for ref, nom, tel, zone, ago in DEMO
]

res = import_dossiers_list(items)
print(f"Seed : {res.imported} importés, {len(res.skipped_existing)} déjà présents.")
print("Lance le serveur puis regarde GET /api/dossiers")
