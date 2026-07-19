/**
 * auth.js - handles the login and register forms on the landing page.
 */

document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, skip straight to the dashboard.
  if (TokenStore.isLoggedIn()) {
    window.location.href = "/dashboard/";
    return;
  }

  const alertBox = document.getElementById("auth-alert");

  function showError(message) {
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
  }

  function hideError() {
    alertBox.classList.add("d-none");
  }

  function setLoading(buttonId, spinnerId, isLoading) {
    document.getElementById(buttonId).disabled = isLoading;
    document.getElementById(spinnerId).classList.toggle("d-none", !isLoading);
  }

  // ---------------- LOGIN ----------------
  const loginForm = document.getElementById("login-form");
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    setLoading("login-submit", "login-spinner", true);

    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const res = await apiFetch(
        "/auth/login/",
        { method: "POST", body: JSON.stringify({ username, password }) },
        false
      );
      const data = await res.json();

      if (!res.ok) {
        showError(extractErrorMessage(data) || "Invalid username or password.");
        return;
      }

      TokenStore.set(data.access, data.refresh);
      localStorage.setItem("username", username);
      window.location.href = "/dashboard/";
    } catch (err) {
      showError("Could not reach the server. Please try again.");
    } finally {
      setLoading("login-submit", "login-spinner", false);
    }
  });

  // ---------------- REGISTER ----------------
  const registerForm = document.getElementById("register-form");
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    setLoading("register-submit", "register-spinner", true);

    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const password2 = document.getElementById("reg-password2").value;

    try {
      const res = await apiFetch(
        "/auth/register/",
        { method: "POST", body: JSON.stringify({ username, email, password, password2 }) },
        false
      );
      const data = await res.json();

      if (!res.ok) {
        showError(extractErrorMessage(data));
        return;
      }

      // Auto-login right after successful registration.
      const loginRes = await apiFetch(
        "/auth/login/",
        { method: "POST", body: JSON.stringify({ username, password }) },
        false
      );
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        TokenStore.set(loginData.access, loginData.refresh);
        localStorage.setItem("username", username);
        window.location.href = "/dashboard/";
      } else {
        // Registration worked but auto-login didn't; send them to the login tab.
        document.getElementById("login-tab").click();
        showError("Account created. Please log in.");
      }
    } catch (err) {
      showError("Could not reach the server. Please try again.");
    } finally {
      setLoading("register-submit", "register-spinner", false);
    }
  });
});
