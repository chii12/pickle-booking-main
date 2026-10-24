const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector(".primary-nav");
const bookingForm = document.querySelector("#booking-form");
const bookingDate = document.querySelector("#booking-date");
const bookingCourt = document.querySelector("#booking-court");
const bookingDuration = document.querySelector("#booking-duration");
const bookingTime = document.querySelector("#booking-time");
const bookingEstimate = document.querySelector("#booking-estimate");
const bookingMessage = document.querySelector("#form-message");
const cancellationForm = document.querySelector("#cancellation-form");
const cancellationReference = document.querySelector("#cancellation-reference");
const cancellationPhone = document.querySelector("#cancellation-phone");
const cancellationMessage = document.querySelector("#cancellation-message");
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
let cancellationToken = null;
let bookingAvailability = [];
let bookingAvailabilityRequestId = 0;
let bookingAvailabilityKey = "";
let bookingAvailabilityError = null;
let bookingAvailabilityLoading = false;

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
let calendarLoadError = null;
let selectedAvailabilityDate = null;

const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const showAvailability = (date, selectedButton) => {
  scheduleGrid.querySelectorAll(".calendar-date-button[aria-pressed='true']").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });
  selectedButton.setAttribute("aria-pressed", "true");
  selectedAvailabilityDate = date;
  availabilityDialogTitle.textContent = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
  renderAvailabilityDetails(date);
  if (!availabilityDialog.open) availabilityDialog.showModal();
};

const renderAvailabilityDetails = (date) => {
  availabilityDetailSlots.replaceChildren();
  if (!calendarLoaded) {
    const message = document.createElement("p");
    message.className = `availability-load-message${calendarLoadError ? " is-error" : ""}`;
    message.setAttribute("role", calendarLoadError ? "alert" : "status");
    message.textContent = calendarLoadError
      ? `Could not load confirmed bookings. ${calendarLoadError.message || String(calendarLoadError)}`
      : "Loading confirmed bookings…";
    availabilityDetailSlots.setAttribute("role", calendarLoadError ? "alert" : "status");
    availabilityDetailSlots.setAttribute("aria-busy", String(!calendarLoadError));
    availabilityDetailSlots.append(message);
    return;
  }

  availabilityDetailSlots.setAttribute("role", "table");
  availabilityDetailSlots.setAttribute("aria-busy", "false");
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
    dateButton.setAttribute("aria-pressed", String(
      selectedAvailabilityDate && formatDateValue(selectedAvailabilityDate) === formatDateValue(date),
    ));
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
  calendarLoadError = null;
  calendarBookingsByDate.clear();
  calendarMessage.textContent = "Loading confirmed bookings…";
  calendarMessage.classList.remove("is-error");
  if (selectedAvailabilityDate) renderAvailabilityDetails(selectedAvailabilityDate);
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
    if (selectedAvailabilityDate) renderAvailabilityDetails(selectedAvailabilityDate);
    renderCalendar();
  } catch (error) {
    if (loadId !== calendarLoadId) return;
    calendarLoadError = error;
    calendarBookingsByDate.clear();
    calendarMessage.textContent = `Could not load confirmed bookings. ${error.message}`;
    calendarMessage.classList.add("is-error");
    console.error("Unable to load public calendar bookings:", error);
    if (selectedAvailabilityDate) renderAvailabilityDetails(selectedAvailabilityDate);
    renderCalendar();
  }
};

