# X-MAS deploy — storefront on Vercel, backend on Railway

The architecture this guide targets:

| Piece | Host | Why |
|---|---|---|
| `web/` — Next.js storefront | **Vercel** | static/ISR pages, edge CDN |
| `medusa-backend/apps/backend` — Medusa v2 | **Railway** | long-running server + DB |
| `api/` — Express (QPay/Botxon, legacy auth) | **Railway** | long-running, holds webhook + rate-limit state |
| Postgres | **Railway** | managed, automatic backups |

> This supersedes [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md) for the Vercel split. That
> guide puts **web** on Railway too and wires `api` over Railway's private network
> (`api.railway.internal`). **Vercel cannot reach that private network**, so here
> `api` gets a public domain instead. Everything else is the same shape.

Deploy order matters: **Railway first**, because Vercel's build bakes the Medusa
URL into the CSP and into `next/image`'s allowed hosts.

---

## 0. Secrets (generate fresh — never reuse the beauty store's)

```bash
openssl rand -base64 32   # JWT_SECRET   — medusa and api must SHARE this one
openssl rand -base64 32   # COOKIE_SECRET
openssl rand -hex 32      # AUTH_MFA_ENCRYPTION_KEY
```

## 1. Railway project + Postgres

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub
   repo** → `batlvndenbayrbileg-sys/x-mas`, branch `main`.
2. **New → Database → Add PostgreSQL**. Reference it as
   `${{Postgres.DATABASE_URL}}` — never paste the raw value.

## 2. Two services from the same repo

| Service | Settings → Root Directory | Public domain |
|---|---|---|
| **medusa** | `medusa-backend/apps/backend` | **yes** (storefront + admin call it) |
| **api** | `api` | **yes** — Vercel reaches it over the internet |

Each folder has its own Dockerfile; Railway picks it up automatically. Both bind
to `$PORT`, so leave the port settings alone.

Settings → Networking → **Generate Domain** on both. You get something like
`medusa-xxx.up.railway.app` and `api-xxx.up.railway.app`.

## 3. Environment variables

Fill the Vercel domain in once you have it (step 5) and redeploy; use the
`*.vercel.app` URL first if you have no custom domain yet.

### medusa

```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<step 0>
COOKIE_SECRET=<step 0>
AUTH_MFA_ENCRYPTION_KEY=<step 0>
STORE_CORS=https://<your-vercel-domain>
AUTH_CORS=https://<your-vercel-domain>,https://medusa-xxx.up.railway.app
ADMIN_CORS=https://medusa-xxx.up.railway.app
STOREFRONT_URL=https://<your-vercel-domain>
EMAIL_FROM=X-MAS <onboarding@resend.dev>
RESEND_API_KEY=<optional>
# R2 object storage — STRONGLY recommended: the container disk is ephemeral, so
# admin-uploaded images vanish on redeploy without it.
S3_FILE_URL=   S3_ENDPOINT=   S3_BUCKET=   S3_ACCESS_KEY_ID=   S3_SECRET_ACCESS_KEY=   S3_REGION=auto
# Leave REDIS_URL and MEILISEARCH_HOST unset → shared mode, search disabled.
```

### api

```
NODE_ENV=production
JWT_SECRET=<same value as medusa>
WEB_ORIGIN=https://<your-vercel-domain>
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
MEDUSA_URL=http://medusa.railway.internal:9000
MEDUSA_PK=<step 6>
BOTXON_GATEWAY_URL=https://botxon.chat
BOTXON_GATEWAY_KEY=<Botxon → /owner/gateway>
BOTXON_WEBHOOK_SECRET=<Botxon → /owner/gateway>
EMAIL_FROM=X-MAS <onboarding@resend.dev>
RESEND_API_KEY=<optional>
```

`MEDUSA_URL` stays on the private network — that hop is Railway→Railway, so it
does not need the public domain.

> Without `BOTXON_GATEWAY_KEY` the service refuses to start in production, and
> without `BOTXON_WEBHOOK_SECRET` the webhook is rejected. Both are required.

## 4. Deploy and migrate

