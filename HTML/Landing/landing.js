// ==============================
// SAFE ELEMENT SELECTORS
// ==============================
const SESSION_KEY = "gm_dental_current_user";

const API_BASE_URL =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "";

async function parseJsonResponse(response, endpointLabel = "request") {
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (!response.ok) {
      throw new Error(`Server error (HTTP ${response.status}). Please try again.`);
    }
    return {};
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    if (trimmed.startsWith("<")) {
      console.error(`Non-JSON response from ${endpointLabel}:`, trimmed.slice(0, 200));
      throw new Error(
        `The server didn't recognize "${endpointLabel}" (HTTP ${response.status}). ` +
        `Make sure the backend server is running and has been restarted with the latest code.`
      );
    }
    throw new Error(`Server returned an unexpected response (HTTP ${response.status}).`);
  }
}

// Only redirect if user came from login (not manual open)

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const verifyForm = document.getElementById("verifyForm");

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");
const showVerify = document.getElementById("showVerify");
const backToLoginAfterVerify = document.getElementById("backToLoginAfterVerify");

const loginRole = document.getElementById("loginRole");
const branchDiv = document.getElementById("branchDiv");

const registerFormElement = document.getElementById("registerFormElement");
const loginFormElement = document.getElementById("loginFormElement");

const themeToggle = document.getElementById("themeToggle");
const backToTop = document.getElementById("backToTop");
const serviceSearch = document.getElementById("serviceSearch");
let serviceItems = document.querySelectorAll(".service-item");
const noServiceMessage = document.getElementById("noServiceMessage");
const filterChips = document.querySelectorAll(".service-filter-chip");

const appToast = document.getElementById("appToast");
const appToastTitle = document.getElementById("appToastTitle");
const appToastMessage = document.getElementById("appToastMessage");
const appToastIcon = document.getElementById("appToastIcon");
const appToastClose = document.getElementById("appToastClose");

const navLinks = document.querySelectorAll(".navbar .nav-link");
const sections = document.querySelectorAll("section[id]");
let revealItems = document.querySelectorAll(".reveal-up");
const loginModal = document.getElementById("loginModal");
const faqItems = document.querySelectorAll(".faq-item");
const passwordToggles = document.querySelectorAll(".password-toggle");
const countUpItems = document.querySelectorAll(".count-up");
const scrollProgress = document.getElementById("scrollProgress");
const cursorGlow = document.getElementById("cursorGlow");
const navbar = document.getElementById("mainNavbar");
let tiltCards = document.querySelectorAll(".tilt-card, .magnetic-card, .hero-carousel-card");

const ADMIN_STORAGE_KEY = "dental-admin-ui-v3";
const CLINIC_DB_KEY = "gm_dental_db_v1";
const defaultLandingDentists = window.GMDefaultAccounts.merge([], "dentist");

function getStoredJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeLandingDentist(dentist = {}) {
  const name = String(dentist.name || dentist.dentist || "").trim();
  if (!name) return null;

  return {
    id: String(dentist.id || dentist.accountId || name).trim(),
    name,
    specialty: String(dentist.specialty || "General Dentist").trim(),
    archived: dentist.archived === true || String(dentist.archived || "").toLowerCase() === "true"
  };
}

