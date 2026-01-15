import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { seedDefaultData } from "../lib/seed-data.js";

async function main() {
  await seedDefaultData();
  console.log("Seeding completed!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
