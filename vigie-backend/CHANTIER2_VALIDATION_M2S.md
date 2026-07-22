# Chantier 2 — Validation pilotée exclusivement par M2S

## 1. Objectif

Le constateur valide le dossier dans la plateforme M2S. Nida'a/Vigie observe cette validation,
met immédiatement le dossier hors du cycle de relance et ne propose aucune action de validation
dans son dashboard.

## 2. Fonctionnement obtenu

- **Webhook recommandé** : `POST /api/webhooks/m2s/dossier-status`, signature HMAC SHA-256,
  `event_id` obligatoire et journal idempotent.
- **Polling de secours** : le poller met désormais à jour les dossiers déjà connus et détecte leurs
  changements de statut ; il ne se limite plus aux créations.
- **Sécurité serveur** : l'ancienne route `POST /api/dossiers/{id}/validate` répond `403`.
- **Sécurité Supabase** : RLS + trigger interdisent la transition vers `valide` à un utilisateur
  normal. Seuls la `service_role` ou `moteur@vigie.internal` avec `role=admin` peuvent l'appliquer.
- **Arrêt des relances** : contrôles avant planification, avant dispatch et juste avant composition.
  Un résultat d'appel tardif est archivé, sans reprogrammer de relance.
- **Frontend** : le bouton de validation a été remplacé par un indicateur explicatif en lecture
  seule. Le mode M2S, l'URL de polling et sa cadence sont pilotables dans `/parametres`.

## 3. Fichiers principaux concernés

- Backend : `app/providers/m2s.py`, `app/routers/m2s_webhook.py`, `app/importer.py`, `app/repo.py`,
  `app/engine.py`, `agent/worker.py`, `app/security.py`, `app/config.py`.
- Frontend : `src/routes/dossiers.$id.tsx`, `src/routes/parametres.tsx`, `src/data/types.ts`,
  `src/lib/api.ts`, `src/lib/hooks.ts`.
- Base : `supabase/migrations/20260720120000_chantier2_validation_m2s.sql`.

## 4. Modifications nécessaires avant activation réelle

Le nom et les valeurs du statut M2S sont volontairement inconnus dans le code. Après réponse de
M2S, renseigner les variables correspondantes sans modifier le mapper :

```env
M2S_STATUS_FIELD=CHEMIN_JSON_CONFIRME
M2S_VALIDATED_STATUS_VALUES=VALEUR_1,VALEUR_2
M2S_ACTIVE_STATUS_VALUES=VALEUR_3,VALEUR_4
```

La notation pointée est acceptée, par exemple `dossier.statut`, si le statut est imbriqué.

## 5. Commandes de mise en place

1. Appliquer la migration avec le SQL Editor Supabase, ou avec la CLI :

   ```powershell
   npx supabase db push
   ```

2. Générer le secret webhook et placer la même valeur dans le backend et chez M2S :

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

3. Redémarrer le backend après modification de son `.env` :

   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```

4. Dans `/parametres`, choisir `Webhook (recommandé)` ou `Polling API`, puis enregistrer.
5. Quand l'API réelle remplace le générateur, mettre `AUTO_DOSSIER_ENABLED=false`.

## 6. Variables d'environnement

```env
# Secret entrant : obligatoire en mode webhook, jamais exposé au frontend.
M2S_WEBHOOK_SECRET=

# Secret sortant : utilisé uniquement en mode polling.
M2S_API_TOKEN=

