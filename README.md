# LoL Live 🔮

Application perso pour suivre les **matchs de League of Legends pro** : scores, direct, drafts (picks et bans),
tableaux des scores, classements, équipes et joueurs. Même esprit que *Basket Live* (l'appli NBA) : web app
installable sur téléphone (PWA) et APK Android, sans compte ni serveur.

Ligues suivies : **LEC, LCK, LPL, LCS, LFL, CBLOL, LCP** et les compétitions internationales (**Worlds, MSI, First Stand**).

## Fonctionnalités

- **Matchs** : bandeau des jours (épinglé sous l'en-tête, toujours visible), filtre par ligue, séries dans l'ordre de la journée (terminées au-dessus, puis en direct, puis à venir par heure ; la liste s'ouvre sur l'en direct ou le prochain match). En descendant en bas de la liste, le jour suivant (avec des matchs) s'ajoute dessous.
  Les séries à venir ou en cours affichent l'Elo de chaque équipe et ses chances de gagner la série (barre bleu / rouge).
  Heures dans ton fuseau. Série en cours, score de la série (BO1 / BO3 / BO5), game décisive signalée.
- **Fiche de série**, une game à la fois :
  - **Draft** : bans et picks de chaque camp, rôle par rôle, avec l'**ordre de la draft** (1 à 20) ;
  - **Joueurs** : tableau des scores (K/D/A, CS, or, dégâts, participation aux kills, vision, objets, runes
    et sorts d'invocateur) ;
  - **Équipes** : kills, or, tours, dragons, barons, hérauts, larves du Néant, inhibiteurs ;
  - avant la série : forme sur 5 séries et face-à-face ; replay et lien de la retransmission.
- **Direct** (avec une clé LoL Esports, voir plus bas) : score de la série en temps réel, et pour la game en cours
  l'or, les kills, les objectifs, les 10 joueurs (niveau, KDA, CS, vie) et la courbe d'écart d'or.
- **Tournoi** (onglet Tournoi) : classement de chaque tournoi (séries et games gagnées, série en cours) ou, pour les playoffs, les séries tour
  par tour. Pour les **Worlds**, la **phase suisse** en bracket comme sur l'affiche officielle (une colonne par tour,
  une boîte par bilan 0-0, 1-0, 0-1, 2-0…, BO1 ou BO3, affiches « TBD » des tours à venir ; une équipe qui vient de jouer apparaît tout de suite dans la boîte de son nouveau bilan, en attendant son adversaire), plus une vue « Bilans »
  (résultat et adversaire de chaque équipe à chaque tour ; qualifiées, en course, éliminées).
- Quand une compétition internationale est en cours (Worlds, MSI, First Stand), elle passe **en premier** : dans
  les filtres de ligues, dans Tournoi et Stats (choisie d'office) et dans la liste des matchs du jour.
- **Chances** (onglet Tournoi) : simulation de 4 000 tournois d'après la force des équipes. Pour un classement de
  ligue : la probabilité de finir à chaque place. Pour les Worlds : celle de se qualifier (quarts), d'atteindre les
  demies, la finale et de **gagner le titre**. La fiche d'une série affiche aussi les chances de gagner la série.
  Force des équipes : l'Elo mondial ci-dessus (estimation, pas un pronostic officiel ; les égalités sont tirées au sort et les quarts, quand ils ne sont pas
  connus, tirés meilleur bilan contre moins bon).
- **Elo mondial** (onglet Classement), pour les équipes et pour les joueurs : note, évolution sur 90 jours, games
  jouées, taux de victoires. Le calcul est fait **game par game** et chaque game compte pareil, qu'elle soit dans
  un BO1, un BO3 ou un BO5 (pas de bonus de série, pas de poids différent pour les playoffs ou l'international). Il
  porte sur tout l'historique de Leaguepedia depuis 2011 : 57 000 séries (93 000 games) pour les équipes, 89 000 games
  pour les joueurs (la force d'une équipe y est la moyenne de ses cinq joueurs). `scripts/build-elo.mjs` et
  `scripts/build-player-elo.mjs` font le calcul une fois et écrivent `public/elo.json` et `public/elo-players.json` ;
  l'appli y ajoute les games jouées depuis. Une équipe ou un joueur démarre à la moyenne de sa ligue (ou de ses
  coéquipiers), son K est élevé au début puis baisse pour que la note converge vite, et une longue absence rapproche la
  note de la moyenne de la ligue. Les réglages sont choisis par `--tune`, qui minimise l'erreur de prévision du
  vainqueur de chaque game sur l'historique (64 % de games bien prévues pour les équipes). Les Chances et les
  probabilités de victoire utilisent l'Elo des équipes.
- **Historique de l'Elo** : courbe mois par mois (1 an, 3 ans ou tout) dans l'onglet Elo d'une équipe et sur la fiche d'un joueur.
- **Variation d'Elo** : les séries terminées (liste des matchs, fiche de série, fiche d'équipe) affichent le gain ou la
  perte d'Elo de chaque équipe (somme de ses games) ; le tableau d'une game affiche celle de chaque joueur, et la fiche
  d'un joueur celle de ses dernières games. Historique conservé : 120 jours pour les séries, 90 jours pour les games,
  toutes les compétitions officielles prises en compte par l'Elo.
- **Stats** (onglet Stats), cinq vues :
  - **Champions** d'un tournoi : présence, picks, bans, taux de victoire ;
  - **Joueurs** d'un tournoi, « par partie » (KDA, kills, CS, dégâts) ou « par minute » (CS, or et dégâts par minute, part des
    dégâts et de l'or de l'équipe, participation aux kills, vision par minute) ;
  - **Équipes** d'un tournoi : taux de victoire, durée moyenne des games, kills, écart d'or, tours, dragons, barons et hérauts
    par game, taux de victoire côté bleu et côté rouge ;
  - **Records** : les trois premiers de chaque catégorie, pour un **tournoi**, pour **une année** (2011 à aujourd'hui) ou
    pour **tous les temps**, toutes ligues ou une seule. Games : la plus courte et la plus longue, plus de kills, plus gros
    écart d'or ; sur une game, les meilleures performances individuelles (kills, assists, dégâts, CS, vision, KDA sans mourir) ;
    pour un tournoi, aussi la plus longue suite de victoires. Pour une année ou tous les temps, l'appli ne télécharge pas les
    ~90 000 games : elle demande à Leaguepedia les trois premières de chaque catégorie (`api/records.ts`) et garde le résultat
    sur l'appareil (12 h, 1 h pour l'année en cours) ;
  - **Régions** : bilan des compétitions internationales des trois dernières années entre régions (séries et games, par
    compétition ou cumulé, et face-à-face de chaque région contre les autres), et courbe du niveau de chaque région (moyenne
    de l'Elo de ses 5 meilleures équipes, mois par mois). La région d'une équipe est celle de sa ligue actuelle.
- **Équipes** : favoris, effectif et calendrier de chaque équipe. **Joueurs** : fiche, stats sur 12 mois,
  champions les plus joués (12 derniers mois ou toute la carrière, liste complète), dernières games.
- **Alertes** : début de série, fin de chaque game, game décisive, résultat final.
- Thème sombre / clair automatique, interface en français.

## Les données

| Source | Sert à | Clé |
| --- | --- | --- |
| [Leaguepedia](https://lol.fandom.com) (tables Cargo) | calendrier, résultats, drafts, stats des joueurs, classements, effectifs | aucune |
| [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) (Riot) | icônes des champions et des objets | aucune |
| API de lolesports.com (non officielle) | direct exact : score, or, objectifs, joueurs de la game en cours | à coller dans l'appli |

**Sans clé**, tout fonctionne avec Leaguepedia : les résultats, drafts et statistiques arrivent quelques minutes
après la fin de chaque game ; une série dont l'heure est passée est affichée « En cours (estimé) ».

**Avec la clé**, la série est confirmée en direct et la game en cours est détaillée. Pour la trouver :

1. Ouvre lolesports.com sur un ordinateur, puis les outils de développement (F12), onglet *Réseau*.
2. Recharge la page, clique sur une requête vers `esports-api.lolesports.com` (par ex. `getSchedule`).
3. Copie la valeur de l'en-tête `x-api-key`.
4. Dans l'appli : onglet **Équipes → Direct LoL Esports**, colle la clé, *Enregistrer* (le bouton *Tester la clé*
   vérifie qu'elle est acceptée).

La clé reste sur l'appareil et n'est envoyée qu'à LoL Esports. Elle peut changer : recommence alors la manipulation.
L'API n'est pas documentée et peut évoluer sans préavis ; si elle ne répond plus, l'appli retombe sur Leaguepedia.

Limites à connaître :

- Leaguepedia limite les requêtes anonymes : l'appli espace ses appels, garde les réponses en cache et ralentit
  son rafraîchissement quand rien n'est en direct. Dans le navigateur, un quota dépassé affiche
  « Leaguepedia limite les requêtes » : il suffit de réessayer un peu plus tard.
- Dans l'**appli Android**, les appels passent par le HTTP natif de Capacitor (`CapacitorHttp`) : pas de restriction
  CORS, ce qui est aussi ce qui permet d'appeler l'API de lolesports.com. Dans le **navigateur**, ce sont les
  règles CORS des serveurs qui décident : Leaguepedia répond, le direct LoL Esports peut être refusé.
- Les statistiques détaillées d'une game (picks, items…) n'existent dans Leaguepedia qu'une fois la game terminée.
- Les bans sont toujours ceux de Leaguepedia ; le flux en direct ne donne que les champions choisis.

Projet perso, sans lien avec Riot Games, LoL Esports ni Leaguepedia. *League of Legends* est une marque de Riot Games.

## Appli Android (APK)

**Télécharger :** https://github.com/p-bailly/LOL-games/releases/latest/download/rift-live.apk

1. Ouvre le lien sur le téléphone Android et télécharge le fichier.
2. Ouvre-le : Android demande d'autoriser l'installation depuis le navigateur (« sources inconnues ») — accepte.
3. L'appli **LoL Live** apparaît avec les autres applis.

L'APK est reconstruit automatiquement par GitHub Actions (`.github/workflows/android.yml`) à chaque push sur la
branche par défaut ; il suffit de le retélécharger pour mettre à jour (il s'installe par-dessus l'ancien).

Il est signé avec la même clé de signature personnelle que *Basket Live*, volontairement versionnée
(`android/app/superfan.keystore`), pour que les APK construits n'importe où aient la même signature. C'est adapté à
un usage perso, pas à une publication sur le Play Store.

Construire l'APK soi-même : Android SDK (plateforme 36) + Java 21, puis `npm run android`
→ `android/app/build/outputs/apk/release/app-release.apk`.

## Partage avec Nimbus

L'appli Android partage la liste de tes **équipes favorites** avec le launcher perso Nimbus (`fr.perso.nimbus`).
`src/lib/nimbus.ts` les remet au plugin natif `NimbusBridge`, qui les garde dans des SharedPreferences ;
`NimbusProvider` les sert en lecture seule à l'adresse `content://com.pbailly.riftlive.nimbus/favorites` (une ligne
par équipe, dans l'ordre des favoris : `team_id` = nom Leaguepedia de l'équipe, `abbr` et `name`). Seuls Nimbus et
l'appli elle-même peuvent lire cette adresse.

Nimbus lit cette adresse pour montrer, sur sa page de déverrouillage, les séries en direct de ces équipes et leurs
résultats récents (calendrier de lolesports.com, relu toutes les 15 s tant qu'une série est en cours) : comme pour
Basket Live, un bandeau au logo de LoL Live. Il reconnaît une équipe à son nom Leaguepedia (`team_id`), sinon à son
sigle (`abbr`) : ces deux colonnes doivent donc rester celles de Leaguepedia. Nimbus met aussi LoL Live dans les
places « Jeux & perso » de ses accueils papier.

## Lancer l'app en local

Prérequis : [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev -- --host   # pour l'ouvrir depuis ton téléphone sur le même Wi-Fi
```

Version de production : `npm run build` puis `npm run preview`.

## La mettre sur ton téléphone (PWA)

1. **Héberge-la** (gratuit) : GitHub Pages (`.github/workflows/deploy.yml`, à activer dans *Settings → Pages →
   Source : GitHub Actions*) ou Netlify / Vercel / Cloudflare Pages (commande `npm run build`, dossier `dist`).
2. Ouvre l'adresse sur le téléphone, puis *Sur l'écran d'accueil* (iPhone, Safari) ou *Installer l'application*
   (Android, Chrome).

## Les alertes

Active-les dans l'onglet **Équipes**. Elles s'affichent dans l'app et en notification système (appli Android :
notifications natives ; navigateur : quand il le permet, sur iPhone seulement une fois l'app ajoutée à l'écran
d'accueil, iOS 16.4+). Sans serveur, elles ne partent que **quand l'app est ouverte ou en arrière-plan récent**.

## Structure

```
src/
  api/cargo.ts         accès aux tables Cargo de Leaguepedia (file d'attente, cache, logos)
  api/leaguepedia.ts   séries, games, drafts, équipes
  api/stats.ts         tournois, classements, effectifs, stats de champions et de joueurs
  api/games.ts         games et lignes de joueurs d'un tournoi, séries des compétitions internationales (stats d'équipe, records, régions)
  api/records.ts       records d'une année ou de tous les temps (top 3 par catégorie, demandé à Leaguepedia)
  api/lolesports.ts    API LoL Esports (direct), api/live.ts : rapprochement avec les séries de Leaguepedia
  api/ddragon.ts       icônes de champions et d'objets (Data Dragon)
  api/leagues.ts       ligues suivies
  hooks/usePolling.ts  chargement + rafraîchissement automatique (pause en arrière-plan)
  lib/                 formatage, favoris / réglages (localStorage), routage par hash, notifications, Nimbus
  components/          cartes de série, draft, tableau des scores, direct, alertes…
  pages/               Matchs, Série, Tournoi, Classement (Elo), Stats, Équipes, Équipe, Joueur
public/                manifest PWA, service worker, icônes
android/               projet Android (Capacitor) qui embarque l'app web
design/logo/           logo au crayon : generer.py (SVG, icône adaptative), puis png.cjs (PNG)
```
