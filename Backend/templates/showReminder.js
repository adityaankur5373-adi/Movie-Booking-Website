export const showReminderTemplate = (booking) => {
  return `
    <h2>⏰ Reminder: Your show is starting soon!</h2>
    <p>Movie: <b>${booking.show.movie.title}</b></p>
    <p>Theatre: <b>${booking.show.screen.theatre.name}</b></p>
    <p>Seats: <b>${booking.bookedSeats.join(", ")}</b></p>
    <p>Show Time: <b>${new Date(booking.show.startTime).toLocaleString()}</b></p>
  `;
};