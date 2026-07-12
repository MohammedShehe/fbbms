/* ============================================================
   FBBMS SUPER MANAGER ENGINE
   ============================================================ */

(function(){
  const session = fbRequireRole("super");
  if(!session) return;

  fbMountLiveClock(document.getElementById("clockHost"));
  fbWireProfileMenu("profileTrigger", "profileDropdown");
  document.getElementById("logoutBtn").addEventListener("click", fbLogout);

  const charts = {}; // kind -> Chart.js instance
  let invActiveKind = "sports";

  /* ---------------- Main nav: Sports / Scents / Inventory / Staffs ---------------- */
  const mainNavBtns = document.querySelectorAll("#mainNav button");
  mainNavBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      mainNavBtns.forEach(b=> b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.section;
      document.querySelectorAll(".fb-section").forEach(sec=> sec.classList.remove("active"));
      let el;
      if(target === "staffs") el = document.getElementById("section-staffs");
      else if(target === "inventory") el = document.getElementById("section-inventory");
      else el = document.getElementById(`division-${target}`);
      el.classList.add("active");
      if(target === "sports" || target === "scents") refreshDivision(target);
      if(target === "inventory") renderInventoryPanel(invActiveKind);
    });
  });

  /* ---------------- Division sub-tabs (Today/Weekly/Monthly/Yearly/Graph) ---------------- */
  document.querySelectorAll(".fb-section[data-kind]").forEach(section=>{
    const kind = section.dataset.kind;
    section.querySelectorAll(".division-tabs .fb-tab").forEach(tab=>{
      tab.addEventListener("click", ()=>{
        section.querySelectorAll(".division-tabs .fb-tab").forEach(t=> t.classList.remove("active"));
        tab.classList.add("active");
        section.querySelectorAll(".sub-section").forEach(s=> s.style.display = "none");
        section.querySelector(`[data-sub-section="${tab.dataset.sub}"]`).style.display = "block";
        if(tab.dataset.sub === "graph") renderGraph(kind, section);
      });
    });
    section.querySelector(".graph-select").addEventListener("change", ()=> renderGraph(kind, section));
  });

  function buildRow(r, showTime){
    return `<tr>
      <td class="mono text-muted-fb">${showTime ? new Date(r.addedAt).toLocaleTimeString() : r.date}</td>
      <td>${fbEscapeHtml(r.customer)}</td>
      <td>${fbEscapeHtml(r.item)}</td>
      <td><span class="fb-badge fb-badge-category">${fbEscapeHtml(r.category)}</span></td>
      <td class="mono">${r.quantity}</td>
      <td class="mono">${fbFormatMoney(r.unitPrice)}</td>
      <td class="mono fw-bold">${fbFormatMoney(r.total)}</td>
    </tr>`;
  }
  function emptyRow(cols){
    return `<tr><td colspan="${cols}"><div class="fb-empty"><i class="bi bi-inbox"></i>No records found</div></td></tr>`;
  }

  /* ---------------- TODAY ---------------- */
  function renderToday(kind, section){
    const records = fbGetRecords(kind);
    const todayStr = fbFormatDateShort();
    const todays = records.filter(r=> r.date === todayStr);
    const total = todays.reduce((s,r)=> s+r.total, 0);

    section.querySelector(".today-label").textContent = fbFormatDateLong();
    section.querySelector(".today-total").textContent = fbFormatMoney(total);
    section.querySelector(".today-count").textContent = `${todays.length} record${todays.length!==1?"s":""} today`;
    const tbody = section.querySelector(".today-table tbody");
    tbody.innerHTML = todays.length ? todays.map(r=>buildRow(r,true)).join("") : emptyRow(7);
  }

  /* ---------------- WEEKLY ---------------- */
  function getLast7Days(){
    const days = [];
    const now = new Date();
    for(let i=6;i>=0;i--){
      const d = new Date(now); d.setDate(d.getDate()-i);
      days.push(d);
    }
    return days;
  }

  function renderWeekly(kind, section, selectedDayName){
    selectedDayName = selectedDayName || "Total";
    const records = fbGetRecords(kind);
    const days = getLast7Days();
    const grid = section.querySelector(".weekly-day-grid");

    const dayData = days.map(d=>{
      const dateStr = fbFormatDateShort(d);
      const dayRecords = records.filter(r=> r.date === dateStr);
      return { date:d, dateStr, name:FB_DAYS[d.getDay()], total: dayRecords.reduce((s,r)=>s+r.total,0), records: dayRecords };
    });
    const weekTotal = dayData.reduce((s,d)=> s+d.total, 0);
    const weekRecords = dayData.flatMap(d=>d.records);

    grid.innerHTML = dayData.map(d=>{
      const active = selectedDayName === d.name;
      return `<div class="fb-day-chip ${active?"active":""}" data-day-name="${d.name}">
        <div class="d-name">${d.name.slice(0,3)}</div>
        <div class="d-date mono">${d.dateStr.slice(5)}</div>
        <div class="d-total">${fbFormatMoney(d.total)}</div>
      </div>`;
    }).join("") + `<div class="fb-day-chip ${selectedDayName==="Total"?"active":""}" data-day-name="Total">
        <div class="d-name">Total</div>
        <div class="d-date mono">Last 7d</div>
        <div class="d-total">${fbFormatMoney(weekTotal)}</div>
      </div>`;

    grid.querySelectorAll(".fb-day-chip").forEach(chip=>{
      chip.addEventListener("click", ()=> renderWeekly(kind, section, chip.dataset.dayName));
    });

    let detailLabel, detailTotal, detailRecords, count;
    if(selectedDayName === "Total" || !selectedDayName){
      detailLabel = "This week (last 7 days)"; detailTotal = weekTotal; detailRecords = weekRecords; count = weekRecords.length;
    } else {
      const found = dayData.find(d=> d.name === selectedDayName) || dayData[dayData.length-1];
      detailLabel = `${found.name}, ${found.dateStr}`; detailTotal = found.total; detailRecords = found.records; count = found.records.length;
    }
    section.querySelector(".weekly-detail-label").textContent = "Total income — " + detailLabel;
    section.querySelector(".weekly-detail-total").textContent = fbFormatMoney(detailTotal);
    section.querySelector(".weekly-detail-count").textContent = `${count} record${count!==1?"s":""}`;
    section.querySelector(".weekly-table tbody").innerHTML = detailRecords.length
      ? [...detailRecords].sort((a,b)=> new Date(b.date)-new Date(a.date)).map(r=>buildRow(r,false)).join("")
      : emptyRow(7);
  }

  /* ---------------- MONTHLY ---------------- */
  function renderMonthly(kind, section, selectedKey){
    const records = fbGetRecords(kind);
    const byMonth = {};
    records.forEach(r=>{
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth[key] = byMonth[key] || { label:`${FB_MONTHS[d.getMonth()]} ${d.getFullYear()}`, count:0, total:0, monthIdx:d.getMonth(), year:d.getFullYear() };
      byMonth[key].count++; byMonth[key].total += r.total;
    });
    const keys = Object.keys(byMonth).sort((a,b)=>{
      const [ya,ma]=a.split("-").map(Number), [yb,mb]=b.split("-").map(Number);
      return (yb*12+mb)-(ya*12+ma);
    });
    const grid = section.querySelector(".monthly-grid");
    if(!keys.length){
      grid.innerHTML = `<div class="fb-empty" style="grid-column:1/-1;"><i class="bi bi-calendar-x"></i>No records yet</div>`;
      section.querySelector(".monthly-detail-card").style.display = "none";
      section.querySelector(".monthly-table tbody").innerHTML = emptyRow(7);
      return;
    }
    const activeKey = selectedKey && byMonth[selectedKey] ? selectedKey : keys[0];
    grid.innerHTML = keys.map(k=>{
      const m = byMonth[k];
      return `<div class="fb-month-chip ${k===activeKey?"active":""}" data-month-key="${k}">
        <div class="m-name">${m.label}</div>
        <div class="m-count">${m.count} record${m.count!==1?"s":""}</div>
        <div class="m-total">${fbFormatMoney(m.total)}</div>
      </div>`;
    }).join("");
    grid.querySelectorAll(".fb-month-chip").forEach(chip=>{
      chip.addEventListener("click", ()=> renderMonthly(kind, section, chip.dataset.monthKey));
    });

    const m = byMonth[activeKey];
    section.querySelector(".monthly-detail-card").style.display = "flex";
    section.querySelector(".monthly-detail-label").textContent = m.label;
    section.querySelector(".monthly-detail-total").textContent = fbFormatMoney(m.total);
    section.querySelector(".monthly-detail-count").textContent = `${m.count} record${m.count!==1?"s":""}`;

    const monthRecords = records.filter(r=>{ const d=new Date(r.date); return d.getFullYear()===m.year && d.getMonth()===m.monthIdx; });
    section.querySelector(".monthly-table tbody").innerHTML = monthRecords.length
      ? monthRecords.sort((a,b)=> new Date(b.date)-new Date(a.date)).map(r=>buildRow(r,false)).join("")
      : emptyRow(7);
  }

  /* ---------------- YEARLY ---------------- */
  function renderYearly(kind, section, selectedYear){
    const records = fbGetRecords(kind);
    const byYear = {};
    records.forEach(r=>{
      const y = new Date(r.date).getFullYear();
      byYear[y] = byYear[y] || [];
      byYear[y].push(r);
    });
    const years = Object.keys(byYear).sort((a,b)=> b-a);
    const grid = section.querySelector(".yearly-year-grid");
    if(!years.length){
      grid.innerHTML = `<div class="fb-empty" style="grid-column:1/-1;"><i class="bi bi-calendar-x"></i>No records yet</div>`;
      section.querySelector(".yearly-table tbody").innerHTML = emptyRow(3);
      return;
    }
    const activeYear = selectedYear && byYear[selectedYear] ? selectedYear : years[0];
    grid.innerHTML = years.map(y=>{
      const total = byYear[y].reduce((s,r)=>s+r.total,0);
      return `<div class="fb-day-chip ${y===activeYear?"active":""}" data-year="${y}">
        <div class="d-name">${y}</div>
        <div class="d-total">${fbFormatMoney(total)}</div>
      </div>`;
    }).join("");
    grid.querySelectorAll(".fb-day-chip").forEach(chip=>{
      chip.addEventListener("click", ()=> renderYearly(kind, section, chip.dataset.year));
    });

    const yearRecords = byYear[activeYear];
    const grandTotal = yearRecords.reduce((s,r)=>s+r.total,0);
    section.querySelector(".yearly-detail-label").textContent = `Grand Total — ${activeYear}`;
    section.querySelector(".yearly-detail-total").textContent = fbFormatMoney(grandTotal);

    const byMonthIdx = Array.from({length:12}, ()=> ({count:0,total:0}));
    yearRecords.forEach(r=>{ const idx = new Date(r.date).getMonth(); byMonthIdx[idx].count++; byMonthIdx[idx].total += r.total; });
    section.querySelector(".yearly-table tbody").innerHTML = FB_MONTHS.map((name,idx)=>{
      const m = byMonthIdx[idx];
      if(!m.count) return "";
      return `<tr><td>${name}</td><td class="mono">${m.count}</td><td class="mono fw-bold">${fbFormatMoney(m.total)}</td></tr>`;
    }).join("") || emptyRow(3);
  }

  /* ---------------- GRAPH ---------------- */
  function renderGraph(kind, section){
    const select = section.querySelector(".graph-select");
    const mode = select.value;
    const canvas = section.querySelector(".graph-canvas");
    const records = fbGetRecords(kind);
    const accent = kind === "sports" ? "#18E0A6" : "#E0A64C";

    let labels, data, title;

    if(mode === "Total"){
      const days = getLast7Days();
      labels = days.map(d=> FB_DAYS[d.getDay()].slice(0,3) + " " + fbFormatDateShort(d).slice(5));
      data = days.map(d=>{
        const dateStr = fbFormatDateShort(d);
        return records.filter(r=> r.date === dateStr).reduce((s,r)=>s+r.total,0);
      });
      title = "Last 7 days — combined daily totals";
    } else {
      // trend of a specific weekday across the last 8 occurrences
      const occurrences = [];
      let cursor = new Date();
      while(occurrences.length < 8){
        if(FB_DAYS[cursor.getDay()] === mode) occurrences.unshift(new Date(cursor));
        cursor.setDate(cursor.getDate()-1);
      }
      labels = occurrences.map(d=> fbFormatDateShort(d).slice(5));
      data = occurrences.map(d=>{
        const dateStr = fbFormatDateShort(d);
        return records.filter(r=> r.date === dateStr).reduce((s,r)=>s+r.total,0);
      });
      title = `${mode} trend — last 8 occurrences`;
    }

    if(charts[kind]){ charts[kind].destroy(); }

    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0,0,0,320);
    gradient.addColorStop(0, accent + "55");
    gradient.addColorStop(1, accent + "00");

    charts[kind] = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: title,
          data,
          borderColor: accent,
          backgroundColor: gradient,
          borderWidth: 3,
          pointBackgroundColor: "#0B0E14",
          pointBorderColor: accent,
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          tension: 0.42,
          fill: true
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        animation: { duration: 900, easing: "easeOutQuart" },
        plugins:{
          legend:{ display:true, labels:{ color:"#9AA3B2", font:{family:"Inter"} } },
          tooltip:{
            backgroundColor:"#171C27", borderColor:accent, borderWidth:1,
            titleColor:"#F4F6F8", bodyColor:"#F4F6F8", padding:12, cornerRadius:10,
            callbacks:{ label: (ctx)=> " " + fbFormatMoney(ctx.parsed.y) }
          }
        },
        scales:{
          x:{ ticks:{ color:"#9AA3B2" }, grid:{ color:"rgba(255,255,255,0.04)" } },
          y:{ ticks:{ color:"#9AA3B2", callback:(v)=> (v/1000)+"k" }, grid:{ color:"rgba(255,255,255,0.06)" } }
        }
      }
    });
  }

  function refreshDivision(kind){
    const section = document.getElementById(`division-${kind}`);
    renderToday(kind, section);
    renderWeekly(kind, section);
    renderMonthly(kind, section);
    renderYearly(kind, section);
  }

  refreshDivision("sports");
  refreshDivision("scents");

  /* ================= INVENTORY ================= */
  const invSubTabs = document.querySelectorAll("#inventoryDivisionTabs .fb-tab");
  invSubTabs.forEach(tab=>{
    tab.addEventListener("click", ()=>{
      invSubTabs.forEach(t=> t.classList.remove("active"));
      tab.classList.add("active");
      invActiveKind = tab.dataset.invKind;
      document.querySelectorAll(".inv-sub-panel").forEach(p=> p.classList.remove("active"));
      document.getElementById(`inv-panel-${invActiveKind}`).classList.add("active");
      renderInventoryPanel(invActiveKind);
    });
  });

  function stockMeta(amount){
    if(amount <= 0) return { cls:"stock-out", pill:"out", label:"Out of stock" };
    if(amount <= 5) return { cls:"stock-low", pill:"low", label:"Low stock" };
    return { cls:"stock-ok", pill:"ok", label:"In stock" };
  }

  function renderInventoryPanel(kind){
    const list = fbGetInventoryList(kind);
    const grid = document.getElementById(`inv-grid-${kind}`);
    grid.innerHTML = list.map(entry=>{
      const s = stockMeta(entry.amount);
      return `<div class="fb-inv-card ${s.cls}">
        <div class="inv-cat">
          <span>${fbEscapeHtml(entry.category)}</span>
          <span class="fb-inv-pill ${s.pill}">${s.label}</span>
        </div>
        <div class="inv-qty">${entry.amount}</div>
        <div class="inv-unit">${fbEscapeHtml(entry.unit)} available</div>
      </div>`;
    }).join("");

    const totalUnits = list.reduce((s,e)=> s + (e.amount>0?e.amount:0), 0);
    const outCount = list.filter(e=> e.amount<=0).length;
    const lowCount = list.filter(e=> e.amount>0 && e.amount<=5).length;
    document.getElementById(`inv-summary-${kind}`).innerHTML = `
      <div class="fb-stat-card">
        <div class="fb-stat-label">Categories Tracked</div>
        <div class="fb-stat-value">${list.length}</div>
        <div class="fb-stat-sub"><i class="bi bi-boxes"></i> ${kind === "sports" ? "Sports" : "Scents"} Division</div>
      </div>
      <div class="fb-stat-card">
        <div class="fb-stat-label">Units In Stock</div>
        <div class="fb-stat-value">${totalUnits}</div>
        <div class="fb-stat-sub"><i class="bi bi-box-seam"></i> Combined across categories</div>
      </div>
      <div class="fb-stat-card">
        <div class="fb-stat-label">Needs Attention</div>
        <div class="fb-stat-value">${outCount + lowCount}</div>
        <div class="fb-stat-sub"><i class="bi bi-exclamation-triangle"></i> ${outCount} out &middot; ${lowCount} low</div>
      </div>
    `;
  }

  renderInventoryPanel("sports");
  renderInventoryPanel("scents");

  /* ---- Add Stock modal ---- */
  const stockModalEl = document.getElementById("addStockModal");
  const stockModal = new bootstrap.Modal(stockModalEl);
  const stockDivisionSelect = document.getElementById("stockDivision");
  const stockCategorySelect = document.getElementById("stockCategory");

  function fillStockCategories(kind){
    stockCategorySelect.innerHTML = FB_CATEGORIES[kind].map(c=> `<option value="${c}">${c}</option>`).join("");
  }

  document.getElementById("addStockFab").addEventListener("click", ()=>{
    stockDivisionSelect.value = invActiveKind;
    fillStockCategories(invActiveKind);
    document.getElementById("stockQtyText").value = "";
    document.getElementById("stockFormError").classList.remove("show");
    stockModal.show();
  });
  stockDivisionSelect.addEventListener("change", ()=> fillStockCategories(stockDivisionSelect.value));

  document.getElementById("addStockForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const kind = stockDivisionSelect.value;
    const category = stockCategorySelect.value;
    const qtyText = document.getElementById("stockQtyText").value.trim();
    const errEl = document.getElementById("stockFormError");
    const errText = document.getElementById("stockFormErrorText");

    const parsed = fbParseQuantityText(qtyText);
    if(!qtyText || !(parsed.amount > 0)){
      errText.textContent = 'Please enter a quantity like "10 pairs" or "25 bottles".';
      errEl.classList.add("show");
      return;
    }
    errEl.classList.remove("show");

    fbAddInventoryStock(kind, category, qtyText);
    stockModal.hide();
    fbToast(`Added ${qtyText} to "${category}" (${kind === "sports" ? "Sports" : "Scents"}).`, "success");
    renderInventoryPanel(kind);
  });

  /* ================= EDIT PROFILE (self password change) ================= */
  const profileModalEl = document.getElementById("editProfileModal");
  const profileModal = new bootstrap.Modal(profileModalEl);
  document.getElementById("editProfileBtn").addEventListener("click", ()=>{
    document.getElementById("profileStepForm").style.display = "block";
    document.getElementById("profileStepOtp").style.display = "none";
    document.getElementById("profileStepSuccess").style.display = "none";
    document.getElementById("profileSendOtpBtn").style.display = "inline-block";
    document.getElementById("profileVerifyOtpBtn").style.display = "none";
    document.getElementById("newPasswordInput").value = "";
    document.getElementById("confirmPasswordInput").value = "";
    document.getElementById("profileFormError").classList.remove("show");
    profileModal.show();
  });

  document.getElementById("profileSendOtpBtn").addEventListener("click", ()=>{
    const newPass = document.getElementById("newPasswordInput").value;
    const confirmPass = document.getElementById("confirmPasswordInput").value;
    const errEl = document.getElementById("profileFormError");
    const errText = document.getElementById("profileFormErrorText");

    if(!newPass || newPass.length < 8){
      errText.textContent = "New password must be at least 8 characters.";
      errEl.classList.add("show");
      return;
    }
    if(newPass !== confirmPass){
      errText.textContent = "Passwords do not match.";
      errEl.classList.add("show");
      return;
    }
    errEl.classList.remove("show");

    fbCreateOtp("profile-password", { newPassword: newPass });
    document.getElementById("profileDemoCode").textContent = fbGetOtp().code;
    document.getElementById("profileStepForm").style.display = "none";
    document.getElementById("profileStepOtp").style.display = "block";
    document.getElementById("profileSendOtpBtn").style.display = "none";
    document.getElementById("profileVerifyOtpBtn").style.display = "inline-block";
    wireOtpInputs("profileOtpInputs");
    fbToast("Verification code generated.", "info");
  });

  document.getElementById("profileVerifyOtpBtn").addEventListener("click", ()=>{
    const code = readOtpInputs("profileOtpInputs");
    const errEl = document.getElementById("profileOtpError");
    const errText = document.getElementById("profileOtpErrorText");
    if(code.length < 6){ errText.textContent = "Enter the full 6-digit code."; errEl.classList.add("show"); return; }

    const result = fbVerifyOtp(code);
    if(!result.ok){ errText.textContent = result.reason; errEl.classList.add("show"); return; }
    errEl.classList.remove("show");

    fbUpdateStaffAccount("super", { password: result.meta.newPassword });
    fbClearOtp();
    document.getElementById("profileStepOtp").style.display = "none";
    document.getElementById("profileVerifyOtpBtn").style.display = "none";
    document.getElementById("profileStepSuccess").style.display = "block";
    fbToast("Password changed successfully.", "success");
    setTimeout(()=> profileModal.hide(), 1400);
  });

  /* ================= STAFFS ================= */
  const staffRow = document.getElementById("staffCardsRow");
  function renderStaffCards(){
    const staff = fbGetStaff();
    const roles = [
      { key:"sports", icon:"bi-dribbble", label:"Sports Manager" },
      { key:"scents", icon:"bi-flower2", label:"Scents Manager" }
    ];
    staffRow.innerHTML = roles.map(r=>{
      const acc = staff[r.key];
      const disabled = acc.active === false;
      return `<div class="col-md-6">
        <div class="fb-staff-card">
          <span class="fb-avatar"><i class="bi ${r.icon}"></i></span>
          <div class="flex-grow-1">
            <div class="fw-bold">${r.label}</div>
            <div class="mono text-muted-fb" style="font-size:0.85rem;">${acc.email}</div>
            <div class="mt-1">
              <span class="fb-badge" style="${disabled? "background:rgba(240,85,90,0.12);border-color:rgba(240,85,90,0.35);color:#FF9A9E;" : "background:var(--sports-glow);border-color:var(--sports);color:var(--sports);"}">
                <i class="bi ${disabled?"bi-slash-circle":"bi-check-circle"}"></i> ${disabled?"Access revoked":"Active"}
              </span>
            </div>
          </div>
          <div class="d-flex flex-column gap-2">
            <button class="fb-btn-outline" data-staff-edit="${r.key}"><i class="bi bi-pencil"></i> Edit</button>
            <button class="fb-btn-outline" data-staff-toggle="${r.key}">
              <i class="bi ${disabled?"bi-arrow-counterclockwise":"bi-trash3"}"></i> ${disabled?"Reactivate":"Delete"}
            </button>
          </div>
        </div>
      </div>`;
    }).join("");

    staffRow.querySelectorAll("[data-staff-edit]").forEach(btn=>{
      btn.addEventListener("click", ()=> openStaffEdit(btn.dataset.staffEdit));
    });
    staffRow.querySelectorAll("[data-staff-toggle]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const role = btn.dataset.staffToggle;
        const acc = fbGetStaff()[role];
        const nowDisabled = acc.active !== false;
        const msg = nowDisabled
          ? `Revoke access for ${acc.email}? They will no longer be able to sign in.`
          : `Reactivate access for ${acc.email}?`;
        if(confirm(msg)){
          fbUpdateStaffAccount(role, { active: !nowDisabled ? true : false });
          renderStaffCards();
          fbToast(nowDisabled ? "Staff access revoked." : "Staff access restored.", nowDisabled ? "warning" : "success");
        }
      });
    });
  }
  renderStaffCards();

  const staffModalEl = document.getElementById("staffEditModal");
  const staffModal = new bootstrap.Modal(staffModalEl);
  let staffEditingRole = null;

  function openStaffEdit(role){
    staffEditingRole = role;
    const acc = fbGetStaff()[role];
    document.getElementById("staffEditEmail").value = acc.email;
    document.getElementById("staffEditPassword").value = "";
    document.getElementById("staffStepForm").style.display = "block";
    document.getElementById("staffStepOtp").style.display = "none";
    document.getElementById("staffStepSuccess").style.display = "none";
    document.getElementById("staffSendOtpBtn").style.display = "inline-block";
    document.getElementById("staffVerifyOtpBtn").style.display = "none";
    document.getElementById("staffFormError").classList.remove("show");
    staffModal.show();
  }

  document.getElementById("staffSendOtpBtn").addEventListener("click", ()=>{
    const newEmail = document.getElementById("staffEditEmail").value.trim();
    const newPassword = document.getElementById("staffEditPassword").value;
    const errEl = document.getElementById("staffFormError");
    const errText = document.getElementById("staffFormErrorText");

    if(!/^\S+@\S+\.\S+$/.test(newEmail)){
      errText.textContent = "Please enter a valid email address.";
      errEl.classList.add("show");
      return;
    }
    if(newPassword && newPassword.length < 8){
      errText.textContent = "New password must be at least 8 characters.";
      errEl.classList.add("show");
      return;
    }
    errEl.classList.remove("show");

    fbCreateOtp("staff-edit", { role: staffEditingRole, newEmail, newPassword });
    document.getElementById("staffDemoCode").textContent = fbGetOtp().code;
    document.getElementById("staffStepForm").style.display = "none";
    document.getElementById("staffStepOtp").style.display = "block";
    document.getElementById("staffSendOtpBtn").style.display = "none";
    document.getElementById("staffVerifyOtpBtn").style.display = "inline-block";
    wireOtpInputs("staffOtpInputs");
    fbToast("Verification code generated to confirm this change.", "info");
  });

  document.getElementById("staffVerifyOtpBtn").addEventListener("click", ()=>{
    const code = readOtpInputs("staffOtpInputs");
    const errEl = document.getElementById("staffOtpError");
    const errText = document.getElementById("staffOtpErrorText");
    if(code.length < 6){ errText.textContent = "Enter the full 6-digit code."; errEl.classList.add("show"); return; }

    const result = fbVerifyOtp(code);
    if(!result.ok){ errText.textContent = result.reason; errEl.classList.add("show"); return; }
    errEl.classList.remove("show");

    const updates = { email: result.meta.newEmail };
    if(result.meta.newPassword) updates.password = result.meta.newPassword;
    fbUpdateStaffAccount(result.meta.role, updates);
    fbClearOtp();

    document.getElementById("staffStepOtp").style.display = "none";
    document.getElementById("staffVerifyOtpBtn").style.display = "none";
    document.getElementById("staffStepSuccess").style.display = "block";
    fbToast("Staff account updated.", "success");
    renderStaffCards();
    setTimeout(()=> staffModal.hide(), 1400);
  });

  /* ---------------- shared OTP input widget helper ---------------- */
  function wireOtpInputs(containerId){
    const inputs = [...document.getElementById(containerId).querySelectorAll("input")];
    inputs.forEach(i=>{ i.value=""; i.classList.remove("filled"); });
    inputs[0].focus();
    inputs.forEach((inp, idx)=>{
      inp.oninput = ()=>{
        inp.value = inp.value.replace(/[^0-9]/g,"");
        if(inp.value){ inp.classList.add("filled"); if(idx<inputs.length-1) inputs[idx+1].focus(); }
        else inp.classList.remove("filled");
      };
      inp.onkeydown = (e)=>{
        if(e.key === "Backspace" && !inp.value && idx>0) inputs[idx-1].focus();
      };
    });
  }
  function readOtpInputs(containerId){
    return [...document.getElementById(containerId).querySelectorAll("input")].map(i=>i.value).join("");
  }

})();
