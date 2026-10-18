const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector(".primary-nav");
const bookingForm = document.querySelector("#booking-form");
const bookingDate = document.querySelector("#booking-date");
const bookingCourt = document.querySelector("#booking-court");
const bookingDuration = document.querySelector("#booking-duration");
const bookingTime = document.querySelector("#booking-time");
const bookingEstimate = document.querySelector("#booking-estimate");
const bookingMessage = document.querySelector("#form-message");
const promoInput = document.querySelector("#promo-code");
const promoFeedback = document.querySelector("#promo-feedback");
const lightbox = document.querySelector("#lightbox");
const qrDialog = document.querySelector("#qr-dialog");
const qrImage = document.querySelector("#website-qr");
const qrMessage = document.querySelector("#qr-message");
const qrPrint = document.querySelector("#qr-print");
const loyaltyCount = document.querySelector("#loyalty-count");
const loyaltyProgress = document.querySelector("#loyalty-progress");
const loyaltyStatus = document.querySelector("#loyalty-status");
const loyaltyAdd = document.querySelector("#loyalty-add");
const backToTop = document.querySelector("#back-to-top");
const scheduleGrid = document.querySelector("#schedule-grid");
const scheduleRange = document.querySelector("#schedule-range");
const calendarMessage = document.querySelector("#calendar-message");

document.querySelector("#year").textContent = new Date().getFullYear();

let logoClickCount = 0;
document.querySelectorAll(".brand").forEach((logo) => {
  logo.addEventListener("click", (event) => {
    event.preventDefault();
    logoClickCount += 1;
    if (logoClickCount >= 5) {
      window.location.href = "admin.html";
    }
  });
});

const updateBackToTop = () => {
  backToTop.disabled = window.scrollY === 0;
};

window.addEventListener("scroll", updateBackToTop, { passive: true });
updateBackToTop();

backToTop.addEventListener("click", () => {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  window.scrollTo({ top: 0, behavior });
});

const today = new Date();
const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("en", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("en", { month: "short" });
const scheduleMonth = document.querySelector("#schedule-month");
const previousMonth = document.querySelector("#previous-month");
const nextMonth = document.querySelector("#next-month");
const availabilityDialog = document.querySelector("#availability-dialog");
const availabilityDialogTitle = document.querySelector("#availability-dialog-title");
const availabilityDetailSlots = document.querySelector("#availability-detail-slots");
const availabilityDialogClose = document.querySelector("#availability-dialog-close");
const calendarBookingsByDate = new Map();
const calendarCourts = [
  "The Ace Court — ₱400/hour",
  "The Prime Court — ₱500/hour",
  "The Rally Court — ₱400/hour",
  "The Social Court — ₱450/hour",
];
let calendarLoadId = 0;
let calendarLoaded = false;

const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const showAvailability = (date, selectedButton) => {
  scheduleGrid.querySelectorAll(".calendar-date-button[aria-pressed='true']").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });
  selectedButton.setAttribute("aria-pressed", "true");
  availabilityDialogTitle.textContent = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
  availabilityDetailSlots.replaceChildren();

  if (!calendarLoaded) {
    calendarMessage.textContent = "Booking details are still loading. Please select the date again in a moment.";
    calendarMessage.classList.add("is-error");
    return;
  }

  const bookings = calendarBookingsByDate.get(formatDateValue(date)) || [];
  const header = document.createElement("div");
  header.className = "availability-hour-row availability-hour-header";
  header.setAttribute("role", "row");
  ["TIME", ...calendarCourts.map((court) => court.replace(/\s+—\s+₱[\d,]+\/hour$/, ""))].forEach((label) => {
    const cell = document.createElement("span");
    cell.className = "availability-hour-cell";
    cell.setAttribute("role", "columnheader");
    cell.textContent = label;
    header.append(cell);
  });
  availabilityDetailSlots.append(header);

  for (let hour = 0; hour < 24; hour += 1) {
    const row = document.createElement("div");
    row.className = "availability-hour-row";
    row.setAttribute("role", "row");
    const timeCell = document.createElement("span");
    timeCell.className = "availability-hour-cell availability-hour-time";
    timeCell.setAttribute("role", "rowheader");
    timeCell.textContent = `${formatCalendarHour(hour)} – ${formatCalendarHour(hour + 1)}`;
    row.append(timeCell);

    calendarCourts.forEach((courtName) => {
      const cell = document.createElement("span");
      cell.className = "availability-hour-cell";
      cell.setAttribute("role", "cell");
      const status = getCourtHourStatus(date, hour, courtName, bookings);
      const badge = document.createElement("span");
      badge.className = `availability-hour-status slot-${status.toLowerCase().replace(" ", "-")}`;
      badge.textContent = status;
      cell.setAttribute("aria-label", `${courtName.replace(/\s+—\s+₱[\d,]+\/hour$/, "")}, ${timeCell.textContent}: ${status}`);
      cell.append(badge);
      row.append(cell);
    });
    availabilityDetailSlots.append(row);
  }

  if (!availabilityDialog.open) availabilityDialog.showModal();
};

