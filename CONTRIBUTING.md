# Contribuer à Monitorix

Merci de contribuer. Ce guide garde le code lisible et cohérent pour tous.
Commence par lire [`docs/architecture.md`](docs/architecture.md).

## Mise en route

```bash
npm install                       # dépendances du dashboard
cd pc-agent && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt
cd ../desktop && npm install      # (optionnel) app de bureau
```

Copie `pc-agent/.env.example` vers `pc-agent/.env` et renseigne
`ENROLLMENT_TOKEN` (obtenu depuis le dashboard). Ne committe jamais `.env`.

## Avant chaque commit

Ces deux commandes **doivent passer sans erreur** :

```bash
npx tsc --noEmit                  # typage
npx eslint src --max-warnings=0   # lint (zéro avertissement)
```

Pour le code Python de l'agent, vérifie au minimum qu'il compile :

```bash
cd pc-agent && python -m py_compile *.py
```

## Style de code

### TypeScript / React (dashboard)

- **Pas de valeurs de style en dur.** Couleurs, espacements, rayons, polices
  viennent de `src/constants/theme.ts` via `useTheme()`. Si une valeur manque,
  ajoute-la au thème.
- **Composants fins, logique dans `lib/` ou `hooks/`.** Un composant fait du
  rendu ; il ne fait pas d'accès données ni de calcul complexe inline.
- **État partagé = Provider + hook** (`useAuth`, `useOrganization`). Ne
  duplique pas un état de session/organisation ; consomme le contexte.
- **Utilise `ThemedText` / `ThemedView`** plutôt que `Text` / `View` bruts,
  pour le support clair/sombre.
- Nomme les fichiers en **kebab-case** (`event-row.tsx`, `use-dashboard.ts`),
  cohérent avec l'existant.
- Les types partagés vont dans `src/types/`. Évite `any` ; préfère un type
  précis ou `unknown` + validation.

### Python (agent)

- Type hints partout (le code existant les utilise, y compris
  `from __future__ import annotations`).
- Le réseau ne se fait que dans `supabase_client.py`. Un watcher n'appelle
  jamais Supabase directement : il passe par le spool.
- Toute nouvelle option de config se déclare dans `config.py` (avec une
  valeur par défaut) ET dans `.env.example` (documentée).

### SQL (base de données)

- Tout va dans `supabase/schema.sql`, qui reste **idempotent** (`create or
  replace`, `if not exists`, `drop policy if exists`). On doit pouvoir
  ré-exécuter le fichier entier sans erreur.
- Toute écriture sensible passe par une fonction, jamais par une politique
  INSERT permissive. Lis [`docs/securite.md`](docs/securite.md) avant de
  modifier une politique RLS ou une fonction `SECURITY DEFINER`.

## Messages de commit

- En anglais, à l'impératif, une ligne de résumé courte puis un corps qui
  explique le **pourquoi** (pas seulement le quoi). Exemple :

  ```
  Add rate limiting to the enroll_device RPC

  A leaked token could otherwise create unlimited devices. Cap enrollment
  to N calls per minute per token via ...
  ```

- Un commit = un changement cohérent. Ne mélange pas refactor et
  fonctionnalité dans le même commit.
- Travaille sur une branche, pas directement sur `master`, pour toute
  contribution non triviale.

## Structure des dossiers (rappel)

| Dossier | Rôle |
|---|---|
| `src/` | Dashboard Expo (web + mobile) |
| `pc-agent/` | Agent de surveillance Python |
| `desktop/` | Emballage Electron du dashboard |
| `supabase/` | Schéma et politiques de la base |
| `docs/` | Architecture, sécurité, analyse marché |

## Questions à se poser avant une PR

- Est-ce que `tsc` et `eslint` passent ?
- Ai-je introduit une valeur de style en dur ? (→ la mettre dans le thème)
- Ai-je touché à la sécurité (auth, RLS, RPC, token) ? (→ mettre à jour
  `docs/securite.md`)
- Ai-je testé le chemin réel (pas juste le typage) ? Voir la commande de
  lancement dans `docs/architecture.md`.
