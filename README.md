# Nida2 M2S

Frontend React de supervision des relances vocales IA sur les dossiers de
sinistre en retard, connecté directement au même projet Supabase que le backend.

## Configuration

Copie `.env.example` en `.env` et renseigne les informations publiques du
projet Supabase :

```
VITE_SUPABASE_URL=https://ton-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=ta_cle_publishable
```

Installe et vérifie le frontend avec le lockfile livré :

```bash
npm ci
npm run build
npm run dev
```

## Backend

Le backend Python vit dans `vigie-backend/` et se lance séparément (voir son `README.md`) :

```
uvicorn app.main:app --reload --port 8000
```

Les routes métier FastAPI sont protégées par `VIGIE_API_KEY`. La clé reste
uniquement dans l'environnement des composants serveur (backend, worker vocal
et intégration M2S) ; elle ne doit jamais être ajoutée au bundle React.

## Schéma normalisé des dossiers

Après les TP 1 à 4 de normalisation Supabase, exécute la migration RPC
`supabase/migrations/20260716130000_rpc_dossiers_normalises.sql` avant de lancer
le frontend et le backend. Le déroulé et les contrôles du TP 5/6 sont détaillés
dans `TP5_TP6_NORMALISATION.md`.

Toutes les migrations du dossier `supabase/migrations/` doivent être appliquées,
notamment `20260716230000_whatsapp_alerts.sql` pour conserver les statuts des
alertes envoyées par `m2s-api`.

## Authentification

L'accès est réservé aux superviseurs invités par l'administrateur depuis la page `/superviseurs`. Aucune inscription publique n'est possible : toute personne non ajoutée par l'admin doit le contacter pour obtenir un accès.

## Preview hébergée en HTTPS

Une preview servie en HTTPS ne peut pas joindre un backend local. Les callbacks
du worker vocal, de M2S et de Meta doivent viser une URL backend HTTPS publique
(Render, Railway, tunnel de développement, etc.).

## Notes production

- Restreindre `CORS_ORIGINS` du backend aux domaines autorisés (au lieu de `*`).
- Générer une longue valeur aléatoire pour `VIGIE_API_KEY` et la transmettre
  avec `X-API-Key` aux seuls clients serveur autorisés.
- Renseigner `WHATSAPP_APP_SECRET` pour vérifier la signature Meta de chaque
  webhook WhatsApp entrant.

## Guides de déploiement

- `CHANTIER1_MOTEUR_VOCAL.md` : moteur vocal et estimation des coûts IA.
- `CHANTIER2_SYNCHRONISATION_M2S.md` : synchronisation M2S et source de vérité.
- `CHANTIER3_WHATSAPP_VERS_SIP.md` : appels WhatsApp, repli SIP et recette Meta/LiveKit.
- `GUIDE_CONFIGURATION_DEPLOIEMENT_ET_COUTS.md` : configuration complète de bout en bout.
