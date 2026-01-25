import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@gmail.com";
  const password = "admin123";

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: {
      email,
      password: hashedPassword,
      provider: "local",
      role: "ADMIN",
    },
  });

  console.log("✅ Admin user created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
