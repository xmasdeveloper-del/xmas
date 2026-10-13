# X-MAS / NARAN — Railway deploy (low-maintenance PaaS)

> ## ⭐ Deploying X-MAS? Read this first
> This repo is the **X-MAS sneaker store** (`github.com/batlvndenbayrbileg-sys/x-mas`, branch `main`).
>
> **The storefront now goes on Vercel, not Railway** — follow
> **[DEPLOY-VERCEL-RAILWAY.md](DEPLOY-VERCEL-RAILWAY.md)** instead of this file.
> It covers the differences that matter: `api` needs a public domain (Vercel
> cannot reach `*.railway.internal`), CORS points at the Vercel domain, and the
> Botxon webhook goes straight to the api service.
>
> The guide below still describes the all-Railway layout correctly, and its
> medusa/Postgres sections carry over unchanged. Two things in it are stale:
> the catalogue is **64 products across Converse, UGG and The North Face**
> (New Balance was retired), and the seed list omits `seed-shipping.ts` /
> `seed-inventory.ts`.



Railway runs the whole stack with **no server to maintain**: push to GitHub →
auto-deploy, **managed Postgres** with automatic backups, TLS, restarts. You do a
one-time setup; the shop owner only ever touches the admin panel.

- Repo: `github.com/batlvndenbayrbileg-sys/naranamerik` (branch `main`)
- Rough cost: usage-based, ~**₮110k–150k/сар** for a small store.
- ⚠️ **Do NOT set a hard usage limit** — a live store must stay up; use a spend
  **alert** instead (Project → Settings → Usage → email alert).

This is the lean single-region setup: Medusa in **shared mode** (one service, no
separate worker, no Redis) + **no MeiliSearch** (storefront search is disabled;
add it later if needed). Fine for launch traffic.

---

## 0. One-time secrets (generate locally)

```bash
openssl rand -base64 32   # JWT_SECRET
openssl rand -base64 32   # COOKIE_SECRET
```
Keep these — the same `JWT_SECRET` must be shared by the `medusa` and `api`
services.

## 1. Create the project + database

