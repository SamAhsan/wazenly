-- Contacts and ContactLists become scoped to a single WhatsApp number instead of being
-- shared workspace-wide. Since real data already exists, this migration backfills
-- numberId for every existing row before the column becomes required, duplicating any
-- contact that has genuine history with more than one number so each number keeps its
-- own independent copy (tags/notes/opt-out) going forward.

-- Step 0: add the columns nullable first so we can backfill before enforcing NOT NULL.
ALTER TABLE "Contact" ADD COLUMN "numberId" TEXT;
ALTER TABLE "ContactList" ADD COLUMN "numberId" TEXT;

-- Step 0.5: swap the uniqueness to (workspaceId, numberId, phone) immediately -- this
-- must happen before any duplication below, since Postgres would otherwise still
-- enforce the old (workspaceId, phone)-only uniqueness and reject a same-phone
-- duplicate row the moment we try to insert one for a second number. NULLs are never
-- considered equal to each other in a unique index, so having every numberId still
-- unset at this point is safe.
DROP INDEX "Contact_workspaceId_phone_key";
CREATE UNIQUE INDEX "Contact_workspaceId_numberId_phone_key" ON "Contact"("workspaceId", "numberId", "phone");

-- Step 1: every (contact, number) pair we have real evidence for, from the number-scoped
-- tables that already reference both.
CREATE TEMP TABLE contact_affinity AS
SELECT DISTINCT contact_id, number_id FROM (
  SELECT "contactId" AS contact_id, "numberId" AS number_id FROM "Conversation" WHERE "contactId" IS NOT NULL
  UNION
  SELECT "contactId", "numberId" FROM "Message" WHERE "contactId" IS NOT NULL
  UNION
  SELECT cc."contactId", camp."numberId" FROM "CampaignContact" cc JOIN "Campaign" camp ON camp.id = cc."campaignId" WHERE cc."contactId" IS NOT NULL
  UNION
  SELECT "contactId", "numberId" FROM "FlowSession"
) x;

-- Step 2: contacts with zero evidence (e.g. imported but never messaged/targeted) fall
-- back to their workspace's oldest connected number.
INSERT INTO contact_affinity (contact_id, number_id)
SELECT c.id, (
  SELECT n.id FROM "WhatsAppNumber" n WHERE n."workspaceId" = c."workspaceId" ORDER BY n."createdAt" ASC LIMIT 1
)
FROM "Contact" c
WHERE NOT EXISTS (SELECT 1 FROM contact_affinity a WHERE a.contact_id = c.id)
  AND EXISTS (SELECT 1 FROM "WhatsAppNumber" n WHERE n."workspaceId" = c."workspaceId");

-- Fail loudly rather than silently dropping data if a workspace has contacts but no
-- WhatsAppNumber at all to assign them to.
DO $$
DECLARE orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "Contact" c WHERE NOT EXISTS (SELECT 1 FROM contact_affinity a WHERE a.contact_id = c.id);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Found % contact(s) in a workspace with no WhatsAppNumber -- cannot assign numberId, resolve manually before re-running this migration.', orphan_count;
  END IF;
END $$;

-- Step 3: rank each contact's candidate numbers deterministically (oldest number first)
-- so the "primary" assignment (kept on the existing row) is stable.
CREATE TEMP TABLE contact_number_rank AS
SELECT a.contact_id, a.number_id,
       ROW_NUMBER() OVER (PARTITION BY a.contact_id ORDER BY n."createdAt" ASC) AS rnk
FROM contact_affinity a
JOIN "WhatsAppNumber" n ON n.id = a.number_id;

-- Step 4: assign the primary number directly onto the existing Contact row.
UPDATE "Contact" c
SET "numberId" = r.number_id
FROM contact_number_rank r
WHERE r.contact_id = c.id AND r.rnk = 1;

-- Step 5: every additional number a contact has real history with gets its own
-- duplicate row (same name/tags/customFields/optedOut), and we record the mapping so
-- every reference below can be repointed to the right copy.
CREATE TEMP TABLE contact_duplicate_map (
  old_contact_id TEXT,
  number_id TEXT,
  new_contact_id TEXT
);

DO $$
DECLARE
  rec RECORD;
  new_id TEXT;
  dup_count INT := 0;
BEGIN
  FOR rec IN SELECT contact_id, number_id FROM contact_number_rank WHERE rnk > 1 LOOP
    new_id := gen_random_uuid()::text;
    INSERT INTO "Contact" (id, "workspaceId", "numberId", name, phone, email, tags, "customFields", "optedOut", "optedOutAt", "lastMessaged", "createdAt", "updatedAt")
    SELECT new_id, "workspaceId", rec.number_id, name, phone, email, tags, "customFields", "optedOut", "optedOutAt", "lastMessaged", "createdAt", now()
    FROM "Contact" WHERE id = rec.contact_id;

    INSERT INTO contact_duplicate_map (old_contact_id, number_id, new_contact_id) VALUES (rec.contact_id, rec.number_id, new_id);
    dup_count := dup_count + 1;
  END LOOP;
  RAISE NOTICE 'Contact duplication: created % duplicate contact row(s) for contacts with history on more than one number.', dup_count;
END $$;

-- Step 6: repoint every per-number reference to the correct (original-or-duplicate)
-- contact for that specific number.
UPDATE "Conversation" conv
SET "contactId" = dm.new_contact_id
FROM contact_duplicate_map dm
WHERE conv."contactId" = dm.old_contact_id AND conv."numberId" = dm.number_id;

UPDATE "Message" m
SET "contactId" = dm.new_contact_id
FROM contact_duplicate_map dm
WHERE m."contactId" = dm.old_contact_id AND m."numberId" = dm.number_id;