const formatDateValue = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const timeToMinutes = (match) => {
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return hour * 60 + Number(match[2]);
};

const bookingTimeRange = (time) => {
  const matches = [...String(time).matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
  if (matches.length < 2) return null;
  const start = timeToMinutes(matches[0]);
  const end = timeToMinutes(matches[1]);
  return end > start ? [start, end] : null;
};

const formatCalendarHour = (hour) => {
  const normalizedHour = hour % 24;
  return `${normalizedHour % 12 || 12}:00 ${normalizedHour < 12 ? "AM" : "PM"}`;
};

const getCourtHourStatus = (date, hour, court, bookings) => {
  const hourStart = hour * 60;
  const hourEnd = hourStart + 60;
  const hasConfirmedBooking = bookings.some((booking) => {
    if (booking.court !== court) return false;
    const range = bookingTimeRange(booking.time);
    return range && hourStart < range[1] && range[0] < hourEnd;
  });
  if (hasConfirmedBooking) return "BOOKED";

  const weekday = date.getDay();
  if (hour >= 7 && hour < 10 && (weekday === 3 || weekday === 6)) return "OPEN PLAY";
  if (hour >= 10 && hour < 16 && weekday === 2) return "MAINTENANCE";
  if (hour >= 16 && hour < 22 && (weekday === 4 || weekday === 0)) return "OPEN PLAY";
  return "OPEN";
};

const renderCalendar = () => {
  scheduleGrid.replaceChildren();
  if (availabilityDialog.open) availabilityDialog.close();
  scheduleMonth.textContent = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(displayedMonth);

  const weekdayHeader = document.createElement("div");
  weekdayHeader.className = "calendar-weekdays";
  weekdayHeader.setAttribute("role", "row");
  weekdays.forEach((weekday) => {
    const heading = document.createElement("div");
    heading.className = "calendar-weekday";
    heading.setAttribute("role", "columnheader");
    heading.textContent = weekday;
    weekdayHeader.append(heading);
  });
  scheduleGrid.append(weekdayHeader);

  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const leadingEmptyDays = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1).getDay();
  const trailingEmptyDays = (7 - ((leadingEmptyDays + daysInMonth) % 7)) % 7;

  for (let index = 0; index < leadingEmptyDays; index += 1) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day calendar-day-empty";
    emptyDay.setAttribute("role", "presentation");
    scheduleGrid.append(emptyDay);
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), dayNumber);
    const dayCard = document.createElement("div");
    dayCard.className = "calendar-day";
    dayCard.dataset.weekday = String(date.getDay());
    dayCard.setAttribute("role", "gridcell");
    if (date.toDateString() === today.toDateString()) {
      dayCard.classList.add("today");
    }

    const dateHeading = document.createElement("div");
    dateHeading.className = "calendar-day-heading";
    const weekdayName = document.createElement("span");
    weekdayName.className = "calendar-day-weekday";
    weekdayName.textContent = weekdayFormatter.format(date).toUpperCase();
    const dateNumber = document.createElement("span");
    const dateButton = document.createElement("button");
    dateButton.className = "calendar-date-button";
    dateButton.type = "button";
    dateButton.setAttribute("aria-label", `Show hourly court status for ${weekdayFormatter.format(date)} ${dateFormatter.format(date)}`);
    dateButton.setAttribute("aria-pressed", "false");
    dateButton.addEventListener("click", () => showAvailability(date, dateButton));
    dateNumber.className = "calendar-date";
    dateNumber.textContent = String(dayNumber);
    dateButton.append(dateNumber);
    dateHeading.append(weekdayName, dateButton);
    dayCard.append(dateHeading);

    const bookingCount = calendarBookingsByDate.get(formatDateValue(date))?.length || 0;
    const bookingBadge = document.createElement("span");
    bookingBadge.className = `calendar-booking-count${bookingCount ? " has-bookings" : ""}`;
    bookingBadge.textContent = calendarLoaded && bookingCount ? `${bookingCount} booked` : "";
    const dateLabel = `${weekdayFormatter.format(date)} ${dateFormatter.format(date)}`;
    const todayLabel = date.toDateString() === today.toDateString() ? "Today, " : "";
    const bookingLabel = calendarLoaded && bookingCount
      ? `, ${bookingCount} confirmed ${bookingCount === 1 ? "booking" : "bookings"}`
      : "";
    dayCard.setAttribute("aria-label", `${todayLabel}${dateLabel}${bookingLabel}`);
    dayCard.append(bookingBadge);
    scheduleGrid.append(dayCard);
  }

  for (let index = 0; index < trailingEmptyDays; index += 1) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day calendar-day-empty";
    emptyDay.setAttribute("role", "presentation");
    scheduleGrid.append(emptyDay);
  }

  previousMonth.disabled = displayedMonth.getFullYear() === today.getFullYear()
    && displayedMonth.getMonth() === today.getMonth();
};

