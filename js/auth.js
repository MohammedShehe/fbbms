/* ============================================================
   FBBMS AUTH GUARD
   Include on every protected page after data.js
   ============================================================ */

const FB_ROLE_PAGES = {
  sports: "sports-dashboard.html",
  scents: "scents-dashboard.html",
  super:  "super-dashboard.html"
};

function fbRequireRole(expectedRole){
  const session = fbGetSession();
  if(!session || session.role !== expectedRole){
    window.location.href = "index.html";
    return null;
  }
  return session;
}

function fbLogout(){
  fbClearSession();
  window.location.href = "index.html";
}

/* Wires up a profile pill (icon + dropdown) present on every dashboard */
function fbWireProfileMenu(triggerId, dropdownId){
  const trigger = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  if(!trigger || !dropdown) return;
  trigger.addEventListener("click", (e)=>{
    e.stopPropagation();
    dropdown.classList.toggle("show");
  });
  document.addEventListener("click", ()=> dropdown.classList.remove("show"));
  dropdown.addEventListener("click", (e)=> e.stopPropagation());
}
