import { prisma } from "../config/prisma.js";
  import asyncHandler from "../middlewares/asyncHandler.js";
export const getAdminDashboard = asyncHandler(async (req, res) => {
  // 1️⃣ Totals
  const totalUser = await prisma.user.count();
  const totalBookings = await prisma.booking.count();

  const revenueAgg = await prisma.booking.aggregate({
    _sum: { totalAmount: true },
    where: { isPaid: true },
  });

  const totalRevenue = revenueAgg?._sum?.totalAmount || 0;

  // 2️⃣ Active Shows (ONGOING + UPCOMING)
  const now = new Date();

  const activeShows = await prisma.show.findMany({
    where: {
      endTime: { gte: now }, // ongoing + upcoming
    },
    include: {
      movie: {
        select: {
          id: true,
          title: true,
          posterPath: true,
          voteAverage: true,
          runtime: true,
        },
      },
      _count: {
        select: { bookings: true },
      },
    },
    orderBy: { startTime: "asc" },
    take: 10,
  });

  // 3️⃣ Format for frontend
  const formattedActiveShows = activeShows.map((s) => ({
    id: s.id,
    showDateTime: s.startTime,
    endTime: s.endTime,
    seatPrice: s.seatPrice,

    movie: s.movie,

    totalBookings: s._count?.bookings || 0,
  }));

  res.json({
    success: true,
    dashboard: {
      totalUser,
      totalBookings,
      totalRevenue,
      activeShows: formattedActiveShows,
    },
  });
});