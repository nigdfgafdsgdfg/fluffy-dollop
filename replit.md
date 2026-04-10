# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This project implements a Twitter-like backend
architecture using Firebase Authentication and Firestore as the database.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Firebase Firestore (via firebase-admin)
- **Auth**: Firebase Authentication (email/password + Google)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Firebase Setup

Set one of these environment secrets before deploying:

- `FIREBASE_SERVICE_ACCOUNT_JSON` — full service account JSON string (preferred for production)
- `FIREBASE_PROJECT_ID` — project ID when using application default credentials

Without credentials the server falls back to Firebase emulator mode (localhost:9099 auth, localhost:8080 Firestore).

## Architecture

### Folder Structure

```
artifacts/api-server/src/
  app.ts                   — Express app setup
  index.ts                 — server entry (boots Firebase + starts listening)
  lib/
    firebase.ts            — Firebase Admin SDK singleton (Auth + Firestore)
    logger.ts              — Pino structured logger
    firestore-schema.md    — Full Firestore schema design + query examples
  middlewares/
    authenticate.ts        — Firebase ID token verification middleware
  routes/
    health/                — GET /api/healthz
    auth/                  — GET /api/auth/me
    users/                 — POST /api/users, GET /api/users/:id, GET /api/users/:id/posts|followers|following
    posts/                 — POST /api/posts, GET /api/posts/:id, DELETE /api/posts/:id
    follows/               — POST /api/follows/:targetId, DELETE /api/follows/:targetId
    feed/                  — GET /api/feed
```

### Firestore Collections

| Collection | Document ID | Purpose |
|---|---|---|
| `users` | `{uid}` | User profiles with denormalized counters |
| `usernames` | `{username}` | Username uniqueness enforcement |
| `posts` | `{auto}` | Posts with denormalized author info |
| `follows` | `{followerId}_{followeeId}` | Follow relationships |
| `likes` *(ready)* | `{userId}_{postId}` | Post likes (add when needed) |
| `comments` *(ready)* | `{auto}` | Post comments (add when needed) |

### API Endpoints

All endpoints require `Authorization: Bearer <Firebase ID Token>` except `/healthz`.

| Method | Path | Description |
|---|---|---|
| GET | /api/healthz | Health check |
| GET | /api/auth/me | Get current user profile |
| POST | /api/users | Create user profile after signup |
| GET | /api/users/:id | Get user profile |
| GET | /api/users/:id/posts | Get posts by user (paginated) |
| GET | /api/users/:id/followers | List followers |
| GET | /api/users/:id/following | List followed users |
| POST | /api/posts | Create a post |
| GET | /api/posts/:id | Get a single post |
| DELETE | /api/posts/:id | Delete own post |
| POST | /api/follows/:targetId | Follow a user |
| DELETE | /api/follows/:targetId | Unfollow a user |
| GET | /api/feed | Paginated feed from followed users |

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
See `artifacts/api-server/src/lib/firestore-schema.md` for full schema, indexes, and security rules.
