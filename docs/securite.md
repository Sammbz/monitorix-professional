# Sécurité de Monitorix

Ce document décrit le modèle de menace, les protections en place, et ce qui
reste à faire avant une mise en production sérieuse. À relire à chaque
changement touchant l'authentification, le schéma SQL ou l'agent.

## Modèle de données et acteurs

| Acteur | Comment il s'authentifie | Ce qu'il peut faire |
|---|---|---|
| Admin (humain) | Session Supabase Auth (email + mot de passe, JWT) | Lire/gérer les données de **ses** organisations |
| Agent PC | Token d'enrôlement (org-scoped) via RPC | Écrire devices/events de **son** organisation, rien d'autre |
| Anonyme | Clé anon publique | Rien (RLS bloque tout accès direct aux tables) |

Le principe central : **l'agent ne se connecte jamais comme un utilisateur**.
Il n'a ni mot de passe ni `service_role`. Un token qui fuite ne donne accès
qu'à l'écriture d'events pour **une seule** organisation.

## 1. Injections SQL

**Statut : couvert.** Aucune requête SQL n'est construite par concaténation
de chaînes.

- Le client web utilise le SDK `@supabase/supabase-js`, qui envoie des
  requêtes paramétrées via PostgREST — jamais de SQL assemblé à la main.
- Les fonctions serveur (`enroll_device`, `submit_event`,
  `create_organization`, `accept_invitation`, `events_activity`) sont en
  PL/pgSQL avec des **paramètres typés** (`uuid`, `text`, `jsonb`, `int`).
  Une valeur passée en paramètre est une donnée, jamais du code.
- Toutes les fonctions `SECURITY DEFINER` fixent `set search_path = public`,
  ce qui empêche le détournement par un schéma malveillant (attaque
  classique sur les fonctions definer).
- La recherche texte de la page Historique échappe les jokers `%` `_` et
  retire les séparateurs `,()` de la grammaire de filtre PostgREST
  (`use-event-history.ts`) — une recherche littérale ne peut pas devenir un
  wildcard ni casser le filtre.

## 2. Row Level Security (RLS)

**Statut : couvert, c'est la pièce maîtresse.** RLS est activé sur **toutes**
les tables. Aucune donnée n'est lisible sans passer une politique.

- `is_org_admin()` est la fonction pivot : un admin ne voit que les
  organisations où il a une `membership` avec `role = 'admin'`.
