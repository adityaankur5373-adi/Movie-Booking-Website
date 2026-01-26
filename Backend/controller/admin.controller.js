
import { prisma } from "../config/prisma.js";
import asyncHandler from "../middlewares/asyncHandler.js";




/**
 * GET /api/admin/dashboard
 * ADMIN ONLY
 */
export const getAdminDashboard = asyncHandler(async (req, res) => {
  // 1) Total Users
  const totalUser = await prisma.user.count();

  // 2) Total Bookings
  const totalBookings = await prisma.booking.count();

  // 3) Total Revenue (only paid bookings)
  const revenueAgg = await prisma.booking.aggregate({
    _sum: { totalAmount: true },
    where: { isPaid: true },
  });

  const totalRevenue = revenueAgg?._sum?.totalAmount || 0;

  // 4) Active Shows (last 7 days + next 7 days)
  const now = new Date();

  const from = new Date(now);
  from.setDate(from.getDate() - 7);

  const to = new Date(now);
  to.setDate(to.getDate() + 7);

 const activeShows = await prisma.show.findMany({
  where: {
    startTime: {
      gte: from,
      lte: to,
    },
  },
  include: {
    movie: true,
    screen: {
      include: {
        theatre: true,
      },
    },
    _count: {
      select: { bookings: true },
    },
  },
  orderBy: { startTime: "asc" },
  take: 10,
});
  // Format for frontend
  const formattedActiveShows = activeShows.map((s) => ({
    id: s.id,
    showDateTime: s.startTime,
    seatPrice: s.seatPrice,

    movie: {
      id: s.movie?.id,
      title: s.movie?.title,
      poster_path: s.movie?.posterPath || null, // ✅ avoid ""
      vote_average: s.movie?.voteAverage || 0,
      showPrice: s.seatPrice,
    },

    theatre: {
      id: s.screen?.theatre?.id,
      name: s.screen?.theatre?.name,
      city: s.screen?.theatre?.city,
      area: s.screen?.theatre?.area,
    },

    screen: {
      id: s.screen?.id,
      name: s.screen?.name,
    },

    totalBookings: s.bookings?.length || 0,
  }));

  res.json({
    success: true,
    dashboard: {
      totalBookings,
      totalRevenue,
      totalUser,
      activeShows: formattedActiveShows,
    },
  });
});