function getLandingDentists() {
  const adminState = getStoredJson(ADMIN_STORAGE_KEY, {});
  const clinicDb = getStoredJson(CLINIC_DB_KEY, {});
  const source = Array.isArray(clinicDb?.dentists) && clinicDb.dentists.length
    ? clinicDb.dentists
    : Array.isArray(adminState?.dentists) && adminState.dentists.length
      ? adminState.dentists
      : defaultLandingDentists;

  const seen = new Set();
  return source
    .map(normalizeLandingDentist)
    .filter(Boolean)
    .filter(dentist => !dentist.archived)
    .filter(dentist => {
      const key = dentist.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderLandingDentists() {
  const grid = document.getElementById("landingDentistsGrid");
  if (!grid) return;

  const dentists = window.GMDefaultAccounts.merge(getLandingDentists(), "dentist");
  const items = dentists.length ? dentists : defaultLandingDentists;

  grid.innerHTML = items.map((dentist, index) => {
    const delayClass = index % 3 === 1 ? " delay-1" : index % 3 === 2 ? " delay-2" : "";
    return `
      <div class="col-md-6 col-lg-4 reveal-up active${delayClass}">
        <div class="card dentist-card text-center h-100 tilt-card">
          <div class="card-body">
            <div class="dentist-avatar"><i class="bi bi-person-circle dentist-icon"></i></div>
            <h5 class="mt-3">${escapeLandingHtml(dentist.name)}</h5>
            <p>${escapeLandingHtml(dentist.specialty || "General Dentist")}</p>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function escapeLandingHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderLandingDentists();
revealItems = document.querySelectorAll(".reveal-up");
tiltCards = document.querySelectorAll(".tilt-card, .magnetic-card, .hero-carousel-card");

window.addEventListener("storage", (event) => {
  if (![ADMIN_STORAGE_KEY, CLINIC_DB_KEY, "gm_dental_sync_stamp", "gm_dental_global_sync"].includes(event.key)) return;
  renderLandingDentists();
  revealItems = document.querySelectorAll(".reveal-up");
  tiltCards = document.querySelectorAll(".tilt-card, .magnetic-card, .hero-carousel-card");
});

const regPassword = document.getElementById("regPassword");
const regConfirmPassword = document.getElementById("regConfirmPassword");
const confirmPasswordError = document.getElementById("confirmPasswordError");
const regTerms = document.getElementById("regTerms");
const termsError = document.getElementById("termsError");
const registerBtn = document.getElementById("registerBtn");
const acceptTermsBtn = document.getElementById("acceptTermsBtn");
const termsModalEl = document.getElementById("termsModal");

const openTermsPanel = document.getElementById("openTermsPanel");
const closeTermsPanel = document.getElementById("closeTermsPanel");
const cancelTermsPanel = document.getElementById("cancelTermsPanel");
const termsPanelOverlay = document.getElementById("termsPanelOverlay");

let toastTimeout = null;
let activeFilter = "all";
let pendingVerificationEmail = "";

// ==============================
// TOAST
// ==============================
function showToast(type, title, message) {
  if (!appToast || !appToastTitle || !appToastMessage || !appToastIcon) return;

  appToast.classList.remove("success", "error", "info");
  appToast.classList.add(type, "show");

  appToastTitle.textContent = title;
  appToastMessage.textContent = message;

  if (type === "success") {
    appToastIcon.textContent = "✅";
  } else if (type === "error") {
    appToastIcon.textContent = "❌";
  } else {
    appToastIcon.textContent = "ℹ️";
  }

  if (toastTimeout) clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    appToast.classList.remove("show");
  }, 4200);
}

if (appToastClose) {
  appToastClose.addEventListener("click", () => {
    appToast.classList.remove("show");
    if (toastTimeout) clearTimeout(toastTimeout);
  });
}

// ==============================
// THEME / DARK MODE
// ==============================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  if (themeToggle) {
    themeToggle.innerHTML =
      theme === "dark"
        ? `<i class="bi bi-sun-fill"></i><span>Light Mode</span>`
        : `<i class="bi bi-moon-stars-fill"></i><span>Dark Mode</span>`;
  }

  localStorage.setItem("theme", theme);
}

(function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme("light");
  }
})();

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    applyTheme(currentTheme === "dark" ? "light" : "dark");
  });
}

// ==============================
// AUTH SLIDER SYSTEM
// ==============================
const authContainer = document.getElementById("authContainer");
const signInContainer = document.querySelector(".sign-in-container");
const signUpContainer = document.querySelector(".sign-up-container");

const showRegisterBtns = [
  document.getElementById("showRegisterOverlay"),
  document.getElementById("showRegisterMobile")
].filter(Boolean);

const showLoginBtns = [
  document.getElementById("showLoginOverlay"),
  document.getElementById("showLoginMobile"),
  document.getElementById("backToLoginAfterVerify")
].filter(Boolean);

let activeAuthMode = "login";
let authIsMobile = window.innerWidth <= 991;

function switchAuth(mode) {
  activeAuthMode = mode === "register" ? "register" : "login";
  mode = activeAuthMode;
  const isMobile = window.innerWidth <= 991;
  authIsMobile = isMobile;

  if (isMobile) {
    signInContainer?.classList.remove("active-mobile");
    signUpContainer?.classList.remove("active-mobile");

    if (mode === "register") {
      signUpContainer?.classList.add("active-mobile");
    } else {
      signInContainer?.classList.add("active-mobile");
    }
    return;
  }

  if (mode === "register") {
    authContainer?.classList.add("right-panel-active");
  } else {
    authContainer?.classList.remove("right-panel-active");
  }
}

showRegisterBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    switchAuth("register");
  });
});

showLoginBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (verifyForm) verifyForm.classList.add("d-none");
    switchAuth("login");
  });
});

window.addEventListener("load", () => {
  switchAuth(activeAuthMode);
});

window.addEventListener("resize", () => {
  // Mobile keyboards resize the viewport without changing the selected form.
  const isMobile = window.innerWidth <= 991;
  if (!authContainer || isMobile === authIsMobile) return;
  switchAuth(activeAuthMode);
});

const isiOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const authInputs = document.querySelectorAll("#loginModal input, #loginModal textarea, #loginModal select");

if (isiOSDevice && authInputs.length) {
  const keepFocusedInputVisible = (input) => {
    setTimeout(() => {
      input.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }, 120);
  };

  authInputs.forEach((input) => {
    input.addEventListener("focus", () => {
      document.body.classList.add("ios-auth-keyboard");
      keepFocusedInputVisible(input);
    });

    input.addEventListener("input", () => keepFocusedInputVisible(input));

    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (!document.querySelector("#loginModal input:focus, #loginModal textarea:focus, #loginModal select:focus")) {
          document.body.classList.remove("ios-auth-keyboard");
        }
      }, 80);
    });
  });
}

loginModal?.addEventListener("touchend", (event) => {
  const field = event.target.closest?.("input:not([type='hidden']):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])");
  if (!field) return;

  setTimeout(() => {
    try {
      field.focus({ preventScroll: true });
    } catch {
      field.focus();
    }
  }, 0);
}, { passive: true });

// ==============================
// OPTIONAL LOGIN ROLE LOGIC
// ==============================
if (loginRole && branchDiv) {
  loginRole.addEventListener("change", () => {
    branchDiv.style.display = loginRole.value === "admin" ? "block" : "none";
  });
}

function updateRegisterButtonState() {
  if (!registerBtn || !regTerms) return;
  const password = regPassword?.value || "";
  const strongPassword = password ? evaluatePasswordStrength(password).isStrong : false;
  registerBtn.disabled = !regTerms.checked || !strongPassword;
}

function showConfirmPasswordError(show) {
  if (!regConfirmPassword || !confirmPasswordError) return;

  regConfirmPassword.classList.toggle("input-error", show);
  confirmPasswordError.classList.toggle("d-none", !show);
}

function showTermsError(show) {
  if (!termsError) return;
  termsError.classList.toggle("d-none", !show);
}

function validateConfirmPassword() {
  if (!regPassword || !regConfirmPassword) return true;

  const password = regPassword.value;
  const confirmPassword = regConfirmPassword.value;

  if (!confirmPassword) {
    showConfirmPasswordError(false);
    return false;
  }

  const matched = password === confirmPassword;
  showConfirmPasswordError(!matched);
  return matched;
}

const passwordStrength = document.getElementById("passwordStrength");
const passwordStrengthFill = document.getElementById("passwordStrengthFill");
const passwordStrengthText = document.getElementById("passwordStrengthText");
const passwordRules = document.getElementById("passwordRules");

const PASSWORD_STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];

function evaluatePasswordStrength(password = "") {
  const checks = {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password)
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score, isStrong: score === 5 };
}

function renderStrengthInto(panelEl, fillEl, textEl, rulesEl, inputEl, password) {
  if (!panelEl) return { isStrong: false };

  if (!password) {
    panelEl.classList.add("d-none");
    inputEl?.classList.remove("input-error");
    return { isStrong: false };
  }

  panelEl.classList.remove("d-none");

  const { checks, score, isStrong } = evaluatePasswordStrength(password);

  if (fillEl) fillEl.className = `password-strength-fill s-${score}`;

  const label = panelEl.querySelector(".password-strength-label");
  if (label) label.className = `password-strength-label s-${score}`;
  if (textEl) textEl.textContent = PASSWORD_STRENGTH_LABELS[score] || "Weak";

  if (rulesEl) {
    rulesEl.querySelectorAll("li").forEach((li) => {
      const rule = li.getAttribute("data-rule");
      const ok = Boolean(checks[rule]);
      li.classList.toggle("ok", ok);
      const icon = li.querySelector("i");
      if (icon) icon.className = ok ? "bi bi-check-circle-fill" : "bi bi-x-circle";
    });
  }

  inputEl?.classList.toggle("input-error", !isStrong);

  return { isStrong };
}

function renderPasswordStrength(password) {
  return renderStrengthInto(
    passwordStrength,
    passwordStrengthFill,
    passwordStrengthText,
    passwordRules,
    regPassword,
    password
  );
}

if (regPassword && regConfirmPassword) {
  regPassword.addEventListener("input", () => {
    renderPasswordStrength(regPassword.value);
    validateConfirmPassword();
    updateRegisterButtonState();
  });
  regPassword.addEventListener("focus", () => {
    if (regPassword.value) renderPasswordStrength(regPassword.value);
  });
  regConfirmPassword.addEventListener("input", () => {
    validateConfirmPassword();
    updateRegisterButtonState();
  });
}

if (regTerms) {
  regTerms.addEventListener("change", () => {
    updateRegisterButtonState();
    if (regTerms.checked) {
      showTermsError(false);
    }
  });
}

window.addEventListener("load", updateRegisterButtonState);

// ==============================
// REGISTER FORM SUBMIT
// ==============================
if (registerFormElement) {
  registerFormElement.addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitBtn = this.querySelector('button[type="submit"]');
    if (!this.reportValidity()) return;

    const userData = {
      name: document.getElementById("regName")?.value.trim(),
      email: document.getElementById("regEmail")?.value.trim(),
      password: document.getElementById("regPassword")?.value,
      sex: document.getElementById("regSex")?.value,
      dob: document.getElementById("regDOB")?.value,
      mobile: document.getElementById("regMobile")?.value.trim(),
      address: document.getElementById("regAddress")?.value.trim(),
    };

    const confirmPassword = document.getElementById("regConfirmPassword")?.value;

    if (!userData.name || !userData.email || !userData.password || !confirmPassword || !userData.mobile) {
      showToast("error", "Missing Information", "Please fill in all required fields before registering.");
      validateConfirmPassword();
      if (!regTerms?.checked) showTermsError(true);
      return;
    }

    const strength = evaluatePasswordStrength(userData.password);
    if (!strength.isStrong) {
      renderPasswordStrength(userData.password);
      showToast(
        "error",
        "Weak Password",
        "Use at least 8 characters with uppercase, lowercase, a number, and a special character."
      );
      regPassword?.focus();
      return;
    }

    if (!validateConfirmPassword()) {
      showToast("error", "Password Mismatch", "Password and confirm password do not match.");
      return;
    }

    if (!regTerms?.checked) {
      showTermsError(true);
      showToast("error", "Terms Required", "Please agree to the Terms and Conditions before registering.");
      updateRegisterButtonState();
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Registering...";
      }

      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(userData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Registration failed.");
      }

      showConfirmPasswordError(false);
      showTermsError(false);

      openOtpPanel(userData.email);
      showToast("info", "Verification Code Sent", "We emailed you a 6-digit code. Enter it below to verify your account.");

    } catch (error) {
      console.error("Registration error:", error);
      showToast("error", "Registration Failed", error.message || "Registration failed. Please try again.");
    } finally {
      if (submitBtn) {
        submitBtn.textContent = "Register";
        updateRegisterButtonState();
      }
    }
  });
}

// ==============================
// LOGIN FORM SUBMIT
// ==============================
if (loginFormElement) {
  loginFormElement.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail")?.value.trim().toLowerCase();
    const password = document.getElementById("loginPassword")?.value;

    if (!email || !password) {
      showToast("error", "Login Required", "Please enter your email and password.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }

      if (!result.user) {
        throw new Error("No user data returned from server.");
      }

      const safeUser = {
        sessionToken: result.sessionToken || "",
        id: result.user.id || "",
        name: result.user.name || "",
        email: (result.user.email || email).toLowerCase(),
        role: result.user.role || "patient",
        sex: result.user.sex || "",
        dob: result.user.dob || "",
        mobile: result.user.mobile || "",
        address: result.user.address || "",
        condition: result.user.condition || ""
      };

      if (!["admin", "dentist", "patient", "staff"].includes(safeUser.role)) {
        throw new Error("Invalid role returned from server.");
      }

      sessionStorage.setItem("gm_dental_current_user", JSON.stringify(safeUser));
      sessionStorage.setItem("gm_dental_session_lock", JSON.stringify({
        email: safeUser.email,
        role: safeUser.role
      }));

      showToast("success", "Login Successful", `Welcome back, ${safeUser.name || safeUser.email}!`);

      setTimeout(() => {
        if (safeUser.role === "admin") {
          window.location.replace("../Admin/admin.html");
        } else if (safeUser.role === "dentist") {
          window.location.replace("../Dentist/dentist_page.html");
        } else if (safeUser.role === "staff") {
          window.location.replace("../Staff/staff.html");
        } else {
          window.location.replace("../Patient/patient.html");
        }
      }, 700);

    } catch (error) {
      console.error("Login error:", error);
      showToast("error", "Login Failed", error.message || "Login failed. Please try again.");
    }
  });
}

// ==============================
// PASSWORD TOGGLE
// ==============================
passwordToggles.forEach((btn) => {
  const targetId = btn.getAttribute("data-target");
  const input = document.getElementById(targetId);
  const icon = btn.querySelector("i");

  if (!input || !icon) return;

  function syncPasswordIcon() {
    if (input.type === "password") {
      icon.className = "bi bi-eye-slash";
    } else {
      icon.className = "bi bi-eye";
    }
  }

  syncPasswordIcon();

  btn.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    syncPasswordIcon();
  });
});

function openTermsOverlay() {
  if (!termsPanelOverlay) return;
  termsPanelOverlay.classList.remove("d-none");
  document.body.style.overflow = "hidden";
}

function closeTermsOverlay() {
  if (!termsPanelOverlay) return;
  termsPanelOverlay.classList.add("d-none");
  document.body.style.overflow = "";
}

if (openTermsPanel) {
  openTermsPanel.addEventListener("click", (e) => {
    e.preventDefault();
    openTermsOverlay();
  });
}

if (closeTermsPanel) {
  closeTermsPanel.addEventListener("click", closeTermsOverlay);
}

if (cancelTermsPanel) {
  cancelTermsPanel.addEventListener("click", closeTermsOverlay);
}

if (termsPanelOverlay) {
  termsPanelOverlay.addEventListener("click", (e) => {
    if (e.target === termsPanelOverlay) {
      closeTermsOverlay();
    }
  });
}

if (acceptTermsBtn && regTerms) {
  acceptTermsBtn.addEventListener("click", () => {
    regTerms.checked = true;
    updateRegisterButtonState();
    showTermsError(false);
    closeTermsOverlay();
  });
}

// ==============================
// SERVICE FILTER + SEARCH
// ==============================
function filterServices() {
  const searchValue = (serviceSearch?.value || "").toLowerCase().trim();
  let visibleCount = 0;

  serviceItems.forEach((item) => {
    const text = `${item.dataset.search || ''} ${item.textContent}`.toLowerCase();
    const category = item.getAttribute("data-category");
    const matchesSearch = text.includes(searchValue);
    const matchesCategory = activeFilter === "all" || category === activeFilter;
    const matched = matchesSearch && matchesCategory;

    item.style.display = matched ? "" : "none";
    if (matched) visibleCount++;
  });

  if (noServiceMessage) {
    noServiceMessage.classList.toggle("d-none", visibleCount !== 0);
  }
}

if (serviceSearch) {
  serviceSearch.addEventListener("input", filterServices);
}

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((btn) => btn.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.getAttribute("data-filter") || "all";
    filterServices();
  });
});

// ==============================
// BACK TO TOP + SCROLL PROGRESS + NAVBAR
// ==============================
function handleScrollEffects() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

  if (scrollProgress) {
    scrollProgress.style.width = `${progress}%`;
  }

  if (backToTop) {
    if (scrollTop > 400) {
      backToTop.style.display = "grid";
      backToTop.style.placeItems = "center";
    } else {
      backToTop.style.display = "none";
    }
  }

  if (navbar) {
    navbar.classList.toggle("navbar-scrolled", scrollTop > 15);
  }

  updateActiveNav();
}

window.addEventListener("scroll", handleScrollEffects);

if (backToTop) {
  backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}

// ==============================
// NAV ACTIVE LINK ON SCROLL
// ==============================
function updateActiveNav() {
  if (document.body.dataset.landingPage) {
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === document.body.dataset.landingPage));
    return;
  }
  let current = "";

  sections.forEach((section) => {
    const sectionTop = section.offsetTop - 140;
    const sectionHeight = section.offsetHeight;

    if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
      current = section.getAttribute("id");
    }
  });

  navLinks.forEach((link) => {
    link.classList.remove("active");
    const href = link.getAttribute("href");
    if (href === `#${current}`) {
      link.classList.add("active");
    }
  });
}

window.addEventListener("load", handleScrollEffects);

// ==============================
// REVEAL ON SCROLL
// ==============================
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
    }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("active"));
}

