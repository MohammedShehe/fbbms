// js/login.js
import { AuthAPI } from './api.js';
import { fbGetSession, fbSetSession, fbSetToken } from './utils.js';

document.getElementById("yearNow").textContent = new Date().getFullYear();

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const errorBox = document.getElementById("loginError");
const errorText = document.getElementById("loginErrorText");
const togglePass = document.getElementById("togglePass");
const pwField = document.getElementById("loginPassword");

togglePass.addEventListener("click", () => {
    const isPass = pwField.type === "password";
    pwField.type = isPass ? "text" : "password";
    togglePass.innerHTML = `<i class="bi ${isPass ? "bi-eye-slash" : "bi-eye"}"></i>`;
});

function showLoginError(msg) {
    errorText.textContent = msg;
    errorBox.classList.add("show");
}

function hideLoginError() {
    errorBox.classList.remove("show");
}

const FB_ROLE_PAGES = {
    sports_manager: "sports-dashboard.html",
    scents_manager: "scents-dashboard.html",
    super_manager: "super-dashboard.html"
};

// Redirect if already logged in
(function redirectIfLoggedIn() {
    const session = fbGetSession();
    if (session && FB_ROLE_PAGES[session.role]) {
        window.location.href = FB_ROLE_PAGES[session.role];
    }
})();

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideLoginError();

    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    loginBtn.classList.add("loading");
    loginBtn.disabled = true;

    try {
        if (email === 'manager@fourbrothers.online') {
            await AuthAPI.sendOTP(email, password);
            sessionStorage.setItem("fbbms_pending_login", JSON.stringify({ email, role: 'super_manager' }));
            window.location.href = "otp.html";
            return;
        }

        const result = await AuthAPI.login(email, password);
        fbSetToken(result.token);
        fbSetSession({ 
            email: result.email, 
            role: result.role,
            loggedInAt: new Date().toISOString()
        });
        
        if (FB_ROLE_PAGES[result.role]) {
            window.location.href = FB_ROLE_PAGES[result.role];
        } else {
            showLoginError("Unknown role. Please contact support.");
        }

    } catch (error) {
        showLoginError(error.message || "Invalid email or password. Please try again.");
    } finally {
        loginBtn.classList.remove("loading");
        loginBtn.disabled = false;
    }
});