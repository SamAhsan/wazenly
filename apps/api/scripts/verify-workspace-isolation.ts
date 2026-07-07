/**
 * Standalone cross-workspace security check. Creates two throwaway companies with
 * their own owners, then verifies:
 *  - a valid token + a workspace the caller actually belongs to succeeds
 *  - the same valid token + a DIFFERENT company's id in x-workspace-id is rejected (403)
 * Requires the API to be running locally (npm run dev) on API_URL.
 * Run with: npx ts-node --transpile-only scripts/verify-workspace-isolation.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import axios from "axios";
import { prisma } from "@wazenly/db";
import { createToken } from "../src/routes/auth";

const API_URL = process.env.API_URL || "http://localhost:4000";

async function main() {
  console.log("Setting up two isolated test companies...");

  const [companyA, companyB] = await Promise.all([
    prisma.workspace.create({
      data: {
        name: "Isolation Test Co A",
        slug: `isolation-test-a-${Date.now()}`,
        members: { create: { user: { create: { email: `iso-a-${Date.now()}@test.local` } }, role: "OWNER", joinedAt: new Date() } },
      },
      include: { members: true },
    }),
    prisma.workspace.create({
      data: {
        name: "Isolation Test Co B",
        slug: `isolation-test-b-${Date.now()}`,
        members: { create: { user: { create: { email: `iso-b-${Date.now()}@test.local` } }, role: "OWNER", joinedAt: new Date() } },
      },
      include: { members: true },
    }),
  ]);

  const userAId = companyA.members[0].userId;
  const userBId = companyB.members[0].userId;
  const tokenA = createToken(userAId, companyA.id);

  let passed = 0;
  let failed = 0;

  function report(name: string, ok: boolean, detail: string) {
    if (ok) { console.log(`  PASS  ${name}`); passed++; }
    else { console.error(`  FAIL  ${name} — ${detail}`); failed++; }
  }

  try {
    // Same-company access should work
    const same = await axios.get(`${API_URL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${tokenA}`, "x-workspace-id": companyA.id },
      validateStatus: () => true,
    });
    report("same-company access succeeds", same.status === 200, `got ${same.status}: ${JSON.stringify(same.data)}`);

    // Cross-company access must be rejected
    const cross = await axios.get(`${API_URL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${tokenA}`, "x-workspace-id": companyB.id },
      validateStatus: () => true,
    });
    report("cross-company access rejected (403)", cross.status === 403, `got ${cross.status}: ${JSON.stringify(cross.data)}`);

    // Same check against another representative route
    const crossContacts = await axios.get(`${API_URL}/api/contacts`, {
      headers: { Authorization: `Bearer ${tokenA}`, "x-workspace-id": companyB.id },
      validateStatus: () => true,
    });
    report("cross-company contacts access rejected (403)", crossContacts.status === 403, `got ${crossContacts.status}`);

    // Switch endpoint must refuse a company the caller isn't a member of
    const switchAttempt = await axios.post(`${API_URL}/api/workspaces/${companyB.id}/switch`, {}, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true,
    });
    report("switch to non-member company rejected (403)", switchAttempt.status === 403, `got ${switchAttempt.status}`);

    // Switch to your own company should work
    const switchOwn = await axios.post(`${API_URL}/api/workspaces/${companyA.id}/switch`, {}, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true,
    });
    report("switch to own company succeeds", switchOwn.status === 200, `got ${switchOwn.status}: ${JSON.stringify(switchOwn.data)}`);
  } finally {
    await prisma.workspace.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    console.log("Cleaned up test companies.");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