// ==============================
// COUNT-UP ANIMATION
// ==============================
function animateCounter(card) {
  const heading = card.querySelector("h3");
  if (!heading) return;

  const target = Number(card.getAttribute("data-target"));
  if (!target || Number.isNaN(target)) return;

  let current = 0;
  const duration = 1200;
  const steps = 40;
  const increment = target / steps;
  const intervalTime = duration / steps;

  const counter = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(counter);
    }
    heading.textContent = `${Math.round(current)}+`;
  }, intervalTime);
}

if ("IntersectionObserver" in window && countUpItems.length) {
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  countUpItems.forEach((item) => countObserver.observe(item));
}

// ==============================
// FAQ
// ==============================
faqItems.forEach((item) => {
  const question = item.querySelector(".faq-question");
  if (!question) return;

  question.addEventListener("click", () => {
    const isActive = item.classList.contains("active");

    faqItems.forEach((faq) => faq.classList.remove("active"));

    if (!isActive) {
      item.classList.add("active");
    }
  });
});

// ==============================
// RESET MODAL STATE WHEN CLOSED
// ==============================
if (loginModal) {
  loginModal.addEventListener("hidden.bs.modal", () => {
    switchAuth("login");

    if (registerFormElement) registerFormElement.reset();
    if (loginFormElement) loginFormElement.reset();

    if (typeof showConfirmPasswordError === "function") {
      showConfirmPasswordError(false);
    }

    if (typeof showTermsError === "function") {
      showTermsError(false);
    }

    if (typeof updateRegisterButtonState === "function") {
      updateRegisterButtonState();
    }

    if (typeof closeTermsOverlay === "function") {
      closeTermsOverlay();
    }

    const confirmInput = document.getElementById("regConfirmPassword");
    if (confirmInput) {
      confirmInput.classList.remove("input-error");
    }

    if (verifyForm) verifyForm.classList.add("d-none");
    pendingVerificationEmail = "";
    if (typeof clearOtpInputs === "function") clearOtpInputs();
    if (typeof showOtpError === "function") showOtpError("");

    if (typeof renderPasswordStrength === "function") {
      renderPasswordStrength("");
    }

    if (typeof closeForgotPasswordCard === "function") {
      closeForgotPasswordCard();
    }
  });
}

