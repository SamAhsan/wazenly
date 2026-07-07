-- Each WhatsApp number becomes its own independent company workspace. Any existing
-- workspace holding more than one number gets split: the oldest number keeps the
-- existing Workspace row, and every additional number gets a freshly created one.
-- Every table that already carries numberId (Contact/ContactList from the earlier
-- per-number migration, plus Campaign/Conversation/Message/Flow/Template/
-- DailyAnalytics/FlowSession, which already had it) gets re-pointed mechanically --
-- numberId already tells us exactly which row belongs to which split-off company, no
-- inference needed. WorkspaceMember rows are cloned onto every new company so no
-- existing team member loses access. ApiKey/WebhookEndpoint/QuickReply/Notification
-- and any not-yet-accepted Invitation have no number affinity recorded anywhere and
-- stay on the original (primary) workspace only.

DO $$
DECLARE
  ws RECORD;
  num RECORD;
  new_ws_id TEXT;
  new_slug TEXT;
  free_plan_id TEXT;
  is_first BOOLEAN;
  split_count INT := 0;
  member_clone_count INT := 0;
BEGIN
  SELECT id INTO free_plan_id FROM "BillingPlan" WHERE name = 'Free' LIMIT 1;

  FOR ws IN
    SELECT "workspaceId" AS id
    FROM "WhatsAppNumber"
    GROUP BY "workspaceId"
    HAVING COUNT(*) > 1
  LOOP
    is_first := TRUE;

    FOR num IN
      SELECT id, "displayName"
      FROM "WhatsAppNumber"
      WHERE "workspaceId" = ws.id
      ORDER BY "createdAt" ASC
    LOOP
      IF is_first THEN
        is_first := FALSE;
        CONTINUE; -- oldest number's data stays on the existing workspace row
      END IF;

      new_ws_id := gen_random_uuid()::text;
      new_slug := lower(regexp_replace(num."displayName", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 8);

      INSERT INTO "Workspace" (id, name, slug, timezone, "defaultLang", "planId", "createdAt", "updatedAt")
      SELECT new_ws_id, num."displayName", new_slug, timezone, "defaultLang", free_plan_id, now(), now()
      FROM "Workspace" WHERE id = ws.id;

      IF free_plan_id IS NOT NULL THEN
        INSERT INTO "Subscription" (id, "workspaceId", "planId", status, "startedAt")
        VALUES (gen_random_uuid()::text, new_ws_id, free_plan_id, 'active', now());
      END IF;

      -- Move the number itself, then every row that already records this exact
      -- numberId -- numberId is globally unique (WhatsAppNumber.id), so filtering by
      -- it alone is unambiguous regardless of a row's current workspaceId.
      UPDATE "WhatsAppNumber" SET "workspaceId" = new_ws_id WHERE id = num.id;
      UPDATE "Template" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;
      UPDATE "Campaign" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;
      UPDATE "Conversation" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;
      UPDATE "Message" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;
      UPDATE "Flow" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;
      UPDATE "Contact" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;
      UPDATE "ContactList" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;
      UPDATE "DailyAnalytics" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;
      UPDATE "FlowSession" SET "workspaceId" = new_ws_id WHERE "numberId" = num.id;

      -- Clone every team member onto the new company. inviteToken is globally unique
      -- (already-consumed, tied to the original invitation), so it's not carried over.
      INSERT INTO "WorkspaceMember" (id, "workspaceId", "userId", role, "invitedAt", "joinedAt", "inviteToken")
      SELECT gen_random_uuid()::text, new_ws_id, "userId", role, "invitedAt", "joinedAt", NULL
      FROM "WorkspaceMember" WHERE "workspaceId" = ws.id;
      GET DIAGNOSTICS member_clone_count = ROW_COUNT;

      split_count := split_count + 1;
      RAISE NOTICE 'Split "%": created workspace % with % cloned team member(s).', num."displayName", new_ws_id, member_clone_count;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Workspace split complete: % new company workspace(s) created.', split_count;
END $$;

-- Enforce one number per workspace going forward.
ALTER TABLE "WhatsAppNumber" ADD CONSTRAINT "WhatsAppNumber_workspaceId_key" UNIQUE ("workspaceId");
