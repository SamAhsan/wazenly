# WhatsApp Webhook Setup Guide

This document covers everything you need to configure Meta webhooks for Wazenly. Keep it open when you're setting up a new number or debugging delivery issues.

---

## 1. Webhook URL

The backend exposes **one webhook endpoint, shared by every connected number**. Defined in:

```
apps/api/src/routes/webhooks.ts
```

### Verification endpoint (GET)

```
GET https://wazenlyapp.com/api/webhooks/meta
```

Meta calls this once when you save the webhook URL in the developer console. It must return the `hub.challenge` value within 3 seconds.

### Event endpoint (POST)

```
POST https://wazenlyapp.com/api/webhooks/meta
```

Meta sends all events here, for every connected number in the app — the server identifies which number an event belongs to from the payload itself (`value.metadata.phone_number_id`), not from the URL. The server responds `200 EVENT_RECEIVED` immediately and queues the payload for async processing via `webhookProcessorQueue` (Redis/BullMQ).

There is no per-number path segment — do not append a phone number ID to this URL.

---

## 2. Verify Token

Verification is checked against a **single, global** token: the `WHATSAPP_WEBHOOK_VERIFY_TOKEN` environment variable (see `apps/api/src/routes/webhooks.ts`). Set it once in `.env` and use the same value for every number — it is not per-number.