// ==============================
// OTP VERIFICATION
// ==============================
const otpForm = document.getElementById("otpForm");
const otpInputs = document.querySelectorAll(".otp-digit");
const otpEmailLabel = document.getElementById("otpEmailLabel");
const otpError = document.getElementById("otpError");
const otpErrorText = document.getElementById("otpErrorText");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const resendOtpBtn = document.getElementById("resendOtpBtn");

function showOtpError(message) {
  if (!otpError) return;
  if (message && otpErrorText) otpErrorText.textContent = message;
  otpError.classList.toggle("d-none", !message);
}

function clearOtpInputs() {
  otpInputs.forEach((input) => {
    input.value = "";
    input.classList.remove("is-filled");
  });
}

function readOtpValue() {
  return Array.from(otpInputs).map((input) => input.value.trim()).join("");
}

function openOtpPanel(email) {
  pendingVerificationEmail = String(email || "").toLowerCase();
  if (otpEmailLabel) {
    otpEmailLabel.textContent = pendingVerificationEmail || "your email";
  }
  clearOtpInputs();
  showOtpError("");
  if (verifyForm) verifyForm.classList.remove("d-none");
  setTimeout(() => otpInputs[0]?.focus(), 60);
}

function closeOtpPanel() {
  if (verifyForm) verifyForm.classList.add("d-none");
  clearOtpInputs();
  showOtpError("");
}

