-- Mark all pre-existing users as verified so the new REQUIRE_EMAIL_VERIFICATION
-- login gate does not lock out accounts created before this feature shipped.
UPDATE "User" SET "emailVerified" = CURRENT_TIMESTAMP WHERE "emailVerified" IS NULL;
