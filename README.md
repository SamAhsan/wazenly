# WAZENLY — WhatsApp Business Solution Provider (BSP) SaaS Platform

A full-stack enterprise WhatsApp BSP platform built with Next.js 14, Express, PostgreSQL, Redis, and BullMQ.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + Socket.io |
| Database | PostgreSQL + Prisma ORM |
| Caching / Queue | Redis + BullMQ |
| WhatsApp | WhatsApp Cloud API (Meta Graph API v18.0) |
| Auth | NextAuth.js (Credentials + Google OAuth) |
| Charts | Recharts |
| Flow Builder | React Flow |

---

## Features

- **Multi-Number Management** — Connect and manage multiple WhatsApp Business numbers with encrypted token storage (AES-256)
- **Campaign Manager** — Multi-step campaign wizard with contact list targeting, template variable mapping, scheduling, rate limiting, and quiet hours
- **Real-time Inbox** — WhatsApp-style team inbox with Socket.io, conversation assignment, internal notes, and canned replies
- **Template Manager** — Sync, create, and submit message templates directly to Meta for approval
- **Contact Management** — CSV import, tags, custom fields, lists, opt-out tracking
- **Chatbot Flow Builder** — Visual drag-and-drop flow builder using React Flow
- **Analytics Dashboard** — Real-time delivery funnel, per-campaign stats, and per-number breakdowns
- **REST API** — Public API v1 with API key authentication and OpenAPI docs
- **Background Workers** — BullMQ workers for campaign sending, webhook processing, template sync, and contact imports
- **Multi-tenant** — Full workspace isolation with RBAC (Owner/Admin/Manager/Agent/Viewer)

---

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL 14+
- Redis 6+
- A Meta Developer account with a WhatsApp Business App

---

## Local Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/yourorg/wazenly.git
cd wazenly
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required — PostgreSQL connection string
DATABASE_URL="postgresql://postgres:password@localhost:5432/wazenly"

# Required — Redis connection string
REDIS_URL="redis://localhost:6379"

# Required — NextAuth (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-secret-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# Required — AES-256 encryption for WhatsApp tokens (exactly 32 chars)
ENCRYPTION_KEY="wazenly-super-secret-key-32-char"

# Required — Base URL where Meta can reach your webhook
WEBHOOK_BASE_URL="https://your-ngrok-url.ngrok.io"

# Optional — Google OAuth (for social sign-in)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional — SMTP for password reset emails
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="you@gmail.com"
SMTP_PASS="your-app-password"

# App URLs
NEXT_PUBLIC_APP_URL="http://localhost:3000"
API_URL="http://localhost:4000"
PORT="4000"
NODE_ENV="development"
```

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Seed with demo data
npm run db:seed
```

**Demo credentials after seeding:**
```
Email:    admin@acme.com
Password: Admin1234!
```

### 4. Start all services

Open **3 terminal windows**:

**Terminal 1 — Backend API:**
```bash
cd apps/api
npm run dev
# Running on http://localhost:4000
# API Docs: http://localhost:4000/api/docs
```

**Terminal 2 — Frontend:**
```bash
cd apps/web
npm run dev
# Running on http://localhost:3000
```

**Terminal 3 — Queue Workers:**
```bash
cd packages/queue
npm run worker
```

---

## Connecting a Real WhatsApp Number

### Step 1: Meta Developer Setup

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new App → Select **Business** type
3. Add the **WhatsApp** product to your app
4. Go to **WhatsApp > API Setup**
5. Note down:
   - **Phone Number ID** (shown in the dashboard)
   - **WhatsApp Business Account ID (WABA ID)**
   - **Temporary Access Token** (or generate a permanent one)

### Step 2: Expose your local webhook with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Expose port 4000
ngrok http 4000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and set:
```env
WEBHOOK_BASE_URL="https://abc123.ngrok.io"
```

### Step 3: Configure Webhook in Meta Dashboard