const loadCalendarBookings = async () => {
  const loadId = ++calendarLoadId;
  const monthStart = formatDateValue(displayedMonth);
  const nextMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
  const monthEnd = formatDateValue(nextMonth);
  calendarLoaded = false;
  calendarBookingsByDate.clear();
  calendarMessage.textContent = "Loading confirmed bookings…";
  calendarMessage.classList.remove("is-error");
  renderCalendar();
  try {
    const bookings = await window.PickleRallyDB.listPublicBookings(monthStart, monthEnd);
    if (loadId !== calendarLoadId) return;
    if (!Array.isArray(bookings)) throw new Error("The calendar returned an invalid booking list.");
    bookings.forEach((booking) => {
      if (typeof booking.date !== "string" || typeof booking.court !== "string" || typeof booking.time !== "string") {
        throw new Error("The calendar returned a booking with missing schedule details.");
      }
      const dayBookings = calendarBookingsByDate.get(booking.date) || [];
      dayBookings.push(booking);
      calendarBookingsByDate.set(booking.date, dayBookings);
    });
    calendarBookingsByDate.forEach((dayBookings) => {
      dayBookings.sort((first, second) => {
        const firstStart = bookingTimeRange(first.time)?.[0] ?? Number.POSITIVE_INFINITY;
        const secondStart = bookingTimeRange(second.time)?.[0] ?? Number.POSITIVE_INFINITY;
        return firstStart - secondStart;
      });
    });
    calendarLoaded = true;
    calendarMessage.textContent = "Select a date to see each court's hourly status.";
    renderCalendar();
  } catch (error) {
    if (loadId !== calendarLoadId) return;
    calendarBookingsByDate.clear();
    calendarMessage.textContent = `Could not load confirmed bookings. ${error.message}`;
    calendarMessage.classList.add("is-error");
    console.error("Unable to load public calendar bookings:", error);
    renderCalendar();
  }
};

previousMonth.addEventListener("click", () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
  loadCalendarBookings();
});
nextMonth.addEventListener("click", () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
  loadCalendarBookings();
});
availabilityDialogClose.addEventListener("click", () => availabilityDialog.close());
availabilityDialog.addEventListener("click", (event) => {
  if (event.target === availabilityDialog) availabilityDialog.close();
});
availabilityDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") availabilityDialog.close();
});
loadCalendarBookings();
window.setInterval(() => {
  if (!document.hidden) loadCalendarBookings();
}, 60_000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadCalendarBookings();
});

if (bookingDate) {
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  bookingDate.min = localToday;
}

const updateBookingEstimate = () => {
  const hourlyRate = Number(bookingCourt.selectedOptions[0]?.dataset.rate);
  const hours = Number(bookingDuration.value);
  bookingEstimate.textContent = hourlyRate && hours
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(hourlyRate * hours)
    : "Choose a court & duration";
};

const formatBookingHour = (hour) => {
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";
  return `${displayHour}:00 ${period}`;
};

const updateBookingTimes = () => {
  const duration = Number(bookingDuration.value);
  const selectedTime = bookingTime.value;
  bookingTime.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = duration ? "Choose a time" : "Choose a duration first";
  bookingTime.append(placeholder);

  if (!duration) {
    bookingTime.disabled = true;
    return;
  }

  bookingTime.disabled = false;
  const openingHour = 7;
  const closingHour = 22;
  for (let startHour = openingHour; startHour + duration <= closingHour; startHour += 1) {
    const endHour = startHour + duration;
    const option = document.createElement("option");
    option.value = `${formatBookingHour(startHour)} – ${formatBookingHour(endHour)}`;
    option.textContent = option.value;
    option.selected = option.value === selectedTime;
    bookingTime.append(option);
  }
};