# Contrat à remplir uniquement après confirmation par M2S.
M2S_STATUS_FIELD=
M2S_VALIDATED_STATUS_VALUES=
M2S_ACTIVE_STATUS_VALUES=
```

`M2S_DOSSIERS_API_URL`, `M2S_POLL_ENABLED` et `M2S_POLL_INTERVAL_SECONDS` restent des replis pour
une installation ancienne ; après migration, le mode, l'URL et la cadence sont gérés dans
`settings` depuis `/parametres`.

## 7. Méthode de test

### Tests automatiques

```powershell
cd vigie-backend
python -m unittest discover -s tests -v
cd ..
npm run build
```

### Recette fonctionnelle

1. Créer ou choisir un dossier `en_retard`.
2. Vérifier que le détail n'affiche aucun bouton permettant de le valider.
3. Envoyer un webhook signé avec un `event_id` unique et le statut validé confirmé par M2S.
4. Vérifier `dossiers.status = 'valide'`, `validated_at` renseigné et `next_action_at = null`.
5. Rejouer exactement le même webhook : réponse `200`, `duplicate=true`, aucun effet supplémentaire.
6. Rejouer le même `event_id` avec un corps différent : réponse `409`.
7. Tester une signature incorrecte : réponse `401`.
8. Essayer une mise à jour directe du statut avec un compte superviseur : refus RLS/SQLSTATE
   `42501`.
9. Vérifier qu'aucun nouvel appel n'est composé pour le dossier validé.

## 8. Erreurs possibles

- `409 Le mode webhook M2S n'est pas activé` : sélectionner le mode webhook dans `/parametres`.
- `503 M2S_WEBHOOK_SECRET n'est pas configuré` : ajouter le secret au `.env` backend et redémarrer.
- `503 contrat de statut M2S` : compléter les trois variables de contrat après confirmation M2S.
- `401 Signature HMAC M2S invalide` : signer le **corps HTTP brut exact**, sans le reconstruire.
- `422 Statut M2S absent ou inconnu` : contrôler le chemin et les valeurs confirmées.
- Le polling ne voit jamais une validation : vérifier que l'endpoint M2S retourne aussi les
  dossiers validés/modifiés, ou fournit un filtre `updated_since`/un curseur.

## 9. Résultat attendu

Le dashboard reste un observateur. Une validation M2S fait sortir le dossier du cycle en quelques
secondes, les replays sont sans danger, un utilisateur normal ne peut pas fabriquer le statut et
aucun secret M2S n'est stocké ou rendu dans le frontend.

## Questions précises à poser à M2S

1. Quel est le **nom exact ou chemin JSON** du champ statut ?
2. Quelle est la liste exhaustive des valeurs, leur casse et leur signification ? Lesquelles sont
   terminales et laquelle signifie précisément « validé par le constateur » ?
3. Un dossier validé peut-il être rouvert ? Si oui, avec quelle valeur et quelle règle métier ?
4. Quel champ contient l'identifiant immuable de l'événement et quel champ contient la date de
   validation ? Quel fuseau horaire est utilisé ?
5. Le webhook contient-il le dossier complet ou seulement `ref_sinistre` + statut ?
6. Quel est le nom de l'en-tête de signature, l'algorithme, le préfixe (`sha256=`), et faut-il
   signer le corps brut ? Quelle est la politique de retry et le délai d'acquittement attendu ?
7. Pour le polling : URL, méthode, pagination, filtre incrémental (`updated_since`/curseur), limites
   de débit et cadence autorisée ? L'endpoint retourne-t-il aussi les dossiers déjà validés ?
8. Pour l'authentification sortante : Bearer, clé dans un autre en-tête, OAuth2/mTLS ? Durée de vie
   et procédure de rotation du secret ?
9. Existe-t-il un environnement sandbox et des exemples réels de payload création + validation ?

## Prompt Lovable équivalent

> Sur la page détail dossier, supprime toute action « Marquer validé » et tout appel qui écrit
> `status='valide'` dans Supabase. Affiche à la place un indicateur en lecture seule : « Statut
> piloté par M2S — validation effectuée par le constateur dans la plateforme M2S. » Dans
> `/parametres`, ajoute une Card « Synchronisation des dossiers M2S » suivant le pattern Card +
> Field existant, avec mode désactivé/webhook/polling, URL API et cadence. Ne mets aucun token ou
> secret M2S dans le frontend. Conserve le thème navy, le français et le submit global existant.
