# Chantier 1 — Moteur vocal configurable

## 1. Objectif

Permettre de choisir depuis `/parametres`, sans redéploiement, entre :

- `realtime` : OpenAI Realtime speech-to-speech, meilleure fluidité ;
- `pipeline` : OpenAI STT → LLM → TTS, moins cher mais plus lent.

Le SIP existant reste inchangé. Le moteur est construit au démarrage de chaque job LiveKit à partir
des paramètres transmis par le backend.

## 2. Fonctionnement obtenu

- La table `settings` contient le choix du moteur et les modèles associés.
- Le backend relit `settings` lors du dispatch et transmet la configuration au worker.
- Le worker construit `AgentSession` avec Realtime ou avec le pipeline demandé.
- Si le pipeline échoue pendant sa construction ou son `session.start()`, le worker ferme la session
  incomplète et tente immédiatement Realtime.
- Le function calling reste porté par le même `VigieAgent` dans les deux modes.
- Durée maximale, plafond de tokens et nombre de tours s'appliquent aux deux modes.
- `ctx.add_shutdown_callback()` reste l'unique point d'envoi du résultat final.
- Chaque appel enregistre `voice_engine_used`, `models_used` et `estimated_cost_usd`.

L'estimation de coût concerne uniquement l'IA. Elle n'inclut ni LiveKit Cloud, ni le trunk SIP, ni
Twilio. La facture réelle du fournisseur reste la référence.

## 3. Fichiers concernés

- Migration : `supabase/migrations/20260720140000_chantier1_moteur_vocal.sql`
- Worker : `vigie-backend/agent/worker.py`, `vigie-backend/agent/voice_config.py`
- Backend : `app/models.py`, `app/repo.py`, `app/schemas.py`, `app/engine.py`,
  `app/providers/telephony.py`, `app/routers/calls.py`, `app/main.py`
- Frontend : `src/data/types.ts`, `src/lib/api.ts`, `src/integrations/supabase/types.ts`,
  `src/routes/parametres.tsx`
- Tests : `vigie-backend/tests/test_voice_config.py`

## 4. Modifications principales

### Paramètres

Les valeurs par défaut ne cassent pas l'existant :

```text
voice_engine=realtime
realtime_model=gpt-realtime
stt_provider=openai
stt_model=gpt-4o-mini-transcribe
stt_language=ar
llm_model=gpt-4o-mini
tts_provider=openai
tts_model=gpt-4o-mini-tts
tts_voice_id=ash
```

Le premier incrément prend volontairement en charge OpenAI comme fournisseur STT/TTS. Cela réutilise
la clé déjà présente et évite d'afficher des fournisseurs non implémentés. L'architecture pourra être
étendue plus tard sans modifier le contrat de la table.

### Traçabilité

```sql
SELECT
  voice_engine_used,
  count(*) AS appels,
  avg(duration_sec) AS duree_moyenne_sec,
  avg(estimated_cost_usd) AS cout_ia_moyen_usd
FROM public.calls
WHERE ended_at IS NOT NULL
GROUP BY voice_engine_used;
```

## 5. Commandes d'installation

Depuis la racine du dépôt :

```powershell
npx supabase db push

cd vigie-backend
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r agent\requirements-agent.txt
python -m agent.worker download-files
```

`download-files` télécharge les poids Silero VAD nécessaires au pipeline. Redémarrer ensuite le
backend et le worker une fois pour charger le nouveau code :

```powershell
uvicorn app.main:app --reload --port 8000
python -m agent.worker dev
```

Après cette installation, modifier le moteur ou les modèles dans `/parametres` ne nécessite plus de
redémarrage : le changement s'applique au prochain appel.

## 6. Variables d'environnement

Aucune nouvelle clé fournisseur n'est requise. `OPENAI_API_KEY` reste commune aux deux moteurs.
Les variables ci-dessous ne sont que des replis pour le Playground ou une installation non migrée :

```env
VOICE_ENGINE=realtime
OPENAI_REALTIME_MODEL=gpt-realtime
STT_PROVIDER=openai
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_INPUT_LANGUAGE=ar
OPENAI_LLM_MODEL=gpt-4o-mini
TTS_PROVIDER=openai
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=ash
```

