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
  const feedback = document.querySelector("#admin-feedback");
  const searchInput = document.querySelector("#booking-search");
  const refreshButton = document.querySelector("#refresh-bookings");
  const syncStatus = document.querySelector("#admin-sync-status");
  const filterButtons = [...document.querySelectorAll(".admin-filter")];
  let activeFilter = "all";
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
    const filtered = bookings
      .filter((booking) => activeFilter === "all" || booking.status === activeFilter)
      .filter((booking) => !query || [booking.name, booking.phone, booking.court, booking.date, booking.time]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query)));
    bookingList.replaceChildren(...filtered.map(renderBooking));
    bookingEmpty.hidden = filtered.length !== 0;
    document.querySelector("#booking-empty-title").textContent = bookings.length
      ? "No matching bookings."
      : "No booking requests yet.";
    document.querySelector("#booking-empty-message").textContent = bookings.length
      ? "Try another search or choose a different status filter."
      : "Booking requests submitted on the website will appear here.";
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

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      filterButtons.forEach((filterButton) => {
        const isActive = filterButton === button;
        filterButton.classList.toggle("is-active", isActive);
        filterButton.setAttribute("aria-pressed", String(isActive));
      });
      renderBookings();
    });
  });

  searchInput.addEventListener("input", renderBookings);
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