1. [railway.app](https://railway.app) → sign in with GitHub → **New Project** →
   **Deploy from GitHub repo** → pick `naranamerik`.
2. In the project: **New → Database → Add PostgreSQL**. Railway exposes it as
   `${{Postgres.DATABASE_URL}}` (reference it below — don't paste the raw value).

## 2. Add three services (all from the same repo)

For each, set **Settings → Root Directory** and let it use that folder's
Dockerfile. Create them in this order:

| Service | Root Directory | Port |
|---|---|---|
| **medusa** | `medusa-backend/apps/backend` | 9000 |
| **api** | `api` | 4000 |
| **web** | `web` | 3000 |

(For `web`, add the same repo again as a new service and set its root dir; Railway
supports multiple services from one repo.)

Give `medusa` and `web` a **public domain** (Settings → Networking → Generate
Domain) — you'll get `https://medusa-xxx.up.railway.app` and
`https://web-xxx.up.railway.app`. `api` can stay **private** (no public domain);
`web` proxies to it over the private network.

## 3. Environment variables

Use Railway **reference variables** for cross-service values. Replace the
`…up.railway.app` hosts with the real ones Railway generated (or your custom
domains once added in step 7).

### medusa
```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<from step 0>
COOKIE_SECRET=<from step 0>
STORE_CORS=https://web-xxx.up.railway.app
ADMIN_CORS=https://medusa-xxx.up.railway.app
AUTH_CORS=https://web-xxx.up.railway.app,https://medusa-xxx.up.railway.app
STOREFRONT_URL=https://web-xxx.up.railway.app
RESEND_API_KEY=<optional, for emails>
EMAIL_FROM=NARAN <onboarding@resend.dev>
# R2 image storage (STRONGLY recommended — container disk is ephemeral):
S3_FILE_URL=   S3_ENDPOINT=   S3_BUCKET=   S3_ACCESS_KEY_ID=   S3_SECRET_ACCESS_KEY=   S3_REGION=auto
# Leave REDIS_URL and MEILISEARCH_HOST UNSET → shared mode + search disabled.
# Optional RBAC deny-by-default:
SUPER_ADMIN_EMAILS=
```

### api
```
NODE_ENV=production
PORT=4000
JWT_SECRET=<same as medusa>
WEB_ORIGIN=https://web-xxx.up.railway.app
MEDUSA_URL=http://medusa.railway.internal:9000
MEDUSA_PK=<from step 6>
NEXT_PUBLIC_SITE_URL=https://web-xxx.up.railway.app
BOTXON_GATEWAY_URL=https://botxon.chat
BOTXON_GATEWAY_KEY=<from Botxon /owner/gateway>
BOTXON_WEBHOOK_SECRET=<from Botxon /owner/gateway>
RESEND_API_KEY=<optional>
EMAIL_FROM=NARAN <onboarding@resend.dev>
```

### web
Build args AND runtime env (Railway passes service variables to both):
```
NEXT_PUBLIC_MEDUSA_URL=https://medusa-xxx.up.railway.app
NEXT_PUBLIC_MEDUSA_PK=<from step 6>
NEXT_PUBLIC_MEDUSA_REGION=<from step 6>
NEXT_PUBLIC_USE_MEDUSA=1
NEXT_PUBLIC_MEILISEARCH=0
NEXT_PUBLIC_SITE_URL=https://web-xxx.up.railway.app
API_URL=http://api.railway.internal:4000
```
> `NEXT_PUBLIC_MEDUSA_URL` must also be present at RUNTIME (it is, as a service
> variable) — the enforced CSP's `connect-src` is built from it.

## 4. Deploy

Trigger a deploy on each service (Railway auto-deploys on push). `medusa` runs
`db:migrate` on boot automatically, then starts. Wait for all three healthy.

## 5. Seed the catalog + admin (one-off)

Open the **medusa** service → **Shell** (or a one-off command) and run the same
steps as `docs/DEPLOY.md` §6:
```bash
cd .medusa/server
npx medusa exec ./src/scripts/seed-region.js
npx medusa exec ./src/scripts/seed-mnt.js
npx medusa exec ./src/scripts/seed-categories.js
npx medusa exec ./src/scripts/seed-naran.js
npx medusa exec ./src/scripts/seed-promotions.js
npx medusa exec ./src/scripts/seed-return-shipping.js
npx medusa user -e admin@naran.mn -p '<STRONG_PASSWORD>'
```
(Real 10k catalog: `IMPORT_FILE=./data/catalog.csv npx medusa exec ./src/scripts/import-products.js`.)

## 6. Get the publishable key + region → finish web

In the medusa admin (`https://medusa-xxx.up.railway.app/app` → Settings →
Publishable API Keys, and Regions), copy the `pk_…` and the MNT `reg_…`. Put them
in the **web** service's `NEXT_PUBLIC_MEDUSA_PK` / `NEXT_PUBLIC_MEDUSA_REGION` and
**redeploy web** (NEXT_PUBLIC_* bake in at build).

## 7. Custom domain (optional)

web service → Settings → Networking → **Custom Domain** → `naran.mn`; Railway
shows a CNAME to add at your registrar (iTool/Cloudflare). Do the same for the
medusa service → `api.naran.mn`. Then update the CORS / URL envs above to the real
domains and redeploy. TLS is automatic.

## 8. Botxon webhook

Register the webhook at Botxon `/owner/gateway` as:
`https://<web domain>/api/webhooks/botxon` (the web service proxies `/api/*` to the
api service; raw body is preserved for the HMAC check).

## 9. Ongoing (near-zero)

- **Deploy updates:** `git push` → Railway redeploys automatically.
- **Backups:** Railway Postgres backs up automatically (no cron to run).
- **Cost:** watch the usage alert; scale is automatic.
- **Add search later:** add a MeiliSearch service + set `MEILISEARCH_HOST` on
  medusa and `NEXT_PUBLIC_MEILISEARCH=1` on web, then redeploy.
