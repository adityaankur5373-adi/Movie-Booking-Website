import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 👇 Put your movieId here
  const movieId = "0680e824-f545-4910-85d2-997a121bd04d";

  // 1) Check movie exists
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
  });

  if (!movie) {
    throw new Error(`Movie not found with id: ${movieId}`);
  }

  // 2) Create 2 theatres
  const theatre1 = await prisma.theatre.create({
    data: {
      name: "PVR Phoenix Mall",
      city: "Lucknow",
      area: "Alambagh",
      address: "Phoenix United Mall, Lucknow",
    },
  });

  const theatre2 = await prisma.theatre.create({
    data: {
      name: "INOX Lulu Mall",
      city: "Lucknow",
      area: "Gomti Nagar",
      address: "Lulu Mall, Lucknow",
    },
  });

  // 3) Create screens for both theatres
  const screen1 = await prisma.screen.create({
    data: {
      name: "Audi 1",
      screenNo: 1,
      layout: {
        sections: [
          {
            label: "SILVER",
            price: 160,
            rows: ["A", "B"],
            leftCount: 4,
            rightCount: 4,
          },
          {
            label: "GOLD",
            price: 220,
            rows: ["C", "D"],
            leftCount: 4,
            rightCount: 4,
          },
        ],
      },
      theatreId: theatre1.id,
    },
  });

  const screen2 = await prisma.screen.create({
    data: {
      name: "Audi 2",
      screenNo: 1,
      layout: {
        sections: [
          {
            label: "SILVER",
            price: 180,
            rows: ["A", "B"],
            leftCount: 5,
            rightCount: 5,
          },
          {
            label: "PLATINUM",
            price: 300,
            rows: ["C"],
            leftCount: 5,
            rightCount: 5,
          },
        ],
      },
      theatreId: theatre2.id,
    },
  });

  // 4) Create 3 shows for same movie in 2 different theatres
  // Theatre 1 -> Screen 1 -> 2 shows
  // Theatre 2 -> Screen 2 -> 1 show

  const show1 = await prisma.show.create({
    data: {
      movieId,
      screenId: screen1.id,
      startTime: new Date("2026-01-19T10:00:00.000Z"),
      seatPrice: 200,
      seatPrices: {
        SILVER: 160,
        GOLD: 220,
      },
    },
  });

  const show2 = await prisma.show.create({
    data: {
      movieId,
      screenId: screen1.id,
      startTime: new Date("2026-01-19T14:00:00.000Z"),
      seatPrice: 220,
      seatPrices: {
        SILVER: 170,
        GOLD: 240,
      },
    },
  });

  // Theatre 2 -> Screen 2 -> 1 show
  const show3 = await prisma.show.create({
    data: {
      movieId,
      screenId: screen2.id,
      startTime: new Date("2026-01-19T18:00:00.000Z"),
      seatPrice: 250,
      seatPrices: {
        SILVER: 180,
        PLATINUM: 300,
      },
    },
  });

  console.log("✅ Seed done!");
  console.log({
    movie: { id: movie.id, title: movie.title },
    theatres: [theatre1.name, theatre2.name],
    screens: [screen1.name, screen2.name],
    shows: [show1.id, show2.id, show3.id],
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