- Les tables `devices` et `events` **n'ont aucune politique INSERT** : elles
  ne sont écrites que par les RPC `SECURITY DEFINER`, qui valident le token
  côté serveur. `events` est un journal append-only (pas d'UPDATE/DELETE).
- `organizations`/`memberships` n'ont pas de politique INSERT directe : la
  création passe par `create_organization` (org + membership admin dans une
  seule transaction). Ça évite le piège RLS « INSERT ... RETURNING » et
  interdit à un utilisateur de s'ajouter arbitrairement à une organisation.
- Les nouveaux membres rejoignent via `accept_invitation` (code à usage
  unique, expiration 7 jours) — pas d'auto-insertion de membership.

## 3. Clés API et secrets

**Statut : correct, avec un point de vigilance.**

- La **clé anon** Supabase est publique par conception (elle est dans le
  bundle web ET dans l'agent). Elle ne donne aucun accès par elle-même : RLS
  fait tout le travail. La committer n'est pas une fuite.
- La clé `service_role` (qui, elle, contourne RLS) **n'est utilisée nulle
  part** dans ce dépôt. À ne jamais mettre côté client ni dans l'agent.
- Le fichier `.env` (qui contient le `ENROLLMENT_TOKEN`) est **gitignoré**.
  Seul `.env.example` (sans valeur) est versionné.
- Le token d'enrôlement est un secret **opérationnel** : il vaut un accès en
  écriture à une org. Il peut être **révoqué** depuis le dashboard, ce qui
  coupe immédiatement les agents qui l'utilisent.

### Bornage des entrées serveur (ajouté)

Même avec un token valide, les RPC plafonnent désormais ce qui peut être
écrit, pour qu'un token compromis ne puisse pas noyer la base :

- `enroll_device` : nom d'appareil 1–120 caractères.
- `submit_event` : type ≤ 64 car., message ≤ 4000 car., metadata ≤ 16 KB.
- `create_organization` : nom 1–120 caractères.

## 4. Agent PC

- Communique uniquement en HTTPS vers Supabase.
- Ne stocke aucun mot de passe ; seul le token est sur la machine (dans
  `.env`, hors du dépôt).
- Le spool local SQLite ne contient que des métadonnées d'événements déjà
  destinées au serveur — pas de secret supplémentaire.
- Tourne en tâche planifiée **par utilisateur** (pas en SYSTEM), sans droits
  admin — surface d'attaque réduite.

## 5. Application de bureau (Electron)

- La fenêtre charge une page web servie sur **127.0.0.1 uniquement** (jamais
  exposée au réseau), sur un port aléatoire.
- Le serveur local refuse toute requête sortant de `dist/` (protection
  contre la traversée de chemin, vérifiée avec le séparateur de chemin).
- `nodeIntegration: false` et `contextIsolation: true` : une faille dans la
  page ne peut pas atteindre le système de fichiers ni Node.

## Rate limiting (en place)

Compteurs à fenêtre fixe stockés dans Postgres (`rpc_rate_limits`, table sous
RLS sans politique — seules les fonctions serveur y accèdent). Trois niveaux :

| Protection | Clé | Limite |
|---|---|---|
| Force brute sur les tokens | IP (`x-forwarded-for`) | Blocage après 20 tokens invalides / 15 min |
| Enrôlements | organisation | 120 / heure |
| Événements | appareil | 600 / 10 min (~1/s soutenu) |
| Heartbeats | appareil | 10 / min (l'agent en envoie 2) |

Détails d'implémentation :

- Les échecs d'authentification sont comptés **par IP** et vérifiés *avant*
  la validation du token (`is_rate_blocked`), sans compter les appels
  légitimes — un bureau derrière un NAT avec 50 agents n'est jamais gêné.
- **Piège Postgres important** (trouvé en test) : enregistrer un échec puis
  rejeter la requête avec `raise` ne fonctionne **pas** — le `raise` annule
  toute la transaction, y compris l'incrément du compteur, donc les échecs
  ne s'accumulent jamais. Les RPC enregistrent donc l'échec et **retournent
  un sentinel** (null / retour normal) au lieu de lever une exception, ce qui
  valide (commit) l'incrément. L'agent traite déjà un id d'appareil null
  comme une erreur, donc le contrat client est préservé.
- Les clés de compteur ne contiennent **jamais le token brut** (uniquement
  des ids d'org/appareil et des IP).
- Nettoyage opportuniste : les clés inactives depuis 2 jours sont purgées.
- Côté agent, `main.py` applique un backoff de 5 s quand un lot entier
  échoue, pour ne pas marteler l'API en cas de limite atteinte ou de coupure.

Limite connue : si l'en-tête `x-forwarded-for` est absent, tous les échecs
partagent un seau `unknown` — un attaquant s'y bloque aussi lui-même.

## Ce qui reste à faire avant la production

Par ordre de priorité :

1. **Rotation/expiration** des tokens d'enrôlement (ils sont éternels tant
   que non révoqués). Ajouter un `expires_at` comme pour les invitations.
2. **Confirmation d'email obligatoire** à l'inscription (réglage Supabase
   Auth) + politique de mot de passe forte.
   Dans le même écran : activer la **protection anti-bot** (intégration
   native Cloudflare Turnstile/hCaptcha — Dashboard → Authentication →
   Bot and Abuse Protection, zéro code à écrire).
   Et prévoir une **surveillance des métriques d'abus** : volume d'events
   par org, échecs d'auth (`rpc_rate_limits` est déjà consultable en SQL),
   alertes sur pics anormaux.
3. **Audit log** des actions admin (qui a révoqué un token, supprimé un
   appareil, invité qui).
4. **Chiffrement au repos** des chemins de fichiers sensibles si le contenu
   surveillé est confidentiel (aujourd'hui les events sont en clair en base).
5. **Revue RGPD** : rétention configurable + purge automatique, export et
   suppression des données sur demande (droit à l'effacement).
6. **Signature de code** de l'installateur Windows et de l'agent (évite les
   alertes SmartScreen/antivirus et l'altération du binaire).

## Rappel : procédure après un changement de schéma

Ré-exécuter **tout** `supabase/schema.sql` dans le SQL Editor de Supabase (le
fichier est idempotent). Ne jamais appliquer un bout isolé : les politiques
et fonctions se redéfinissent ensemble.
