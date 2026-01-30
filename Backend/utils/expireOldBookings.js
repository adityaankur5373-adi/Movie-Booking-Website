export const expireOldBookings = async (tx) => {
  const now = new Date();

  // 1️⃣ find expired pending bookings
  const expiredBookings = await tx.booking.findMany({
    where: {
      status: "PENDING",
      expiredAt: { lt: now },
    },
    select: { id: true },
  });

  if (expiredBookings.length === 0) return;

  const bookingIds = expiredBookings.map(b => b.id);

  // 2️⃣ mark bookings as EXPIRED
  await tx.booking.updateMany({
    where: { id: { in: bookingIds } },
    data: { status: "EXPIRED" },
  });

  // 3️⃣ delete DB seat locks
  await tx.seatLock.deleteMany({
    where: { bookingId: { in: bookingIds } },
  });
};
