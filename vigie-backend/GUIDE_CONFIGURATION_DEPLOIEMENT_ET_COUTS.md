# Guide de configuration, de déploiement et de coûts — Vigie M2S

> Version vérifiée le 20 juillet 2026. Les prix des fournisseurs peuvent évoluer : vérifier les pages officielles avant tout engagement.

Ce document permet à une nouvelle personne de configurer et d'exploiter l'application Vigie M2S sans avoir à lire tout le code. Il couvre le frontend React, le backend FastAPI, le worker vocal LiveKit, Supabase, M2S, les appels SIP et WhatsApp, ainsi qu'une estimation pour 4 000 minutes d'appel par mois.

## 1. Vue d'ensemble

L'application est composée de trois processus distincts :

1. Le **frontend React/Vite** affiche les dossiers, les appels et la page `/parametres`. Il lit et écrit directement dans Supabase, sous le contrôle des politiques RLS.
2. Le **backend FastAPI** exécute le moteur d'escalade, synchronise les dossiers M2S, déclenche les appels et reçoit les webhooks.
3. Le **worker vocal LiveKit** rejoint les rooms d'appel, mène la conversation avec OpenAI, puis envoie le résultat au backend.

Flux simplifié :

```text
Frontend React ───────────────► Supabase
       │                           ▲
       │ /parametres               │ dossiers, settings, appels
       ▼                           │
Backend FastAPI ───────────────────┘
       │
       ├──► API M2S : dossiers et statuts
       ├──► M2S API WhatsApp : alerte texte au superviseur
       └──► LiveKit : création et dispatch d'une room
                       │
                       ├──► WhatsApp Connector : appel WhatsApp
                       └──► Trunk SIP : appel téléphonique
                       │
                       ▼
                 Worker vocal ───► OpenAI
                       │
                       └──► Backend : résultat et transcription
```

Il existe donc plusieurs factures indépendantes : **OpenAI**, **LiveKit**, l'éventuel **opérateur SIP**, l'hébergement du frontend/backend et, selon le contrat, **Meta/WhatsApp Connector** ou la plateforme M2S API.

## 2. Où placer les variables d'environnement

### 2.1 Frontend

Créer le fichier suivant à la racine du projet :

```text
vigie-m2s-github/.env
```

Le fichier doit contenir des variables commençant par `VITE_`, car Vite ne transmet au navigateur que ce préfixe.

```dotenv
VITE_SUPABASE_PROJECT_ID=abcdefghijklmnopqrst
VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxx
```

Après toute modification, arrêter puis relancer `npm run dev`. Une variable Vite est injectée au démarrage ou au build ; recharger seulement la page ne suffit pas.

### 2.2 Backend et worker

Créer :

```text
vigie-m2s-github/vigie-backend/.env
```

FastAPI charge ce fichier lorsque la commande est exécutée depuis `vigie-backend/` :

```powershell
cd vigie-backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Dans un deuxième terminal, depuis le même dossier :

```powershell
cd vigie-backend
.venv\Scripts\Activate.ps1
python -m agent.worker dev
```

En production, si FastAPI et le worker sont déployés comme deux services séparés, renseigner les variables nécessaires dans **les deux services**. Le worker doit notamment recevoir `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `VIGIE_API_KEY` et les replis OpenAI.

### 2.3 Ne jamais committer les secrets

Le fichier `.env` doit rester ignoré par Git. Seuls `.env.example` et ce guide peuvent être commités.

À ne jamais placer dans le `.env` Vite, dans le bundle React ou dans le dépôt Git :

- `SUPABASE_SERVICE_PASSWORD` et une éventuelle clé `service_role` ;
- `VIGIE_API_KEY` et `ENGINE_TICK_TOKEN` ;
- `OPENAI_API_KEY` et `LIVEKIT_API_SECRET`, hors mécanisme administrateur déjà prévu par `/parametres` ;
- les tokens Meta, M2S et secrets de webhook.

La clé Supabase **publishable/anon** est la seule clé d'infrastructure prévue pour être publique. La page administrateur actuelle lit et écrit néanmoins certains secrets opérationnels dans `settings` afin de les modifier à chaud : son accès et ses RLS doivent donc être strictement réservés aux administrateurs.

## 3. Où trouver chaque valeur

### 3.1 Supabase

Dans le dashboard Supabase du projet :

- `VITE_SUPABASE_PROJECT_ID` : identifiant du projet, visible dans l'URL du dashboard et dans l'URL Supabase ;
- `VITE_SUPABASE_URL` et `SUPABASE_URL` : **Project Settings / Data API**, champ Project URL ;
- `VITE_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_ANON_KEY` : **Project Settings / API Keys**, clé Publishable ou ancienne clé `anon` ;
- `DATABASE_URL`, uniquement si le mode SQL direct est utilisé : **Project Settings / Database / Connection string** ;
- `SUPABASE_SERVICE_EMAIL` et `SUPABASE_SERVICE_PASSWORD` : compte créé dans Supabase Auth pour le moteur. Ce compte doit posséder le rôle applicatif `admin` dans `user_roles` afin de satisfaire les policies RLS du projet ;
- `SUPABASE_SERVICE_ROLE_KEY` : uniquement pour un projet qui expose réellement cette clé au serveur. Ne jamais la mettre dans React.

La documentation Supabase confirme que les clés publishable sont destinées aux composants publics, tandis que l'identité de l'utilisateur connecté continue de déterminer le rôle RLS : [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys).

### 3.2 OpenAI

