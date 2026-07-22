# Agent vocal Vigie — worker LiveKit

Ce dossier contient l'agent vocal qui mène la conversation en darija avec le
constateur : capte la cause du retard, annonce le délai restant, et applique
les garde-fous de coût (durée max, tokens max par réponse). Il peut fonctionner
avec OpenAI Realtime ou avec un pipeline STT → LLM → TTS sélectionné depuis
`/parametres`.

## Ce que ça fait, indépendamment du SIP

Cet agent se connecte à une **room LiveKit** comme n'importe quel agent.
Il n'a besoin d'aucun trunk SIP pour être testé : tu peux le rejoindre depuis
le **LiveKit Agents Playground** (dans ton navigateur, avec ton micro) et lui
parler directement, en simulant le rôle du constateur. Le jour où le trunk
SIP est prêt, c'est le _backend_ (place_call) qui connectera un participant
SIP dans la room à la place de ton micro — l'agent, lui, ne change pas.

## Installation

```bash
cd vigie-backend
python -m venv .venv          # si pas déjà fait
source .venv/bin/activate     # Windows : .venv\Scripts\activate
pip install -r agent/requirements-agent.txt
python -m agent.worker download-files  # poids Silero nécessaires au pipeline
```

## Configuration (.env, à la racine de vigie-backend)

Complète (en plus de ce que tu as déjà pour LiveKit) :

```
OPENAI_API_KEY=sk-...
VIGIE_API_BASE_URL=http://127.0.0.1:8000      # pour poster le résultat d'appel
VIGIE_API_KEY=...                              # même clé que le backend
AGENT_MAX_CALL_SECONDS=100                     # coupure dure (garde-fou de coût)
AGENT_MAX_RESPONSE_TOKENS=200                  # longueur max d'un tour de parole IA
```

Ces valeurs, ainsi que le moteur et ses modèles, sont normalement lues dans
`settings` puis transmises dans les métadonnées de chaque job. Le `.env` sert
de repli au Playground. Voir `../../CHANTIER1_MOTEUR_VOCAL.md` pour la liste
complète et la recette de bascule.

## Lancer le worker

```bash
python -m agent.worker dev
```

Le worker se connecte à ton projet LiveKit et attend d'être dispatché dans une room.

## Appels WhatsApp sortants

Le même worker peut être dispatché dans une room créée par le connecteur
WhatsApp LiveKit. Dans ce mode, il attend que le participant WhatsApp soit
connecté avant de commencer à parler et déconnecte proprement l'appel à la fin.

Le worker doit recevoir `WHATSAPP_CALLS_ACCESS_TOKEN` en plus des variables
LiveKit. Le backend doit être public, vérifier les signatures Meta grâce à
`WHATSAPP_APP_SECRET` et recevoir les événements `calls`. Consulte
`../../CHANTIER3_WHATSAPP_VERS_SIP.md` pour la configuration complète et la
recette de repli WhatsApp vers SIP.

## Tester SANS téléphone (recommandé avant le SIP)

1. Ouvre https://agents-playground.livekit.io
2. Connecte-toi à ton projet (même URL/clés que dans `.env`).
3. Une room de test se crée : ton agent (lancé à l'étape précédente) la rejoint
   automatiquement, et toi tu la rejoins depuis le Playground avec ton micro —
   tu peux directement JOUER LE RÔLE DU CONSTATEUR et parler en darija.
4. Observe dans le terminal du worker : les tours de parole, l'appel de
   fonction `record_delay_reason`, et la coupure automatique après
   `AGENT_MAX_CALL_SECONDS`.

## Contexte d'un appel (dossier_id, ref_m2s, temps restant...)

En production, c'est le backend (`place_call`) qui dispatchera l'agent avec
les métadonnées du dossier (voir `job.metadata` dans `worker.py`). Pour tester
manuellement au Playground sans backend, le worker utilise des valeurs de
démonstration par défaut si aucune métadonnée n'est fournie (voir `DEMO_CONTEXT`
dans `worker.py`).
