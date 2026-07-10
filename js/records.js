/* ============================================================
   FBBMS RECORDS ENGINE
   Generic engine driving both Sports & Scents manager dashboards.
   ============================================================ */

function fbInitRecordsPage(kind){
  const session = fbRequireRole(kind);
  if(!session) return;

  fbMountLiveClock(document.getElementById("clockHost"));
  fbWireProfileMenu("profileTrigger", "profileDropdown");
  document.getElementById("logoutBtn").addEventListener("click", fbLogout);

  const categories = FB_CATEGORIES[kind];
  const state = { view: "all", month: null, allSearch:"", allCategory:"", allSort:"date_desc", monthSearch:"", monthCategory:"" };

  /* ---------- populate category selects ---------- */
  function fillCategorySelect(selectEl, withAllOption){
    selectEl.innerHTML = (withAllOption ? '<option value="">All Categories</option>' : '') +
      categories.map(c=> `<option value="${c}">${c}</option>`).join("");
  }
  fillCategorySelect(document.getElementById("allCategoryFilter"), true);
  fillCategorySelect(document.getElementById("monthCategoryFilter"), true);
  fillCategorySelect(document.getElementById("recCategory"), false);

  /* ---------- tabs ---------- */
  document.querySelectorAll("#viewTabs .fb-tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
      document.querySelectorAll("#viewTabs .fb-tab").forEach(t=> t.classList.remove("active"));
      tab.classList.add("active");
      state.view = tab.dataset.view;
      document.getElementById("section-all").classList.toggle("active", state.view==="all");
      document.getElementById("section-monthly").classList.toggle("active", state.view==="monthly");
      if(state.view === "all") renderAll();
      else renderMonthGrid();
    });
  });

  /* ---------- Add record modal ---------- */
  const modalEl = document.getElementById("addRecordModal");
  const modal = new bootstrap.Modal(modalEl);
  document.getElementById("addRecordFab").addEventListener("click", ()=>{
    document.getElementById("addRecordForm").reset();
    document.getElementById("recDate").value = fbFormatDateShort();
    document.getElementById("recCategoryOtherWrap").style.display = "none";
    document.getElementById("recTotalPreview").value = fbFormatMoney(0);
    modal.show();
  });

  const catSelect = document.getElementById("recCategory");
  catSelect.addEventListener("change", ()=>{
    document.getElementById("recCategoryOtherWrap").style.display = catSelect.value === "Other" ? "block" : "none";
  });

  function updateTotalPreview(){
    const qty = Number(document.getElementById("recQty").value) || 0;
    const unit = Number(document.getElementById("recUnitPrice").value) || 0;
    document.getElementById("recTotalPreview").value = fbFormatMoney(qty * unit);
  }
  document.getElementById("recQty").addEventListener("input", updateTotalPreview);
  document.getElementById("recUnitPrice").addEventListener("input", updateTotalPreview);

  document.getElementById("addRecordForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const category = catSelect.value === "Other"
      ? (document.getElementById("recCategoryOther").value.trim() || "Other")
      : catSelect.value;

    const record = {
      date: document.getElementById("recDate").value || fbFormatDateShort(),
      customer: document.getElementById("recCustomer").value.trim(),
      item: document.getElementById("recItem").value.trim(),
      category,
      quantity: Number(document.getElementById("recQty").value) || 1,
      unitPrice: Number(document.getElementById("recUnitPrice").value) || 0,
      notes: document.getElementById("recNotes").value.trim()
    };
    fbAddRecord(kind, record);
    modal.hide();
    fbToast("Record saved successfully.", "success");
    if(state.view === "all") renderAll(); else renderMonthGrid();
  });

  /* ---------- delete handler (event delegation) ---------- */
  document.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-delete-id]");
    if(!btn) return;
    const id = btn.dataset.deleteId;
    if(confirm("Delete this record? This cannot be undone.")){
      fbDeleteRecord(kind, id);
      fbToast("Record deleted.", "warning");
      if(state.view === "all") renderAll(); else renderMonthGrid();
    }
  });

  /* ---------- ALL VIEW ---------- */
  function renderAllStats(records){
    const total = records.reduce((s,r)=> s + r.total, 0);
    const grid = document.getElementById("allStatsGrid");
    grid.innerHTML = `
      <div class="fb-stat-card">
        <div class="fb-stat-label">Total Income (All Time)</div>
        <div class="fb-stat-value">${fbFormatMoney(total)}</div>
        <div class="fb-stat-sub"><i class="bi bi-graph-up-arrow"></i> Across ${records.length} sale${records.length!==1?"s":""}</div>
      </div>
      <div class="fb-stat-card">
        <div class="fb-stat-label">Total Records</div>
        <div class="fb-stat-value">${records.length}</div>
        <div class="fb-stat-sub"><i class="bi bi-receipt"></i> Items sold and logged</div>
      </div>
      <div class="fb-stat-card">
        <div class="fb-stat-label">Average Sale Value</div>
        <div class="fb-stat-value">${fbFormatMoney(records.length? total/records.length : 0)}</div>
        <div class="fb-stat-sub"><i class="bi bi-bar-chart-line"></i> Per transaction</div>
      </div>
    `;
  }

  function buildRow(r){
    return `
      <tr>
        <td class="mono text-muted-fb">${r.date}</td>
        <td>${fbEscapeHtml(r.customer)}</td>
        <td>${fbEscapeHtml(r.item)}</td>
        <td><span class="fb-badge fb-badge-category">${fbEscapeHtml(r.category)}</span></td>
        <td class="mono">${r.quantity}</td>
        <td class="mono">${fbFormatMoney(r.unitPrice)}</td>
        <td class="mono fw-bold">${fbFormatMoney(r.total)}</td>
        <td><button class="fb-btn-outline" style="padding:5px 10px;" data-delete-id="${r.id}"><i class="bi bi-trash3"></i></button></td>
      </tr>
    `;
  }

  function applyFilters(records, search, category){
    return records.filter(r=>{
      const matchesSearch = !search || r.customer.toLowerCase().includes(search) || r.item.toLowerCase().includes(search);
      const matchesCategory = !category || r.category === category;
      return matchesSearch && matchesCategory;
    });
  }

  function applySort(records, sortKey){
    const arr = [...records];
    switch(sortKey){
      case "date_asc": return arr.sort((a,b)=> new Date(a.date)-new Date(b.date));
      case "total_desc": return arr.sort((a,b)=> b.total-a.total);
      case "total_asc": return arr.sort((a,b)=> a.total-b.total);
      default: return arr.sort((a,b)=> new Date(b.date)-new Date(a.date));
    }
  }

  function renderAll(){
    let records = fbGetRecords(kind);
    renderAllStats(records);
    const filtered = applySort(applyFilters(records, state.allSearch, state.allCategory), state.allSort);
    const tbody = document.getElementById("allTableBody");
    tbody.innerHTML = filtered.length ? filtered.map(buildRow).join("") :
      `<tr><td colspan="8"><div class="fb-empty"><i class="bi bi-inbox"></i>No records match your filters</div></td></tr>`;
  }

  document.getElementById("allSearchInput").addEventListener("input", fbDebounce((e)=>{
    state.allSearch = e.target.value.trim().toLowerCase(); renderAll();
  }, 200));
  document.getElementById("allCategoryFilter").addEventListener("change", (e)=>{ state.allCategory = e.target.value; renderAll(); });
  document.getElementById("allSortSelect").addEventListener("change", (e)=>{ state.allSort = e.target.value; renderAll(); });

  /* ---------- MONTHLY VIEW ---------- */
  function renderMonthGrid(){
    const records = fbGetRecords(kind);
    const byMonth = {};
    records.forEach(r=>{
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth[key] = byMonth[key] || { label: `${FB_MONTHS[d.getMonth()]} ${d.getFullYear()}`, count:0, total:0, monthIdx:d.getMonth(), year:d.getFullYear() };
      byMonth[key].count++;
      byMonth[key].total += r.total;
    });
    const keys = Object.keys(byMonth).sort((a,b)=>{
      const [ya,ma] = a.split("-").map(Number), [yb,mb] = b.split("-").map(Number);
      return (yb*12+mb) - (ya*12+ma);
    });

    const grid = document.getElementById("monthGrid");
    if(!keys.length){
      grid.innerHTML = `<div class="fb-empty" style="grid-column:1/-1;"><i class="bi bi-calendar-x"></i>No records yet</div>`;
      document.getElementById("monthlyDetail").style.display = "none";
      return;
    }
    grid.innerHTML = keys.map(k=>{
      const m = byMonth[k];
      const active = state.month === k;
      return `<div class="fb-month-chip ${active?"active":""}" data-month-key="${k}">
        <div class="m-name">${m.label}</div>
        <div class="m-count">${m.count} record${m.count!==1?"s":""}</div>
        <div class="m-total">${fbFormatMoney(m.total)}</div>
      </div>`;
    }).join("");

    grid.querySelectorAll(".fb-month-chip").forEach(chip=>{
      chip.addEventListener("click", ()=>{
        state.month = chip.dataset.monthKey;
        renderMonthGrid();
        renderMonthDetail(byMonth[state.month]);
      });
    });

    if(state.month && byMonth[state.month]){
      renderMonthDetail(byMonth[state.month]);
    } else if(!state.month){
      // auto-select most recent month
      state.month = keys[0];
      grid.querySelector(`[data-month-key="${keys[0]}"]`)?.classList.add("active");
      renderMonthDetail(byMonth[keys[0]]);
    }
  }

  function renderMonthDetail(monthMeta){
    document.getElementById("monthlyDetail").style.display = "block";
    document.getElementById("monthlyLabel").textContent = monthMeta.label;
    document.getElementById("monthlyTotal").textContent = fbFormatMoney(monthMeta.total);
    document.getElementById("monthlyCount").textContent = `${monthMeta.count} record${monthMeta.count!==1?"s":""}`;

    const records = fbGetRecords(kind).filter(r=>{
      const d = new Date(r.date);
      return d.getFullYear() === monthMeta.year && d.getMonth() === monthMeta.monthIdx;
    });
    const filtered = applyFilters(records, state.monthSearch, state.monthCategory)
      .sort((a,b)=> new Date(b.date)-new Date(a.date));

    const tbody = document.getElementById("monthTableBody");
    tbody.innerHTML = filtered.length ? filtered.map(buildRow).join("") :
      `<tr><td colspan="8"><div class="fb-empty"><i class="bi bi-inbox"></i>No records match your filters</div></td></tr>`;
  }

  document.getElementById("monthSearchInput").addEventListener("input", fbDebounce((e)=>{
    state.monthSearch = e.target.value.trim().toLowerCase();
    const grid = document.getElementById("monthGrid");
    const activeChip = grid.querySelector(".fb-month-chip.active");
    if(activeChip){
      const byMonth = {};
      fbGetRecords(kind).forEach(r=>{
        const d = new Date(r.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        byMonth[key] = byMonth[key] || { label:`${FB_MONTHS[d.getMonth()]} ${d.getFullYear()}`, count:0, total:0, monthIdx:d.getMonth(), year:d.getFullYear() };
        byMonth[key].count++; byMonth[key].total += r.total;
      });
      renderMonthDetail(byMonth[state.month]);
    }
  }, 200));
  document.getElementById("monthCategoryFilter").addEventListener("change", (e)=>{
    state.monthCategory = e.target.value;
    document.getElementById("monthSearchInput").dispatchEvent(new Event("input"));
  });

  /* ---------- initial paint ---------- */
  renderAll();
}
