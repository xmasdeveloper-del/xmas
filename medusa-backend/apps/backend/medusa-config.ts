import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'
import { execSync } from 'node:child_process'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Synchronous, short TCP reachability probe (config load is sync, so this spawns
// a tiny node child that connects with a timeout). Used to skip optional infra
// whose plugin/module would otherwise throw at boot when the service is down.
function reachable(url: string, timeoutMs = 1200): boolean {
  try {
    const u = new URL(url)
    const port = u.port || (u.protocol === 'https:' ? '443' : '80')
    execSync(
      `node -e "const s=require('net').connect(${port},'${u.hostname}',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));s.setTimeout(${timeoutMs},()=>{s.destroy();process.exit(1)})"`,
      { stdio: 'ignore', timeout: timeoutMs + 2000 },
    )
    return true
  } catch {
    return false
  }
}

// --- Database URL ------------------------------------------------------------
// Built here rather than in the compose file or a container entrypoint, because
// this is the one place every entry path goes through: the server, the worker,
// the migrate job, and `medusa exec` run from a shell inside a running
// container — which is how the seeds are run, and which never sees an
// entrypoint.
//
// Two things the naive string gets wrong:
//
//   1. The password is percent-encoded. "openssl rand -base64 32" emits "/"
//      roughly half the time, and a "/" ends the URL's authority, so
//      postgres://xmas:ab/cd@postgres:5432/xmas parses as host "xmas", port
//      "ab" — Medusa resolves a host named after the database and gets
//      EAI_AGAIN.
//
//   2. sslmode is stated outright. @medusajs/utils decides whether to demand
//      TLS by pattern-matching this string: anything that is not localhost,
//      127.0.0.1 or sslmode=disable is treated as a remote database and gets
//      ssl: { rejectUnauthorized: false }. An on-box Postgres on the compose
//      network is "postgres", so it was asked for TLS it does not speak. Knex
//      builds its pool with propagateCreateError: false, so that error goes
//      nowhere and the pool retries every 200ms — db:migrate printed "Running
//      migrations..." and hung with no error at all. POSTGRES_SSLMODE
//      overrides for a managed server that does want TLS.
//
// A full DATABASE_URL always wins, so a managed provider's own connection
// string passes through untouched.
function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (!process.env.POSTGRES_PASSWORD) return undefined
  const enc = encodeURIComponent
  const user = enc(process.env.POSTGRES_USER || "xmas")
  const pass = enc(process.env.POSTGRES_PASSWORD)
  const host = process.env.POSTGRES_HOST || "postgres"
  const port = process.env.POSTGRES_PORT || "5432"
  const db = process.env.POSTGRES_DB || "xmas"
  const ssl = process.env.POSTGRES_SSLMODE || "disable"
  return `postgres://${user}:${pass}@${host}:${port}/${db}?sslmode=${ssl}`
}

// --- Optional infra, gated on env so local dev boots without these services ---
// MeiliSearch (typo-tolerant, faceted product search — scales to 10k+).
const MEILI_HOST = process.env.MEILISEARCH_HOST
const MEILI_KEY = process.env.MEILISEARCH_API_KEY
// Cloudflare R2 (S3-compatible object storage for product images).
const R2_ENDPOINT = process.env.S3_ENDPOINT
const R2_BUCKET = process.env.S3_BUCKET

// Product → MeiliSearch index document. Flattens categories so the storefront
// can search by category name and facet-filter by category handle inside Meili.
const productTransformer = (product: any) => ({
  id: product.id,
  handle: product.handle,
  title: product.title,
  description: product.description,
  thumbnail: product.thumbnail,
  category_handles: (product.categories || []).map((c: any) => c.handle).filter(Boolean),
  category_names: (product.categories || []).map((c: any) => c.name).filter(Boolean),
})

