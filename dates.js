export function istDay(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(day, amount) {
  const date = new Date(`${day}T12:00:00+05:30`);
  date.setDate(date.getDate() + amount);
  return istDay(date);
}

export function recentDays(today, count = 7) {
  return Array.from({ length: count }, (_, index) => addDays(today, -index));
}
