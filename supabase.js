(() => {
  const sessionKey = "picklerallySupabaseSession";
  const config = window.PICKLERALLY_SUPABASE || {};
  const projectUrl = String(config.url || "").replace(/\/+$/, "");
  const anonKey = String(config.anonKey || "");

  const requireConfig = () => {
    if (!projectUrl || !anonKey) {
      throw new Error("The database is not configured yet. Add your Supabase project URL and anon key in supabase-config.js.");
    }
  };

  const readSession = () => {
    try {
      const session = JSON.parse(localStorage.getItem(sessionKey) || "null");
      return session && typeof session.access_token === "string" ? session : null;
    } catch (error) {
      throw new Error("Could not read the saved sign-in session from this browser.", { cause: error });
    }
  };

  const saveSession = (session) => {
    try {
      localStorage.setItem(sessionKey, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Date.now() + Number(session.expires_in || 3600) * 1000,
      }));
    } catch (error) {
      throw new Error("Could not save your sign-in session. Enable browser storage and try again.", { cause: error });
    }
  };

  const removeSession = () => {
    try {
      localStorage.removeItem(sessionKey);
    } catch (error) {
      throw new Error("Could not clear the saved sign-in session.", { cause: error });
    }
  };

  const request = async (path, { method = "GET", body, accessToken, headers = {} } = {}) => {
    requireConfig();
    const response = await fetch(`${projectUrl}${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken || anonKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const responseText = await response.text();
    let responseBody = null;
    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }
    if (!response.ok) {
      const detail = typeof responseBody === "string"
        ? responseBody
        : responseBody?.message || responseBody?.msg || responseBody?.error_description || responseBody?.error;
      const error = new Error(detail || `Database request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return responseBody;
  };

  const refreshSession = async (session) => {
    if (!session?.refresh_token) {
      removeSession();
      return null;
    }
    try {
      const refreshed = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: session.refresh_token },
      });
      saveSession(refreshed);
      return refreshed;
    } catch (error) {
      if ([400, 401, 403].includes(error.status)) {
        removeSession();
        throw new Error("Your admin session expired. Please sign in again.", { cause: error });
      }
      throw new Error("Could not refresh your admin session. Check your connection and try again.", { cause: error });
    }
  };

  const getAccessToken = async () => {
    const session = readSession();
    if (!session) return null;
    if (Number(session.expires_at) < Date.now() + 60_000) {
      const refreshed = await refreshSession(session);
      return refreshed?.access_token || null;
    }
    return session.access_token;
  };

  const authenticatedRequest = async (path, options = {}) => {
    let accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Your admin session has expired. Please sign in again.");
    try {
      return await request(path, { ...options, accessToken });
    } catch (error) {
      if (error.status !== 401) throw error;
      const currentSession = readSession();
      const refreshed = await refreshSession(currentSession);
      accessToken = refreshed?.access_token;
      if (!accessToken) throw new Error("Your admin session has expired. Please sign in again.");
      return request(path, { ...options, accessToken });
    }
  };

  window.PickleRallyDB = {
    isConfigured: () => Boolean(projectUrl && anonKey),
    listPublicBookings: async (startDate, endDate) => {
      const bookings = await request(
        "/rest/v1/rpc/list_public_bookings",
        {
          method: "POST",
          body: { p_start_date: startDate, p_end_date: endDate },
        },
      );
      if (!Array.isArray(bookings)) {
        throw new Error("The calendar returned an invalid booking list.");
      }
      return bookings;
    },
    listUnavailableBookingTimes: async (date, court) => {
      const bookings = await request("/rest/v1/rpc/list_unavailable_booking_times", {
        method: "POST",
        body: { p_booking_date: date, p_court: court },
      });
      if (!Array.isArray(bookings) || bookings.some((booking) => typeof booking.time !== "string")) {
        throw new Error("The booking availability check returned an invalid response.");
      }
      return bookings.map((booking) => booking.time);
    },
    createBooking: async (booking) => {
      const result = await request("/rest/v1/rpc/create_customer_booking", {
        method: "POST",
        body: {
          p_name: booking.name,
          p_phone: booking.phone,
          p_email: booking.email,
          p_court: booking.court,
          p_players: booking.players,
          p_duration: booking.duration,
          p_date: booking.date,
          p_time: booking.time,
          p_estimated_total: booking.estimated_total,
          p_promo: booking.promo,
          p_notes: booking.notes,
        },
      });
      if (!result || typeof result.booking_id !== "string" || typeof result.cancellation_token !== "string") {
        throw new Error("The booking response did not include valid cancellation details. Please contact the club before submitting another request.");
      }
      return result;
    },
    sendCancellationEmail: async (bookingId, cancellationToken) => {
      const result = await request("/functions/v1/send-cancellation-email", {
        method: "POST",
        body: { booking_id: bookingId, cancellation_token: cancellationToken },
      });
      if (!result?.success) {
        throw new Error("The cancellation email could not be sent.");
      }
    },
    cancelBooking: async (bookingId, phone, cancellationToken = null) => {
      const result = await request("/rest/v1/rpc/cancel_customer_booking", {
        method: "POST",
        body: {
          p_booking_id: bookingId,
          p_phone: phone || null,
          p_token: cancellationToken,
        },
      });
      if (typeof result !== "boolean") {
        throw new Error("The cancellation request returned an invalid response.");
      }
      return result;
    },
    createAdminBooking: async (booking) => {
      const result = await authenticatedRequest("/rest/v1/bookings?select=*", {
        method: "POST",
        body: booking,
        headers: { Prefer: "return=representation" },
      });
      if (!Array.isArray(result) || result.length !== 1) {
        throw new Error("The booking was not created. Please refresh and try again.");
      }
      return result[0];
    },
    signIn: async (email, password) => {
      const session = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email, password },
      });
      saveSession(session);
      return session;
    },
    getSession: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) return null;
      try {
        return await request("/auth/v1/user", { accessToken });
      } catch (error) {
        if ([401, 403].includes(error.status)) {
          removeSession();
          throw new Error("Your admin session expired. Please sign in again.", { cause: error });
        }
        throw error;
      }
    },
    signOut: async () => {
      const accessToken = await getAccessToken();
      try {
        if (accessToken) await request("/auth/v1/logout", { method: "POST", accessToken });
      } catch (error) {
        removeSession();
        throw new Error("Your local session was cleared, but Supabase could not confirm sign-out.", { cause: error });
      }
      removeSession();
    },
    listBookings: () => authenticatedRequest("/rest/v1/bookings?select=*&order=created_at.desc"),
    updateBookingStatus: async (id, status) => {
      const result = await authenticatedRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=id`, {
        method: "PATCH",
        body: { status },
        headers: { Prefer: "return=representation" },
      });
      if (!Array.isArray(result) || result.length !== 1) {
        throw new Error("The booking was not updated. It may have been deleted or access may have expired.");
      }
    },
    deleteBooking: async (id) => {
      const result = await authenticatedRequest(`/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=id`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      if (!Array.isArray(result) || result.length !== 1) {
        throw new Error("The booking was not deleted. It may have already been removed.");
      }
    },
  };
})();