(The `WhatsAppNumber.webhookVerifyToken` database column exists but is not read by the verification endpoint above; don't use it for this step.)

To view or generate the token:

```bash
cd /var/www/wazenly
grep WHATSAPP_WEBHOOK_VERIFY_TOKEN .env
# If missing, generate one and add it to .env:
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## 3. Configuring Meta Developer Console

### Step-by-step

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Select your app (the one tied to your WhatsApp Business Account)
3. In the left sidebar: **WhatsApp → Configuration**
4. Under **Webhook**, click **Edit**
5. Fill in:
   - **Callback URL**: `https://wazenlyapp.com/api/webhooks/meta`
   - **Verify token**: the `WHATSAPP_WEBHOOK_VERIFY_TOKEN` value from `.env` (step above)
6. Click **Verify and save**
7. Meta will send a GET request to your URL. If verification fails, check:
   - Nginx is running: `systemctl status nginx`
   - API is running: `pm2 list`
   - The verify token matches `.env` exactly (no trailing spaces)

This is a one-time, app-level setup — you do **not** need to repeat it per number. Once set, every connected WhatsApp number's events flow through this same URL.

### Subscribe to webhook fields

After saving, you must subscribe to events. Under **Webhook fields**, enable:

| Field | Purpose |
|-------|---------|
| `messages` | Inbound messages from customers |
| `message_deliveries` | Delivery confirmations |
| `message_reads` | Read receipts |
| `messaging_postbacks` | Button click responses |
| `message_template_status_update` | Template approval/rejection updates |
| `account_alerts` | Phone number quality rating changes |

Click **Subscribe** next to each field.

---

## 4. How Webhook Events Are Processed

```
Meta → POST /api/webhooks/meta
         ↓
    Queue: webhookProcessorQueue (BullMQ/Redis), one job per phoneNumberId found in the payload
         ↓
    packages/queue/src/workers/webhook.worker.ts
         ↓
    Processes:
      ├── Inbound messages  → creates Contact + Conversation + Message
      ├── Status "delivered" → updates Message.status, DailyAnalytics
      ├── Status "read"     → updates Message.status, DailyAnalytics
      ├── Status "failed"   → updates Message.status, DailyAnalytics, Campaign
      └── Outbound webhooks → dispatches to configured webhook endpoints
```

### Event types handled

**Inbound messages** (`value.messages` array):
- Creates or upserts the Contact record
- Creates or upserts the Conversation record
- Saves the Message record with direction=INBOUND
- Checks for opt-out keywords (STOP, UNSUBSCRIBE, etc.) and classifies reply interest (Interested/Not Interested)
- Increments `DailyAnalytics.inbound` and optionally `newContacts`

**Status updates** (`value.statuses` array):
- `sent` → `Message.status = SENT`
- `delivered` → `Message.status = DELIVERED`, sets `deliveredAt`
- `read` → `Message.status = READ`, sets `readAt`
- `failed` → `Message.status = FAILED`, stores error code and message

For campaign messages, also updates `CampaignContact` status and recalculates campaign aggregate stats.

---

## 5. Testing the Webhook

### Step 1: Verify the API is reachable

```bash
curl -s "https://wazenlyapp.com/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
# Should return: test123
```

If this fails with 404, check nginx config (`cat /etc/nginx/sites-enabled/wazenlyapp.com`).
If it returns "Invalid verify token", the token doesn't match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env`.

### Step 2: Send a test message

From any WhatsApp account, send a message to your connected WhatsApp Business number.

### Step 3: Check server logs

```bash
pm2 logs wazenly-workers --lines 30
```

You should see:
```
[WebhookWorker] processing job ...
```

If silent, the webhook event never reached the queue. Check:
```bash
pm2 logs wazenly-api --lines 20 --nostream
```

### Step 4: Verify the database

```bash
cd /var/www/wazenly && export $(cat .env | grep -v '^#' | xargs)
node -e "
require('dotenv').config();
const { PrismaClient } = require('./packages/db/dist/index.js');
const p = new PrismaClient();
p.message.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { direction: true, body: true, status: true, createdAt: true } })
  .then(ms => { console.log(JSON.stringify(ms, null, 2)); process.exit(0); });
"
```

### Step 5: Check the Inbox

Open Wazenly → Inbox. The inbound message should appear. The conversation should show as OPEN. If not visible, verify the selected number in the top bar matches the number that received the message.

---

## 6. Troubleshooting

### "Invalid verify token" from Meta

The token you entered in Meta does not match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env`. Re-check with `grep WHATSAPP_WEBHOOK_VERIFY_TOKEN .env` on the server.

### Webhook verified but messages not appearing

1. Check workers are running: `pm2 list` → `wazenly-workers` should be online
2. Check Redis: `redis-cli ping` → should return PONG
3. Check worker logs: `pm2 logs wazenly-workers --lines 50`

### Status updates not reflected

Delivery/read statuses come via the same POST endpoint but are processed by the webhook worker's `value.statuses` branch. If message sends work but statuses don't update, the webhook subscription may be missing `message_deliveries` or `message_reads` — go back to Meta Developer Console and subscribe to those fields.

### Template status not syncing

Template approval/rejection from Meta comes via `message_template_status_update` webhook field. If templates aren't syncing automatically, subscribe to this field, or use the manual **Sync from Meta** button in Wazenly → Templates.

---

## 7. Environment Variables Reference

These variables must be set in `/var/www/wazenly/.env` on the server:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (default: `redis://localhost:6379`) |
| `NEXTAUTH_SECRET` | NextAuth/JWT signing secret — read directly by both `apps/web` and `apps/api` |
| `NEXTAUTH_URL` | Frontend URL (e.g. `https://wazenlyapp.com`) |
| `ENCRYPTION_KEY` | 32-char AES key for storing WhatsApp access tokens |
| `WEBHOOK_BASE_URL` | Public base URL Meta can reach (e.g. `https://wazenlyapp.com`) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Single verify token used for every number (see section 2) |
| `NEXT_PUBLIC_APP_URL` | Public URL of the web app (e.g. `https://wazenlyapp.com`) |
| `NEXT_PUBLIC_API_URL` | API URL seen by the browser (e.g. `https://wazenlyapp.com/api`) |
| `CORS_ORIGIN` | Allowed browser origin(s) for the API, comma-separated |

Meta access tokens are stored **in the database**, not in `.env` — you set them via the Wazenly UI (Settings → Numbers).
