import { AuthAPI } from './api.js';
import { fbSetSession, fbSetToken, fbToast } from './utils.js';

const pending = JSON.parse(sessionStorage.getItem("fbbms_pending_login") || "null");

if (!pending) {
    window.location.href = "index.html";
}

document.getElementById("otpTargetEmail").textContent = pending.email;

const inputs = [...document.querySelectorAll("#otpInputs input")];
const errorBox = document.getElementById("otpError");
const errorText = document.getElementById("otpErrorText");
const verifyBtn = document.getElementById("otpVerifyBtn");
const resendBtn = document.getElementById("otpResendBtn");
const countdownEl = document.getElementById("otpCountdown");

inputs[0].focus();

inputs.forEach((inp, idx) => {
    inp.addEventListener("input", () => {
        inp.value = inp.value.replace(/[^0-9]/g, "");
        if (inp.value) {
            inp.classList.add("filled");
            if (idx < inputs.length - 1) inputs[idx + 1].focus();
        } else {
            inp.classList.remove("filled");
        }
    });
    
    inp.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !inp.value && idx > 0) {
            inputs[idx - 1].focus();
        }
    });
    
    inp.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "").slice(0, 6);
        text.split("").forEach((ch, i) => {
            if (inputs[i]) {
                inputs[i].value = ch;
                inputs[i].classList.add("filled");
            }
        });
        if (text.length) inputs[Math.min(text.length, inputs.length) - 1].focus();
    });
});

function hideError() { errorBox.classList.remove("show"); }
function showError(msg) { errorText.textContent = msg; errorBox.classList.add("show"); }

let secondsLeft = 600;
let countdownInterval;

function tickCountdown() {
    const m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const s = String(secondsLeft % 60).padStart(2, "0");
    countdownEl.textContent = `${m}:${s}`;
    if (secondsLeft <= 0) {
        clearInterval(countdownInterval);
        resendBtn.disabled = false;
        countdownEl.parentElement.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Code expired — request a new one`;
    }
    secondsLeft--;
}

function startCountdown() {
    secondsLeft = 600;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(tickCountdown, 1000);
    tickCountdown(); // Immediate update
}

startCountdown();

// Resend code with loading state
resendBtn.addEventListener("click", async () => {
    // Disable button and show loading state
    resendBtn.disabled = true;
    const originalText = resendBtn.textContent;
    resendBtn.innerHTML = '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:middle;margin-right:8px;"></span> Sending...';
    
    try {
        await AuthAPI.sendOTP(pending.email, 'Fourbrothers@2026');
        startCountdown();
        inputs.forEach(i => { i.value = ""; i.classList.remove("filled"); });
        inputs[0].focus();
        hideError();
        fbToast("A new verification code has been sent.", "success");
        resendBtn.innerHTML = originalText;
        resendBtn.disabled = false;
    } catch (error) {
        showError("Failed to send OTP. Please try again.");
        resendBtn.innerHTML = originalText;
        resendBtn.disabled = false;
    }
});

verifyBtn.addEventListener("click", async () => {
    hideError();
    const code = inputs.map(i => i.value).join("");
    
    if (code.length < 6) {
        showError("Please enter the full 6-digit code.");
        return;
    }

    verifyBtn.classList.add("loading");
    verifyBtn.disabled = true;

    try {
        const result = await AuthAPI.verifyOTP(pending.email, code);
        fbSetToken(result.token);
        fbSetSession({
            email: result.email,
            role: result.role,
            loggedInAt: new Date().toISOString()
        });
        
        sessionStorage.removeItem("fbbms_pending_login");
        clearInterval(countdownInterval);
        
        document.getElementById("otpStep").style.display = "none";
        document.getElementById("otpSuccessStep").style.display = "block";
        
        setTimeout(() => {
            window.location.href = result.role === 'super_manager' 
                ? "super-dashboard.html" 
                : `${result.role.replace('_manager', '')}-dashboard.html`;
        }, 1400);
        
    } catch (error) {
        showError(error.message || "Invalid or expired code. Please try again.");
        inputs.forEach(i => { i.value = ""; i.classList.remove("filled"); });
        inputs[0].focus();
    } finally {
        verifyBtn.classList.remove("loading");
        verifyBtn.disabled = false;
    }
});