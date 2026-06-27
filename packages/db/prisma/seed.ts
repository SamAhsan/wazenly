import { PrismaClient, MemberRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database (clean)...");

  const freePlan = await prisma.billingPlan.upsert({
    where: { name: "Free" },
    update: {},
    create: {
      name: "Free",
      priceMonthly: 0,
      pricePerMessage: 0.005,
      messageLimit: 1000,
      numberLimit: 1,
      memberLimit: 2,
      features: { analytics: false, flows: false, api: false },
    },
  });

  await prisma.billingPlan.upsert({
    where: { name: "Pro" },
    update: {},
    create: {
      name: "Pro",
      priceMonthly: 49,
      pricePerMessage: 0.002,
      messageLimit: 50000,
      numberLimit: 5,
      memberLimit: 10,
      features: { analytics: true, flows: true, api: true },
    },
  });

  const hashedPassword = await bcrypt.hash("Admin1234!", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@wazenly.com" },
    update: {},
    create: {
      email: "admin@wazenly.com",
      name: "Wazenly Admin",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "my-workspace" },
    update: {},
    create: {
      name: "My Workspace",
      slug: "my-workspace",
      timezone: "UTC",
      planId: freePlan.id,
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: adminUser.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: adminUser.id,
      role: MemberRole.OWNER,
      joinedAt: new Date(),
    },
  });

  await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      planId: freePlan.id,
      status: "active",
    },
  });

  console.log("✅ Clean seed completed!");
  console.log(`
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Login credentials:
    Email:    admin@wazenly.com
    Password: Admin1234!
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
