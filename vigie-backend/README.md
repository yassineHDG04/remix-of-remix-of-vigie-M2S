# Vigie — Backend métier (prototype)

Relance vocale IA & escalade des dossiers en retard — M2S Maroc.

## Démarrage rapide

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m scripts.seed_demo                          # (optionnel) données de démo
uvicorn app.main:app --reload --port 8000
```

Swagger interactif : http://127.0.0.1:8000/docs

Sous PowerShell, remplace `source .venv/bin/activate` et `cp` par :

```powershell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

Mode MOCK par défaut (`MOCK_MODE=true`) : les appels téléphoniques sont simulés,
le moteur d'escalade tourne pour de vrai. Voir le guide PDF pour les scénarios
de test et le branchement du VoIP réel (LiveKit + trunk SIP).

## Sécurité des routes FastAPI

Toutes les routes internes `/api/*` exigent `VIGIE_API_KEY`. La santé `/`
reste publique. Le webhook WhatsApp utilise la signature officielle Meta et
n'accepte pas la clé interne générique.

Génère une clé puis copie-la dans `.env` :

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Exemple d'appel :

```bash
curl -H "X-API-Key: TA_CLE" http://127.0.0.1:8000/api/dossiers
```

La même `VIGIE_API_KEY` doit être présente dans l'environnement du worker
`agent/worker.py`, afin qu'il puisse poster le résultat d'un appel.

Pour un import poussé par M2S :

```bash
curl -X POST http://127.0.0.1:8000/api/dossiers/import \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TA_CLE" \
  -d '[]'
```

Pour WhatsApp, renseigne aussi `WHATSAPP_APP_SECRET` avec l'App Secret Meta.
Le backend vérifie alors `X-Hub-Signature-256` avant de traiter un clic.

## Connexion à la plateforme m2s-api

Renseigne dans `.env` :

```dotenv
M2S_WHATSAPP_API_URL=https://VOTRE_M2S_API/api/v1
M2S_WHATSAPP_API_KEY=VOTRE_CLE_BEARER
M2S_WHATSAPP_INSTANCE_ID=VOTRE_INSTANCE
```

Dans la page **Webhooks** de `m2s-api`, crée ensuite un endpoint :

- URL : `https://VOTRE_BACKEND/api/webhooks/m2s-whatsapp`
- authentification : `Bearer`
- jeton : exactement la valeur de `VIGIE_API_KEY`
- événements : `message.sent`, `message.delivered`, `message.read`, `message.failed`

Le même contrat fonctionne en SQLite et dans Supabase. En production Supabase,
applique d'abord `../supabase/migrations/20260716230000_whatsapp_alerts.sql`.

## Appel WhatsApp puis téléphone

Le chantier 3 ajoute un fournisseur WhatsApp Calling LiveKit et conserve le
fournisseur SIP historique comme repli. Le choix et les quotas se règlent dans
`/parametres`. La procédure Meta/LiveKit, la migration et la recette progressive
sont décrites dans `../CHANTIER3_WHATSAPP_VERS_SIP.md`.

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```

Les tests couvrent notamment l'authentification des routes, la source de vérité
M2S, le routage WhatsApp → SIP et la persistance monotone des statuts WhatsApp.
