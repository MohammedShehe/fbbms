document.getElementById("yearNow").textContent = new Date().getFullYear();

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const errorBox = document.getElementById("loginError");
const errorText = document.getElementById("loginErrorText");
const togglePass = document.getElementById("togglePass");
const pwField = document.getElementById("loginPassword");

togglePass.addEventListener("click", ()=>{
  const isPass = pwField.type === "password";
  pwField.type = isPass ? "text" : "password";
  togglePass.innerHTML = `<i class="bi ${isPass?"bi-eye-slash":"bi-eye"}"></i>`;
});

function showLoginError(msg){
  errorText.textContent = msg;
  errorBox.classList.add("show");
}
function hideLoginError(){ errorBox.classList.remove("show"); }

const FB_ROLE_PAGES_SAFE = {
  sports: "sports-dashboard.html",
  scents: "scents-dashboard.html",
  super:  "super-dashboard.html"
};

// If already logged in, redirect straight to the right dashboard
(function redirectIfLoggedIn(){
  const session = fbGetSession();
  if(session && FB_ROLE_PAGES_SAFE[session.role]){
    window.location.href = FB_ROLE_PAGES_SAFE[session.role];
  }
})();

loginForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  hideLoginError();

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const staff = fbGetStaff();

  const match = Object.entries(staff).find(([role, acc])=> acc.email.toLowerCase() === email && acc.password === password);

  loginBtn.classList.add("loading");
  loginBtn.disabled = true;

  setTimeout(()=>{
    loginBtn.classList.remove("loading");
    loginBtn.disabled = false;

    if(!match){
      showLoginError("Invalid email or password. Please check your credentials and try again.");
      return;
    }

    const [role, account] = match;

    if(account.active === false){
      showLoginError("This account has been disabled by the Super Manager. Contact your administrator.");
      return;
    }

    if(role === "super"){
      // Super manager requires OTP verification before session is granted
      fbCreateOtp("login", { role, email: account.email, name: account.name });
      fbToast("A verification code has been generated for Super Manager login.", "info");
      sessionStorage.setItem("fbbms_pending_login", JSON.stringify({ role, email: account.email, name: account.name }));
      window.location.href = "otp.html?context=login";
      return;
    }

    fbSetSession({ role, email: account.email, name: account.name, loggedInAt: new Date().toISOString() });
    window.location.href = FB_ROLE_PAGES_SAFE[role];
  }, 650);
});
