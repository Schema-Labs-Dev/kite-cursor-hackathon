# 02 — Monorepo Setup

## Target structure

```
kite/
├── apps/
│   ├── web/        # existing Next.js 16 marketing site (moved from root)
│   ├── miniapp/    # Next.js Base Mini App (you build) — see 11-miniapp.md
│   ├── api/        # NestJS backend (you build)
│   └── mobile/     # Expo app (your friend builds)
├── contracts/      # Foundry / Solidity (you build)
├── docs/           # this folder
├── .gitignore
├── package.json    # pnpm workspace root
├── pnpm-workspace.yaml
└── README.md
```

We use **pnpm workspaces**. No turborepo, no nx — keep it simple for a hackathon.

## Step 1 — Move the marketing site

The existing repo has the Next.js marketing site at the root. Move it.

```bash
cd /Users/bernardnamangala/Documents/Personal/base_brainstorming/kite

mkdir -p apps
mkdir apps/web

# Move existing Next.js site into apps/web
mv app components public next.config.ts package.json package-lock.json \
   postcss.config.mjs tsconfig.json apps/web/

# Keep BRIEF.md, README.md, AGENTS.md, CLAUDE.md, .gitignore at root
```

Verify the marketing site still runs:

```bash
cd apps/web
pnpm install
pnpm dev
# Visit localhost:3000 — should still work
```

## Step 2 — Initialize pnpm workspace at root

Create `pnpm-workspace.yaml` at the repo root:

```yaml
packages:
  - "apps/*"
  - "contracts"
```

Create root `package.json`:

```json
{
  "name": "kite-monorepo",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter @kite/web dev",
    "dev:miniapp": "pnpm --filter @kite/miniapp dev",
    "dev:api": "pnpm --filter @kite/api start:dev",
    "dev:mobile": "pnpm --filter @kite/mobile start",
    "build:contracts": "cd contracts && forge build",
    "test:contracts": "cd contracts && forge test"
  },
  "devDependencies": {
    "prettier": "^3.3.0"
  }
}
```

Update `apps/web/package.json` `name` field to `@kite/web`.

## Step 3 — Scaffold the new directories

Run these from the repo root. We'll fill them in later docs.

```bash
# Backend (covered in detail in 04-backend-nestjs.md)
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --skip-git
# Edit apps/api/package.json → set name to @kite/api

# Mini App (covered in detail in 11-miniapp.md)
pnpm dlx create-next-app@latest apps/miniapp \
  --typescript --tailwind --app --no-src-dir --import-alias "@/*" --use-pnpm
# Edit apps/miniapp/package.json → set name to @kite/miniapp

# Mobile (your friend may do this themselves)
pnpm dlx create-expo-app apps/mobile --template blank-typescript
# Edit apps/mobile/package.json → set name to @kite/mobile

# Contracts (covered in detail in 03-smart-contracts.md)
mkdir contracts
cd contracts
forge init --no-commit
cd ..
```

## Step 4 — Root `.gitignore` additions

Append to `.gitignore`:

```
# Dependencies
node_modules/

# Build artifacts
apps/*/dist/
apps/*/.next/
apps/*/.expo/
contracts/out/
contracts/cache/
contracts/broadcast/

# Environment
.env
.env.local
.env.*.local
!.env.example

# Database
*.sqlite
*.db

# OS
.DS_Store
```

## Step 5 — Environment variables

Create `.env.example` at root:

```bash
# Shared / convention
NODE_ENV=development

# Backend (apps/api)
DATABASE_URL=postgresql://kite:kite@localhost:5432/kite
JWT_SECRET=replace-me-in-prod
PORT=3001

# Chain
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_CHAIN_ID=84532
KITE_TREASURY_ADDRESS=0x0000000000000000000000000000000000000000
USDC_ADDRESS_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Coinbase Developer Platform
CDP_PROJECT_ID=
CDP_API_KEY_NAME=
CDP_API_KEY_SECRET=

# Coinbase Onramp (for webhooks)
ONRAMP_WEBHOOK_SECRET=

# Mini App (apps/miniapp) — uses NEXT_PUBLIC_ prefix
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_KITE_TREASURY_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_ONCHAINKIT_API_KEY=         # from Coinbase Developer Platform
NEXT_PUBLIC_BASE_DEV_PROJECT_ID=        # from Base.dev after registration

# Mobile (apps/mobile) — uses EXPO_PUBLIC_ prefix
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
EXPO_PUBLIC_KITE_TREASURY_ADDRESS=
EXPO_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Contracts
PRIVATE_KEY=                       # Foundry deployer (testnet only — never commit)
BASESCAN_API_KEY=                  # for verification
```

Each app gets its own `.env` based on this template.

## Step 6 — Local Postgres via Docker

Create `docker-compose.yml` at repo root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: kite-postgres
    environment:
      POSTGRES_USER: kite
      POSTGRES_PASSWORD: kite
      POSTGRES_DB: kite
    ports:
      - "5432:5432"
    volumes:
      - kite-pg-data:/var/lib/postgresql/data

volumes:
  kite-pg-data:
```

Start it:

```bash
docker compose up -d
```

## Step 7 — Verify the workspace

```bash
pnpm install
pnpm dev:web       # marketing site at :3000
pnpm dev:api       # NestJS at :3001 (default Hello World)
pnpm dev:miniapp   # Mini App at :3002 (default Next.js page)
```

> Note the port choice: marketing site (`:3000`) and Mini App (`:3002`) run side-by-side. Set `apps/miniapp/package.json` dev script to `next dev -p 3002`.

Smoke test passes? Move on to [`03-smart-contracts.md`](./03-smart-contracts.md).
