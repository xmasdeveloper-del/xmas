# Medusa v2 backend — deploy to Railway / Render (with managed Postgres + Redis).
# Build context = this apps/backend directory.
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build
# Install the compiled server's deps at BUILD time so startup is fast (no runtime install → no 502).
RUN cd .medusa/server && npm install --omit=dev --legacy-peer-deps

ENV NODE_ENV=production
EXPOSE 9000

# Run migrations, then start the compiled server (binds to $PORT).
CMD ["sh", "-c", "cd .medusa/server && npx medusa db:migrate && npm run start"]
