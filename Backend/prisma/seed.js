import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.theatre.createMany({
    data: [
      {
        name: "PVR Dhanbad",
        city: "Dhanbad",
        area: "Bank More",
        address: "Bank More, Dhanbad, Jharkhand",
        latitude: 23.7957,
        longitude: 86.4304,
      },
      {
        name: "INOX South City",
        city: "Kolkata",
        area: "Jadavpur",
        address: "South City Mall, Kolkata",
        latitude: 22.5015,
        longitude: 88.3617,
      },
      {
        name: "PVR Patna",
        city: "Patna",
        area: "Fraser Road",
        address: "Fraser Road, Patna, Bihar",
        latitude: 25.5941,
        longitude: 85.1376,
      },
      {
        name: "PVR Ranchi",
        city: "Ranchi",
        area: "Lalpur",
        address: "Nucleus Mall, Ranchi",
        latitude: 23.3441,
        longitude: 85.3096,
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Theatres seeded successfully");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });