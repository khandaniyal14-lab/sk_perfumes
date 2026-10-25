import { prisma } from "./src/lib/prisma.js";

try {
  const productCount = await prisma.product.count();
  const adminCount = await prisma.admin.count();

  console.log("Database connection successful!");
  console.log("Products:", productCount);
  console.log("Admins:", adminCount);
} catch (error) {
  console.error("Database test failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}