// js/records.js
import { SportsSalesAPI, ScentsSalesAPI } from './api.js';
import { 
    fbRequireRole, fbMountLiveClock, fbWireProfileMenu, fbLogout,
    fbFormatDateShort, fbFormatMoney, fbFormatDateDisplay, 
    fbEscapeHtml, fbToast, fbDebounce, FB_MONTHS
} from './utils.js';

const FB_CATEGORIES = {
    sports: ["Balls", "Jerseys", "Shorts", "Stockings", "Slides", "Sport Shoes", "Cones", "Wistles", "Shinguards"],
    scents: ["Perfume - Men", "Perfume - Women", "Unisex Perfume", "Body Spray", "Oud & Bakhoor", "Deodorant", "Air Freshener", "Lotion"]
};

export function fbInitRecordsPage(kind) {
    // Validate kind parameter
    if (!kind || (kind !== 'sports' && kind !== 'scents')) {
        console.error('Invalid kind parameter:', kind);
        fbToast('Invalid division specified.', 'error');
        return;
    }

    const session = fbRequireRole(kind === 'sports' ? 'sports_manager' : 'scents_manager');
    if (!session) return;

    fbMountLiveClock(document.getElementById("clockHost"));
    fbWireProfileMenu("profileTrigger", "profileDropdown");
    document.getElementById("logoutBtn").addEventListener("click", fbLogout);

    const categories = FB_CATEGORIES[kind];
    const API = kind === 'sports' ? SportsSalesAPI : ScentsSalesAPI;
    
    const state = { 
        view: "all", 
        month: null, 
        allSearch: "", 
        allCategory: "", 
        allSort: "newest", 
        monthSearch: "", 
        monthCategory: "" 
    };

    function fillCategorySelect(selectEl, withAllOption) {
        if (!selectEl) return;
        selectEl.innerHTML = (withAllOption ? '<option value="">All Categories</option>' : '') +
            categories.map(c => `<option value="${c}">${c}</option>`).join("");
    }
    
    const allCategoryFilter = document.getElementById("allCategoryFilter");
    const monthCategoryFilter = document.getElementById("monthCategoryFilter");
    const recCategory = document.getElementById("recCategory");
    
    fillCategorySelect(allCategoryFilter, true);
    fillCategorySelect(monthCategoryFilter, true);
    fillCategorySelect(recCategory, false);

    document.querySelectorAll("#viewTabs .fb-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll("#viewTabs .fb-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            state.view = tab.dataset.view;
            document.getElementById("section-all").classList.toggle("active", state.view === "all");
            document.getElementById("section-monthly").classList.toggle("active", state.view === "monthly");
            document.getElementById("section-inventory").classList.toggle("active", state.view === "inventory");
            if (state.view === "all") renderAll();
            else if (state.view === "monthly") renderMonthGrid();
            else renderInventory();
        });
    });

    const modalEl = document.getElementById("addRecordModal");
    if (!modalEl) {
        console.error('Add record modal not found');
        return;
    }
    const modal = new bootstrap.Modal(modalEl);
    const addFab = document.getElementById("addRecordFab");
    if (addFab) {
        addFab.addEventListener("click", () => {
            const form = document.getElementById("addRecordForm");
            if (form) form.reset();
            const dateInput = document.getElementById("recDate");
            if (dateInput) dateInput.value = fbFormatDateShort();
            const otherWrap = document.getElementById("recCategoryOtherWrap");
            if (otherWrap) otherWrap.style.display = "none";
            const totalPreview = document.getElementById("recTotalPreview");
            if (totalPreview) totalPreview.value = fbFormatMoney(0);
            modal.show();
        });
    }

    const catSelect = document.getElementById("recCategory");
    if (catSelect) {
        catSelect.addEventListener("change", () => {
            const otherWrap = document.getElementById("recCategoryOtherWrap");
            if (otherWrap) {
                otherWrap.style.display = catSelect.value === "Other" ? "block" : "none";
            }
        });
    }

    function updateTotalPreview() {
        const qty = Number(document.getElementById("recQty")?.value) || 0;
        const unit = Number(document.getElementById("recUnitPrice")?.value) || 0;
        const preview = document.getElementById("recTotalPreview");
        if (preview) preview.value = fbFormatMoney(qty * unit);
    }
    
    const qtyInput = document.getElementById("recQty");
    const unitInput = document.getElementById("recUnitPrice");
    if (qtyInput) qtyInput.addEventListener("input", updateTotalPreview);
    if (unitInput) unitInput.addEventListener("input", updateTotalPreview);

    const addForm = document.getElementById("addRecordForm");
    if (addForm) {
        addForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const category = catSelect?.value === "Other"
                ? (document.getElementById("recCategoryOther")?.value.trim() || "Other")
                : catSelect?.value || "Other";

            const data = {
                sale_date: document.getElementById("recDate")?.value || fbFormatDateShort(),
                customer_name: document.getElementById("recCustomer")?.value.trim() || "",
                item_name: document.getElementById("recItem")?.value.trim() || "",
                category: category,
                quantity: Number(document.getElementById("recQty")?.value) || 1,
                unit_price: Number(document.getElementById("recUnitPrice")?.value) || 0,
                notes: document.getElementById("recNotes")?.value.trim() || ""
            };

            try {
                await API.add(data);
                modal.hide();
                fbToast("Record saved successfully. Inventory updated.", "success");
                if (state.view === "all") renderAll();
                else if (state.view === "monthly") renderMonthGrid();
                else renderInventory();
            } catch (error) {
                fbToast(error.message || "Failed to save record.", "error");
            }
        });
    }

    document.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-delete-id]");
        if (!btn) return;
        const id = btn.dataset.deleteId;
        if (confirm("Delete this record? This cannot be undone. The sold quantity will be returned to inventory.")) {
            try {
                await API.delete(id);
                fbToast("Record deleted. Stock restored.", "warning");
                if (state.view === "all") renderAll();
                else if (state.view === "monthly") renderMonthGrid();
                else renderInventory();
            } catch (error) {
                fbToast(error.message || "Failed to delete record.", "error");
            }
        }
    });

    async function renderAllStats(records) {
        try {
            const stats = await API.getStats();
            const total = records.reduce((s, r) => s + parseFloat(r.total_price || 0), 0);
            const grid = document.getElementById("allStatsGrid");
            if (!grid) return;
            grid.innerHTML = `
                <div class="fb-stat-card">
                    <div class="fb-stat-label">Total Income (All Time)</div>
                    <div class="fb-stat-value">${fbFormatMoney(stats.total_income || total)}</div>
                    <div class="fb-stat-sub"><i class="bi bi-graph-up-arrow"></i> Across ${stats.total_records || records.length} sale${(stats.total_records || records.length) !== 1 ? "s" : ""}</div>
                </div>
                <div class="fb-stat-card">
                    <div class="fb-stat-label">Total Records</div>
                    <div class="fb-stat-value">${stats.total_records || records.length}</div>
                    <div class="fb-stat-sub"><i class="bi bi-receipt"></i> Items sold and logged</div>
                </div>
                <div class="fb-stat-card">
                    <div class="fb-stat-label">Average Sale Value</div>
                    <div class="fb-stat-value">${fbFormatMoney(stats.avg_sale_value || (records.length ? total / records.length : 0))}</div>
                    <div class="fb-stat-sub"><i class="bi bi-bar-chart-line"></i> Per transaction</div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    function buildRow(r) {
        return `
            <tr>
                <td class="mono text-muted-fb">${fbFormatDateDisplay(r.sale_date)}</td>
                <td>${fbEscapeHtml(r.customer_name)}</td>
                <td>${fbEscapeHtml(r.item_name)}</td>
                <td><span class="fb-badge fb-badge-category">${fbEscapeHtml(r.category)}</span></td>
                <td class="mono">${r.quantity}</td>
                <td class="mono">${fbFormatMoney(r.unit_price)}</td>
                <td class="mono fw-bold">${fbFormatMoney(r.total_price)}</td>
                <td><button class="fb-btn-outline" style="padding:5px 10px;" data-delete-id="${r.id}"><i class="bi bi-trash3"></i></button></td>
            </tr>
        `;
    }

    async function renderAll() {
        try {
            const params = {
                search: state.allSearch,
                category: state.allCategory,
                sort: state.allSort
            };
            const records = await API.getAll(params);
            renderAllStats(records);
            const tbody = document.getElementById("allTableBody");
            if (!tbody) return;
            tbody.innerHTML = records.length ? 
                records.map(buildRow).join("") :
                `<tr><td colspan="8"><div class="fb-empty"><i class="bi bi-inbox"></i>No records match your filters</div></td></tr>`;
        } catch (error) {
            fbToast(error.message || "Failed to load records.", "error");
        }
    }

    const searchInput = document.getElementById("allSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", fbDebounce((e) => {
            state.allSearch = e.target.value.trim().toLowerCase();
            renderAll();
        }, 200));
    }
    
    if (allCategoryFilter) {
        allCategoryFilter.addEventListener("change", (e) => {
            state.allCategory = e.target.value;
            renderAll();
        });
    }
    
    const sortSelect = document.getElementById("allSortSelect");
    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            state.allSort = e.target.value;
            renderAll();
        });
    }

    async function renderMonthGrid() {
        try {
            const currentYear = new Date().getFullYear();
            const monthlySummary = await API.getMonthlySummary(currentYear);
            const grid = document.getElementById("monthGrid");
            if (!grid) return;
            
            if (!monthlySummary || monthlySummary.length === 0) {
                grid.innerHTML = `<div class="fb-empty" style="grid-column:1/-1;"><i class="bi bi-calendar-x"></i>No records yet</div>`;
                const detail = document.getElementById("monthlyDetail");
                if (detail) detail.style.display = "none";
                return;
            }

            grid.innerHTML = monthlySummary.map(m => {
                const key = `${m.year}-${m.month}`;
                const active = state.month === key;
                return `<div class="fb-month-chip ${active ? "active" : ""}" data-month-key="${key}" data-year="${m.year}" data-month="${m.month}">
                    <div class="m-name">${FB_MONTHS[m.month - 1]} ${m.year}</div>
                    <div class="m-count">${m.total_records} record${m.total_records !== 1 ? "s" : ""}</div>
                    <div class="m-total">${fbFormatMoney(m.monthly_income)}</div>
                </div>`;
            }).join("");

            grid.querySelectorAll(".fb-month-chip").forEach(chip => {
                chip.addEventListener("click", () => {
                    state.month = chip.dataset.monthKey;
                    renderMonthGrid();
                    renderMonthDetail(parseInt(chip.dataset.year), parseInt(chip.dataset.month));
                });
            });

            const firstChip = grid.querySelector(".fb-month-chip");
            if (firstChip && !state.month) {
                state.month = firstChip.dataset.monthKey;
                firstChip.classList.add("active");
                renderMonthDetail(parseInt(firstChip.dataset.year), parseInt(firstChip.dataset.month));
            }
        } catch (error) {
            fbToast(error.message || "Failed to load monthly summary.", "error");
        }
    }

    async function renderMonthDetail(year, month) {
        try {
            const monthLabel = `${FB_MONTHS[month - 1]} ${year}`;
            const detail = document.getElementById("monthlyDetail");
            if (detail) detail.style.display = "block";
            
            const label = document.getElementById("monthlyLabel");
            if (label) label.textContent = monthLabel;

            const params = {
                month: month,
                year: year,
                search: state.monthSearch,
                category: state.monthCategory
            };
            const records = await API.getAll(params);
            
            const totalIncome = records.reduce((sum, r) => sum + parseFloat(r.total_price || 0), 0);
            const totalEl = document.getElementById("monthlyTotal");
            if (totalEl) totalEl.textContent = fbFormatMoney(totalIncome);
            
            const countEl = document.getElementById("monthlyCount");
            if (countEl) countEl.textContent = `${records.length} record${records.length !== 1 ? "s" : ""}`;

            const tbody = document.getElementById("monthTableBody");
            if (!tbody) return;
            tbody.innerHTML = records.length ? 
                records.map(buildRow).join("") :
                `<tr><td colspan="8"><div class="fb-empty"><i class="bi bi-inbox"></i>No records match your filters</div></td></tr>`;
        } catch (error) {
            fbToast(error.message || "Failed to load month details.", "error");
        }
    }

    const monthSearch = document.getElementById("monthSearchInput");
    if (monthSearch) {
        monthSearch.addEventListener("input", fbDebounce((e) => {
            state.monthSearch = e.target.value.trim().toLowerCase();
            const activeChip = document.querySelector("#monthGrid .fb-month-chip.active");
            if (activeChip) {
                renderMonthDetail(parseInt(activeChip.dataset.year), parseInt(activeChip.dataset.month));
            }
        }, 200));
    }
    
    if (monthCategoryFilter) {
        monthCategoryFilter.addEventListener("change", (e) => {
            state.monthCategory = e.target.value;
            if (monthSearch) monthSearch.dispatchEvent(new Event("input"));
        });
    }

    function stockClass(amount) {
        if (amount <= 0) return { cls: "stock-out", pill: "out", label: "Out of stock" };
        if (amount <= 5) return { cls: "stock-low", pill: "low", label: "Low stock" };
        return { cls: "stock-ok", pill: "ok", label: "In stock" };
    }

    async function renderInventory() {
        try {
            const inventory = await API.getInventory();
            const stats = await API.getInventoryStats();
            
            const grid = document.getElementById("inventoryGrid");
            if (!grid) return;
            grid.innerHTML = inventory.map(entry => {
                const s = stockClass(parseFloat(entry.stock_quantity));
                return `<div class="fb-inv-card ${s.cls}">
                    <div class="inv-cat">
                        <span>${fbEscapeHtml(entry.category)}</span>
                        <span class="fb-inv-pill ${s.pill}">${s.label}</span>
                    </div>
                    <div class="inv-qty">${entry.stock_quantity}</div>
                    <div class="inv-unit">${fbEscapeHtml(entry.unit)} available</div>
                </div>`;
            }).join("");

            const summary = document.getElementById("inventorySummary");
            if (summary) {
                summary.innerHTML = `
                    <div class="fb-stat-card">
                        <div class="fb-stat-label">Categories Tracked</div>
                        <div class="fb-stat-value">${stats.categories_tracked || inventory.length}</div>
                        <div class="fb-stat-sub"><i class="bi bi-boxes"></i> Across this division</div>
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
            }
        } catch (error) {
            fbToast(error.message || "Failed to load inventory.", "error");
        }
    }

    // Initial render
    renderAll();
}