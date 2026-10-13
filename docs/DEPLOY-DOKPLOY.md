# X-MAS — Dokploy deploy (self-hosted, one VPS)

Dokploy runs the **whole X-MAS stack from one Docker Compose file** on your own
VPS — Postgres, Redis, MeiliSearch, Medusa (server + worker), the Express API and
the Next.js storefront, with Traefik TLS/routing built in.

- **Repo:** `github.com/batlvndenbayrbileg-sys/x-mas` (branch `main`)
- **Compose file:** `infra/docker-compose.prod.yml` (validated ✓, env-driven)
- **Env template:** `infra/.env.prod.example`
- **VPS sizing — get 8 GB.** The service `mem_limit`s in the compose file add up
  to **3.9 GB** at steady state (Postgres 768m + Medusa 1024m + worker 640m + web
  512m + meili 512m + redis 256m + api 256m). A 4 GB box has nothing left for the
  kernel, Docker, Dokploy and Traefik, and the build itself peaks higher — it will
  OOM. 8 GB (e.g. Hetzner CX32) leaves comfortable headroom.
- **Running on 4 GB anyway?** Drop the two optional services and the stack fits in
  ~2.8 GB: comment out `meilisearch` and `medusa-worker` in
  `infra/docker-compose.prod.yml`, and set `NEXT_PUBLIC_MEILISEARCH=0` in the env.
  Medusa then runs in shared mode (it processes its own jobs) and storefront
  search falls back to Medusa's built-in query. Both can be added back later.

---

## 1. Install Dokploy (once, on the VPS)
```bash
curl -sSL https://dokploy.com/install.sh | sh
```
Open `http://<vps-ip>:3000`, create the admin account.

## 2. Point a DNS A-record at the VPS
- `xmas.mn` and `www.xmas.mn` → VPS IP (storefront)
- `api.xmas.mn` → VPS IP (Medusa admin + store API)

## 3. Create a Compose project in Dokploy
1. **Create Project → Compose**.
2. **Provider: GitHub** → connect the account → repo `batlvndenbayrbileg-sys/x-mas`, branch `main`.
3. **Compose Path:** `infra/docker-compose.prod.yml`.

## 4. Environment
Paste the contents of `infra/.env.prod.example` into the Compose **Environment**
tab and fill the blanks:
- `POSTGRES_PASSWORD` — `openssl rand -hex 32`. **Not `-base64`.** The compose
  file builds `DATABASE_URL` out of this password, and base64 emits `/`, which
  closes the URL's authority early: Medusa then looks up a host named after your
  database and dies with `EAI_AGAIN` before a single migration runs.
- `JWT_SECRET`, `COOKIE_SECRET`, `MEILISEARCH_API_KEY` — `openssl rand -base64 32`
  (never go into a URL, so any character is fine)
- `STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS` → your `https://xmas.mn` / `https://api.xmas.mn`
- `NEXT_PUBLIC_MEDUSA_URL=https://api.xmas.mn`, `PUBLIC_SITE_URL=https://xmas.mn`, `STOREFRONT_URL=https://xmas.mn`
- `BOTXON_GATEWAY_KEY` + `BOTXON_WEBHOOK_SECRET` (from Botxon `/owner/gateway`) — **required in prod**
- Leave `NEXT_PUBLIC_MEDUSA_PK` / `NEXT_PUBLIC_MEDUSA_REGION` as placeholders for now (step 7)

## 5. Domains (Dokploy → Domains)
- `web` service, container port **3000** → `xmas.mn` (enable HTTPS/Let's Encrypt)
- `medusa` service, container port **9000** → `api.xmas.mn` (HTTPS)
- `api` stays internal (no domain — `web` reaches it at `http://api:4000`)

## 6. Deploy
Hit **Deploy**. The images are built **on the VPS** — the Next.js build is the
memory-hungry step (it peaks well above the 512m the running container is capped
at), which is the other reason a 4 GB box struggles. If a build is OOM-killed,
add swap (`fallocate -l 4G /swapfile && mkswap /swapfile && swapon /swapfile`)
or build elsewhere and push images to a registry.

 Order is automatic: `postgres`/`redis`/`meilisearch` → `medusa-migrate`
(runs `db:migrate` once) → `medusa` + `medusa-worker` → `api` → `web`.

`medusa-migrate` applies every module migration, so schema added since the last
deploy — the customer `review` table, for one — is created without a manual step.

## 7. Seed the catalog + admin (once)
Dokploy → `medusa` service → **Terminal**:
```bash
cd .medusa/server
npx medusa exec ./src/scripts/seed-region.js
npx medusa exec ./src/scripts/seed-shipping.js
npx medusa exec ./src/scripts/seed-mnt.js
npx medusa exec ./src/scripts/seed-return-shipping.js
npx medusa exec ./src/scripts/seed-categories.js   # Converse, UGG, The North Face
npx medusa exec ./src/scripts/seed-naran.js        # the 64-product X-MAS catalogue
npx medusa exec ./src/scripts/seed-inventory.js
npx medusa exec ./src/scripts/seed-free-shipping.js  # REQUIRED — the checkout
                                                    # shows free shipping over
                                                    # ₮150,000; without this
                                                    # promo the invoice is higher
                                                    # than the total displayed
npx medusa user -e admin@xmas.mn -p '<STRONG_PASSWORD>'
```

## 8. Publishable key + region → finish the storefront
1. Open `https://api.xmas.mn/app` → **Settings → Publishable API Keys** (copy `pk_…`)
   and **Regions** (copy the MNT `reg_…`).
2. Put them in the Compose env: `NEXT_PUBLIC_MEDUSA_PK`, `NEXT_PUBLIC_MEDUSA_REGION`.
3. **Redeploy** (these bake into the web build).

## 9. Botxon webhook
Register `https://xmas.mn/api/webhooks/botxon` in Botxon `/owner/gateway`.

---

### Notes
- **Images:** container disk is ephemeral. For durable product images set the
  `S3_*` (Cloudflare R2) vars, or store images on a Dokploy volume.
- **Backups:** Dokploy can schedule Postgres backups (Database → Backups), or use
  `infra/backup/`.
- **Updates:** push to `main` → redeploy in Dokploy (enable auto-deploy webhook to
  make it automatic).
- Managed Postgres instead of on-box? Use `infra/docker-compose.managed-db.yml`
  and set the full `DATABASE_URL` (with `?sslmode=require`).