UPDATE "FlowSession" fs
SET "contactId" = dm.new_contact_id
FROM contact_duplicate_map dm
WHERE fs."contactId" = dm.old_contact_id AND fs."numberId" = dm.number_id;

UPDATE "CampaignContact" cc
SET "contactId" = dm.new_contact_id
FROM contact_duplicate_map dm
JOIN "Campaign" camp ON camp."numberId" = dm.number_id
WHERE cc."contactId" = dm.old_contact_id AND cc."campaignId" = camp.id;

-- Step 7: resolve ContactList.numberId. Prefer the number of any campaign the list has
-- actually been used for; otherwise the majority number among its members' (now
-- resolved) contacts; otherwise the workspace's oldest number. Lists whose evidence
-- disagrees across more than one number are logged for manual review -- we still make a
-- deterministic choice so nothing is left unassigned.
CREATE TEMP TABLE list_number_candidates AS
SELECT cl.id AS list_id, camp."numberId" AS number_id, COUNT(*) AS weight
FROM "ContactList" cl
JOIN "_CampaignContactLists" j ON j."B" = cl.id
JOIN "Campaign" camp ON camp.id = j."A"
GROUP BY cl.id, camp."numberId"
UNION ALL
SELECT cl.id, c."numberId", COUNT(*)
FROM "ContactList" cl
JOIN "ContactListMember" clm ON clm."listId" = cl.id
JOIN "Contact" c ON c.id = clm."contactId"
GROUP BY cl.id, c."numberId";

CREATE TEMP TABLE list_number_resolved AS
SELECT DISTINCT ON (list_id) list_id, number_id
FROM (
  SELECT list_id, number_id, SUM(weight) AS total_weight
  FROM list_number_candidates
  GROUP BY list_id, number_id
) ranked
ORDER BY list_id, total_weight DESC, number_id ASC;

UPDATE "ContactList" cl
SET "numberId" = r.number_id
FROM list_number_resolved r
WHERE r.list_id = cl.id;

-- Lists with no campaigns and no members at all: fall back to the workspace default.
UPDATE "ContactList" cl
SET "numberId" = (SELECT n.id FROM "WhatsAppNumber" n WHERE n."workspaceId" = cl."workspaceId" ORDER BY n."createdAt" ASC LIMIT 1)
WHERE cl."numberId" IS NULL;

DO $$
DECLARE
  rec RECORD;
  ambiguous_count INT := 0;
BEGIN
  FOR rec IN
    SELECT list_id, COUNT(DISTINCT number_id) AS distinct_numbers
    FROM list_number_candidates
    GROUP BY list_id
    HAVING COUNT(DISTINCT number_id) > 1
  LOOP
    ambiguous_count := ambiguous_count + 1;
    RAISE NOTICE 'ContactList % had mixed number evidence across its campaigns/members -- auto-assigned to the highest-weighted number, please review manually.', rec.list_id;
  END LOOP;
  RAISE NOTICE 'Total ContactLists with ambiguous number affinity: %', ambiguous_count;
END $$;

-- Step 8: repoint ContactListMember rows to whichever contact (original, an existing
-- duplicate, or a freshly created one) actually belongs to the list's resolved number,
-- so no list membership is silently lost.
DO $$
DECLARE
  rec RECORD;
  target_contact_id TEXT;
  new_id TEXT;
  created_for_list INT := 0;
BEGIN
  FOR rec IN
    SELECT clm.id AS member_id, clm."contactId" AS contact_id, cl."numberId" AS list_number_id
    FROM "ContactListMember" clm
    JOIN "ContactList" cl ON cl.id = clm."listId"
  LOOP
    target_contact_id := NULL;

    SELECT id INTO target_contact_id FROM "Contact" WHERE id = rec.contact_id AND "numberId" = rec.list_number_id;

    IF target_contact_id IS NULL THEN
      SELECT c2.id INTO target_contact_id
      FROM "Contact" c1
      JOIN "Contact" c2 ON c2."workspaceId" = c1."workspaceId" AND c2.phone = c1.phone AND c2."numberId" = rec.list_number_id
      WHERE c1.id = rec.contact_id
      LIMIT 1;
    END IF;

    IF target_contact_id IS NULL THEN
      new_id := gen_random_uuid()::text;
      INSERT INTO "Contact" (id, "workspaceId", "numberId", name, phone, email, tags, "customFields", "optedOut", "optedOutAt", "lastMessaged", "createdAt", "updatedAt")
      SELECT new_id, "workspaceId", rec.list_number_id, name, phone, email, tags, "customFields", "optedOut", "optedOutAt", "lastMessaged", "createdAt", now()
      FROM "Contact" WHERE id = rec.contact_id;
      target_contact_id := new_id;
      created_for_list := created_for_list + 1;
    END IF;

    IF target_contact_id != rec.contact_id THEN
      UPDATE "ContactListMember" SET "contactId" = target_contact_id WHERE id = rec.member_id;
    END IF;
  END LOOP;
  RAISE NOTICE 'ContactListMember repoint: created % additional contact row(s) to keep list membership intact for its resolved number.', created_for_list;
END $$;

-- Step 9: enforce NOT NULL now that every row has a value.
ALTER TABLE "Contact" ALTER COLUMN "numberId" SET NOT NULL;
ALTER TABLE "ContactList" ALTER COLUMN "numberId" SET NOT NULL;

-- Step 10: indexes + foreign keys for the new column.
CREATE INDEX "Contact_numberId_idx" ON "Contact"("numberId");
CREATE INDEX "ContactList_numberId_idx" ON "ContactList"("numberId");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_numberId_fkey" FOREIGN KEY ("numberId") REFERENCES "WhatsAppNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactList" ADD CONSTRAINT "ContactList_numberId_fkey" FOREIGN KEY ("numberId") REFERENCES "WhatsAppNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
