import cron from "node-cron";
import { prisma } from "../config/prisma.js";

// 🔥 Runs every minute
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    // 1️⃣ find expired pending bookings
    const expired = await prisma.booking.findMany({
      where: {
        status: "PENDING",
        expiredAt: { lt: now },
      },
      select: { id: true },
    });

    if (!expired.length) return;

    const bookingIds = expired.map(b => b.id);

    // 2️⃣ mark bookings expired
    await prisma.booking.updateMany({
      where: { id: { in: bookingIds } },
      data: { status: "EXPIRED" },
    });

    // 3️⃣ delete seat locks
    await prisma.seatLock.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });

    console.log(
      `[CRON] Expired ${bookingIds.length} bookings at ${now.toISOString()}`
    );
  } catch (err) {
    console.error("[CRON] Expiry job failed:", err.message);
  }
});
