# X-MAS — Oracle Cloud Always Free (ARM)

The whole stack on one free ARM machine: Postgres, Redis, MeiliSearch, Medusa
(server + worker), the Express payment API and the Next.js storefront, with
Dokploy handling deploys and Traefik handling TLS.

- **Cost:** ₮0. Always Free has no 12-month expiry.
- **Machine:** VM.Standard.A1.Flex (Ampere ARM), up to 4 OCPU / 24 GB free.
- **Repo:** `github.com/batlvndenbayrbileg-sys/x-mas`, branch `main`
- **Compose:** `infra/docker-compose.prod.yml` · **Env:** `infra/.env.prod.example`

**ARM is fine.** Every image the stack uses is multi-arch — `node:22-alpine`,
`postgres:16-alpine`, `redis:7-alpine`, `getmeili/meilisearch` — so nothing in
the Dockerfiles or the compose file changes.

> Oracle's console changes often and the free-tier terms can move. Where a
> screen does not look like the description below, the concept still holds:
> find the equivalent control rather than following the wording literally.

---

## 1. Account

[cloud.oracle.com](https://cloud.oracle.com) → **Start for free**. A credit card
is required for identity verification; Always Free resources are not charged.

**Pick the home region carefully — it cannot be changed afterwards.** Nearest to
Mongolia: **Japan East (Tokyo)**, Japan Central (Osaka), South Korea (Seoul),
Singapore.

## 2. Create the instance

**Compute → Instances → Create instance.**

| Field | Value |
|---|---|
| Image | **Ubuntu 24.04** — the **aarch64 / ARM** build |
| Shape | **VM.Standard.A1.Flex** (Ampere) |
| OCPU / memory | **2 OCPU / 12 GB** |
| Boot volume | 50–100 GB |
| SSH | Upload your public key (`~/.ssh/id_ed25519.pub`) |

Why 2/12 and not the full 4/24: the stack idles at about 3.9 GB, so 12 GB is
already generous — and smaller shapes are far easier to get. Free-tier ARM
capacity is genuinely scarce; **"Out of host capacity" is normal**. Retry over a
few hours, or try another availability domain in the same region. Do not switch
region to chase capacity — the home region is permanent.

## 3. Open the ports — both halves

This is where most Oracle setups stall. Two separate firewalls block 80/443, and
opening one is not enough.

**a. The virtual network.** Networking → Virtual Cloud Networks → your VCN →
your subnet → **Security List** → Add Ingress Rules:

| Source CIDR | Protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

**b. The machine itself.** Oracle's Ubuntu image ships with strict iptables
rules. SSH in and open the same ports locally:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Skip (b) and the site simply never answers, with nothing in the logs to say why.

## 4. DNS at iTool

The domain is already registered and its nameservers are iTool's
(`*.orderbox-dns.com`), so only the records are missing. itool.mn → your domain
→ DNS management → add three **A** records pointing at the instance's public IP:

| Type | Host | Value |
|---|---|---|
| A | `@` | instance IP |
| A | `www` | instance IP |
| A | `api` | instance IP |

Do this **before** installing Dokploy — propagation takes anywhere from ten
minutes to a few hours, and Let's Encrypt cannot issue a certificate until the
name resolves to the server. Check with `nslookup xmas.mn 8.8.8.8`.

## 5. Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Then open `http://<instance-ip>:3000` and create the admin account. Do this
promptly — the installer leaves that port open to anyone who finds it.

## 6. The project

Dokploy → **Create Project → Compose**.

- Provider **GitHub** → connect → repo `batlvndenbayrbileg-sys/x-mas`, branch `main`
- **Compose path:** `infra/docker-compose.prod.yml`

**Environment:** paste `infra/.env.prod.example` into the Environment tab and
fill in:

- `POSTGRES_PASSWORD` — `openssl rand -hex 32`. **Not `-base64`:** the compose
  file pastes this into `DATABASE_URL`, and a `/` in the password ends the URL's
  authority early, so Medusa resolves the wrong host and never migrates.
- `JWT_SECRET`, `COOKIE_SECRET`, `MEILISEARCH_API_KEY` — `openssl rand -base64 32`
- `STORE_CORS=https://xmas.mn,https://www.xmas.mn`
- `ADMIN_CORS=https://api.xmas.mn` · `AUTH_CORS=https://xmas.mn,https://www.xmas.mn`
- `NEXT_PUBLIC_MEDUSA_URL=https://api.xmas.mn`
- `PUBLIC_SITE_URL=https://xmas.mn` · `STOREFRONT_URL=https://xmas.mn`
- `BOTXON_GATEWAY_KEY`, `BOTXON_WEBHOOK_SECRET` from Botxon `/owner/gateway` —
  **the api service refuses to start in production without the gateway key**
- Leave `NEXT_PUBLIC_MEDUSA_PK` / `NEXT_PUBLIC_MEDUSA_REGION` as placeholders
  until step 8

**Domains** (Dokploy → Domains):

| Service | Container port | Domain |
|---|---|---|
| `web` | 3000 | `xmas.mn` (+ `www.xmas.mn`), HTTPS on |
| `medusa` | 9000 | `api.xmas.mn`, HTTPS on |

`api` needs no domain — `web` reaches it inside the compose network.

## 7. Deploy

Hit **Deploy**. Order is automatic: `postgres`/`redis`/`meilisearch` →
`medusa-migrate` (runs `db:migrate`, which creates every table including
`review`) → `medusa` + `medusa-worker` → `api` → `web`.

The images build on the machine. On 2 ARM cores the Next.js build takes several
minutes — slow is expected, failure is not.

## 8. Seed, then finish the storefront

Dokploy → `medusa` service → **Terminal**:

```bash
cd .medusa/server
npx medusa exec ./src/scripts/seed-region.ts
npx medusa exec ./src/scripts/seed-mnt.ts
npx medusa exec ./src/scripts/seed-shipping.ts
npx medusa exec ./src/scripts/seed-return-shipping.ts
npx medusa exec ./src/scripts/seed-categories.ts     # the 8 brands
npx medusa exec ./src/scripts/seed-naran.ts          # 166 products
npx medusa exec ./src/scripts/seed-inventory.ts
npx medusa exec ./src/scripts/seed-free-shipping.ts  # REQUIRED — without it the
                                                     # checkout shows free
                                                     # shipping over ₮150,000
                                                     # and invoices more
npx medusa user -e admin@xmas.mn -p '<STRONG_PASSWORD>'
```

Then open `https://api.xmas.mn/app` → Settings → **Publishable API Keys** and
**Regions**, copy the `pk_…` and the MNT `reg_…` into the compose env as
`NEXT_PUBLIC_MEDUSA_PK` / `NEXT_PUBLIC_MEDUSA_REGION`, and **redeploy** —
`NEXT_PUBLIC_*` are baked in at build time, so a restart is not enough.

## 9. Botxon webhook

Register at Botxon `/owner/gateway`:

```
https://xmas.mn/api/webhooks/botxon
```

The storefront proxies `/api/*` to the Express service and preserves the raw
body, which the HMAC check needs.

## 10. Keeping it

Always Free instances can be reclaimed after long idle periods. A live store
with traffic is not idle, so this is mostly a risk while the shop is quiet.

What Oracle does not give you that a paid host does: no managed backups. The
database is the thing worth protecting — `infra/backup/backup.sh` dumps Postgres;
schedule it and copy the dump off the machine.
