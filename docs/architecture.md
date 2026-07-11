# Architecture de Monitorix

Guide pour tout développeur qui reprend le projet. À lire avant de toucher au
code.

## Vue d'ensemble

Monitorix a trois composants indépendants qui communiquent uniquement via
Supabase :

```
┌──────────────┐        RPC (token)        ┌──────────────┐
│  pc-agent    │ ────────────────────────▶ │              │
│  (Python)    │   enroll_device           │              │
│  Windows     │   submit_event            │   Supabase   │
└──────────────┘   agent_heartbeat         │  (Postgres   │
                                           │   + Auth     │
┌──────────────┐        SDK (JWT)          │   + Realtime │
│  Dashboard   │ ◀──────────────────────▶  │   + RLS)     │
│  (Expo RN)   │   requêtes + realtime     │              │
│  web/mobile  │                           └──────────────┘
└──────────────┘
        │
        └── emballé par desktop/ (Electron) pour le bureau
```

- **`pc-agent/`** (Python) : tourne sur les PC surveillés, remonte les
  événements. N'a jamais de session utilisateur — s'authentifie par token.
- **`src/`** (Expo/React Native) : le dashboard admin. Même code pour web,
  mobile et bureau.
- **`desktop/`** (Electron) : emballe l'export web statique en app installable.
- **`supabase/schema.sql`** : toute la base — tables, RLS, fonctions RPC.
  Source de vérité unique et idempotente.

## Dashboard (`src/`)

Routing par fichiers (expo-router) : chaque fichier de `src/app/` est un écran.

```
src/
  app/
    _layout.tsx      Racine : providers + aiguillage (connexion → onboarding → dashboard)
    index.tsx        Dashboard principal (temps réel, colonnes sur grand écran)
    history.tsx      Page historique (recherche, périodes, pagination)
  components/
    auth/            Écran de connexion
    onboarding/      Création / rejoindre une organisation
    dashboard/       Briques du dashboard (stats, graphique, ligne d'événement, détails)
    *.tsx            Composants partagés (cartes token/invitation, texte/vue thémés)
  hooks/             Logique réutilisable et état partagé (voir ci-dessous)
  lib/               Fonctions pures (catégories, icônes, statut appareil, client Supabase)
  constants/theme.ts Couleurs, polices, espacements, seuils — AUCUNE valeur en dur ailleurs
  types/             Types TypeScript partagés
```

### Conventions à respecter

- **L'état partagé passe par un Provider + hook**, pas par des appels
  répétés. `AuthProvider`/`useAuth` et `OrganizationProvider`/`useOrganization`
  exposent une seule instance d'état à toute l'app. Ne jamais dupliquer un
  `useState` de session/organisation dans un composant : lire le contexte.
- **Aucune couleur / taille / police en dur** dans un composant. Tout vient
  de `constants/theme.ts` et du hook `useTheme()`. Ajouter une constante là
  plutôt qu'un `#RRGGBB` inline.
- **Texte et vues via `ThemedText` / `ThemedView`** pour rester compatibles
  clair/sombre automatiquement.
- **La logique pure va dans `lib/`**, testable sans React (ex.
  `event-icons.ts`, `device-status.ts`). Les composants restent fins.
- **Les accès données vont dans un hook `use-*`**, jamais directement dans le
  rendu d'un composant. Un composant appelle un hook, pas `supabase` en direct
  (sauf action ponctuelle simple comme dans une carte).

## Agent PC (`pc-agent/`)

```
main.py             Point d'entrée : threads (watchers, sender, heartbeat), arrêt propre
config.py           Chargement/validation de la config (.env), valeurs par défaut
watchers.py         Trois surveillances : fichiers (watchdog), USB (WMI), process (psutil)
supabase_client.py  Appels RPC (le seul endroit qui parle réseau)
spool.py            File d'attente SQLite durable (rien n'est perdu hors-ligne)
```

### Flux d'un événement

1. Un watcher détecte quelque chose → appelle `enqueue()`.
2. `enqueue()` écrit dans le spool SQLite (durable).
3. Le thread `event-sender` vide le spool vers Supabase via `submit_event`.
4. En cas d'échec réseau, l'événement reste dans le spool et sera réessayé.

Cette séparation (capture → spool → envoi) garantit qu'aucun événement n'est
perdu si Supabase est momentanément injoignable. **Ne pas court-circuiter le
spool** en envoyant directement depuis un watcher.

## Base de données (`supabase/schema.sql`)

- **Fichier unique et idempotent.** Toute modification se fait ici, puis on
  ré-exécute le fichier entier dans le SQL Editor. Ne jamais appliquer un
  fragment isolé.
- Les écritures sensibles passent par des fonctions `SECURITY DEFINER` qui
  valident les droits côté serveur. Voir `docs/securite.md`.
- Realtime est activé sur `devices` et `events` pour le temps réel du
  dashboard.

## Workflow de développement

```bash
# Dashboard (web)
npx expo start --web

# Vérifs avant commit (les deux DOIVENT passer)
npx tsc --noEmit
npx eslint src --max-warnings=0

# Agent
cd pc-agent && .venv/Scripts/python.exe main.py

# App de bureau (après un export web à jour)
npx expo export --platform web
cd desktop && npm start
```

Voir `CONTRIBUTING.md` pour les règles de contribution (commits, style, PR).