bookingCourt.addEventListener("change", updateBookingEstimate);
bookingDuration.addEventListener("change", updateBookingEstimate);
bookingDuration.addEventListener("change", updateBookingTimes);
updateBookingTimes();

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  primaryNav.classList.toggle("is-open", !isOpen);
});

primaryNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    primaryNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
  });
});

promoInput.addEventListener("input", () => {
  const code = promoInput.value.trim().toUpperCase();
  if (code) {
    promoFeedback.textContent = "We'll check this code when we confirm your booking.";
  } else {
    promoFeedback.textContent = "";
  }
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!bookingForm.reportValidity()) return;

  const booking = Object.fromEntries(new FormData(bookingForm).entries());
  const saveButton = bookingForm.querySelector('[type="submit"]');
  saveButton.disabled = true;
  bookingMessage.textContent = "Saving your booking request…";
  try {
    const hourlyRate = Number(bookingCourt.selectedOptions[0].dataset.rate);
    await window.PickleRallyDB.createBooking({
      name: booking.name,
      phone: booking.phone,
      court: booking.court,
      players: booking.players,
      duration: Number(booking.duration),
      date: booking.date,
      time: booking.time,
      estimated_total: hourlyRate * Number(booking.duration),
      promo: booking.promo || "",
      notes: booking.notes || "",
    });
  } catch (error) {
    bookingMessage.textContent = `${error.message} Your request was not sent. Please contact the club directly.`;
    console.error("Unable to save booking request:", error);
    saveButton.disabled = false;
    return;
  }

  bookingForm.reset();
  updateBookingEstimate();
  updateBookingTimes();
  promoFeedback.textContent = "";
  bookingMessage.textContent = "Your booking request was sent successfully. Our team will contact you to confirm availability and the final rate.";
  saveButton.disabled = false;
});

document.querySelectorAll(".gallery-open").forEach((button) => {
  button.addEventListener("click", () => {
    const image = lightbox.querySelector("img");
    image.src = button.dataset.gallery;
    image.alt = button.querySelector("img")?.alt || button.getAttribute("aria-label") || "Pickleball court";
    lightbox.showModal();
  });
});

lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

let demoVisits = 7;
if (loyaltyAdd) {
  loyaltyAdd.addEventListener("click", () => {
    demoVisits = Math.min(demoVisits + 1, 10);
    loyaltyCount.textContent = String(demoVisits);
    loyaltyProgress.style.width = `${demoVisits * 10}%`;
    loyaltyStatus.textContent = demoVisits === 10
      ? "Demo reward reached! Ask the club about actual rewards."
      : `${10 - demoVisits} visits to your next reward`;
    loyaltyAdd.disabled = demoVisits === 10;
  });
}

const publicWebsiteUrl = new URL(window.location.href);
publicWebsiteUrl.hash = "";
publicWebsiteUrl.search = "";
const isPublicWebsite = ["http:", "https:"].includes(publicWebsiteUrl.protocol)
  && !["localhost", "127.0.0.1"].includes(publicWebsiteUrl.hostname);

const qrTrigger = document.querySelector("#qr-trigger");
if (qrTrigger) {
  qrTrigger.addEventListener("click", () => {
    qrImage.hidden = true;
    qrPrint.hidden = true;
    qrMessage.textContent = isPublicWebsite
      ? "Preparing a QR code for this website…"
      : "Publish this site at its final web address to create a shareable QR code.";
    qrDialog.showModal();

    if (isPublicWebsite) {
      const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
      qrUrl.searchParams.set("size", "320x320");
      qrUrl.searchParams.set("format", "svg");
      qrUrl.searchParams.set("data", publicWebsiteUrl.href);
      qrImage.src = qrUrl.href;
      qrImage.hidden = false;
    }
  });
}

qrImage.addEventListener("load", () => {
  qrMessage.textContent = "Scan this code to visit the PickleCourt website.";
  qrPrint.hidden = false;
});

qrImage.addEventListener("error", () => {
  qrImage.hidden = true;
  qrPrint.hidden = true;
  qrMessage.textContent = "We couldn't load the QR code. Please try again or share the website link.";
});

qrDialog.querySelector(".qr-close").addEventListener("click", () => qrDialog.close());
qrDialog.addEventListener("click", (event) => {
  if (event.target === qrDialog) qrDialog.close();
});
qrPrint.addEventListener("click", () => window.print());
