import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in .env");
  }

  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("Use an admin password of at least 12 characters.");
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const existing = await prisma.admin.findUnique({
    where: { email },
  });

  if (existing) {
    console.log("Admin account already exists. No changes made.");
    return;
  }

  await prisma.admin.create({
    data: {
      name: ADMIN_NAME.trim(),
      email,
      passwordHash,
    },
  });

  console.log(`Admin account created for ${email}`);
}

main()
  .catch((error) => {
    console.error("Could not create admin:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });