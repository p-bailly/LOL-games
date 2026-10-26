# CLAUDE.md

LoL Live (nom de code `rift-live`) : PWA React + Vite + TypeScript, emballée en APK Android par Capacitor. Pas de serveur, pas de
tests automatisés. Code et commentaires en français. Tout l'état utilisateur est en `localStorage` (clés `rift:*`, `src/lib/store.ts`).

## Commandes
- `npm run dev` (5173), `npm run build` (`tsc --noEmit` + vite), `npm run typecheck`, `npm run preview`. Node 22 (comme la CI).
- `npm run android` : build + `cap sync` + Gradle (Android SDK plateforme 36 + Java 21) → `android/app/build/outputs/apk/release/app-release.apk`.
- CI sur push de la branche par défaut uniquement : `android.yml` (APK dans la release « apk », fichier `rift-live.apk`) et `deploy.yml`
  (GitHub Pages si activé). Elles passent `VITE_BUILD=<run_number>` (affiché « version 1.N » dans l'onglet Équipes) ; `versionName` = `1.<run_number>`,
  `versionCode` = `run_number`.
- Logo : `python3 design/logo/generer.py` (SVG, calques d'icône adaptative, `public/icon.svg`) puis
  `NODE_PATH=$(npm root -g) node design/logo/png.cjs` (PNG ; exige Playwright et son Chromium). `propositions.py/.cjs` : planche de variantes.

## Android
- `applicationId` `com.pbailly.riftlive`. APK signé par la clé **volontairement versionnée** `android/app/superfan.keystore` (mot de passe
  dans `build.gradle`), la même que *Basket Live* : ne pas la changer, sinon les APK ne s'installent plus par-dessus. Usage perso.
- Dans l'appli Android, `CapacitorHttp` est activé (`capacitor.config.json`) : requêtes natives, **sans CORS**. Dans le navigateur, ce sont les
  règles CORS des serveurs qui décident : Leaguepedia répond (via `api.php`), mais `lolesports.com/api/gql` est refusé (pas de direct dans le navigateur).
- **Partage avec Nimbus** (launcher perso `fr.perso.nimbus`) : `src/lib/nimbus.ts` envoie les équipes favorites au plugin natif `NimbusBridge`
  (SharedPreferences, enregistré dans `MainActivity` avant `super.onCreate`) ; `NimbusProvider` les sert en lecture seule sur
  `content://com.pbailly.riftlive.nimbus/favorites` (colonnes `team_id`, `abbr`, `name`, dans l'ordre des favoris) et ne répond qu'à Nimbus
  et à l'appli elle-même (vérification de l'appelant, pas de permission « signature » car les clés diffèrent). Nimbus s'en sert pour son
  bandeau de verrouillage (séries en direct des favoris, calendrier lolesports relu toutes les 15 s) et reconnaît une équipe par `team_id`,
  sinon par `abbr` : **ces colonnes doivent rester les noms/sigles Leaguepedia**.

## Données (Leaguepedia, Data Dragon, LoL Esports)
- `src/api/cargo.ts` : accès aux tables Cargo de Leaguepedia. Android : `Special:CargoExport` (HTTP natif). Navigateur : `api.php?action=cargoquery`
  avec `origin=*` (seul point d'entrée CORS) ; `clean()` et `list()` gomment les différences (listes en tableau ou texte « a,b,c » / « ;; », texte HTML-échappé).
  Requêtes **sérialisées** et espacées (150 ms natif, 400 ms navigateur) car Leaguepedia limite les appels anonymes ; reprise avec attente sur `ratelimited`.
  Caches : `cached` (mémoire, requêtes simultanées partagées) et `persisted` (`localStorage` `rift:cache:*`). `usePolling` se met en pause onglet caché ;
  son intervalle dépend des données (ex. 15 s si un match est en cours, 2 min sinon).
- Sans le direct LoL Esports, tout marche avec Leaguepedia (résultats, drafts, stats quelques minutes après la fin d'une game ; série dont l'heure est
  passée = « En cours (estimé) »). Stats détaillées d'une game (picks, items) seulement une fois la game terminée. Les **bans viennent toujours de
  Leaguepedia** (le direct ne donne que les champions choisis).
- `src/api/lolesports.ts` : API **non officielle et non documentée** (lectures défensives), **sans clé**. Le site ne donne plus de `x-api-key` au
  navigateur (elle reste côté serveur) : l'ancienne API `esports-api.lolesports.com/persisted/gw` n'est plus utilisée.
  - Liste des séries en direct : `GET lolesports.com/api/gql`, requête GraphQL **persistée** `homeEvents` (`eventState: ['inProgress']`). Il faut les en-têtes
    `content-type: application/json` et `apollographql-client-name/version` (sinon 401 « No client headers set » ou erreur CSRF). Pas de CORS :
    appli Android seulement (`liveSupported`, proxy HTTP natif de Capacitor) ; réglage `rift:direct` (`enabled`, défaut `true`, interrupteur dans
    `TeamsPage`). `liveActive()` = Android **et** réglage actif ; sinon `applyLive` rend les séries Leaguepedia intactes.
  - **Si le direct casse** (« requête périmée ») : le site a changé. Relever l'empreinte (`sha256Hash` du paramètre `extensions`) et la version du client
    (en-tête `apollographql-client-version`) sur une requête `homeEvents` de lolesports.com (F12 → Réseau → `api/gql`), puis mettre à jour `HOME_EVENTS_HASH`
    et `GQL_CLIENT` en haut de `lolesports.ts`. `fetchEvent` relit la série dans la liste (`fetchLive`, cache partagé 10 s).
  - La liste ne donne pas le camp (bleu/rouge) des équipes : `fetchLiveGame` le déduit du flux (`esportsTeamId` = `teamId` de la liste).
  - Statistiques de la game : flux `feed.lolesports.com/livestats` (public, CORS `*`) ; il refuse les horodatages trop récents : `fetchLiveFrame` recule de
    45/75/120/240 s.
  - `api/live.ts` rapproche événements live et séries Leaguepedia (nom/sigle normalisés, ±36 h). Si l'API ne répond plus : repli sur Leaguepedia.
  - `rift:live` (ancienne clé collée par l'utilisateur) est supprimée au démarrage par `store.ts`.
- Ligues : `api/leagues.ts`. Une compétition internationale en cours passe en premier partout (`orderLeagues`).
- Records d'une année / de tous les temps (`api/records.ts`) : on ne télécharge pas les ~90 000 games, on demande à Leaguepedia le top 3 par catégorie ;
  cache 12 h (1 h pour l'année en cours).
- Alertes locales sans serveur : elles ne partent que **app ouverte ou en arrière-plan récent** (Android : notifications natives ; web : API Notification,
  iPhone seulement une fois l'app ajoutée à l'écran d'accueil, iOS ≥ 16.4).

## Elo mondial (`public/elo.json`, `public/elo-players.json`)
- Fichiers **générés et versionnés** : `node scripts/build-elo.mjs` (équipes) et `node scripts/build-player-elo.mjs` (joueurs), options `--tune` (cherche les
  meilleurs paramètres en minimisant l'erreur de prévision du vainqueur de chaque game) et `--refresh` (retélécharge l'historique ; sinon cache dans
  `os.tmpdir()`, `lol-elo-series.json` / `lol-elo-games.json`). Les scripts utilisent `curl` (proxy respecté) et importent directement `src/lib/eloCore.ts` /
  `playerEloCore.ts` : ces fichiers doivent rester **sans dépendance et en TypeScript effaçable** (Node les exécute tels quels). Node 22.
- Historique complet de Leaguepedia depuis 2011, calcul **game par game**, chaque game compte pareil (BO1/BO3/BO5, playoffs, international : poids 1, pas
  de bonus de série). Équipes (`DEFAULTS`) : K de 128 (nouvelle équipe) vers 18, départ à la moyenne de la ligue, après 90 jours d'inactivité, 65 % de l'écart à la
  moyenne de la ligue est effacé (`regress`). Joueurs (`PLAYER_DEFAULTS`) : la force d'une équipe = moyenne de ses cinq joueurs. Précision (games
  bien prévues) ≈ 64 % pour les équipes et les joueurs (voir `quality` dans les JSON).
- L'appli charge le JSON puis ajoute les séries/games postérieures à `until` (`api/elo.ts`, `eloPlayers.ts`). Les « Chances » et probabilités de victoire
  utilisent l'Elo des équipes via `api/ratings.ts` (`fetchRatings`) ; repli si le JSON est indisponible : Elo rapide sur les 18 derniers mois (départ par
  région, K 24/40), caché 12 h. Penser à relancer les scripts de temps en temps (les JSON datent de leur dernier build : `builtAt`).
- Projections (`lib/projection.ts`) : 4 000 simulations (`SIMS`), égalités tirées au sort, quarts non connus tirés meilleur bilan contre moins bon
  (1-8, 4-5, 2-7, 3-6) ; c'est une estimation, pas un pronostic officiel. Phase suisse des Worlds : `api/swiss.ts`, `SwissBracket`, `SwissTable`.
- La région d'une équipe est celle de sa ligue actuelle (onglet Stats → Régions : niveau d'une région = moyenne de l'Elo de ses 5 meilleures équipes).