previousMonth.addEventListener("click", () => {
  if (availabilityDialog.open) availabilityDialog.close();
  selectedAvailabilityDate = null;
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
  loadCalendarBookings();
});
nextMonth.addEventListener("click", () => {
  if (availabilityDialog.open) availabilityDialog.close();
  selectedAvailabilityDate = null;
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
  const availabilityKey = `${bookingDate.value}|${bookingCourt.value}`;
  placeholder.textContent = bookingAvailabilityError
    ? "Could not check availability. Change date or court to retry."
    : !duration
      ? "Choose a duration first"
      : !bookingDate.value || !bookingCourt.value
        ? "Choose a court and date first"
        : bookingAvailabilityLoading || bookingAvailabilityKey !== availabilityKey
          ? "Checking available times…"
          : "Choose an available time";
  bookingTime.append(placeholder);

  if (!duration || !bookingDate.value || !bookingCourt.value
    || bookingAvailabilityLoading || bookingAvailabilityKey !== availabilityKey || bookingAvailabilityError) {
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
    const overlapsUnavailableTime = bookingAvailability.some((time) => {
      const unavailableRange = bookingTimeRange(time);
      return unavailableRange && startHour * 60 < unavailableRange[1] && unavailableRange[0] < endHour * 60;
    });
    option.disabled = overlapsUnavailableTime;
    option.textContent = overlapsUnavailableTime ? `${option.value} — Unavailable` : option.value;
    option.selected = !overlapsUnavailableTime && option.value === selectedTime;
    bookingTime.append(option);
  }
};

const loadBookingAvailability = async () => {
  const requestId = ++bookingAvailabilityRequestId;
  const date = bookingDate.value;
  const court = bookingCourt.value;
  bookingAvailabilityKey = `${date}|${court}`;
  bookingAvailability = [];
  bookingAvailabilityError = null;
  bookingAvailabilityLoading = Boolean(date && court);
  if (!date || !court) {
    bookingAvailabilityKey = "";
    updateBookingTimes();
    return;
  }

  updateBookingTimes();
  try {
    const unavailableTimes = await window.PickleRallyDB.listUnavailableBookingTimes(date, court);
    if (requestId !== bookingAvailabilityRequestId) return;
    bookingAvailability = unavailableTimes;
  } catch (error) {
    if (requestId !== bookingAvailabilityRequestId) return;
    bookingAvailabilityError = error;
    console.error("Unable to check booking availability:", error);
  }
  bookingAvailabilityLoading = false;
  updateBookingTimes();
};

bookingCourt.addEventListener("change", updateBookingEstimate);
bookingCourt.addEventListener("change", loadBookingAvailability);
bookingDate.addEventListener("change", loadBookingAvailability);
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
      email: booking.email,
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
    bookingMessage.textContent = `${error.message} If you are unsure whether the request was saved, contact the club before submitting it again.`;
    console.error("Unable to save booking request:", error);
    loadBookingAvailability();
    saveButton.disabled = false;
    return;
  }

  bookingForm.reset();
  updateBookingEstimate();
  updateBookingTimes();
  loadBookingAvailability();
  promoFeedback.textContent = "";
  bookingMessage.textContent = "Your booking inquiry was sent. Please wait for an email or text message from our team with the details. Your booking is not confirmed until the team replies.";
  window.alert("Your booking inquiry was sent! Please wait for an email or text message from our team with the details. Your booking is not confirmed until the team replies.");
  saveButton.disabled = false;
});

cancellationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cancellationForm.reportValidity()) return;

  const submitButton = cancellationForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  cancellationMessage.className = "cancellation-message";
  cancellationMessage.textContent = "Checking your cancellation request…";
  try {
    const cancelled = await window.PickleRallyDB.cancelBooking(
      cancellationReference.value.trim(),
      cancellationPhone.value.trim(),
      cancellationToken,
    );
    if (!cancelled) {
      if (cancellationToken) {
        cancellationPhone.closest("label").hidden = false;
        cancellationPhone.required = true;
      }
      cancellationMessage.classList.add("is-error");
      cancellationMessage.textContent = "We couldn't cancel this booking. Check the reference and phone number or email link. Website cancellations are available only within 48 hours of submitting the request.";
      return;
    }

    cancellationToken = null;
    cancellationForm.reset();
    cancellationPhone.required = true;
    cancellationPhone.closest("label").hidden = false;
    cancellationMessage.classList.add("is-success");
    cancellationMessage.textContent = "Your booking was cancelled. The court is now available for a new booking request.";
  } catch (error) {
    if (cancellationToken) {
      cancellationPhone.closest("label").hidden = false;
      cancellationPhone.required = true;
    }
    cancellationMessage.classList.add("is-error");
    cancellationMessage.textContent = `The booking could not be cancelled. ${error.message}`;
    console.error("Unable to cancel booking:", error);
  } finally {
    submitButton.disabled = false;
  }
});

const loadCancellationLink = () => {
  const cancellationLink = window.location.hash.match(/^#cancel-booking\?reference=([0-9a-f-]{36})&token=([a-f0-9]{64})$/i);
  if (!cancellationLink) return;

  cancellationReference.value = cancellationLink[1];
  cancellationToken = cancellationLink[2];
  cancellationPhone.required = false;
  cancellationPhone.closest("label").hidden = true;
  cancellationMessage.textContent = "Secure email link ready. Select Cancel booking to confirm.";
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#cancel-booking`);
  document.querySelector("#cancel-booking").scrollIntoView({ behavior: "smooth" });
};

window.addEventListener("hashchange", loadCancellationLink);
loadCancellationLink();

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