Ne jamais mettre `OPENAI_API_KEY`, `LIVEKIT_API_SECRET` ou `VIGIE_API_KEY` dans une variable frontend
`VITE_*`.

## 7. Méthode de test

### Tests automatiques

```powershell
cd vigie-backend
python -m unittest discover -s tests -v
cd ..
npm run build
```

Résultat obtenu lors de la livraison : 22 tests backend réussis et build TypeScript réussi.

### Recette fonctionnelle

1. Appliquer la migration.
2. Ouvrir `/parametres`, choisir `Realtime`, enregistrer puis lancer un appel de test.
3. Vérifier dans `calls` : `voice_engine_used='realtime'` et le modèle dans `models_used`.
4. Choisir `Pipeline`, conserver les valeurs économiques par défaut et enregistrer.
5. Lancer un second appel et vérifier `voice_engine_used='pipeline'`, la transcription et la cause.
6. Pour tester le fallback, saisir temporairement un nom de modèle pipeline invalide, lancer un appel,
   puis vérifier `voice_engine_used='realtime'` et `models_used.fallback_from='pipeline'`.
7. Restaurer immédiatement le modèle valide après le test.
8. Vérifier que le résultat n'est posté qu'après la fin réelle de l'appel.

Un appel téléphonique réel reste nécessaire avant de déclarer le pipeline validé pour la darija.

## 8. Erreurs possibles

- `No module named livekit.plugins.silero` : réinstaller `agent/requirements-agent.txt`.
- Poids Silero absents : exécuter `python -m agent.worker download-files`.
- Pipeline puis Realtime en échec : contrôler `OPENAI_API_KEY`. Le fallback ne peut pas compenser
  une clé commune absente ou une panne complète d'OpenAI.
- Aucun changement après enregistrement : vérifier que la migration a été appliquée et que le backend
  transmet les nouveaux champs dans les métadonnées du dispatch.
- Latence élevée : comparer `gpt-4o-mini` et `gpt-4.1-mini`, puis revenir à Realtime si la qualité de
  la conversation devient insuffisante.

## 9. Coût et qualité attendus

Hypothèse : 100 appels/jour, 45 secondes/appel, 30 jours, soit 2 250 minutes connectées/mois.

| Mode     | Coût IA estimé/min |             Coût IA mensuel | Latence de réponse attendue | Risque darija                         |
| -------- | -----------------: | --------------------------: | --------------------------: | ------------------------------------- |
| Realtime |         ~0,050 USD | ~112,50 USD, soit ~1 027 DH |                ~0,3 à 0,8 s | Référence actuelle                    |
| Pipeline |         ~0,010 USD |    ~22,50 USD, soit ~205 DH |                ~1,2 à 2,5 s | Dégradation possible de 5 à 20 points |

Conversion indicative utilisée : 1 USD ≈ 9,1283 DH. Les montants sont des estimations d'ingénierie,
pas une promesse de facturation. Pour mesurer la qualité, réaliser un A/B test sur au moins 100 appels
et comparer cause captée, taux d'incompréhension, latence et fallback.

Le budget total inférieur à 2 500 DH/mois ne peut pas encore être garanti, car cette estimation
n'inclut pas le coût téléphonique SIP/Twilio. Ce poste sera traité dans le chantier 3.

Références :

- [OpenAI dans LiveKit Agents](https://docs.livekit.io/agents/integrations/openai/)
- [Plugin STT OpenAI LiveKit](https://docs.livekit.io/agents/models/stt/openai/)
- [Plugin TTS OpenAI LiveKit](https://docs.livekit.io/agents/models/tts/openai/)
- [Silero VAD LiveKit](https://docs.livekit.io/agents/logic-structure/turns/vad/)
- [Tarifs et modèles OpenAI](https://openai.com/api/pricing/)
- [Cours de change Bank Al-Maghrib](https://www.bkam.ma/en/Markets/Key-indicators/Foreign-exchange-market)
