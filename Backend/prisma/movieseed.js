import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const movieId = "tt1187043"; // 👈 existing movie uuid in DB

  // 1) check movie exists
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie) throw new Error("Movie not found with given movieId");

  // 2) create theatre (or reuse if already exists)
  const theatre = await prisma.theatre.upsert({
    where: { name: "PVR Cinemas Saket" },
    update: {
      city: "Delhi",
      area: "Saket",
      address: "Select Citywalk Mall, Saket, New Delhi",
      screens: 1,
    },
    create: {
      name: "PVR Cinemas Saket",
      city: "Delhi",
      area: "Saket",
      address: "Select Citywalk Mall, Saket, New Delhi",
      image:
        "https://images.unsplash.com/photo-1517602302552-471fe67acf66?auto=format&fit=crop&w=1200&q=60",
      screens: 1,
    },
  });

  // 3) create screen layout
  const layout = {
    rows: [
      { row: "A", type: "SILVER", seats: ["A1", "A2", "A3", "A4", "A5"] },
      { row: "B", type: "SILVER", seats: ["B1", "B2", "B3", "B4", "B5"] },
      { row: "C", type: "GOLD", seats: ["C1", "C2", "C3", "C4", "C5"] },
      { row: "D", type: "GOLD", seats: ["D1", "D2", "D3", "D4", "D5"] },
      { row: "E", type: "PLATINUM", seats: ["E1", "E2", "E3", "E4", "E5"] },
    ],
  };

  // ⚠️ this will create new screen every seed run (duplicate)
  // If you want safe upsert, tell me and I’ll make it.
  const screen = await prisma.screen.create({
    data: {
      name: "Audi 1",
      screenNo: 1,
      layout,
      theatreId: theatre.id,
    },
  });

  // 4) create shows (same movieId, different times)
  const showTimes = [
    "2026-01-21T10:00:00.000Z",
    "2026-01-21T14:00:00.000Z",
    "2026-01-21T18:00:00.000Z",
  ];

  for (const time of showTimes) {
    await prisma.show.create({
      data: {
        movieId,
        theatreId: theatre.id,
        screenId: screen.id,
        startTime: new Date(time),

        seatPrice: 250,
        seatPrices: {
          SILVER: 200,
          GOLD: 300,
          PLATINUM: 400,
        },
      },
    });
  }

  console.log("✅ Theatre + Screen + Shows seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
