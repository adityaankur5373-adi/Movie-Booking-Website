export const calcTotalFromLayout = (
  layout,
  seats = [],
  defaultPrice = 0
) => {
  let total = 0;

  for (const seatId of seats) {
    const [secLabel] = seatId.split("_");

    const section = layout?.sections?.find(
      (s) => s.label === secLabel
    );

    if (section?.price) {
      total += Number(section.price);
    } else {
      total += defaultPrice; // ✅ fallback
    }
  }

  return total;
};