Deploy both services. The medusa container runs `npx medusa db:migrate` before
starting, so schema changes — including the `review` table — apply on their own.

Wait for both to report healthy, then check `https://api-xxx.up.railway.app/health`.

## 5. Vercel — the storefront

1. **New Project** → import `batlvndenbayrbileg-sys/x-mas`.
2. **Root Directory → `web`**. This is the important one: left at `./`, Vercel
   detects `api` and `medusa-backend` as extra apps and offers to group them as
   Services. Neither belongs on Vercel. With the root set, the preset becomes
   **Next.js** on its own.
3. Environment variables:

```
NEXT_PUBLIC_USE_MEDUSA=1
NEXT_PUBLIC_MEDUSA_URL=https://medusa-xxx.up.railway.app
NEXT_PUBLIC_MEDUSA_PK=<step 6>
NEXT_PUBLIC_MEDUSA_REGION=<step 6>
NEXT_PUBLIC_MEILISEARCH=0
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
API_URL=https://api-xxx.up.railway.app
```

Two of these fail quietly rather than loudly:

- **`API_URL`** — `next.config.js` rewrites `/api/*` to it. Unset, it falls back
  to `http://localhost:4000`, and **checkout stops producing QPay invoices** with
  no visible error.
- **`NEXT_PUBLIC_MEDUSA_URL`** — read at **build** time to construct the enforced
  CSP's `connect-src` and `next/image`'s `remotePatterns`. Wrong or missing, the
  browser blocks every store API call and product images refuse to render.

`output: "standalone"` in `next.config.js` is for the Docker path; Vercel ignores
it. Nothing to change.

## 6. Seed the catalog, then finish Vercel

In Railway → medusa service → **Shell**:

```bash
cd .medusa/server
npx medusa exec ./src/scripts/seed-region.js
npx medusa exec ./src/scripts/seed-mnt.js
npx medusa exec ./src/scripts/seed-shipping.js
npx medusa exec ./src/scripts/seed-return-shipping.js
npx medusa exec ./src/scripts/seed-categories.js     # Converse, UGG, The North Face
npx medusa exec ./src/scripts/seed-naran.js          # the 64-product X-MAS catalogue
npx medusa exec ./src/scripts/seed-inventory.js
npx medusa exec ./src/scripts/seed-free-shipping.js  # REQUIRED — the checkout
                                                    # shows free shipping over
                                                    # ₮150,000; without this
                                                    # promo the invoice is higher
                                                    # than the total displayed
npx medusa user -e admin@xmas.mn -p '<STRONG_PASSWORD>'
```

Then open `https://medusa-xxx.up.railway.app/app` → Settings → **Publishable API
Keys** and **Regions**, copy the `pk_…` and the MNT `reg_…`, put them into the
Vercel env vars above **and redeploy Vercel** — `NEXT_PUBLIC_*` bake in at build
time, so a restart is not enough.

## 7. Botxon webhook

Register it at Botxon `/owner/gateway` pointing **straight at the api service**:

```
https://api-xxx.up.railway.app/api/webhooks/botxon
```

Not through the Vercel domain. The handler verifies an HMAC over the raw request
body, and going direct keeps the body byte-identical instead of relying on a
rewrite hop to preserve it.

## 8. Custom domain

Vercel → project → Settings → Domains → `xmas.mn`. Railway → medusa → Networking
→ Custom Domain → `api.xmas.mn`. Then update every URL above to the real domains
(`STORE_CORS`, `AUTH_CORS`, `WEB_ORIGIN`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_MEDUSA_URL`, `API_URL`) and redeploy both sides. TLS is automatic.

## 9. Ongoing

- `git push` → Vercel and Railway both redeploy automatically.
- Railway Postgres backs itself up; nothing to schedule.
- Watch spend with a Railway usage **alert**, not a hard cap — a hard cap takes a
  live store offline.
- Search later: add a MeiliSearch service, set `MEILISEARCH_HOST` +
  `MEILISEARCH_API_KEY` on medusa and `NEXT_PUBLIC_MEILISEARCH=1` on Vercel.
  Give it its own instance and key — see [XMAS-SEPARATION.md](XMAS-SEPARATION.md).