otpInputs.forEach((input, index) => {
  input.addEventListener("input", (e) => {
    const cleaned = e.target.value.replace(/\D/g, "");
    e.target.value = cleaned.slice(-1);
    e.target.classList.toggle("is-filled", Boolean(e.target.value));
    showOtpError("");

    if (e.target.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !e.target.value && index > 0) {
      otpInputs[index - 1].focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      otpInputs[index - 1].focus();
    }
    if (e.key === "ArrowRight" && index < otpInputs.length - 1) {
      e.preventDefault();
      otpInputs[index + 1].focus();
    }
  });

  input.addEventListener("paste", (e) => {
    const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    const digits = pasted.replace(/\D/g, "").slice(0, otpInputs.length);
    if (!digits) return;
    e.preventDefault();
    digits.split("").forEach((digit, i) => {
      if (otpInputs[i]) {
        otpInputs[i].value = digit;
        otpInputs[i].classList.add("is-filled");
      }
    });
    const nextIndex = Math.min(digits.length, otpInputs.length - 1);
    otpInputs[nextIndex]?.focus();
    showOtpError("");
  });
});

if (otpForm) {
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const otp = readOtpValue();

    if (!pendingVerificationEmail) {
      showOtpError("Please register first to receive a code.");
      return;
    }

    if (otp.length !== 6) {
      showOtpError("Please enter all 6 digits of the code.");
      return;
    }

    if (verifyOtpBtn) {
      verifyOtpBtn.disabled = true;
      verifyOtpBtn.textContent = "Verifying...";
    }

    try {
      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingVerificationEmail, otp })
      });

      const result = await response.json();

      if (!response.ok || !result.verified) {
        throw new Error(result.message || "Invalid verification code.");
      }

      showToast("success", "Email Verified", `${pendingVerificationEmail} is now registered and ready to use.`);
      showVerifyToast(pendingVerificationEmail);

      const verifiedEmail = pendingVerificationEmail;
      pendingVerificationEmail = "";
      closeOtpPanel();
      switchAuth("login");

      const loginEmail = document.getElementById("loginEmail");
      if (loginEmail) loginEmail.value = verifiedEmail;
    } catch (error) {
      console.error("OTP verification error:", error);
      showOtpError(error.message || "Invalid verification code.");
    } finally {
      if (verifyOtpBtn) {
        verifyOtpBtn.disabled = false;
        verifyOtpBtn.textContent = "Verify Account";
      }
    }
  });
}

