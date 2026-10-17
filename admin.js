(() => {
  const database = window.PickleRallyDB;
  const login = document.querySelector("#admin-login");
  const loginForm = document.querySelector("#admin-login-form");
  const loginFeedback = document.querySelector("#admin-login-feedback");
  const emailInput = document.querySelector("#admin-email");
  const passwordInput = document.querySelector("#admin-password");
  const dashboard = document.querySelector("#admin-main");
  const signOutButton = document.querySelector("#admin-sign-out");
  const bookingList = document.querySelector("#booking-list");
  const bookingEmpty = document.querySelector("#booking-empty");
  const bookingDialog = document.querySelector("#admin-booking-dialog");
  const bookingForm = document.querySelector("#admin-booking-form");
  const bookingFormFeedback = document.querySelector("#admin-booking-feedback");
  const bookingCourt = document.querySelector("#admin-booking-court");
  const bookingDuration = document.querySelector("#admin-booking-duration");
  const bookingDate = document.querySelector("#admin-booking-date");
  const bookingTime = document.querySelector("#admin-booking-time");
  const bookingTotal = document.querySelector("#admin-booking-total");
  const bookingSubmit = document.querySelector("#admin-booking-submit");
  const feedback = document.querySelector("#admin-feedback");
  const searchInput = document.querySelector("#booking-search");
  const dateFilter = document.querySelector("#booking-date-filter");
  const courtFilter = document.querySelector("#booking-court-filter");
  const refreshButton = document.querySelector("#refresh-bookings");
  const syncStatus = document.querySelector("#admin-sync-status");
  const pagination = document.querySelector("#booking-pagination");
  const paginationSummary = document.querySelector("#booking-pagination-summary");
  const previousPageButton = document.querySelector("#booking-previous-page");
  const nextPageButton = document.querySelector("#booking-next-page");
  const pageNumber = document.querySelector("#booking-page-number");
  const filterButtons = [...document.querySelectorAll(".admin-filter")];
  const pageSize = 10;
  let activeFilter = "all";
  let activePage = 1;
  let bookings = [];
  let loading = false;
  let pollingTimer;

  const updateSyncStatus = (message, isError = false) => {
    syncStatus.textContent = message;
    syncStatus.classList.toggle("is-error", isError);
  };

  const startPolling = () => {
    window.clearInterval(pollingTimer);
    pollingTimer = window.setInterval(() => {
      if (!document.hidden) loadBookings({ silent: true });
    }, 5000);
    updateSyncStatus("Live · checking every 5 sec");
  };

  const stopPolling = () => {
    window.clearInterval(pollingTimer);
    updateSyncStatus("Waiting for staff sign-in");
  };

  const setFeedback = (message) => {
    feedback.textContent = message;
  };

  const showLogin = (message = "") => {
    stopPolling();
    dashboard.hidden = true;
    login.hidden = false;
    signOutButton.hidden = true;
    loginFeedback.textContent = message;
  };

  const setSignedIn = () => {
    login.hidden = true;
    dashboard.hidden = false;
    signOutButton.hidden = false;
    startPolling();
  };

  const localDateValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const formatBookingHour = (hour) => `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`;

  const updateAdminBookingTimes = () => {
    const duration = Number(bookingDuration.value);
    const previousTime = bookingTime.value;
    bookingTime.replaceChildren(new Option(duration ? "Choose a time" : "Choose a duration first", ""));
    if (!duration) {
      bookingTime.disabled = true;
      return;
    }

    bookingTime.disabled = false;
    for (let startHour = 7; startHour + duration <= 22; startHour += 1) {
      const time = `${formatBookingHour(startHour)} – ${formatBookingHour(startHour + duration)}`;
      bookingTime.add(new Option(time, time, false, time === previousTime));
    }
  };

  const updateAdminBookingTotal = () => {
    const rate = Number(bookingCourt.selectedOptions[0]?.dataset.rate);
    const duration = Number(bookingDuration.value);
    bookingTotal.textContent = rate && duration
      ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })
        .format(rate * duration)
      : "Choose a court & duration";
  };

  const timeRange = (time) => {
    const matches = [...String(time || "").matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
    if (matches.length < 2) return null;
    const toMinutes = (match) => {
      const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
      return hour * 60 + Number(match[2]);
    };
    return [toMinutes(matches[0]), toMinutes(matches[1])];
  };

  const hasBookingConflict = (newBooking, existingBookings) => {
    const newRange = timeRange(newBooking.time);
    if (!newRange) throw new Error("Could not read the selected time. Please choose a time slot again.");
    return existingBookings.some((booking) => {
      if (booking.status === "cancelled" || booking.date !== newBooking.date || booking.court !== newBooking.court) return false;
      const existingRange = timeRange(booking.time);
      return existingRange && newRange[0] < existingRange[1] && existingRange[0] < newRange[1];
    });
  };

  const createCell = (className, text) => {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  };

  const renderBooking = (booking) => {
    const row = document.createElement("tr");
    const playerCell = document.createElement("td");
    const playerName = document.createElement("strong");
    playerName.className = "booking-player";
    playerName.textContent = booking.name || "Unnamed player";
    const phone = document.createElement("span");
    phone.className = "booking-phone";
    phone.textContent = booking.phone || "No phone provided";
    playerCell.append(playerName, phone);
    if (booking.notes || booking.promo) {
      const extra = document.createElement("span");
      extra.className = "booking-extra";
      extra.textContent = [booking.notes ? `Note: ${booking.notes}` : "", booking.promo ? `Promo: ${booking.promo}` : ""]
        .filter(Boolean).join(" · ");
      playerCell.append(extra);
    }
    row.append(playerCell);

    const slotCell = document.createElement("td");
    const court = document.createElement("strong");
    court.className = "booking-detail";
    court.textContent = booking.court || "Court not specified";
    const dateAndTime = document.createElement("span");
    dateAndTime.className = "booking-meta";
    const date = booking.date ? new Date(`${booking.date}T00:00:00`) : null;
    const formattedDate = date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date)
      : "Date not specified";
    dateAndTime.textContent = `${formattedDate} · ${booking.time || "Time not specified"}`;
    slotCell.append(court, dateAndTime);
    row.append(slotCell);

    row.append(createCell("", `${booking.players || "—"} · ${booking.duration || "—"} hr`));
    row.append(createCell("", new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(booking.estimated_total || 0)));

    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = `booking-status status-${booking.status}`;
    statusSelect.setAttribute("aria-label", `Status for ${booking.name || "booking"}`);
    ["pending", "confirmed", "cancelled"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status[0].toUpperCase() + status.slice(1);
      option.selected = booking.status === status;
      statusSelect.append(option);
    });
    statusSelect.addEventListener("change", async () => {
      statusSelect.disabled = true;
      setFeedback("Saving booking status…");
      try {
        await database.updateBookingStatus(booking.id, statusSelect.value);
        setFeedback(`Booking for ${booking.name || "player"} marked ${statusSelect.value}.`);
        await loadBookings();
      } catch (error) {
        setFeedback(error.message);
        if (error.message.includes("session has expired")) showLogin(error.message);
        else statusSelect.disabled = false;
      }
    });
    statusCell.append(statusSelect);
    row.append(statusCell);

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.className = "booking-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete booking for ${booking.name || "player"}`);
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(`Delete the booking request for ${booking.name || "this player"}? This cannot be undone.`)) return;
      deleteButton.disabled = true;
      setFeedback("Deleting booking request…");
      try {
        await database.deleteBooking(booking.id);
        setFeedback("Booking request deleted.");
        await loadBookings();
      } catch (error) {
        setFeedback(error.message);
        if (error.message.includes("session has expired")) showLogin(error.message);
        else deleteButton.disabled = false;
      }
    });
    actionCell.append(deleteButton);
    row.append(actionCell);
    return row;
  };

  const renderBookings = () => {
    const pending = bookings.filter((booking) => booking.status === "pending").length;
    const confirmed = bookings.filter((booking) => booking.status === "confirmed").length;
    const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
    const localToday = new Date();
    const todayValue = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;
    document.querySelector("#stat-total").textContent = String(bookings.length);
    document.querySelector("#stat-pending").textContent = String(pending);
    document.querySelector("#stat-confirmed").textContent = String(confirmed);
    document.querySelector("#stat-today").textContent = String(bookings.filter((booking) => booking.date === todayValue).length);
    document.querySelector("#count-all").textContent = String(bookings.length);
    document.querySelector("#count-pending").textContent = String(pending);
    document.querySelector("#count-confirmed").textContent = String(confirmed);
    document.querySelector("#count-cancelled").textContent = String(cancelled);

    const query = searchInput.value.trim().toLocaleLowerCase();
    const selectedDate = dateFilter.value;
    const courts = [...new Set(bookings.map((booking) => booking.court).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second));
    const previousCourt = courtFilter.value;
    courtFilter.replaceChildren(new Option("All courts", ""));
    courts.forEach((court) => courtFilter.add(new Option(court, court)));
    courtFilter.value = courts.includes(previousCourt) ? previousCourt : "";
    const selectedCourt = courtFilter.value;

    const filtered = bookings
      .filter((booking) => activeFilter === "all" || booking.status === activeFilter)
      .filter((booking) => !selectedDate || booking.date === selectedDate)
      .filter((booking) => !selectedCourt || booking.court === selectedCourt)
      .filter((booking) => !query || [booking.name, booking.phone, booking.court, booking.date, booking.time]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query)));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    activePage = Math.min(activePage, totalPages);
    const firstIndex = (activePage - 1) * pageSize;
    const pageBookings = filtered.slice(firstIndex, firstIndex + pageSize);
    bookingList.replaceChildren(...pageBookings.map(renderBooking));
    bookingEmpty.hidden = filtered.length !== 0;
    pagination.hidden = filtered.length === 0;
    paginationSummary.textContent = `Showing ${firstIndex + 1}–${Math.min(firstIndex + pageSize, filtered.length)} of ${filtered.length} requests`;
    pageNumber.textContent = `Page ${activePage} of ${totalPages}`;
    previousPageButton.disabled = activePage === 1;
    nextPageButton.disabled = activePage === totalPages;
    document.querySelector("#booking-empty-title").textContent = bookings.length
      ? "No matching bookings."
      : "No booking requests yet.";
    document.querySelector("#booking-empty-message").textContent = bookings.length
      ? "Try another search or adjust the date, court, or status filters."
      : "Booking requests submitted on the website will appear here, or create one from the staff dashboard.";
  };

  async function loadBookings({ silent = false } = {}) {
    if (loading) return;
    loading = true;
    refreshButton.disabled = true;
    if (!silent) setFeedback("Loading booking requests…");
    try {
      const updatedBookings = await database.listBookings();
      if (JSON.stringify(updatedBookings) !== JSON.stringify(bookings)) {
        bookings = updatedBookings;
        renderBookings();
      }
      updateSyncStatus(`Live · updated ${new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date())}`);
      setFeedback(bookings.length ? "" : "No booking requests yet.");
    } catch (error) {
      updateSyncStatus("Couldn't sync · retrying", true);
      if (!silent) setFeedback(error.message);
      if (error.message.includes("session has expired")) showLogin(error.message);
    } finally {
      loading = false;
      refreshButton.disabled = false;
    }
  }

  if (!database?.isConfigured()) {
    showLogin("Database setup required: add your Supabase project URL and anon key to supabase-config.js, then run supabase-schema.sql in the Supabase SQL Editor.");
    loginForm.querySelector("button[type='submit']").disabled = true;
  } else {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = loginForm.querySelector("button[type='submit']");
      submitButton.disabled = true;
      loginFeedback.textContent = "Signing in…";
      try {
        await database.signIn(emailInput.value.trim(), passwordInput.value);
        const user = await database.getSession();
        if (!user) throw new Error("Sign-in could not be verified. Please try again.");
        setSignedIn();
        await loadBookings();
      } catch (error) {
        loginFeedback.textContent = error.message;
        passwordInput.value = "";
        passwordInput.focus();
      } finally {
        submitButton.disabled = false;
      }
    });

    signOutButton.addEventListener("click", async () => {
      signOutButton.disabled = true;
      try {
        await database.signOut();
        showLogin("You have been signed out.");
      } catch (error) {
        showLogin(error.message);
      } finally {
        signOutButton.disabled = false;
      }
    });

    database.getSession()
      .then((user) => {
        if (!user) {
          showLogin();
          return;
        }
        setSignedIn();
        return loadBookings();
      })
      .catch((error) => showLogin(error.message));
  }

  bookingDate.min = localDateValue();
  bookingDuration.addEventListener("change", updateAdminBookingTimes);
  bookingDuration.addEventListener("change", updateAdminBookingTotal);
  bookingCourt.addEventListener("change", updateAdminBookingTotal);
  document.querySelector("#open-admin-booking").addEventListener("click", () => {
    bookingFormFeedback.textContent = "";
    bookingDialog.showModal();
    bookingForm.querySelector("input[name='name']").focus();
  });
  document.querySelector("#admin-booking-close").addEventListener("click", () => bookingDialog.close());
  bookingDialog.addEventListener("click", (event) => {
    if (event.target === bookingDialog) bookingDialog.close();
  });
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;

    const formData = Object.fromEntries(new FormData(bookingForm));
    const rate = Number(bookingCourt.selectedOptions[0]?.dataset.rate);
    const booking = {
      name: String(formData.name).trim(),
      phone: String(formData.phone).trim(),
      court: String(formData.court),
      players: String(formData.players),
      duration: Number(formData.duration),
      date: String(formData.date),
      time: String(formData.time),
      estimated_total: rate * Number(formData.duration),
      promo: "",
      notes: String(formData.notes || "").trim(),
      status: String(formData.status),
    };

    if (!booking.name || !booking.phone || !rate || booking.date < localDateValue()) {
      bookingFormFeedback.textContent = "Check the player details, court, and booking date.";
      return;
    }

    bookingSubmit.disabled = true;
    bookingFormFeedback.textContent = "Checking court availability…";
    try {
      const latestBookings = await database.listBookings();
      bookings = latestBookings;
      if (hasBookingConflict(booking, latestBookings)) {
        renderBookings();
        bookingFormFeedback.textContent = "That court already has a booking during this time. Choose another time slot.";
        return;
      }

      const createdBooking = await database.createAdminBooking(booking);
      bookings = [createdBooking, ...latestBookings];
      activePage = 1;
      renderBookings();
      setFeedback(`Booking for ${booking.name} created as ${booking.status}.`);
      bookingForm.reset();
      bookingDate.min = localDateValue();
      updateAdminBookingTimes();
      updateAdminBookingTotal();
      bookingDialog.close();
    } catch (error) {
      bookingFormFeedback.textContent = error.message;
      if (error.message.includes("session has expired")) {
        bookingDialog.close();
        showLogin(error.message);
      }
    } finally {
      bookingSubmit.disabled = false;
    }
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      activePage = 1;
      filterButtons.forEach((filterButton) => {
        const isActive = filterButton === button;
        filterButton.classList.toggle("is-active", isActive);
        filterButton.setAttribute("aria-pressed", String(isActive));
      });
      renderBookings();
    });
  });

  const resetPageAndRender = () => {
    activePage = 1;
    renderBookings();
  };

  searchInput.addEventListener("input", resetPageAndRender);
  dateFilter.addEventListener("change", resetPageAndRender);
  courtFilter.addEventListener("change", resetPageAndRender);
  previousPageButton.addEventListener("click", () => {
    if (activePage === 1) return;
    activePage -= 1;
    renderBookings();
  });
  nextPageButton.addEventListener("click", () => {
    activePage += 1;
    renderBookings();
  });
  refreshButton.addEventListener("click", loadBookings);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !login.hidden) loadBookings({ silent: true });
  });

  document.querySelector("#export-bookings").addEventListener("click", () => {
    const headers = ["Name", "Phone", "Court", "Players", "Duration", "Date", "Time", "Estimated total", "Status", "Promo", "Notes"];
    const escapeCsv = (value) => {
      const safeValue = String(value ?? "").replace(/^[=+\-@]/, "'$&");
      return `"${safeValue.replace(/"/g, '""')}"`;
    };
    const rows = bookings.map((booking) => [
      booking.name, booking.phone, booking.court, booking.players, booking.duration,
      booking.date, booking.time, booking.estimated_total, booking.status,
      booking.promo, booking.notes,
    ].map(escapeCsv).join(","));
    const csv = [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const file = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "picklerally-bookings.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    setFeedback(`${bookings.length} booking${bookings.length === 1 ? "" : "s"} exported.`);
  });
})();
