#!/bin/sh
# Build DATABASE_URL from its parts, with the password percent-encoded and SSL
# explicitly settled. Two separate traps live here; both cost a production
# evening, so both are written down.
#
# 1. ENCODING. The compose file used to paste the password straight into the URL:
#
#      postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
#
#    "openssl rand -base64 32" — what the deploy guides told you to run — emits
#    "/" about half the time, and a "/" ends the authority component:
#
#      postgres://xmas:ab/cd@postgres:5432/xmas
#               host "xmas", port "ab", path "/cd@postgres:5432/xmas"
#
#    Medusa then resolves a host named after the database and gets EAI_AGAIN.
#
# 2. SSL. Medusa decides whether to demand TLS by pattern-matching the URL
#    (@medusajs/utils load-module-database-config): anything that is not
#    localhost, 127.0.0.1 or explicitly sslmode=disable is treated as a remote
#    database and gets ssl: { rejectUnauthorized: false }. An on-box Postgres
#    reached over the compose network is "postgres", so it matched "remote" and
#    Medusa asked a plain postgres:16-alpine for TLS. It answers "the server
#    does not support SSL connections" — and Knex's pool is created with
#    propagateCreateError: false, so that error is swallowed and the pool just
#    retries, every ~200ms, in silence. db:migrate prints "Running migrations…"
#    and then hangs forever with an idle connection and no error anywhere.
#
#    So say it outright. POSTGRES_SSLMODE defaults to disable, which is right
#    for a database on the same private network; set it to require for a
#    managed Postgres addressed by parts.
#
# A non-empty DATABASE_URL always wins, so a managed provider's own connection
# string (Neon, DO, with its ?sslmode=require) still passes through untouched.
set -e

if [ -z "${DATABASE_URL}" ]; then
  DATABASE_URL=$(node -e '
    const enc = encodeURIComponent;
    const user = enc(process.env.POSTGRES_USER || "xmas");
    const pass = enc(process.env.POSTGRES_PASSWORD || "");
    const host = process.env.POSTGRES_HOST || "postgres";
    const port = process.env.POSTGRES_PORT || "5432";
    const db   = process.env.POSTGRES_DB   || "xmas";
    const ssl  = process.env.POSTGRES_SSLMODE || "disable";
    process.stdout.write(`postgres://${user}:${pass}@${host}:${port}/${db}?sslmode=${ssl}`);
  ')
  export DATABASE_URL
fi

exec "$@"
