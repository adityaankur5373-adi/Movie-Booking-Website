export const bookingConfirmTemplate = (booking) => {
  return `
    <h2>🎟 Booking Confirmed</h2>
    <p>Movie: <b>${booking.show.movie.title}</b></p>
    <p>Theatre: <b>${booking.show.screen.theatre.name}</b></p>
    <p>Screen: <b>${booking.show.screen.name}</b></p>
    <p>Seats: <b>${booking.bookedSeats.join(", ")}</b></p>
    <p>Show Time: <b>${new Date(booking.show.startTime).toLocaleString()}</b></p>
    <p>Total: <b>₹${booking.totalAmount}</b></p>
  `;
};