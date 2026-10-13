#!/bin/sh
# Build DATABASE_URL from its parts, with the password percent-encoded.
#
# The compose file used to paste the password straight into the URL:
#
#   postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
#
# which is fine until the password contains a character that means something
# in a URL. "openssl rand -base64 32" — what the deploy guides told you to run
# — emits "/" about half the time, and a "/" ends the authority component:
#
#   postgres://xmas:ab/cd@postgres:5432/xmas
#            host "xmas", port "ab", path "/cd@postgres:5432/xmas"
#
# Medusa then resolves a host named after the database, gets EAI_AGAIN, and
# retries until the migration job times out. Nothing in the error mentions the
# password. That cost a production evening, so the URL is assembled here now
# and the operator can use whatever password they like.
#
# DATABASE_URL set and non-empty wins, so a managed Postgres (Neon, DO) that
# hands you a full connection string still works untouched.
set -e

if [ -z "${DATABASE_URL}" ]; then
  DATABASE_URL=$(node -e '
    const enc = encodeURIComponent;
    const user = enc(process.env.POSTGRES_USER || "xmas");
    const pass = enc(process.env.POSTGRES_PASSWORD || "");
    const host = process.env.POSTGRES_HOST || "postgres";
    const port = process.env.POSTGRES_PORT || "5432";
    const db   = process.env.POSTGRES_DB   || "xmas";
    process.stdout.write(`postgres://${user}:${pass}@${host}:${port}/${db}`);
  ')
  export DATABASE_URL
fi

exec "$@"