1. In Meta App Dashboard → **WhatsApp > Configuration**
2. Set **Callback URL**: `https://abc123.ngrok.io/api/webhooks/meta/{YOUR_PHONE_NUMBER_ID}`
3. Set **Verify Token**: copy from your database after connecting the number (or check console logs)
4. Subscribe to the **messages** field

### Step 4: Connect the number in WAZENLY

1. Open [http://localhost:3000/dashboard/numbers](http://localhost:3000/dashboard/numbers)
2. Click **Connect Number**
3. Fill in all credentials from Step 1
4. Click **Connect** — the platform will verify and register the webhook automatically

---

## API Documentation

Interactive Swagger UI: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

### Authentication

All public API requests require a Bearer token (API key):

```http
Authorization: Bearer waz_your_api_key_here
```

Generate API keys at: `/dashboard/settings` → **API Keys**

### Key Endpoints

```
POST   /api/v1/messages/send          → Send single message
POST   /api/v1/messages/template      → Send template message
GET    /api/v1/messages/:id           → Get message status
POST   /api/v1/campaigns              → Create campaign
GET    /api/v1/campaigns/:id          → Get campaign stats
POST   /api/v1/contacts               → Create/update contact
GET    /api/v1/contacts               → List contacts
GET    /api/v1/templates              → List approved templates
GET    /api/v1/numbers                → List connected numbers
```

### Example: Send a message

```bash
curl -X POST http://localhost:4000/api/v1/messages/send \
  -H "Authorization: Bearer waz_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "numberId": "your-number-id",
    "to": "+15551234567",
    "type": "text",
    "text": "Hello from WAZENLY!"
  }'
```

---

## Project Structure

```
wazenly/
├── apps/
│   ├── api/                    # Express backend
│   │   └── src/
│   │       ├── index.ts        # Server entry point
│   │       ├── routes/         # API route handlers
│   │       ├── middleware/     # Auth, rate limiting, error handling
│   │       ├── services/       # Meta API service
│   │       └── socket/         # Socket.io event handlers
│   └── web/                    # Next.js 14 frontend
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── auth/       # Login, register, forgot-password
│           │   ├── dashboard/  # All dashboard pages
│           │   └── api/auth/   # NextAuth handler
│           ├── components/     # Shared components
│           ├── lib/            # API client, utils
│           └── types/          # TypeScript declarations
├── packages/
│   ├── db/                     # Prisma schema + migrations + seed
│   ├── shared/                 # Shared types, constants, utilities
│   └── queue/                  # BullMQ workers
│       └── src/
│           ├── workers/
│           │   ├── campaign.worker.ts
│           │   ├── webhook.worker.ts
│           │   ├── template-sync.worker.ts
│           │   └── contact-importer.worker.ts
│           ├── queues.ts
│           └── redis.ts
├── .env.example
├── package.json                # Workspace root
├── turbo.json                  # Turborepo config
└── tsconfig.json               # Shared TS config
```

---

## Database Schema Overview

```
User → WorkspaceMember → Workspace
Workspace → WhatsAppNumber, Template, Contact, Campaign, Flow, etc.
Campaign → CampaignContact (per-recipient tracking)
Conversation → Message (inbox)
Flow → FlowNode, FlowEdge, FlowTrigger
```

All models are multi-tenant — scoped by `workspace_id`.

---

## Background Queue Architecture

```
Campaign Launch
  └── campaignSenderQueue
       └── campaign.worker.ts
            ├── Batch contacts (50 at a time)
            ├── Call Meta Cloud API
            ├── Handle 429 rate limits (exponential backoff)
            ├── Update CampaignContact status
            └── Queue next batch

Incoming Webhook (Meta → /api/webhooks/meta/:phoneNumberId)
  └── webhookProcessorQueue
       └── webhook.worker.ts
            ├── Process inbound messages
            ├── Update message delivery statuses
            ├── Handle opt-outs
            └── Dispatch outbound webhooks

Template Sync (hourly cron)
  └── templateSyncQueue
       └── template-sync.worker.ts
            └── Sync template statuses from Meta API

CSV Import
  └── contactImporterQueue
       └── contact-importer.worker.ts
            ├── Validate & normalize phones
            ├── Upsert contacts
            └── Add to contact list
```

---

## Deployment

### Option A: Railway (Recommended for quick start)

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project
3. Deploy from GitHub
4. Add services: **PostgreSQL**, **Redis**
5. Set all env variables from `.env.example`
6. Railway auto-detects the monorepo and deploys `apps/api` and `apps/web`

### Option B: Render

1. Create 3 Render services:
   - **Web Service** (apps/web): `npm run build && npm run start`
   - **Background Worker** (packages/queue): `npm run worker`
   - **API** (apps/api): `npm run build && npm run start`
2. Add **PostgreSQL** and **Redis** databases from Render marketplace
3. Set environment variables in each service

### Option C: VPS (Ubuntu/Debian)

```bash
# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql redis-server nginx

# Setup app
git clone https://github.com/yourorg/wazenly.git /var/www/wazenly
cd /var/www/wazenly
npm install

# Create PostgreSQL database
sudo -u postgres psql -c "CREATE DATABASE wazenly;"
sudo -u postgres psql -c "CREATE USER wazenly WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE wazenly TO wazenly;"

# Configure .env, then:
npm run db:migrate
npm run db:seed

# Build everything
npm run build

# Use PM2 for process management
npm install -g pm2

pm2 start apps/api/dist/index.js --name "wazenly-api"
pm2 start "cd packages/queue && npm run worker" --name "wazenly-workers" --interpreter bash
pm2 start "cd apps/web && npm start" --name "wazenly-web"
pm2 save
pm2 startup
```

**Nginx config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `NEXTAUTH_URL` | ✅ | Full URL of your Next.js app |
| `ENCRYPTION_KEY` | ✅ | AES-256 key for WhatsApp tokens (exactly 32 chars) |
| `WEBHOOK_BASE_URL` | ✅ | Public URL where Meta can reach webhooks |
| `GOOGLE_CLIENT_ID` | — | For Google OAuth sign-in |
| `GOOGLE_CLIENT_SECRET` | — | For Google OAuth sign-in |
| `META_APP_ID` | — | Meta app ID (for app-level operations) |
| `META_APP_SECRET` | — | Meta app secret |
| `SMTP_HOST` | — | SMTP server for password reset emails |
| `SMTP_PORT` | — | SMTP port (587 for TLS) |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password / app password |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL of Next.js frontend |
| `NEXT_PUBLIC_API_URL` | ✅ | Browser-facing API base (usually `<NEXT_PUBLIC_APP_URL>/api`) |
| `API_URL` | ✅ | Internal (localhost) URL of Express API, used server-side |
| `CORS_ORIGIN` | ✅ | Allowed browser origin(s) for the API, comma-separated |
| `PORT` | — | API port (default: 4000) |

---

## Troubleshooting

**Webhook not receiving messages:**
- Ensure `WEBHOOK_BASE_URL` is a publicly accessible HTTPS URL
- Check ngrok is running and URL matches `.env`
- Verify the webhook is registered in Meta Developer Dashboard
- The verify token must match `webhookVerifyToken` in the database

**429 Rate limit errors from Meta:**
- Reduce `rateLimit` setting on the campaign (default: 60/min)
- Check your number's tier in Meta Dashboard
- Tier 1 = 1,000 messages/day, Tier 2 = 10,000, etc.

**Campaign stuck in RUNNING:**
- Check Redis is running: `redis-cli ping`
- Check queue worker logs for errors
- Verify the campaign has contacts with status QUEUED

**Template sync not working:**
- Ensure the access token has `whatsapp_business_messaging` permission
- Check WABA ID is correct
- Templates take 1–24 hours to be approved by Meta

---

## License

MIT © 2024 WAZENLY
