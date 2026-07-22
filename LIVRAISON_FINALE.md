# Livraison finale — Vigie M2S

Version consolidée du 21 juillet 2026.

## Contenu

- frontend React/TanStack avec l'interface responsive validée ;
- backend FastAPI complet dans `vigie-backend/` ;
- worker vocal LiveKit dans `vigie-backend/agent/` ;
- providers M2S, SIP, WhatsApp Calling et alertes texte `m2s-api` ;
- routers, scripts de démonstration et tests backend ;
- migrations Supabase, dont `whatsapp_alerts` ;
- configuration d'exemple sans secret ;
- guide complet de configuration et de déploiement.

## Vérifications de cette livraison

- `npm ci` : réussi ;
- lint frontend : 0 erreur ;
- build client, SSR et Nitro : réussi ;
- compilation Python de `app`, `agent`, `scripts` et `tests` : réussie ;
- 33 tests backend : réussis ;
- démarrage FastAPI avec une base SQLite vierge : réussi ;
- création automatique des 8 tables SQLite, dont `whatsapp_alerts` : réussie ;
- contrat d'envoi et de webhook avec `m2s-api` : testé.

## Démarrage local sûr

### Frontend

```bash
cp .env.example .env
npm ci
npm run dev
```

Renseigner dans le `.env` frontend les trois valeurs publiques Supabase.

### Backend en mode simulation

```bash
cd vigie-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Sous PowerShell, utiliser `.\.venv\Scripts\Activate.ps1` et
`Copy-Item .env.example .env`.

### Worker vocal réel

```bash
cd vigie-backend
pip install -r agent/requirements-agent.txt
python -m agent.worker download-files
python -m agent.worker dev
```

Les appels réels nécessitent vos propres identifiants OpenAI, LiveKit, SIP ou
Meta. Aucun secret réel n'est inclus dans la livraison.

## Ordre conseillé en production

1. Appliquer toutes les migrations de `supabase/migrations/`.
2. Configurer le frontend, le backend et le worker avec leurs `.env` respectifs.
3. Démarrer FastAPI puis le worker vocal.
4. Configurer dans `m2s-api` le webhook Bearer vers
   `/api/webhooks/m2s-whatsapp`.
5. Lancer d'abord un dossier en `MOCK_MODE=true`, puis un pilote réel contrôlé.

Le détail de chaque variable et de la recette est dans
`GUIDE_CONFIGURATION_DEPLOIEMENT_ET_COUTS.md`.
