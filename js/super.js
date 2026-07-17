// js/super.js
import { SuperAPI, AuthAPI } from './api.js';
import {
    fbRequireRole, fbMountLiveClock, fbWireProfileMenu, fbLogout,
    fbFormatDateLong, fbFormatMoney, fbFormatDateDisplay,
    fbEscapeHtml, fbToast
} from './utils.js';

const FB_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const FB_CATEGORIES = {
    sports: ["Balls", "Jerseys", "Shorts", "Stockings", "Slides", "Sport Shoes", "Cones", "Wistles", "Shinguards"],
    scents: ["Perfume - Men", "Perfume - Women", "Unisex Perfume", "Body Spray", "Oud & Bakhoor", "Deodorant", "Air Freshener", "Lotion"]
};

(function() {
    const session = fbRequireRole("super_manager");
    if (!session) return;

    fbMountLiveClock(document.getElementById("clockHost"));
    fbWireProfileMenu("profileTrigger", "profileDropdown");
    document.getElementById("logoutBtn").addEventListener("click", fbLogout);

    const charts = {};
    let invActiveKind = "sports";

    const mainNavBtns = document.querySelectorAll("#mainNav button");
    mainNavBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            mainNavBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const target = btn.dataset.section;
            document.querySelectorAll(".fb-section").forEach(sec => sec.classList.remove("active"));
            let el;
            if (target === "staffs") el = document.getElementById("section-staffs");
            else if (target === "inventory") el = document.getElementById("section-inventory");
            else el = document.getElementById(`division-${target}`);
            el.classList.add("active");
            if (target === "sports" || target === "scents") refreshDivision(target);
            if (target === "inventory") renderInventoryPanel(invActiveKind);
        });
    });

    document.querySelectorAll(".fb-section[data-kind]").forEach(section => {
        const kind = section.dataset.kind;
        section.querySelectorAll(".division-tabs .fb-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                section.querySelectorAll(".division-tabs .fb-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                section.querySelectorAll(".sub-section").forEach(s => s.style.display = "none");
                section.querySelector(`[data-sub-section="${tab.dataset.sub}"]`).style.display = "block";
                if (tab.dataset.sub === "graph") renderGraph(kind, section);
            });
        });
        section.querySelector(".graph-select")?.addEventListener("change", () => renderGraph(kind, section));
    });

    function buildRow(r, showTime) {
        return `<tr>
            <td class="mono text-muted-fb">${showTime ? new Date(r.created_at).toLocaleTimeString() : fbFormatDateDisplay(r.sale_date)}</td>
            <td>${fbEscapeHtml(r.customer_name)}</td>
            <td>${fbEscapeHtml(r.item_name)}</td>
            <td><span class="fb-badge fb-badge-category">${fbEscapeHtml(r.category)}</span></td>
            <td class="mono">${r.quantity}</td>
            <td class="mono">${fbFormatMoney(r.unit_price)}</td>
            <td class="mono fw-bold">${fbFormatMoney(r.total_price)}</td>
        </tr>`;
    }

    function emptyRow(cols) {
        return `<tr><td colspan="${cols}"><div class="fb-empty"><i class="bi bi-inbox"></i>No records found</div></td></tr>`;
    }

    async function renderToday(kind, section) {
        try {
            const result = kind === 'sports' 
                ? await SuperAPI.getSportsToday() 
                : await SuperAPI.getScentsToday();
            
            section.querySelector(".today-label").textContent = fbFormatDateLong();
            section.querySelector(".today-total").textContent = fbFormatMoney(result.totalIncome || 0);
            section.querySelector(".today-count").textContent = `${result.records.length} record${result.records.length !== 1 ? "s" : ""} today`;
            
            const tbody = section.querySelector(".today-table tbody");
            tbody.innerHTML = result.records.length ? 
                result.records.map(r => buildRow(r, true)).join("") : 
                emptyRow(7);
        } catch (error) {
            fbToast(error.message || "Failed to load today's records.", "error");
        }
    }

    // FIXED: Weekly now fetches records for the selected day
    async function renderWeekly(kind, section, selectedDayName) {
        try {
            selectedDayName = selectedDayName || "Total";
            const result = kind === 'sports' 
                ? await SuperAPI.getSportsWeekly() 
                : await SuperAPI.getScentsWeekly();
            
            const grid = section.querySelector(".weekly-day-grid");
            const weekData = result.weeklyData || [];
            const weekTotal = result.weeklyTotal || 0;

            grid.innerHTML = weekData.map(d => {
                const active = selectedDayName === d.day_name;
                return `<div class="fb-day-chip ${active ? "active" : ""}" data-day-name="${d.day_name}" data-date="${d.date}">
                    <div class="d-name">${d.day_name.slice(0, 3)}</div>
                    <div class="d-date mono">${d.date.slice(5)}</div>
                    <div class="d-total">${fbFormatMoney(d.daily_income)}</div>
                </div>`;
            }).join("") + `<div class="fb-day-chip ${selectedDayName === "Total" ? "active" : ""}" data-day-name="Total">
                <div class="d-name">Total</div>
                <div class="d-date mono">Last 7d</div>
                <div class="d-total">${fbFormatMoney(weekTotal)}</div>
            </div>`;

            grid.querySelectorAll(".fb-day-chip").forEach(chip => {
                chip.addEventListener("click", () => renderWeekly(kind, section, chip.dataset.dayName));
            });

            let detailLabel, detailTotal, detailRecords = [];
            
            if (selectedDayName === "Total") {
                detailLabel = "This week (last 7 days)";
                detailTotal = weekTotal;
                // Fetch all records for the week
                try {
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    const allRecords = kind === 'sports' 
                        ? await SuperAPI.getSportsMonthly(today.getMonth() + 1, today.getFullYear())
                        : await SuperAPI.getScentsMonthly(today.getMonth() + 1, today.getFullYear());
                    
                    if (allRecords && allRecords.records) {
                        detailRecords = allRecords.records.filter(r => {
                            const d = new Date(r.sale_date);
                            return d >= weekAgo && d <= today;
                        });
                    }
                } catch (e) {
                    console.error('Error fetching week records:', e);
                }
            } else {
                // Find the selected day's data
                const found = weekData.find(d => d.day_name === selectedDayName);
                if (found) {
                    detailLabel = `${found.day_name}, ${found.date}`;
                    detailTotal = found.daily_income;
                    // Fetch records for this specific day
                    try {
                        const dateStr = found.date;
                        const allRecords = kind === 'sports' 
                            ? await SuperAPI.getSportsMonthly(new Date(dateStr).getMonth() + 1, new Date(dateStr).getFullYear())
                            : await SuperAPI.getScentsMonthly(new Date(dateStr).getMonth() + 1, new Date(dateStr).getFullYear());
                        
                        if (allRecords && allRecords.records) {
                            detailRecords = allRecords.records.filter(r => r.sale_date === dateStr);
                        }
                    } catch (e) {
                        console.error('Error fetching day records:', e);
                    }
                } else {
                    detailLabel = "No data";
                    detailTotal = 0;
                }
            }

            section.querySelector(".weekly-detail-label").textContent = "Total income — " + detailLabel;
            section.querySelector(".weekly-detail-total").textContent = fbFormatMoney(detailTotal || 0);
            section.querySelector(".weekly-detail-count").textContent = `${detailRecords.length} record${detailRecords.length !== 1 ? "s" : ""}`;
            
            const tbody = section.querySelector(".weekly-table tbody");
            tbody.innerHTML = detailRecords.length ? 
                detailRecords.map(r => buildRow(r, false)).join("") : 
                emptyRow(7);
        } catch (error) {
            fbToast(error.message || "Failed to load weekly records.", "error");
        }
    }

    async function renderMonthly(kind, section, selectedKey) {
        try {
            const currentYear = new Date().getFullYear();
            const result = kind === 'sports' 
                ? await SuperAPI.getSportsMonthly(new Date().getMonth() + 1, currentYear)
                : await SuperAPI.getScentsMonthly(new Date().getMonth() + 1, currentYear);
            
            const grid = section.querySelector(".monthly-grid");
            const monthRecords = result.records || [];
            const totalIncome = result.totalIncome || 0;

            if (monthRecords.length === 0) {
                grid.innerHTML = `<div class="fb-empty" style="grid-column:1/-1;"><i class="bi bi-calendar-x"></i>No records yet</div>`;
                section.querySelector(".monthly-detail-card").style.display = "none";
                return;
            }

            const monthName = FB_MONTHS[new Date().getMonth()];
            grid.innerHTML = `<div class="fb-month-chip active" data-month-key="current">
                <div class="m-name">${monthName} ${currentYear}</div>
                <div class="m-count">${monthRecords.length} record${monthRecords.length !== 1 ? "s" : ""}</div>
                <div class="m-total">${fbFormatMoney(totalIncome)}</div>
            </div>`;

            section.querySelector(".monthly-detail-card").style.display = "flex";
            section.querySelector(".monthly-detail-label").textContent = `${monthName} ${currentYear}`;
            section.querySelector(".monthly-detail-total").textContent = fbFormatMoney(totalIncome);
            section.querySelector(".monthly-detail-count").textContent = `${monthRecords.length} record${monthRecords.length !== 1 ? "s" : ""}`;

            const tbody = section.querySelector(".monthly-table tbody");
            tbody.innerHTML = monthRecords.length ? 
                monthRecords.map(r => buildRow(r, false)).join("") : 
                emptyRow(7);
        } catch (error) {
            fbToast(error.message || "Failed to load monthly records.", "error");
        }
    }

    async function renderYearly(kind, section, selectedYear) {
        try {
            const year = selectedYear || new Date().getFullYear();
            const result = kind === 'sports' 
                ? await SuperAPI.getSportsYearly(year)
                : await SuperAPI.getScentsYearly(year);
            
            const records = result.records || [];
            const totalIncome = result.totalIncome || 0;

            const grid = section.querySelector(".yearly-year-grid");
            grid.innerHTML = `<div class="fb-day-chip active" data-year="${year}">
                <div class="d-name">${year}</div>
                <div class="d-total">${fbFormatMoney(totalIncome)}</div>
            </div>`;

            section.querySelector(".yearly-detail-label").textContent = `Grand Total — ${year}`;
            section.querySelector(".yearly-detail-total").textContent = fbFormatMoney(totalIncome);

            const byMonth = Array.from({ length: 12 }, () => ({ count: 0, total: 0 }));
            records.forEach(r => {
                const idx = new Date(r.sale_date).getMonth();
                byMonth[idx].count++;
                byMonth[idx].total += parseFloat(r.total_price || 0);
            });

            const tbody = section.querySelector(".yearly-table tbody");
            tbody.innerHTML = FB_MONTHS.map((name, idx) => {
                const m = byMonth[idx];
                if (!m.count) return "";
                return `<tr><td>${name}</td><td class="mono">${m.count}</td><td class="mono fw-bold">${fbFormatMoney(m.total)}</td></tr>`;
            }).join("") || emptyRow(3);
        } catch (error) {
            fbToast(error.message || "Failed to load yearly records.", "error");
        }
    }

    // FIXED: Graph now handles different data structures
    async function renderGraph(kind, section) {
        const select = section.querySelector(".graph-select");
        const mode = select.value;
        const canvas = section.querySelector(".graph-canvas");
        const accent = kind === "sports" ? "#18E0A6" : "#E0A64C";

        try {
            let labels, data, title;

            if (mode === "Total") {
                const result = await SuperAPI.getWeeklyOverview(kind);
                const weekData = result || [];
                const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                labels = days.map(d => d.slice(0, 3));
                data = days.map(day => {
                    const found = weekData.find(w => w.day === day);
                    return found ? parseFloat(found.total) : 0;
                });
                title = "Last 7 days — combined daily totals";
            } else {
                const result = await SuperAPI.getDayTrend(kind, mode);
                const trendData = result || [];
                
                // Handle different possible data structures
                labels = trendData.map(d => {
                    // Check if date property exists (from backend)
                    if (d.date) {
                        return d.date.slice(5);
                    }
                    // Check if sale_date exists
                    if (d.sale_date) {
                        return d.sale_date.slice(5);
                    }
                    // Fallback to index
                    return `Day ${trendData.indexOf(d) + 1}`;
                });
                
                data = trendData.map(d => {
                    // Check if total property exists
                    if (d.total) {
                        return parseFloat(d.total);
                    }
                    // Check if total_price exists
                    if (d.total_price) {
                        return parseFloat(d.total_price);
                    }
                    // Check if daily_income exists
                    if (d.daily_income) {
                        return parseFloat(d.daily_income);
                    }
                    return 0;
                });
                
                title = `${mode} trend — last 8 occurrences`;
            }

            if (charts[kind]) { charts[kind].destroy(); }

            const ctx = canvas.getContext("2d");
            const gradient = ctx.createLinearGradient(0, 0, 0, 320);
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
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 900, easing: "easeOutQuart" },
                    plugins: {
                        legend: { 
                            display: true, 
                            labels: { color: "#9AA3B2", font: { family: "Inter" } } 
                        },
                        tooltip: {
                            backgroundColor: "#171C27",
                            borderColor: accent,
                            borderWidth: 1,
                            titleColor: "#F4F6F8",
                            bodyColor: "#F4F6F8",
                            padding: 12,
                            cornerRadius: 10,
                            callbacks: { 
                                label: (ctx) => " " + fbFormatMoney(ctx.parsed.y) 
                            }
                        }
                    },
                    scales: {
                        x: { 
                            ticks: { color: "#9AA3B2" }, 
                            grid: { color: "rgba(255,255,255,0.04)" } 
                        },
                        y: { 
                            ticks: { 
                                color: "#9AA3B2", 
                                callback: (v) => (v / 1000) + "k" 
                            }, 
                            grid: { color: "rgba(255,255,255,0.06)" } 
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Graph error:', error);
            fbToast(error.message || "Failed to load graph data.", "error");
        }
    }

    async function refreshDivision(kind) {
        const section = document.getElementById(`division-${kind}`);
        await renderToday(kind, section);
        await renderWeekly(kind, section);
        await renderMonthly(kind, section);
        await renderYearly(kind, section);
    }

    refreshDivision("sports");
    refreshDivision("scents");

    const invSubTabs = document.querySelectorAll("#inventoryDivisionTabs .fb-tab");
    invSubTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            invSubTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            invActiveKind = tab.dataset.invKind;
            document.querySelectorAll(".inv-sub-panel").forEach(p => p.classList.remove("active"));
            document.getElementById(`inv-panel-${invActiveKind}`).classList.add("active");
            renderInventoryPanel(invActiveKind);
        });
    });

    function stockMeta(amount) {
        const val = parseFloat(amount) || 0;
        if (val <= 0) return { cls: "stock-out", pill: "out", label: "Out of stock" };
        if (val <= 5) return { cls: "stock-low", pill: "low", label: "Low stock" };
        return { cls: "stock-ok", pill: "ok", label: "In stock" };
    }

    async function renderInventoryPanel(kind) {
        try {
            const inventory = await SuperAPI.getInventory(kind);
            const stats = await SuperAPI.getInventoryStats(kind);
            
            const grid = document.getElementById(`inv-grid-${kind}`);
            grid.innerHTML = inventory.map(entry => {
                const s = stockMeta(entry.stock_quantity);
                return `<div class="fb-inv-card ${s.cls}">
                    <div class="inv-cat">
                        <span>${fbEscapeHtml(entry.category)}</span>
                        <span class="fb-inv-pill ${s.pill}">${s.label}</span>
                    </div>
                    <div class="inv-qty">${entry.stock_quantity}</div>
                    <div class="inv-unit">${fbEscapeHtml(entry.unit)} available</div>
                </div>`;
            }).join("");

            document.getElementById(`inv-summary-${kind}`).innerHTML = `
                <div class="fb-stat-card">
                    <div class="fb-stat-label">Categories Tracked</div>
                    <div class="fb-stat-value">${stats.categories_tracked || inventory.length}</div>
                    <div class="fb-stat-sub"><i class="bi bi-boxes"></i> ${kind === "sports" ? "Sports" : "Scents"} Division</div>
                </div>
                <div class="fb-stat-card">
                    <div class="fb-stat-label">Units In Stock</div>
                    <div class="fb-stat-value">${stats.units_in_stock || 0}</div>
                    <div class="fb-stat-sub"><i class="bi bi-box-seam"></i> Combined across categories</div>
                </div>
                <div class="fb-stat-card">
                    <div class="fb-stat-label">Needs Attention</div>
                    <div class="fb-stat-value">${stats.needs_attention || 0}</div>
                    <div class="fb-stat-sub"><i class="bi bi-exclamation-triangle"></i> Low or out of stock</div>
                </div>
            `;
        } catch (error) {
            fbToast(error.message || "Failed to load inventory.", "error");
        }
    }

    renderInventoryPanel("sports");
    renderInventoryPanel("scents");

    const stockModalEl = document.getElementById("addStockModal");
    const stockModal = new bootstrap.Modal(stockModalEl);
    const stockDivisionSelect = document.getElementById("stockDivision");
    const stockCategorySelect = document.getElementById("stockCategory");

    function fillStockCategories(kind) {
        stockCategorySelect.innerHTML = FB_CATEGORIES[kind].map(c => `<option value="${c}">${c}</option>`).join("");
    }

    document.getElementById("addStockFab").addEventListener("click", () => {
        stockDivisionSelect.value = invActiveKind;
        fillStockCategories(invActiveKind);
        document.getElementById("stockQtyText").value = "";
        document.getElementById("stockFormError").classList.remove("show");
        stockModal.show();
    });

    stockDivisionSelect.addEventListener("change", () => fillStockCategories(stockDivisionSelect.value));

    function fbParseQuantityText(text) {
        const str = String(text || "").trim();
        const m = str.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        if (m) {
            return { amount: parseFloat(m[1]) || 0, unit: (m[2] || "").trim() || "units" };
        }
        return { amount: 0, unit: str || "units" };
    }

    document.getElementById("addStockForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const kind = stockDivisionSelect.value;
        const category = stockCategorySelect.value;
        const qtyText = document.getElementById("stockQtyText").value.trim();
        const errEl = document.getElementById("stockFormError");
        const errText = document.getElementById("stockFormErrorText");

        const parsed = fbParseQuantityText(qtyText);
        if (!qtyText || !(parsed.amount > 0)) {
            errText.textContent = 'Please enter a quantity like "10 pairs" or "25 bottles".';
            errEl.classList.add("show");
            return;
        }
        errEl.classList.remove("show");

        try {
            await SuperAPI.addInventory({
                division: kind,
                category: category,
                quantity: parsed.amount,
                unit: parsed.unit || "units"
            });
            stockModal.hide();
            fbToast(`Added ${qtyText} to "${category}" (${kind === "sports" ? "Sports" : "Scents"}).`, "success");
            renderInventoryPanel(kind);
        } catch (error) {
            fbToast(error.message || "Failed to add stock.", "error");
        }
    });

    const profileModalEl = document.getElementById("editProfileModal");
    const profileModal = new bootstrap.Modal(profileModalEl);

    document.getElementById("editProfileBtn").addEventListener("click", () => {
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

    document.getElementById("profileSendOtpBtn").addEventListener("click", async () => {
        const newPass = document.getElementById("newPasswordInput").value;
        const confirmPass = document.getElementById("confirmPasswordInput").value;
        const errEl = document.getElementById("profileFormError");
        const errText = document.getElementById("profileFormErrorText");

        if (!newPass || newPass.length < 8) {
            errText.textContent = "New password must be at least 8 characters.";
            errEl.classList.add("show");
            return;
        }
        if (newPass !== confirmPass) {
            errText.textContent = "Passwords do not match.";
            errEl.classList.add("show");
            return;
        }
        errEl.classList.remove("show");

        try {
            await SuperAPI.sendManagerOTP();
            fbToast("Verification code sent to your email.", "info");
            document.getElementById("profileStepForm").style.display = "none";
            document.getElementById("profileStepOtp").style.display = "block";
            document.getElementById("profileSendOtpBtn").style.display = "none";
            document.getElementById("profileVerifyOtpBtn").style.display = "inline-block";
            wireOtpInputs("profileOtpInputs");
        } catch (error) {
            fbToast(error.message || "Failed to send verification code.", "error");
        }
    });

    document.getElementById("profileVerifyOtpBtn").addEventListener("click", async () => {
        const code = readOtpInputs("profileOtpInputs");
        const errEl = document.getElementById("profileOtpError");
        const errText = document.getElementById("profileOtpErrorText");
        
        if (code.length < 6) {
            errText.textContent = "Enter the full 6-digit code.";
            errEl.classList.add("show");
            return;
        }
        errEl.classList.remove("show");

        try {
            const newPass = document.getElementById("newPasswordInput").value;
            await AuthAPI.updateProfile('Fourbrothers@2026', newPass, newPass);
            document.getElementById("profileStepOtp").style.display = "none";
            document.getElementById("profileVerifyOtpBtn").style.display = "none";
            document.getElementById("profileStepSuccess").style.display = "block";
            fbToast("Password changed successfully.", "success");
            setTimeout(() => profileModal.hide(), 1400);
        } catch (error) {
            errText.textContent = error.message || "Failed to update password.";
            errEl.classList.add("show");
        }
    });

    const staffRow = document.getElementById("staffCardsRow");

    async function renderStaffCards() {
        try {
            const managers = await SuperAPI.getManagers();
            staffRow.innerHTML = managers.map(m => {
                const roleLabel = m.role === 'sports_manager' ? 'Sports Manager' : 'Scents Manager';
                const icon = m.role === 'sports_manager' ? 'bi-dribbble' : 'bi-flower2';
                return `<div class="col-md-6">
                    <div class="fb-staff-card">
                        <span class="fb-avatar"><i class="bi ${icon}"></i></span>
                        <div class="flex-grow-1">
                            <div class="fw-bold">${roleLabel}</div>
                            <div class="mono text-muted-fb" style="font-size:0.85rem;">${m.email}</div>
                            <div class="mt-1">
                                <span class="fb-badge" style="background:var(--sports-glow);border-color:var(--sports);color:var(--sports);">
                                    <i class="bi bi-check-circle"></i> Active
                                </span>
                            </div>
                        </div>
                        <div class="d-flex flex-column gap-2">
                            <button class="fb-btn-outline" data-staff-edit='${JSON.stringify(m)}'><i class="bi bi-pencil"></i> Edit</button>
                        </div>
                    </div>
                </div>`;
            }).join("");

            staffRow.querySelectorAll("[data-staff-edit]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const manager = JSON.parse(btn.dataset.staffEdit);
                    openStaffEdit(manager);
                });
            });
        } catch (error) {
            fbToast(error.message || "Failed to load staff.", "error");
        }
    }

    renderStaffCards();

    const staffModalEl = document.getElementById("staffEditModal");
    const staffModal = new bootstrap.Modal(staffModalEl);
    let staffEditingId = null;

    function openStaffEdit(manager) {
        staffEditingId = manager.id;
        document.getElementById("staffEditEmail").value = manager.email;
        document.getElementById("staffEditPassword").value = "";
        document.getElementById("staffStepForm").style.display = "block";
        document.getElementById("staffStepOtp").style.display = "none";
        document.getElementById("staffStepSuccess").style.display = "none";
        document.getElementById("staffSendOtpBtn").style.display = "inline-block";
        document.getElementById("staffVerifyOtpBtn").style.display = "none";
        document.getElementById("staffFormError").classList.remove("show");
        staffModal.show();
    }

    document.getElementById("staffSendOtpBtn").addEventListener("click", async () => {
        const newEmail = document.getElementById("staffEditEmail").value.trim();
        const newPassword = document.getElementById("staffEditPassword").value;
        const errEl = document.getElementById("staffFormError");
        const errText = document.getElementById("staffFormErrorText");

        if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
            errText.textContent = "Please enter a valid email address.";
            errEl.classList.add("show");
            return;
        }
        errEl.classList.remove("show");

        try {
            await SuperAPI.sendManagerOTP();
            fbToast("Verification code sent to your email.", "info");
            document.getElementById("staffStepForm").style.display = "none";
            document.getElementById("staffStepOtp").style.display = "block";
            document.getElementById("staffSendOtpBtn").style.display = "none";
            document.getElementById("staffVerifyOtpBtn").style.display = "inline-block";
            wireOtpInputs("staffOtpInputs");
        } catch (error) {
            fbToast(error.message || "Failed to send verification code.", "error");
        }
    });

    document.getElementById("staffVerifyOtpBtn").addEventListener("click", async () => {
        const code = readOtpInputs("staffOtpInputs");
        const errEl = document.getElementById("staffOtpError");
        const errText = document.getElementById("staffOtpErrorText");
        
        if (code.length < 6) {
            errText.textContent = "Enter the full 6-digit code.";
            errEl.classList.add("show");
            return;
        }
        errEl.classList.remove("show");

        try {
            const newEmail = document.getElementById("staffEditEmail").value.trim();
            const newPassword = document.getElementById("staffEditPassword").value;
            await SuperAPI.updateManager(staffEditingId, {
                email: newEmail,
                newPassword: newPassword || undefined,
                otp: code
            });
            document.getElementById("staffStepOtp").style.display = "none";
            document.getElementById("staffVerifyOtpBtn").style.display = "none";
            document.getElementById("staffStepSuccess").style.display = "block";
            fbToast("Staff account updated successfully.", "success");
            renderStaffCards();
            setTimeout(() => staffModal.hide(), 1400);
        } catch (error) {
            errText.textContent = error.message || "Failed to update staff.";
            errEl.classList.add("show");
        }
    });

    function wireOtpInputs(containerId) {
        const inputs = [...document.getElementById(containerId).querySelectorAll("input")];
        inputs.forEach(i => { i.value = ""; i.classList.remove("filled"); });
        inputs[0].focus();
        inputs.forEach((inp, idx) => {
            inp.oninput = () => {
                inp.value = inp.value.replace(/[^0-9]/g, "");
                if (inp.value) {
                    inp.classList.add("filled");
                    if (idx < inputs.length - 1) inputs[idx + 1].focus();
                } else {
                    inp.classList.remove("filled");
                }
            };
            inp.onkeydown = (e) => {
                if (e.key === "Backspace" && !inp.value && idx > 0) inputs[idx - 1].focus();
            };
        });
    }

    function readOtpInputs(containerId) {
        return [...document.getElementById(containerId).querySelectorAll("input")].map(i => i.value).join("");
    }
})();