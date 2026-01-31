import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🎬 Seeding trailers only...");

  const trailerMap = [
    {
      title: "Kabir Singh",
      trailer: {
        image: "https://img.youtube.com/vi/RiANSSgCuJk/hqdefault.jpg",
        youtubeKey: "RiANSSgCuJk",
        videoUrl: "https://www.youtube.com/watch?v=RiANSSgCuJk",
      },
    },
    {
      title: "Green Book",
      trailer: {
        image: "https://img.youtube.com/vi/QkZxoko_HC0/hqdefault.jpg",
        youtubeKey: "QkZxoko_HC0",
        videoUrl: "https://www.youtube.com/watch?v=QkZxoko_HC0",
      },
    },
    {
      title: "Shershaah",
      trailer: {
        image: "https://img.youtube.com/vi/Q0FTXnefVBA/hqdefault.jpg",
        youtubeKey: "Q0FTXnefVBA",
        videoUrl: "https://www.youtube.com/watch?v=Q0FTXnefVBA",
      },
    },
    {
      title: "Drishyam",
      trailer: {
        image: "https://img.youtube.com/vi/AuuX2j14NBg/hqdefault.jpg",
        youtubeKey: "AuuX2j14NBg",
        videoUrl: "https://www.youtube.com/watch?v=AuuX2j14NBg",
      },
    },
  ];

  for (const item of trailerMap) {
    const movie = await prisma.movie.findFirst({
      where: { title: item.title },
    });

    if (!movie) {
      console.log(`❌ Movie not found: ${item.title}`);
      continue;
    }

    await prisma.trailer.create({
      data: {
        image: item.trailer.image,
        videoUrl: item.trailer.videoUrl,
        youtubeKey: item.trailer.youtubeKey,
        movieId: movie.id,
      },
    });

    console.log(`✅ Trailer added → ${item.title}`);
  }

  console.log("🎉 Trailer seed completed!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
