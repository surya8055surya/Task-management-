/**
 * api.js
 * Small shared helper for talking to the Task Manager JWT API.
 * Loaded on every page (see base.html).
 */

const API_BASE = "/api";

const TokenStore = {
  getAccess() {
    return localStorage.getItem("access_token");
  },
  getRefresh() {
    return localStorage.getItem("refresh_token");
  },
  set(access, refresh) {
    localStorage.setItem("access_token", access);
    if (refresh) localStorage.setItem("refresh_token", refresh);
  },
  clear() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
  },
  isLoggedIn() {
    return !!this.getAccess();
  },
};

/**
 * Attempt to exchange the stored refresh token for a new access token.
 * Returns true on success, false otherwise.
 */
async function tryRefreshToken() {
  const refresh = TokenStore.getRefresh();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    TokenStore.set(data.access, data.refresh /* present if rotation is on */);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Fetch wrapper that:
 *  - attaches the Bearer access token automatically
 *  - on a 401, tries a single silent token refresh + retry
 *  - redirects to the login page if that also fails
 *
 * @param {string} path - path relative to API_BASE, e.g. "/tasks/"
 * @param {object} options - standard fetch() options
 * @param {boolean} authRequired - if false, no auth header is required (e.g. login/register)
 */
async function apiFetch(path, options = {}, authRequired = true) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  );

  if (authRequired) {
    const token = TokenStore.getAccess();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401 && authRequired) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${TokenStore.getAccess()}`;
      response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } else {
      TokenStore.clear();
      window.location.href = "/";
      // Return a never-resolving promise-like object so callers stop here.
      return new Promise(() => {});
    }
  }

  return response;
}

/** Pull a readable error message out of a DRF error response body. */
function extractErrorMessage(errorData) {
  if (!errorData) return "Something went wrong. Please try again.";
  if (typeof errorData === "string") return errorData;
  if (errorData.detail) return errorData.detail;

  // DRF field errors look like {"field": ["msg1", "msg2"], ...}
  const parts = [];
  for (const [field, messages] of Object.entries(errorData)) {
    const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
    parts.push(field === "non_field_errors" ? msgs : `${field}: ${msgs}`);
  }
  return parts.join(" | ") || "Something went wrong. Please try again.";
}

/** Wire up the shared navbar (username + logout) on pages where the user is logged in. */
function initNavbar() {
  const usernameEl = document.getElementById("nav-username");
  const logoutBtn = document.getElementById("nav-logout-btn");
  if (!usernameEl || !logoutBtn) return;

  if (TokenStore.isLoggedIn()) {
    const username = localStorage.getItem("username");
    if (username) {
      usernameEl.textContent = `Signed in as ${username}`;
      usernameEl.classList.remove("d-none");
    }
    logoutBtn.classList.remove("d-none");
    logoutBtn.addEventListener("click", async () => {
      try {
        await apiFetch(
          "/auth/logout/",
          { method: "POST", body: JSON.stringify({ refresh: TokenStore.getRefresh() }) }
        );
      } catch (err) {
        /* even if the blacklist call fails, still clear local tokens */
      }
      TokenStore.clear();
      window.location.href = "/";
    });
  }
}

document.addEventListener("DOMContentLoaded", initNavbar);