if (resendOtpBtn) {
  resendOtpBtn.addEventListener("click", async () => {
    if (!pendingVerificationEmail) {
      showOtpError("Please complete the registration form first.");
      return;
    }

    const regName = document.getElementById("regName")?.value.trim();
    const regEmail = document.getElementById("regEmail")?.value.trim().toLowerCase();
    const regPasswordVal = document.getElementById("regPassword")?.value;
    const regMobileVal = document.getElementById("regMobile")?.value.trim();

    if (!regName || !regEmail || !regPasswordVal || !regMobileVal) {
      showToast("info", "Resend Code", "Please open the registration form and submit again to receive a new code.");
      return;
    }

    resendOtpBtn.disabled = true;
    const originalText = resendOtpBtn.textContent;
    resendOtpBtn.textContent = "Sending...";

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPasswordVal,
          sex: document.getElementById("regSex")?.value,
          dob: document.getElementById("regDOB")?.value,
          mobile: regMobileVal,
          address: document.getElementById("regAddress")?.value.trim()
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not resend code.");

      pendingVerificationEmail = regEmail;
      clearOtpInputs();
      showOtpError("");
      showToast("info", "Code Sent", "A new verification code has been emailed to you.");
    } catch (error) {
      console.error("Resend OTP error:", error);
      showToast("error", "Resend Failed", error.message || "Could not resend the verification code.");
    } finally {
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = originalText;
    }
  });
}

// ==============================
// FORGOT PASSWORD
// ==============================
const forgotPasswordCard = document.getElementById("forgotPasswordCard");
const forgotStepEmail = document.getElementById("forgotStepEmail");
const forgotStepReset = document.getElementById("forgotStepReset");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const forgotEmailForm = document.getElementById("forgotEmailForm");
const forgotEmailInput = document.getElementById("forgotEmailInput");
const forgotEmailError = document.getElementById("forgotEmailError");
const forgotEmailErrorText = document.getElementById("forgotEmailErrorText");
const sendResetCodeBtn = document.getElementById("sendResetCodeBtn");
const forgotEmailLabel = document.getElementById("forgotEmailLabel");
const resetOtpInputs = document.querySelectorAll("#resetOtpInputs .otp-digit");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetNewPassword = document.getElementById("resetNewPassword");
const resetConfirmPassword = document.getElementById("resetConfirmPassword");
const resetPasswordStrength = document.getElementById("resetPasswordStrength");
const resetPasswordStrengthFill = document.getElementById("resetPasswordStrengthFill");
const resetPasswordStrengthText = document.getElementById("resetPasswordStrengthText");
const resetPasswordRules = document.getElementById("resetPasswordRules");
const resetError = document.getElementById("resetError");
const resetErrorText = document.getElementById("resetErrorText");
const confirmResetBtn = document.getElementById("confirmResetBtn");
const resendResetCodeBtn = document.getElementById("resendResetCodeBtn");
const forgotCancelBtns = document.querySelectorAll("[data-forgot-cancel]");

let forgotResetEmail = "";

function showForgotEmailError(message) {
  if (!forgotEmailError) return;
  if (message && forgotEmailErrorText) forgotEmailErrorText.textContent = message;
  forgotEmailError.classList.toggle("d-none", !message);
}

function showResetError(message) {
  if (!resetError) return;
  if (message && resetErrorText) resetErrorText.textContent = message;
  resetError.classList.toggle("d-none", !message);
}

function clearResetOtpInputs() {
  resetOtpInputs.forEach((input) => {
    input.value = "";
    input.classList.remove("is-filled");
  });
}

function readResetOtpValue() {
  return Array.from(resetOtpInputs).map((i) => i.value.trim()).join("");
}

