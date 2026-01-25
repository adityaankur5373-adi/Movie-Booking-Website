export const calcTotalFromLayout = (layout, seats = []) => {
  if (!layout?.sections?.length) return 0;

  let total = 0;

  for (const seatId of seats) {
    // seatId = "SILVER_A1"
    const parts = seatId.split("_");
    const secLabel = parts[0]; // "SILVER"
    const rawSeat = parts[1];  // "A1"

    if (!secLabel || !rawSeat) continue;

    const section = layout.sections.find((s) => s.label === secLabel);
    if (section?.price) total += Number(section.price);
  }

  return total;
};