1. Ouvrir [OpenAI API keys](https://platform.openai.com/api-keys).
2. Créer une clé de projet réservée à Vigie.
3. Ajouter un moyen de paiement et, si possible, une limite de budget mensuelle.
4. Copier la clé dans `OPENAI_API_KEY` ou dans `/parametres`.

Une clé API OpenAI est un secret serveur. Ne pas utiliser une clé appartenant à une personne si l'application doit tourner durablement ; préférer une clé d'un projet OpenAI dédié.

### 3.3 LiveKit Cloud

1. Créer un projet sur [LiveKit Cloud](https://cloud.livekit.io/).
2. Ouvrir les paramètres du projet.
3. Copier l'URL WebSocket du projet, de forme `wss://...livekit.cloud`, dans `LIVEKIT_URL`.
4. Créer une paire de clés et copier l'API key dans `LIVEKIT_API_KEY` et le secret dans `LIVEKIT_API_SECRET`.

La clé et le secret doivent appartenir au même projet que l'URL. Un mélange de deux projets provoque des échecs de dispatch ou un worker invisible.

### 3.4 Trunk SIP et Caller ID

LiveKit transporte l'audio mais ne fournit pas automatiquement un numéro marocain sortant. Il faut généralement :

1. souscrire un trunk auprès d'un opérateur SIP autorisant les appels vers les mobiles marocains ;
2. configurer ce trunk dans **LiveKit Cloud / Telephony / SIP trunks** ;
3. récupérer son identifiant, généralement de forme `ST_...`, pour `SIP_TRUNK_ID` ;
4. utiliser comme `SIP_CALLER_ID` un numéro fourni ou vérifié par l'opérateur.

Lors d'un appel, LiveKit crée un participant SIP avec ce trunk puis le connecte à la room de l'agent. C'est le mécanisme documenté dans [Make outbound calls](https://docs.livekit.io/telephony/making-calls/outbound-calls/).

Ne pas inventer un Caller ID. L'opérateur peut rejeter l'appel ou remplacer le numéro s'il n'est pas autorisé.

### 3.5 Appels WhatsApp

Les variables `WHATSAPP_CALLS_*` concernent **l'audio WhatsApp Business Calling**, pas les alertes texte au superviseur.

Il faut :

- un numéro rattaché à WhatsApp Business ;
- un compte Meta Developer et une application Meta ;
- un token WhatsApp Cloud API ;
- le Phone Number ID du numéro appelant ;
- les permissions d'appel sortant Meta dans une région supportée ;
- le consentement explicite du constateur avant l'appel business-initiated ;
- un backend HTTPS public recevant les webhooks Meta ;
- l'abonnement au champ webhook `calls` ;
- la même version Cloud API dans Meta et l'application, `23.0` ou `24.0`.

Ces prérequis et l'échange SDP sont décrits dans la documentation officielle [LiveKit WhatsApp Connector](https://docs.livekit.io/telephony/connectors/whatsapp/).

Valeurs :

- `WHATSAPP_CALLS_ACCESS_TOKEN` : Meta Business Manager / System users ou le panneau WhatsApp de l'application. Pour la production, utiliser un token durable avec les permissions nécessaires ;
- `WHATSAPP_CALLS_PHONE_NUMBER_ID` : WhatsApp Manager / API Setup, sous le numéro d'envoi ;
- `WHATSAPP_APP_SECRET` : Meta Developer Dashboard / App settings / Basic / App Secret ;
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` : valeur aléatoire choisie par l'équipe, puis recopiée à l'identique dans la configuration du webhook Meta ;
- URL de callback : `https://BACKEND_PUBLIC/api/webhooks/whatsapp` ;
- `WHATSAPP_CALLS_DESTINATION_COUNTRY=MA` pour le Maroc.

N'activer `WHATSAPP_CALLS_ENABLED=true` qu'après un test réel de permission et de consentement.

### 3.6 Alertes texte au superviseur via M2S API

Ce canal est indépendant de l'appel audio WhatsApp. Il est utilisé après épuisement de WhatsApp et du SIP afin d'envoyer le message d'intervention humaine.

Demander à l'équipe qui exploite `m2s-api` :

- `M2S_WHATSAPP_API_URL` : URL publique de l'API, sans `/messages/text` à la fin ;
- `M2S_WHATSAPP_API_KEY` : clé Bearer autorisée à envoyer des messages ;
- `M2S_WHATSAPP_INSTANCE_ID` : identifiant de l'instance WhatsApp expéditrice.

Dans `/parametres`, un contact superviseur peut fournir sa propre clé M2S API et son propre ID d'instance. Ce profil sélectionné est prioritaire. Les trois variables ci-dessus et `ZINEB_WHATSAPP` servent de repli.

### 3.7 Synchronisation M2S

Les valeurs suivantes doivent être confirmées avec l'équipe propriétaire de l'API M2S :

- `M2S_DOSSIERS_API_URL` : endpoint de lecture des dossiers ;
- `M2S_API_TOKEN` : token Bearer de cet endpoint ;
- `M2S_WEBHOOK_SECRET` : secret HMAC partagé pour signer les webhooks ;
- `M2S_STATUS_FIELD` : chemin exact du statut dans le JSON, par exemple `dossier.statut` ;
- `M2S_VALIDATED_STATUS_VALUES` : statuts signifiant « validé », séparés par des virgules ;
- `M2S_ACTIVE_STATUS_VALUES` : statuts signifiant « encore actif », séparés par des virgules.

Ne pas deviner les noms de champs ou les statuts : ils constituent le contrat entre les deux applications.

## 4. Exemple complet de `.env` backend

Remplacer toutes les valeurs `CHANGE_ME`. Les commentaires placés sur des lignes séparées évitent les différences d'interprétation entre outils de déploiement.

```dotenv
# Données
DATABASE_URL=sqlite:///./vigie.db
USE_SUPABASE=true
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=sb_publishable_CHANGE_ME
SUPABASE_SERVICE_EMAIL=moteur@vigie.internal
SUPABASE_SERVICE_PASSWORD=CHANGE_ME
SUPABASE_SERVICE_ROLE_KEY=

# Moteur
ENGINE_AUTOSTART=true
ENGINE_TICK_SECONDS=60
VIGIE_API_KEY=CHANGE_ME_RANDOM_LONG
ENGINE_TICK_TOKEN=CHANGE_ME_RANDOM_LONG_DIFFERENT
CORS_ORIGINS=http://localhost:8080

# Test
MOCK_MODE=false
MOCK_ANSWER_RATE=0.7

# LiveKit et SIP — replis du backend + obligatoires au démarrage du worker
LIVEKIT_URL=wss://PROJECT.livekit.cloud
LIVEKIT_API_KEY=API_CHANGE_ME
LIVEKIT_API_SECRET=CHANGE_ME
SIP_TRUNK_ID=ST_CHANGE_ME
SIP_CALLER_ID=+212XXXXXXXXX
SIP_ESTIMATED_COST_PER_MINUTE_USD=0

# Appels WhatsApp audio
WHATSAPP_CALLS_ENABLED=false
WHATSAPP_CALLS_ACCESS_TOKEN=CHANGE_ME_META
WHATSAPP_CALLS_PHONE_NUMBER_ID=CHANGE_ME
WHATSAPP_CALLS_CLOUD_API_VERSION=24.0
WHATSAPP_CALLS_DESTINATION_COUNTRY=MA
WHATSAPP_CALLS_RINGING_TIMEOUT_SECONDS=35
WHATSAPP_ESTIMATED_COST_PER_MINUTE_USD=0

# OpenAI et moteur vocal — replis du worker
OPENAI_API_KEY=sk-proj-CHANGE_ME
VOICE_ENGINE=pipeline
OPENAI_REALTIME_MODEL=gpt-realtime-mini
STT_PROVIDER=openai
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_INPUT_LANGUAGE=ar
OPENAI_LLM_MODEL=gpt-4o-mini
TTS_PROVIDER=openai
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=ash

# Callback worker -> backend
VIGIE_API_BASE_URL=http://127.0.0.1:8000
AGENT_MAX_CALL_SECONDS=60
AGENT_MAX_RESPONSE_TOKENS=200
AGENT_MAX_TURNS=6

# Alerte texte via m2s-api
M2S_WHATSAPP_API_URL=https://M2S_API_HOST
M2S_WHATSAPP_API_KEY=CHANGE_ME
M2S_WHATSAPP_INSTANCE_ID=CHANGE_ME
ZINEB_WHATSAPP=+212XXXXXXXXX

# Webhooks Meta
WHATSAPP_WEBHOOK_VERIFY_TOKEN=CHANGE_ME_RANDOM
WHATSAPP_APP_SECRET=CHANGE_ME_META_APP_SECRET

# Compatibilité ancienne intégration Meta texte ; généralement laissée vide
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_TEMPLATE_NAME=vigie_handoff_humain
WHATSAPP_TEMPLATE_LANG=fr

# Synchronisation dossiers M2S
M2S_API_TOKEN=CHANGE_ME
M2S_WEBHOOK_SECRET=CHANGE_ME_RANDOM
M2S_STATUS_FIELD=
M2S_VALIDATED_STATUS_VALUES=
M2S_ACTIVE_STATUS_VALUES=
M2S_DOSSIERS_API_URL=
M2S_POLL_ENABLED=false
M2S_POLL_INTERVAL_SECONDS=300

# Générateur de démonstration — désactivé en production
AUTO_DOSSIER_ENABLED=false
AUTO_DOSSIER_INTERVAL_HOURS=2
AUTO_DOSSIER_CONSTATEUR_TEL=+212XXXXXXXXX
AUTO_DOSSIER_CONSTATEUR_NOM=Constateur M2S
AUTO_DOSSIER_CONSTATEUR_ZONE=Casablanca
AUTO_DOSSIER_REF_PREFIX=DOS-AUTO
```

### Générer les secrets internes

Générer deux ou trois valeurs différentes :

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Utiliser une sortie pour `VIGIE_API_KEY`, une autre pour `ENGINE_TICK_TOKEN`, une autre pour `M2S_WEBHOOK_SECRET` si M2S n'impose pas déjà la valeur.

## 5. Dictionnaire des variables backend

### Données et sécurité

| Variable                    | Usage                                                   |        Obligatoire en production | Source                                      |
| --------------------------- | ------------------------------------------------------- | -------------------------------: | ------------------------------------------- |
| `DATABASE_URL`              | Base SQLAlchemy locale/directe                          |            Non avec Supabase API | SQLite local ou connexion Postgres Supabase |
| `USE_SUPABASE`              | Active le repository Supabase                           |                     Oui : `true` | Choix d'architecture                        |
| `SUPABASE_URL`              | URL de l'API Supabase                                   |                              Oui | Dashboard Supabase                          |
| `SUPABASE_ANON_KEY`         | En-tête API public avant connexion du compte de service |                              Oui | Dashboard Supabase                          |
| `SUPABASE_SERVICE_EMAIL`    | Identité Auth du moteur                                 |                              Oui | Compte créé par l'administrateur            |
| `SUPABASE_SERVICE_PASSWORD` | Mot de passe de cette identité                          |                              Oui | Choisi lors de la création                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Accès serveur privilégié alternatif                     | Non dans l'architecture actuelle | Dashboard Supabase, si disponible           |
| `VIGIE_API_KEY`             | Protège les routes internes et le callback du worker    |                              Oui | Secret généré localement                    |
| `ENGINE_TICK_TOKEN`         | Protège le déclenchement manuel/cron du tick            |              Oui si cron externe | Secret généré localement                    |
| `CORS_ORIGINS`              | Origines frontend autorisées, séparées par des virgules |                              Oui | URL(s) du frontend                          |

### Exécution du moteur

| Variable              | Usage                                   | Valeur conseillée                    |
| --------------------- | --------------------------------------- | ------------------------------------ |
| `ENGINE_AUTOSTART`    | Lance la boucle d'escalade avec FastAPI | `true` sur un seul backend permanent |
| `ENGINE_TICK_SECONDS` | Fréquence de vérification               | `60`                                 |
| `MOCK_MODE`           | Simule les appels sans LiveKit/OpenAI   | `true` en test, `false` en réel      |
| `MOCK_ANSWER_RATE`    | Probabilité de réponse en simulation    | `0.7`                                |

Ne pas démarrer plusieurs réplicas avec `ENGINE_AUTOSTART=true` sans verrou distribué, sous peine de déclenchements concurrents.

### LiveKit, SIP et WhatsApp Calling

| Variable                                 | Usage                                            | Source                             |
| ---------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| `LIVEKIT_URL`                            | Projet média auquel backend/worker se connectent | LiveKit Cloud                      |
| `LIVEKIT_API_KEY`                        | Identifiant d'API LiveKit                        | LiveKit Cloud                      |
| `LIVEKIT_API_SECRET`                     | Secret de signature LiveKit                      | LiveKit Cloud                      |
| `SIP_TRUNK_ID`                           | Trunk sortant de repli                           | LiveKit Telephony                  |
| `SIP_CALLER_ID`                          | Numéro autorisé présenté au constateur           | Opérateur SIP                      |
| `SIP_ESTIMATED_COST_PER_MINUTE_USD`      | Estimation interne, sans effet sur la facture    | Contrat opérateur                  |
| `WHATSAPP_CALLS_ENABLED`                 | Autorise les appels WhatsApp audio               | `false` jusqu'à validation Meta    |
| `WHATSAPP_CALLS_ACCESS_TOKEN`            | Token Meta Cloud API pour les appels             | Meta                               |
| `WHATSAPP_CALLS_PHONE_NUMBER_ID`         | Numéro WhatsApp Business appelant                | Meta                               |
| `WHATSAPP_CALLS_CLOUD_API_VERSION`       | Version utilisée avec le connecteur              | `24.0`                             |
| `WHATSAPP_CALLS_DESTINATION_COUNTRY`     | Routage pays                                     | `MA`                               |
| `WHATSAPP_CALLS_RINGING_TIMEOUT_SECONDS` | Délai de sonnerie avant non-réponse              | `35`                               |
| `WHATSAPP_ESTIMATED_COST_PER_MINUTE_USD` | Estimation interne du transport WhatsApp         | Devis Meta/LiveKit ; `0` = inconnu |

### Agent OpenAI

| Variable                     | Usage                                             | Repli conseillé                   |
| ---------------------------- | ------------------------------------------------- | --------------------------------- |
| `OPENAI_API_KEY`             | Authentification OpenAI                           | Clé de projet dédiée              |
| `VOICE_ENGINE`               | `realtime` ou `pipeline`                          | `pipeline` pour le coût           |
| `OPENAI_REALTIME_MODEL`      | Modèle speech-to-speech                           | `gpt-realtime-mini`               |
| `STT_PROVIDER`               | Fournisseur transcription                         | `openai`                          |
| `OPENAI_TRANSCRIPTION_MODEL` | Modèle STT                                        | `gpt-4o-mini-transcribe`          |
| `OPENAI_INPUT_LANGUAGE`      | Langue STT                                        | `ar` pour darija code-switchée    |
| `OPENAI_LLM_MODEL`           | Modèle de compréhension/réponse                   | `gpt-4o-mini`                     |
| `TTS_PROVIDER`               | Fournisseur de voix                               | `openai`                          |
| `OPENAI_TTS_MODEL`           | Modèle de synthèse                                | `gpt-4o-mini-tts`                 |
| `OPENAI_TTS_VOICE`           | Voix                                              | `ash`, `coral`, `sage` ou `verse` |
| `AGENT_MAX_CALL_SECONDS`     | Coupure dure                                      | `60`                              |
| `AGENT_MAX_RESPONSE_TOKENS`  | Limite d'une réponse                              | `200`                             |
| `AGENT_MAX_TURNS`            | Nombre maximal de tours                           | `6`                               |
| `VIGIE_API_BASE_URL`         | Backend public auquel le worker poste le résultat | URL HTTPS du backend              |

### M2S, alertes et démonstration

| Variable                                                            | Usage                                           | Source                                   |
| ------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| `M2S_WHATSAPP_API_URL`                                              | Base URL d'envoi de l'alerte texte              | Équipe m2s-api                           |
| `M2S_WHATSAPP_API_KEY`                                              | Bearer de m2s-api                               | Équipe m2s-api                           |
| `M2S_WHATSAPP_INSTANCE_ID`                                          | Instance expéditrice                            | Équipe m2s-api                           |
| `ZINEB_WHATSAPP`                                                    | Destinataire de repli                           | Numéro superviseur                       |
| `WHATSAPP_APP_SECRET`                                               | Vérification de signature Meta                  | Meta App Settings                        |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`                                     | Challenge GET du webhook Meta                   | Secret choisi localement                 |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_*` | Compatibilité de l'ancienne alerte Meta directe | Laisser vide sauf réactivation explicite |
| `M2S_API_TOKEN`                                                     | Authentifie le polling M2S                      | Équipe M2S                               |
| `M2S_WEBHOOK_SECRET`                                                | Vérifie le webhook M2S                          | Secret partagé                           |
| `M2S_STATUS_FIELD`                                                  | Chemin du statut JSON                           | Contrat M2S                              |
| `M2S_VALIDATED_STATUS_VALUES`                                       | Liste des statuts validés                       | Contrat M2S                              |
| `M2S_ACTIVE_STATUS_VALUES`                                          | Liste des statuts actifs                        | Contrat M2S                              |
| `M2S_DOSSIERS_API_URL`                                              | Repli de l'URL de polling                       | Équipe M2S                               |
| `M2S_POLL_ENABLED`                                                  | Repli d'activation polling                      | `false` tant que non configuré           |
| `M2S_POLL_INTERVAL_SECONDS`                                         | Repli de cadence                                | `300`                                    |
| `AUTO_DOSSIER_*`                                                    | Générateur d'essai sans API M2S                 | Toujours désactivé en production         |

## 6. Comprendre la page `/parametres`

Toutes les cartes utilisent le même bouton **Enregistrer** en bas de page. Le bouton sauvegarde la ligne unique `settings.id = 1` dans Supabase.

### 6.1 Priorité entre dashboard et `.env`

| Réglage                                                     | Priorité normale           | Redémarrage                   |
| ----------------------------------------------------------- | -------------------------- | ----------------------------- |
| Seuils, stratégie d'appel, SLA, modèles et garde-fous       | `/parametres`              | Non, prochain appel/tick      |
| URL/clés LiveKit utilisées par le backend pour dispatcher   | `/parametres`, puis `.env` | Non pour le backend           |
| URL/clés LiveKit utilisées par le worker pour s'enregistrer | `.env` du worker           | **Oui, redémarrer le worker** |
| Clé OpenAI et configuration vocale d'un appel               | `/parametres`, puis `.env` | Non, prochain appel           |
| Secrets Meta/M2S et `VIGIE_API_KEY`                         | `.env` uniquement          | Oui dans le service concerné  |

Changer `LIVEKIT_URL` dans le dashboard ne déplace pas automatiquement un worker déjà connecté. Mettre les nouvelles valeurs dans son environnement et redémarrer `python -m agent.worker dev`.

### 6.2 Seuils d'escalade

Les seuils représentent le **temps restant avant la deadline**, pas le temps écoulé. Ils doivent être strictement décroissants. Le dernier seuil IA doit rester supérieur au seuil humain.

Exemple avec un SLA de 24 heures : relances à 12 h, 6 h et 3 h restantes, puis intervention humaine à 1 h restante.

### 6.3 Boucle d'appel

Deux stratégies sont proposées :

- **Appel téléphonique uniquement** : SIP jusqu'au quota, puis hand-off humain ;
- **WhatsApp puis téléphone** : WhatsApp jusqu'au quota de l'étape, puis SIP jusqu'au quota, puis hand-off humain et message WhatsApp au superviseur.

Les quotas sont comptés **par étape de relance**. Si le constateur répond à l'étape 1, la prochaine relance prévue par le SLA repart à l'étape 2 et commence de nouveau par WhatsApp. Le SIP n'est utilisé que lorsque les tentatives WhatsApp de l'étape courante échouent, ou immédiatement si le connecteur signale une erreur de permission/configuration.

Une réponse avec cause de retard termine la boucle de non-réponse de l'étape, mais ne valide pas le dossier. M2S reste la source de vérité ; une étape suivante peut donc avoir lieu si le dossier reste en retard.

### 6.4 SLA et superviseur

Le contact sélectionné reçoit l'alerte d'intervention humaine. Chaque profil contient :

- le numéro WhatsApp du superviseur ;
- la clé API M2S autorisée à envoyer ;
- l'ID de l'instance WhatsApp expéditrice.

Les secrets de ces profils sont stockés dans Supabase. Vérifier que les policies RLS limitent strictement la lecture/écriture aux rôles autorisés. Pour un niveau de sécurité supérieur, déplacer à terme ces secrets vers un coffre serveur et ne stocker qu'un identifiant de secret dans `settings`.

### 6.5 Synchronisation M2S

- **Désactivé** : aucun statut externe n'est lu ;
- **Webhook** : recommandé, M2S pousse immédiatement les changements vers `/api/webhooks/m2s/dossier-status` ;
- **Polling** : le backend interroge périodiquement l'URL configurée.

L'URL et la cadence sont réglables dans le dashboard. `M2S_API_TOKEN` et `M2S_WEBHOOK_SECRET` restent exclusivement dans `.env`.

### 6.6 Téléphonie IA (SIP)

- `SIP_TRUNK_ID` identifie le trunk stocké dans LiveKit ;
- `SIP_CALLER_ID` est le numéro autorisé présenté au constateur.

Ces valeurs s'appliquent au prochain appel. Les identifiants d'authentification de l'opérateur restent dans la configuration du trunk LiveKit, pas dans le frontend.

### 6.7 Moteur vocal

**Realtime** est une conversation audio-à-audio fluide :

- `gpt-realtime` : meilleure qualité, coût élevé ;
- `gpt-realtime-mini` : plus économique.

**Pipeline** sépare les responsabilités :

1. STT : `gpt-4o-mini-transcribe` ou `gpt-4o-transcribe` ;
2. LLM : `gpt-4o-mini` ou `gpt-4.1-mini` ;
3. TTS : `gpt-4o-mini-tts`.

Le pipeline est recommandé pour maîtriser le budget. Si son initialisation échoue, le code tente un repli Realtime et conserve la raison dans la trace d'appel.

### 6.8 Agent vocal & LiveKit

Cette carte contrôle la connexion LiveKit du backend, la clé OpenAI transmise au prochain job, l'URL de callback et les garde-fous :

- **Durée max** : limite la durée facturable ;
- **Tokens max par réponse** : évite les monologues ;
- **Tours max** : force la clôture d'une conversation qui tourne en boucle.

Valeurs initiales raisonnables pour un appel moyen de 45 secondes : 60 secondes, 200 tokens, 6 tours.

## 7. Procédure de démarrage et de validation

### 7.1 Installation

Frontend :

```powershell
npm install
npm run dev
```

Backend et agent :

```powershell
cd vigie-backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r agent/requirements-agent.txt
python -m agent.worker download-files
```

### 7.2 Ordre de test recommandé

1. Mettre `MOCK_MODE=true` et valider le frontend, Supabase, les seuils et le moteur sans aucun coût téléphonique.
2. Lancer FastAPI et vérifier `GET /health`.
3. Lancer le worker et vérifier dans LiveKit qu'il est enregistré sous `vigie-agent`.
4. Tester l'agent avec le LiveKit Agents Playground, sans SIP.
5. Tester un appel SIP vers un numéro interne autorisé.
6. Configurer le webhook Meta public et tester WhatsApp avec un utilisateur consentant.
7. Tester la stratégie mixte : non-réponse WhatsApp, appel SIP, non-réponse SIP, puis alerte superviseur.
8. Mettre `MOCK_MODE=false`, `AUTO_DOSSIER_ENABLED=false` et restreindre `CORS_ORIGINS` avant production.

### 7.3 Checklist de fonctionnement

- le frontend affiche les dossiers Supabase ;
- la ligne `settings.id=1` est lisible et modifiable par un administrateur ;
- le backend affiche « Couche données : Supabase » au démarrage ;
- le worker apparaît connecté dans LiveKit ;
- le backend et le worker utilisent exactement le même `VIGIE_API_KEY` ;
- `VIGIE_API_BASE_URL` est joignable depuis le worker ;
- le trunk autorise le Caller ID et les destinations marocaines ;
- Meta appelle bien l'URL webhook en HTTPS et la signature est acceptée ;
- les résultats créent une trace d'appel, une transcription et une cause ;
- une validation M2S empêche toute relance supplémentaire.

## 8. Estimation pour 4 000 minutes par mois

### 8.1 Hypothèses

Les calculs ci-dessous supposent :

- 4 000 minutes **connectées et traitées par l'agent** ;
- 50 % de parole du constateur et 50 % de parole de l'IA ;
- environ 1 000 tokens d'entrée LLM et 100 tokens de sortie LLM par minute pour le pipeline, hypothèse volontairement prudente ;
- conversion budgétaire arrondie à **1 USD = 10 DH**, et non un taux bancaire garanti ;
- hors taxes, hébergement, support, numéro SIP et coût de terminaison de l'opérateur ;
- prix publics observés le 20 juillet 2026.

Attention à l'unité : 100 appels/jour × 30 jours × 45 secondes représentent **2 250 minutes audio réelles**, et non 4 000. En revanche, LiveKit arrondit chaque ressource à la minute supérieure : 3 000 sessions de 45 secondes peuvent compter comme environ 3 000 minutes LiveKit. La documentation précise qu'une session de 10 secondes compte une minute et une session de 70 secondes deux minutes : [LiveKit Cloud billing](https://docs.livekit.io/deploy/admin/billing/).

### 8.2 Tarifs OpenAI des modèles intégrés

| Modèle                   | Rôle                     | Tarif public utile au calcul                                           |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| `gpt-realtime`           | Audio-à-audio            | audio entrée 32 USD/M tokens, audio sortie 64 USD/M ; texte 4/16 USD/M |
| `gpt-realtime-mini`      | Audio-à-audio économique | estimation LiveKit : 0,0216 USD/min ; texte OpenAI 0,60/2,40 USD/M     |
| `gpt-4o-mini-transcribe` | STT                      | audio entrée 1,25 USD/M, sortie 5 USD/M                                |
| `gpt-4o-transcribe`      | STT qualité              | audio entrée 2,50 USD/M, sortie 10 USD/M                               |
| `gpt-4o-mini`            | LLM économique           | texte entrée 0,15 USD/M, sortie 0,60 USD/M                             |
| `gpt-4.1-mini`           | LLM qualité              | texte entrée 0,40 USD/M, sortie 1,60 USD/M                             |
| `gpt-4o-mini-tts`        | Synthèse vocale          | texte entrée 0,60 USD/M, audio sortie 12 USD/M                         |

Sources officielles : [gpt-realtime](https://developers.openai.com/api/docs/models/gpt-realtime), [gpt-realtime-mini](https://developers.openai.com/api/docs/models/gpt-realtime-mini), [gpt-4o-mini-transcribe](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe), [gpt-4o-transcribe](https://developers.openai.com/api/docs/models/gpt-4o-transcribe), [gpt-4o-mini](https://developers.openai.com/api/docs/models/gpt-4o-mini), [gpt-4.1-mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) et [gpt-4o-mini-tts](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts).

Pour Realtime, OpenAI indique environ un token audio pour 100 ms de parole utilisateur et un token pour 50 ms de parole assistant. L'historique est réinjecté aux tours suivants, ce qui augmente le coût des tours tardifs : [Managing Realtime costs](https://developers.openai.com/api/docs/guides/realtime-costs).

### 8.3 Coût OpenAI mensuel estimé

| Configuration       |            Calcul de planification |          4 000 min |   En DH indicatifs |
| ------------------- | ---------------------------------: | -----------------: | -----------------: |
| `gpt-realtime`      |  estimation LiveKit 0,0676 USD/min |     **270,40 USD** |       **2 704 DH** |
| `gpt-realtime-mini` |  estimation LiveKit 0,0216 USD/min |      **86,40 USD** |         **864 DH** |
| Pipeline économique |     mini STT + `gpt-4o-mini` + TTS | **environ 42 USD** | **environ 420 DH** |
| Pipeline qualité    | STT qualité + `gpt-4.1-mini` + TTS | **environ 55 USD** | **environ 550 DH** |

Détail du pipeline économique : environ 12 USD de transcription, 0,84 USD de LLM et 28,80 USD de voix. Le pipeline qualité utilise environ 24 USD de transcription, 2,24 USD de LLM et la même enveloppe TTS. Pour rendre l'estimation reproductible, la transcription est budgétée à environ 0,003 USD/min pour le modèle mini et 0,006 USD/min pour le modèle qualité sur les 4 000 minutes ; la voix suppose 2 000 minutes de parole IA. Ce sont des équivalents de planification dérivés des tarifs par token, pas des forfaits contractuels. Le coût réel dépend principalement du temps parlé, du nombre de tours et de la quantité de contexte.

Contrôle de cohérence pour `gpt-realtime` : avec 2 000 minutes de parole utilisateur et 2 000 minutes de parole IA, l'audio brut donne environ 1,2 M tokens d'entrée et 2,4 M tokens de sortie, soit 38,40 + 153,60 = **192 USD** avant l'historique texte/audio réinjecté. L'estimation de 270,40 USD laisse une marge plus réaliste pour les conversations multi-tours.

Le code de Vigie affiche actuellement une estimation interne de 0,05 USD/min pour tout moteur Realtime et 0,01 USD/min pour le pipeline. Cette estimation donne 200 USD ou 40 USD, mais elle ne distingue pas `gpt-realtime` de `gpt-realtime-mini`. La facture OpenAI reste la référence.

### 8.4 Coût LiveKit Cloud

Les tarifs publics LiveKit indiquent :

- plan Build : 0 USD/mois, 1 000 agent-session minutes, 1 000 minutes de SIP tiers et 5 000 minutes WebRTC incluses ;
- plan Ship : à partir de 50 USD/mois, 5 000 agent-session minutes et 5 000 minutes de SIP tiers incluses ;
- au-delà du quota Ship : 0,01 USD/min d'agent session et 0,004 USD/min de SIP tiers ;
- isolation vocale : 1 000 minutes incluses avec Ship, puis 0,0012 USD/min.

La grille complète est sur [LiveKit Pricing](https://livekit.com/pricing).

Pour 4 000 minutes, le plan de production **Ship à 50 USD/mois** est l'hypothèse prudente : les minutes d'agent et de SIP restent sous les quotas de 5 000. Le worker utilise `BVCTelephony` ; si les 4 000 minutes sont facturées comme isolation vocale, ajouter environ 3,60 USD au-delà des 1 000 minutes incluses. Enveloppe LiveKit estimée :

```text
50,00 USD de plan + 3,60 USD d'isolation ≈ 53,60 USD ≈ 536 DH/mois
```

Si le worker reste auto-hébergé, les « agent session minutes » hébergées ne s'appliquent pas de la même façon, mais le média, les participants, le SIP et les Connectors peuvent rester mesurés. Confirmer le compteur exact dans le dashboard LiveKit après un pilote.

Le connecteur WhatsApp est encore présenté comme une fonctionnalité Beta et aucun tarif WhatsApp Connector distinct n'apparaît clairement dans la grille publique consultée. Il faut demander une confirmation écrite à LiveKit/Meta ; `WHATSAPP_ESTIMATED_COST_PER_MINUTE_USD=0` signifie « coût inconnu », pas « gratuit ».

### 8.5 Totaux de planification

| Scénario            |     OpenAI |   LiveKit |     Sous-total | DH indicatifs | Budget 2 500 DH                  |
| ------------------- | ---------: | --------: | -------------: | ------------: | -------------------------------- |
| Realtime qualité    | 270,40 USD | 53,60 USD | **324,00 USD** |  **3 240 DH** | Non, avant transport/hébergement |
| Realtime mini       |  86,40 USD | 53,60 USD | **140,00 USD** |  **1 400 DH** | Possible avec marge limitée      |
| Pipeline économique |     42 USD | 53,60 USD |  **95,60 USD** |    **956 DH** | Oui, marge d'environ 1 544 DH    |
| Pipeline qualité    |     55 USD | 53,60 USD | **108,60 USD** |  **1 086 DH** | Oui, marge d'environ 1 414 DH    |

Ces sous-totaux n'incluent pas :

- la terminaison téléphonique facturée par l'opérateur SIP ;
- un éventuel tarif spécifique WhatsApp Connector/Meta ;
- Supabase, Render/Railway/Vercel ou un autre hébergement ;
- taxes et conversion bancaire.

### 8.6 Risque majeur : coût du trunk SIP

Le fichier `.env.example` historique contient une estimation de `1.4267 USD/min`, issue d'un test à environ 1,07 USD pour 45 secondes. À ce niveau :

```text
4 000 × 1,4267 = 5 706,80 USD ≈ 57 068 DH/mois
```

Ce coût rend le budget impossible. Avant la production, remplacer cette estimation par le tarif contractuel réel et obtenir un prix de terminaison Maroc nettement inférieur. Le coût LiveKit des « third-party SIP minutes » ne remplace pas la facture de l'opérateur SIP.

### 8.7 Recommandation pour rester sous 2 500 DH

Configuration de départ recommandée :

- stratégie **WhatsApp puis téléphone** ;
- modèle **pipeline** avec `gpt-4o-mini-transcribe`, `gpt-4o-mini` et `gpt-4o-mini-tts` ;
- maximum 60 secondes, 200 tokens et 6 tours ;
- SIP uniquement en repli après échec WhatsApp ;
- plan LiveKit Ship pour le pilote de production ;
- alerte humaine texte via m2s-api après épuisement des canaux ;
- plafond OpenAI et alertes de budget ;
- mesure séparée des minutes WhatsApp, SIP, agent et des appels non décrochés.

Cette configuration laisse environ 1 500 DH de marge théorique pour l'hébergement, le connecteur WhatsApp et une petite quantité de SIP. Elle ne peut être garantie sous 2 500 DH qu'après réception du devis WhatsApp/Meta et du tarif de l'opérateur SIP marocain.

## 9. Sécurité et exploitation

- Restreindre `CORS_ORIGINS` aux domaines exacts du frontend.
- Conserver `VIGIE_API_KEY` identique entre backend et worker, mais jamais dans React.
- Faire tourner un seul moteur autonome ou ajouter un verrou distribué.
- Appliquer les migrations Supabase avant le déploiement du code correspondant.
- Vérifier les RLS sur `settings`, `whatsapp_contacts`, `dossiers`, `appels` et `transcriptions`.
- Faire une rotation immédiate d'une clé publiée accidentellement dans Git ou copiée dans une capture d'écran.
- Ne pas journaliser les clés, tokens, mots de passe ni le corps brut signé contenant des données sensibles.
- Définir des alertes de consommation dans OpenAI, LiveKit et l'opérateur SIP.
- Conserver le consentement WhatsApp du constateur et une preuve de la base légale du traitement des appels/transcriptions.

## 10. Dépannage rapide

### Le frontend dit que les variables Supabase manquent

- vérifier que le fichier s'appelle exactement `.env` ;
- le placer à la racine où se trouve `package.json` ;
- utiliser `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` ;
- redémarrer `npm run dev`.

### FastAPI ne trouve pas `app`

Exécuter `uvicorn app.main:app` depuis le dossier `vigie-backend`, pas depuis la racine du frontend.

### Le backend fonctionne mais aucun appel ne part

- vérifier `MOCK_MODE=false` ;
- vérifier que le worker est lancé et visible dans LiveKit ;
- vérifier que le nom de l'agent est `vigie-agent` ;
- vérifier URL, key et secret LiveKit dans le worker et dans `/parametres` ;
- vérifier la fenêtre horaire, le statut du dossier et le seuil SLA ;
- pour le SIP, vérifier `SIP_TRUNK_ID` et le Caller ID autorisé.

### WhatsApp bascule immédiatement vers le SIP

Lire `fallback_reason` dans la trace. Les causes probables sont : fonctionnalité désactivée, token absent/expiré, Phone Number ID incorrect, région non supportée, consentement absent, événement `calls` non abonné ou webhook inaccessible.

### L'appel se termine mais le résultat n'arrive pas

- `VIGIE_API_BASE_URL` doit être joignable depuis le worker ;
- le backend et le worker doivent partager le même `VIGIE_API_KEY` ;
- une preview HTTPS ne peut pas appeler `127.0.0.1` sur une autre machine ;
- consulter les logs du POST vers `/api/webhooks/calls/{call_id}/result`.

## 11. Liens officiels à conserver

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [LiveKit pricing](https://livekit.com/pricing)
- [LiveKit Cloud billing](https://docs.livekit.io/deploy/admin/billing/)
- [LiveKit outbound SIP calls](https://docs.livekit.io/telephony/making-calls/outbound-calls/)
- [LiveKit WhatsApp Connector](https://docs.livekit.io/telephony/connectors/whatsapp/)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI Realtime cost guide](https://developers.openai.com/api/docs/guides/realtime-costs)

---

### Résumé pour la personne qui reprend le projet

1. Configurer Supabase dans le `.env` frontend.
2. Configurer Supabase, les secrets internes, M2S et Meta dans le `.env` backend.
3. Mettre les mêmes clés LiveKit et `VIGIE_API_KEY` dans l'environnement du worker.
4. Régler les choix métier et les modèles dans `/parametres`.
5. Tester d'abord en mock, puis Playground, SIP et enfin WhatsApp.
6. Pour 4 000 minutes et un budget de 2 500 DH, commencer avec le pipeline économique ou `gpt-realtime-mini`, limiter le SIP et obtenir les tarifs contractuels manquants avant la mise en production.