function openForgotPasswordCard() {
  if (!forgotPasswordCard) return;
  forgotPasswordCard.classList.remove("d-none");
  forgotStepEmail?.classList.remove("d-none");
  forgotStepReset?.classList.add("d-none");
  showForgotEmailError("");
  showResetError("");
  clearResetOtpInputs();
  if (resetNewPassword) resetNewPassword.value = "";
  if (resetConfirmPassword) resetConfirmPassword.value = "";
  renderStrengthInto(resetPasswordStrength, resetPasswordStrengthFill, resetPasswordStrengthText, resetPasswordRules, resetNewPassword, "");
  setTimeout(() => forgotEmailInput?.focus(), 60);
}

function closeForgotPasswordCard() {
  if (!forgotPasswordCard) return;
  forgotPasswordCard.classList.add("d-none");
  forgotStepEmail?.classList.remove("d-none");
  forgotStepReset?.classList.add("d-none");
  showForgotEmailError("");
  showResetError("");
  clearResetOtpInputs();
  if (forgotEmailInput) forgotEmailInput.value = "";
  if (resetNewPassword) resetNewPassword.value = "";
  if (resetConfirmPassword) resetConfirmPassword.value = "";
  renderStrengthInto(resetPasswordStrength, resetPasswordStrengthFill, resetPasswordStrengthText, resetPasswordRules, resetNewPassword, "");
  forgotResetEmail = "";
}

function goToForgotResetStep(email) {
  forgotResetEmail = String(email || "").toLowerCase();
  if (forgotEmailLabel) forgotEmailLabel.textContent = forgotResetEmail || "your email";
  forgotStepEmail?.classList.add("d-none");
  forgotStepReset?.classList.remove("d-none");
  setTimeout(() => resetOtpInputs[0]?.focus(), 60);
}

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    const loginEmail = document.getElementById("loginEmail")?.value.trim();
    if (loginEmail && forgotEmailInput) forgotEmailInput.value = loginEmail;
    openForgotPasswordCard();
  });
}

forgotCancelBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    closeForgotPasswordCard();
  });
});

async function requestPasswordResetCode(email) {
  const response = await fetch(`${API_BASE_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const result = await parseJsonResponse(response, "/forgot-password");
  if (!response.ok) throw new Error(result.message || "Could not send reset code.");
  return result;
}

if (forgotEmailForm) {
  forgotEmailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = forgotEmailInput?.value.trim().toLowerCase() || "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showForgotEmailError("Please enter a valid email address.");
      return;
    }

    showForgotEmailError("");
    if (sendResetCodeBtn) {
      sendResetCodeBtn.disabled = true;
      sendResetCodeBtn.textContent = "Sending...";
    }

    try {
      await requestPasswordResetCode(email);
      showToast("info", "Reset Code Sent", "If an account exists with this email, a 6-digit code was sent.");
      goToForgotResetStep(email);
    } catch (error) {
      console.error("Forgot password error:", error);
      showForgotEmailError(error.message || "Could not send reset code.");
    } finally {
      if (sendResetCodeBtn) {
        sendResetCodeBtn.disabled = false;
        sendResetCodeBtn.textContent = "Send Reset Code";
      }
    }
  });
}

resetOtpInputs.forEach((input, index) => {
  input.addEventListener("input", (e) => {
    const cleaned = e.target.value.replace(/\D/g, "");
    e.target.value = cleaned.slice(-1);
    e.target.classList.toggle("is-filled", Boolean(e.target.value));
    showResetError("");
    if (e.target.value && index < resetOtpInputs.length - 1) {
      resetOtpInputs[index + 1].focus();
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !e.target.value && index > 0) {
      resetOtpInputs[index - 1].focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      resetOtpInputs[index - 1].focus();
    }
    if (e.key === "ArrowRight" && index < resetOtpInputs.length - 1) {
      e.preventDefault();
      resetOtpInputs[index + 1].focus();
    }
  });
  input.addEventListener("paste", (e) => {
    const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    const digits = pasted.replace(/\D/g, "").slice(0, resetOtpInputs.length);
    if (!digits) return;
    e.preventDefault();
    digits.split("").forEach((digit, i) => {
      if (resetOtpInputs[i]) {
        resetOtpInputs[i].value = digit;
        resetOtpInputs[i].classList.add("is-filled");
      }
    });
    const nextIndex = Math.min(digits.length, resetOtpInputs.length - 1);
    resetOtpInputs[nextIndex]?.focus();
    showResetError("");
  });
});

if (resetNewPassword) {
  resetNewPassword.addEventListener("input", () => {
    renderStrengthInto(resetPasswordStrength, resetPasswordStrengthFill, resetPasswordStrengthText, resetPasswordRules, resetNewPassword, resetNewPassword.value);
    showResetError("");
  });
}

if (resetConfirmPassword) {
  resetConfirmPassword.addEventListener("input", () => showResetError(""));
}

if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!forgotResetEmail) {
      showResetError("Please request a reset code first.");
      return;
    }

    const otp = readResetOtpValue();
    const newPassword = resetNewPassword?.value || "";
    const confirmPassword = resetConfirmPassword?.value || "";

    if (otp.length !== 6) {
      showResetError("Please enter all 6 digits of the code.");
      return;
    }

    if (!evaluatePasswordStrength(newPassword).isStrong) {
      showResetError("Use at least 8 characters with uppercase, lowercase, a number, and a special character.");
      renderStrengthInto(resetPasswordStrength, resetPasswordStrengthFill, resetPasswordStrengthText, resetPasswordRules, resetNewPassword, newPassword);
      return;
    }

    if (newPassword !== confirmPassword) {
      showResetError("Passwords do not match.");
      return;
    }

    if (confirmResetBtn) {
      confirmResetBtn.disabled = true;
      confirmResetBtn.textContent = "Resetting...";
    }

    try {
      const response = await fetch(`${API_BASE_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotResetEmail, otp, newPassword })
      });
      const result = await parseJsonResponse(response, "/reset-password");
      if (!response.ok) throw new Error(result.message || "Could not reset password.");

      const verifiedEmail = forgotResetEmail;
      showToast("success", "Password Reset", "Your password has been updated. Please log in.");
      closeForgotPasswordCard();
      switchAuth("login");
      const loginEmail = document.getElementById("loginEmail");
      if (loginEmail) loginEmail.value = verifiedEmail;
      const loginPassword = document.getElementById("loginPassword");
      if (loginPassword) {
        loginPassword.value = "";
        setTimeout(() => loginPassword.focus(), 60);
      }
    } catch (error) {
      console.error("Reset password error:", error);
      showResetError(error.message || "Could not reset password.");
    } finally {
      if (confirmResetBtn) {
        confirmResetBtn.disabled = false;
        confirmResetBtn.textContent = "Reset Password";
      }
    }
  });
}