// Register MeiliSearch only when it's actually reachable — if MEILISEARCH_HOST is
// set but the service is down, the plugin's loader throws and takes the whole
// Medusa boot down with it. Probing here lets Medusa (and the admin) start
// regardless; search is simply unavailable until Meili is back and Medusa
// restarts.
const plugins: any[] = []
const meiliUp = !!MEILI_HOST && reachable(MEILI_HOST)
if (MEILI_HOST && !meiliUp) {
  console.warn(`[medusa-config] MeiliSearch (${MEILI_HOST}) unreachable — search plugin disabled so Medusa can still boot.`)
}
if (meiliUp) {
  plugins.push({
    resolve: '@rokmohar/medusa-plugin-meilisearch',
    options: {
      config: { host: MEILI_HOST, apiKey: MEILI_KEY ?? '' },
      settings: {
        // Index UID is env-driven so each store (X-MAS vs beauty) owns its own
        // MeiliSearch index even when they share one Meili instance.
        [process.env.MEILI_INDEX || 'products']: {
          type: 'products',
          enabled: true,
          fields: ['id', 'title', 'description', 'handle', 'thumbnail', 'categories.id', 'categories.name', 'categories.handle'],
          indexSettings: {
            searchableAttributes: ['title', 'description', 'category_names'],
            displayedAttributes: ['id', 'handle', 'title', 'thumbnail', 'category_handles', 'category_names'],
            filterableAttributes: ['category_handles'],
          },
          primaryKey: 'id',
          transformer: productTransformer,
        },
      },
    },
  })
}

// File storage: default local provider unless R2/S3 env is configured (VPS/prod).
const modules: any[] = [
  // Customer product reviews (own table, moderated before they go public).
  { resolve: "./src/modules/review" },
]
if (R2_ENDPOINT && R2_BUCKET) {
  modules.push({
    resolve: '@medusajs/medusa/file',
    options: {
      providers: [
        {
          resolve: '@medusajs/file-s3',
          id: 's3',
          options: {
            file_url: process.env.S3_FILE_URL,      // public CDN/base URL for objects
            endpoint: R2_ENDPOINT,                  // https://<account>.r2.cloudflarestorage.com
            bucket: R2_BUCKET,
            access_key_id: process.env.S3_ACCESS_KEY_ID,
            secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
            region: process.env.S3_REGION || 'auto', // R2 uses "auto"
            // R2 requires path-style addressing.
            additional_client_config: { forcePathStyle: true },
          },
        },
      ],
    },
  })
} else {
  // No object storage configured → Medusa's local file provider. Two things
  // have to be true for an admin-uploaded product image to actually work:
  //   1. It must survive a redeploy. The provider writes to `static/` under the
  //      server's working directory (.medusa/server), and the compose file
  //      mounts that path as a named volume — without it every deploy wiped the
  //      uploads with the container.
  //   2. Its URL must be the public backend host, not an internal one, so
  //      next/image on the storefront (which allows api.xmas.mn) can load it.
  const backend = (process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000').replace(/\/+$/, '')
  modules.push({
    resolve: '@medusajs/medusa/file',
    options: {
      providers: [
        {
          resolve: '@medusajs/file-local',
          id: 'local',
          options: { upload_dir: 'static', backend_url: `${backend}/static` },
        },
      ],
    },
  })
}

// Redis-backed infra for the server/worker split (production only). Locally
// (NODE_ENV !== production) Medusa uses its in-memory event bus + workflow
// engine, so dev boots without Redis even if REDIS_URL is set in .env.
const REDIS_URL = process.env.REDIS_URL
const useRedis = process.env.NODE_ENV === 'production' && !!REDIS_URL
if (useRedis) {
  // Infrastructure modules MUST carry their module `key` so Medusa knows which
  // built-in (in-memory) slot they replace — without it boot fails with
  // "Module … doesn't have a serviceName. Please provide a 'key' …".
  modules.push(
    { key: Modules.EVENT_BUS, resolve: '@medusajs/event-bus-redis', options: { redisUrl: REDIS_URL } },
    { key: Modules.WORKFLOW_ENGINE, resolve: '@medusajs/workflow-engine-redis', options: { redis: { url: REDIS_URL } } },
    { key: Modules.CACHE, resolve: '@medusajs/cache-redis', options: { redisUrl: REDIS_URL, ttl: 30 } },
  )
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: databaseUrl(),
    redisUrl: useRedis ? REDIS_URL : undefined,
    // shared (default) | server (HTTP only) | worker (background jobs only).
    // For a large store: one `server` + one `worker` container sharing Redis.
    workerMode: (process.env.MEDUSA_WORKER_MODE as 'shared' | 'server' | 'worker') || 'shared',
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  plugins,
  modules,
})
