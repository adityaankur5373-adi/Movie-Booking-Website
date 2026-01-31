import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultLayout = {
  sections: [
    {
      label: "GOLD",
      price: 120,
      rows: ["A", "B", "C"],
      leftCount: 6,
      rightCount: 6,
    },
    {
      label: "SILVER",
      price: 160,
      rows: ["D", "E", "F", "G"],
      leftCount: 8,
      rightCount: 8,
    },
    {
      label: "PLATINUM",
      price: 220,
      rows: ["H", "I", "J", "K"],
      leftCount: 10,
      rightCount: 10,
    },
  ],
};

async function main() {
  console.log("🎬 Seeding screens...");

  const theatres = await prisma.theatre.findMany();

  for (const theatre of theatres) {
    // Create 2 screens per theatre
    for (let i = 1; i <= 2; i++) {
      await prisma.screen.upsert({
        where: {
          theatreId_screenNo: {
            theatreId: theatre.id,
            screenNo: i,
          },
        },
        update: {},
        create: {
          name: `Audi ${i}`,
          screenNo: i,
          theatreId: theatre.id,
          layout: defaultLayout,
        },
      });
    }
  }

  console.log("✅ Screens seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
