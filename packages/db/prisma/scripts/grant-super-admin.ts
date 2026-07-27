import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(__dirname, "../../../../.env") });

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run db:grant-super-admin -- <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email} — they must register/log in on the site first, then re-run this script.`);
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "SUPER_ADMIN_GRANTED",
        targetType: "User",
        targetId: user.id,
        metadata: { via: "bootstrap-script" },
      },
    }),
  ]);

  console.log(`✅ Granted Super Admin access to ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
