const pending = JSON.parse(sessionStorage.getItem("fbbms_pending_login") || "null");
if(!pending){
  window.location.href = "index.html";
}

document.getElementById("otpTargetEmail").textContent = pending.email;

const inputs = [...document.querySelectorAll("#otpInputs input")];
const errorBox = document.getElementById("otpError");
const errorText = document.getElementById("otpErrorText");
const verifyBtn = document.getElementById("otpVerifyBtn");
const resendBtn = document.getElementById("otpResendBtn");
const countdownEl = document.getElementById("otpCountdown");
const demoCodeEl = document.getElementById("otpDemoCode");

function refreshDemoCode(){
  const otp = fbGetOtp();
  demoCodeEl.textContent = otp ? otp.code : "------";
}
refreshDemoCode();

inputs[0].focus();

inputs.forEach((inp, idx)=>{
  inp.addEventListener("input", ()=>{
    inp.value = inp.value.replace(/[^0-9]/g,"");
    if(inp.value){
      inp.classList.add("filled");
      if(idx < inputs.length-1) inputs[idx+1].focus();
    } else {
      inp.classList.remove("filled");
    }
  });
  inp.addEventListener("keydown", (e)=>{
    if(e.key === "Backspace" && !inp.value && idx > 0){
      inputs[idx-1].focus();
    }
  });
  inp.addEventListener("paste", (e)=>{
    e.preventDefault();
    const text = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g,"").slice(0,6);
    text.split("").forEach((ch,i)=>{ if(inputs[i]){ inputs[i].value = ch; inputs[i].classList.add("filled"); } });
    if(text.length) inputs[Math.min(text.length,inputs.length)-1].focus();
  });
});

function hideError(){ errorBox.classList.remove("show"); }
function showError(msg){ errorText.textContent = msg; errorBox.classList.add("show"); }

/* Countdown timer */
let secondsLeft = 300;
function tickCountdown(){
  const otp = fbGetOtp();
  if(otp){
    secondsLeft = Math.max(0, Math.round((otp.expiresAt - Date.now())/1000));
  }
  const m = String(Math.floor(secondsLeft/60)).padStart(2,"0");
  const s = String(secondsLeft%60).padStart(2,"0");
  countdownEl.textContent = `${m}:${s}`;
  if(secondsLeft <= 0){
    resendBtn.disabled = false;
    countdownEl.parentElement.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Code expired &mdash; request a new one`;
  }
}
tickCountdown();
const countdownInterval = setInterval(tickCountdown, 1000);

resendBtn.addEventListener("click", ()=>{
  fbCreateOtp("login", pending);
  refreshDemoCode();
  secondsLeft = 300;
  inputs.forEach(i=>{ i.value=""; i.classList.remove("filled"); });
  inputs[0].focus();
  hideError();
  fbToast("A new verification code has been generated.", "success");
});

verifyBtn.addEventListener("click", ()=>{
  hideError();
  const code = inputs.map(i=> i.value).join("");
  if(code.length < 6){
    showError("Please enter the full 6-digit code.");
    return;
  }

  verifyBtn.classList.add("loading");
  verifyBtn.disabled = true;

  setTimeout(()=>{
    const result = fbVerifyOtp(code);
    verifyBtn.classList.remove("loading");
    verifyBtn.disabled = false;

    if(!result.ok){
      showError(result.reason);
      inputs.forEach(i=>{ i.value=""; i.classList.remove("filled"); });
      inputs[0].focus();
      return;
    }

    fbClearOtp();
    clearInterval(countdownInterval);
    fbSetSession({ role: pending.role, email: pending.email, name: pending.name, loggedInAt: new Date().toISOString() });
    sessionStorage.removeItem("fbbms_pending_login");

    document.getElementById("otpStep").style.display = "none";
    document.getElementById("otpSuccessStep").style.display = "block";

    setTimeout(()=>{ window.location.href = "super-dashboard.html"; }, 1400);
  }, 600);
});
