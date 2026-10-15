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
const timeSlots = [
  { full: "7:00 AM–10:00 AM", short: "7–10 AM" },
  { full: "10:00 AM–4:00 PM", short: "10 AM–4 PM" },
  { full: "4:00 PM–10:00 PM", short: "4–10 PM" },
];
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
const availabilityFor = (date, slotIndex) => {
  const weekday = date.getDay();
  if (slotIndex === 0 && (weekday === 3 || weekday === 6)) return ["OPEN PLAY", "slot-clinic"];
  if (slotIndex === 1 && weekday === 2) return ["MAINTENANCE", "slot-maintenance"];
  if (slotIndex === 2 && (weekday === 4 || weekday === 0)) return ["OPEN PLAY", "slot-clinic"];
  return ["OPEN", "slot-open"];
};

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

  timeSlots.forEach((timeSlot, slotIndex) => {
    const [statusText, statusClass] = availabilityFor(date, slotIndex);
    const row = document.createElement("li");
    row.className = "availability-detail-slot";
    const time = document.createElement("span");
    time.textContent = timeSlot.full;
    const status = document.createElement("span");
    status.className = `calendar-status ${statusClass}`;
    const dot = document.createElement("span");
    dot.className = "calendar-status-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = statusText;
    status.append(dot, label);
    row.append(time, status);
    availabilityDetailSlots.append(row);
  });

  if (!availabilityDialog.open) availabilityDialog.showModal();
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
    dayCard.setAttribute("aria-label", `${weekdayFormatter.format(date)} ${dateFormatter.format(date)}`);
    if (date.toDateString() === today.toDateString()) {
      dayCard.classList.add("today");
      dayCard.setAttribute("aria-label", `Today, ${weekdayFormatter.format(date)} ${dateFormatter.format(date)}`);
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
    dateButton.setAttribute("aria-label", `Show availability for ${weekdayFormatter.format(date)} ${dateFormatter.format(date)}`);
    dateButton.setAttribute("aria-pressed", "false");
    dateButton.addEventListener("click", () => showAvailability(date, dateButton));
    dateNumber.className = "calendar-date";
    dateNumber.textContent = String(dayNumber);
    dateButton.append(dateNumber);
    dateHeading.append(weekdayName, dateButton);
    dayCard.append(dateHeading);

    const slots = document.createElement("ul");
    slots.className = "calendar-slots";
    slots.setAttribute("aria-label", "Daily time slots");
    timeSlots.forEach((timeSlot, slotIndex) => {
      const [statusText, statusClass] = availabilityFor(date, slotIndex);
      const statusItem = document.createElement("li");
      statusItem.className = "calendar-slot";
      const timeLabel = document.createElement("span");
      timeLabel.className = "calendar-slot-time";
      timeLabel.textContent = timeSlot.short;
      const status = document.createElement("span");
      status.className = `calendar-status ${statusClass}`;
      status.setAttribute("aria-label", `${timeSlot.full}: ${statusText}`);
      status.title = `${timeSlot.full}: ${statusText}`;
      const statusDot = document.createElement("span");
      statusDot.className = "calendar-status-dot";
      statusDot.setAttribute("aria-hidden", "true");
      const statusLabel = document.createElement("span");
      statusLabel.className = "calendar-status-label";
      statusLabel.textContent = statusText;
      status.append(statusDot, statusLabel);
      statusItem.append(timeLabel, status);
      slots.append(statusItem);
    });
    dayCard.append(slots);
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

previousMonth.addEventListener("click", () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
  renderCalendar();
});
nextMonth.addEventListener("click", () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
  renderCalendar();
});
availabilityDialogClose.addEventListener("click", () => availabilityDialog.close());
availabilityDialog.addEventListener("click", (event) => {
  if (event.target === availabilityDialog) availabilityDialog.close();
});
availabilityDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") availabilityDialog.close();
});
renderCalendar();

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