if (resendResetCodeBtn) {
  resendResetCodeBtn.addEventListener("click", async () => {
    if (!forgotResetEmail) {
      showResetError("Please request a reset code first.");
      return;
    }
    resendResetCodeBtn.disabled = true;
    const originalText = resendResetCodeBtn.textContent;
    resendResetCodeBtn.textContent = "Sending...";
    try {
      await requestPasswordResetCode(forgotResetEmail);
      clearResetOtpInputs();
      showResetError("");
      showToast("info", "Code Sent", "A new reset code has been emailed to you.");
    } catch (error) {
      console.error("Resend reset code error:", error);
      showResetError(error.message || "Could not resend the reset code.");
    } finally {
      resendResetCodeBtn.disabled = false;
      resendResetCodeBtn.textContent = originalText;
    }
  });
}

function showVerifyToast(email) {
  const toast = document.getElementById("verifyToast");
  const text = document.getElementById("verifyEmailText");

  if (!toast || !text) return;

  text.textContent = email + " is now registered.";
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// ==============================
// CURSOR GLOW
// ==============================
if (cursorGlow) {
  window.addEventListener("mousemove", (e) => {
    cursorGlow.style.left = `${e.clientX}px`;
    cursorGlow.style.top = `${e.clientY}px`;
  });
}

// ==============================
// TILT EFFECT (SMOOTHER)
// ==============================
tiltCards.forEach((card) => {
  card.style.transition = "transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.65s cubic-bezier(0.22, 1, 0.36, 1)";

  card.addEventListener("mousemove", (e) => {
    if (window.innerWidth < 992) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -2.2;
    const rotateY = ((x - centerX) / centerX) * 2.2;

    card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px) scale(1.01)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
  });
});

// ==============================
// CLOSE MOBILE NAV ON LINK CLICK
// ==============================
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const navCollapse = document.getElementById("navbarNav");
    if (!navCollapse || typeof bootstrap === "undefined") return;

    if (navCollapse.classList.contains("show")) {
      const bsCollapse = bootstrap.Collapse.getInstance(navCollapse) || new bootstrap.Collapse(navCollapse, { toggle: false });
      bsCollapse.hide();
    }
  });
});

// ==============================
// PREMIUM INTERACTIONS
// ==============================

// NAVBAR SCROLL EFFECT
window.addEventListener("scroll", () => {
  const navbarEl = document.querySelector(".custom-navbar");
  if (!navbarEl) return;

  if (window.scrollY > 50) {
    navbarEl.classList.add("scrolled");
  } else {
    navbarEl.classList.remove("scrolled");
  }
});

// HERO PARALLAX EFFECT
window.addEventListener("scroll", () => {
  const hero = document.querySelector(".hero-section");
  if (!hero) return;

  let offset = window.scrollY * 0.3;
  hero.style.backgroundPosition = `center ${offset}px`;
});

// MAGNETIC HOVER EFFECT (CARDS)
const magneticItems = document.querySelectorAll(".service-card, .choose-card, .dentist-card, .process-card, .contact-card, .mini-feature-card");

magneticItems.forEach((item) => {
  item.addEventListener("mousemove", (e) => {
    if (window.innerWidth < 992) return;

    const rect = item.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const moveX = (x - rect.width / 2) * 0.015;
    const moveY = (y - rect.height / 2) * 0.015;

    item.style.transform = `translate3d(${moveX}px, ${moveY - 8}px, 0)`;
  });

  item.addEventListener("mouseleave", () => {
    item.style.transform = "";
  });
});

document.addEventListener("mousemove", (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 10;
  const y = (e.clientY / window.innerHeight - 0.5) * 10;

  document.querySelectorAll(".hero-carousel-card").forEach((el) => {
    el.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  });
});
