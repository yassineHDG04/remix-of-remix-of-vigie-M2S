# Chantier 3 — Appel WhatsApp puis repli téléphonique

## 1. Objectif

Le scénario est configurable depuis `/parametres` :

- **Téléphone uniquement** : le moteur conserve le fonctionnement SIP actuel.
- **WhatsApp puis téléphone** : le moteur tente d'abord l'appel WhatsApp, puis
  bascule vers le téléphone SIP si le constateur ne répond pas. Après épuisement
  des tentatives téléphoniques, l'intervention humaine existante est déclenchée
  et le superviseur sélectionné reçoit l'alerte WhatsApp.

Le mode par défaut reste `sip`. Une migration ne démarre donc aucun appel
WhatsApp tant que l'utilisateur n'a pas choisi le mode mixte.

## 2. Ordre exact de la boucle

Pour une étape donnée :

1. jusqu'à `whatsapp_max_attempts` tentatives WhatsApp ;
2. jusqu'à `max_call_attempts` tentatives téléphoniques SIP ;
3. intervention humaine et alerte au superviseur.

Une erreur immédiate de configuration ou de fournisseur WhatsApp provoque un
repli SIP sans attendre le prochain intervalle. Une non-réponse normale compte
comme une tentative WhatsApp et respecte `retry_interval_minutes`.

## 3. Modifications livrées

- migration Supabase : paramètres de routage et traçabilité des appels ;
- `/parametres` : choix du scénario et nombre de tentatives WhatsApp ;
- moteur : quotas distincts WhatsApp/SIP et repli automatique ;
- fournisseur WhatsApp LiveKit : création, connexion et déconnexion d'appel ;
- webhook Meta : traitement des événements `calls` et de l'offre SDP ;
- worker vocal : attente du participant WhatsApp, conversation et résultat ;
- journal des appels : canal utilisé, motif de repli, connexion et coût estimé.

`m2s-api` reste le canal d'envoi des messages WhatsApp métier et de l'alerte
humaine. Il n'est pas utilisé comme transport audio.

## 4. Prérequis Meta et LiveKit

Avant d'activer les appels réels :

1. utiliser un numéro enregistré dans WhatsApp Business ;
2. disposer d'un token WhatsApp Cloud API avec les droits d'appel ;
3. renseigner l'identifiant du numéro WhatsApp (`phone_number_id`) ;
4. faire autoriser les appels sortants dans une région prise en charge ;
5. obtenir le consentement explicite du constateur avant l'appel sortant ;
6. publier le webhook HTTPS du backend et abonner l'application aux événements
   d'appel WhatsApp ;
7. utiliser WhatsApp Cloud API v23.0 ou v24.0 ;
8. conserver `WHATSAPP_APP_SECRET` dans le backend pour vérifier la signature
   Meta des webhooks.

Le connecteur WhatsApp LiveKit est actuellement annoncé en bêta. Pour un appel
sortant, Meta envoie une réponse SDP au webhook et le backend doit exécuter la
connexion LiveKit rapidement. Sans webhook public fonctionnel, l'appel ne peut
pas établir l'audio.

Documentation officielle :

- https://docs.livekit.io/telephony/connectors/whatsapp/
- https://docs.livekit.io/reference/telephony/connectors-api/

## 5. Installation et migration

Depuis la racine du frontend :

```bash
npx supabase db push
```

Puis dans le backend :

```bash
cd vigie-backend
python -m venv .venv
# Windows PowerShell : .venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r agent/requirements-agent.txt
```

La migration concernée est :
`supabase/migrations/20260720170000_chantier3_routage_appels.sql`.

## 6. Variables d'environnement

Dans le processus **backend FastAPI** :

```dotenv
WHATSAPP_CALLS_ENABLED=false
WHATSAPP_CALLS_ACCESS_TOKEN=
WHATSAPP_CALLS_PHONE_NUMBER_ID=
WHATSAPP_CALLS_CLOUD_API_VERSION=24.0
WHATSAPP_CALLS_DESTINATION_COUNTRY=MA
WHATSAPP_CALLS_RINGING_TIMEOUT_SECONDS=35

WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=

SIP_ESTIMATED_COST_PER_MINUTE_USD=0
WHATSAPP_ESTIMATED_COST_PER_MINUTE_USD=0
```

Le processus **worker LiveKit** doit également recevoir :

```dotenv
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
WHATSAPP_CALLS_ACCESS_TOKEN=...
VIGIE_API_BASE_URL=https://backend.example.com
VIGIE_API_KEY=...
```

`WHATSAPP_ESTIMATED_COST_PER_MINUTE_USD=0` signifie **tarif inconnu**, et non
pas gratuit. Remplacer cette valeur par le tarif contractuel réellement obtenu.

## 7. Recette progressive

1. Appliquer la migration et redémarrer frontend, backend et worker.
2. Garder `WHATSAPP_CALLS_ENABLED=false`.
3. Choisir « WhatsApp puis téléphone » dans `/parametres`.
4. Déclencher un dossier de test : l'échec WhatsApp doit être tracé et le moteur
   doit basculer immédiatement vers SIP.
5. Configurer le webhook Meta public et vérifier son challenge GET.
6. Vérifier une requête POST signée avec un événement d'appel de test.
7. Confirmer l'autorisation Meta, le consentement et la disponibilité régionale.
8. Passer `WHATSAPP_CALLS_ENABLED=true`, redémarrer et tester d'abord avec un
   seul numéro autorisé.
9. Contrôler la conversation, le résultat, le canal et le coût estimé dans
   l'historique d'appels.

En cas de problème, repasser immédiatement `WHATSAPP_CALLS_ENABLED=false` ou
sélectionner « Téléphone uniquement ». Le fonctionnement SIP reste disponible.

## 8. Contrôles techniques

```bash
PYTHONPATH=vigie-backend python -m unittest discover -s vigie-backend/tests -v
npm run build
```

Les tests de routage vérifient notamment que le moteur n'effectue jamais
l'intervention humaine à la fin des seules tentatives WhatsApp : il doit d'abord
épuiser les tentatives SIP.

## 9. Coût et limite budgétaire

À 100 appels par jour, 45 secondes en moyenne et 30 jours, la charge représente
environ **3 000 appels et 2 250 minutes par mois**.

Avec le coût SIP précédemment observé d'environ 1,07 USD par appel, un trafic
100 % téléphonique coûterait près de 3 210 USD par mois et dépasserait très
largement 2 500 DH. La contrainte budgétaire n'est réaliste que si la grande
majorité des appels passe par un transport WhatsApp réellement peu coûteux et
si les coûts IA, LiveKit, hébergement et Meta restent sous contrôle.

Avant production, demander un devis écrit pour le connecteur WhatsApp/LiveKit,
mesurer le taux réel de repli SIP et configurer le tarif par minute. Le logiciel
trace le canal et le coût estimé, mais il ne peut pas garantir le budget sans
les prix contractuels du fournisseur.
