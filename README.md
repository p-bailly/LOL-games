# LoL Live

Application perso pour suivre les **matchs de League of Legends pro** : scores, direct, drafts, tableaux des scores,
classements, Elo mondial, équipes et joueurs. Même esprit que *Basket Live* : web app installable (PWA) et APK Android,
sans compte ni serveur.

Ligues suivies : LEC, LCK, LPL, LCS, LFL, CBLOL, LCP et les compétitions internationales (Worlds, MSI, First Stand).

## Installer

- **Android** : <https://github.com/p-bailly/LOL-games/releases/latest/download/rift-live.apk> (Android demande
  d'autoriser l'installation depuis le navigateur). L'APK est reconstruit par GitHub Actions à chaque push sur la branche
  par défaut et s'installe par-dessus l'ancien.
- **Web (PWA)** : héberger le dossier `dist` (GitHub Pages via `.github/workflows/deploy.yml`, à activer dans *Settings →
  Pages → Source : GitHub Actions*, ou Netlify / Vercel / Cloudflare Pages avec `npm run build`), puis *Sur l'écran
  d'accueil* (iPhone, Safari) ou *Installer l'application* (Android, Chrome).

## Lancer en local

Prérequis : [Node.js](https://nodejs.org) 22.

```bash
npm install
npm run dev          # http://localhost:5173 (ajouter -- --host pour l'ouvrir depuis un téléphone)
npm run build        # puis npm run preview
```

## Données et usage

Les données viennent de [Leaguepedia](https://lol.fandom.com) (calendrier, résultats, drafts, stats ; aucune clé) et de
Data Dragon (icônes). Sans le direct, les résultats arrivent quelques minutes après chaque game.

**Direct** (appli Android, aucune clé à fournir) : la série et la game en cours sont suivies en direct d'après
lolesports.com (API non officielle, qui peut changer sans préavis : l'appli revient alors à Leaguepedia). Il est activé par
défaut ; **Équipes → Direct LoL Esports** permet de le couper ou de le tester. Dans le navigateur, il n'est pas disponible.
Les **alertes** (début de série, fin de game, game décisive, résultat) s'activent dans l'onglet **Équipes**.

Détails techniques, Elo, partage avec le launcher Nimbus : voir [`CLAUDE.md`](CLAUDE.md).

Projet perso, sans lien avec Riot Games, LoL Esports ni Leaguepedia. *League of Legends* est une marque de Riot Games.
