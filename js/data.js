/* ============================================================
   FBBMS DATA LAYER
   Frontend-only demo: all data lives in localStorage.
   In a real deployment this would be replaced by API calls
   to a backend + real email delivery for OTP.
   ============================================================ */

const FB_KEYS = {
  STAFF: "fbbms_staff",
  RECORDS_SPORTS: "fbbms_records_sports",
  RECORDS_SCENTS: "fbbms_records_scents",
  INVENTORY_SPORTS: "fbbms_inventory_sports",
  INVENTORY_SCENTS: "fbbms_inventory_scents",
  SESSION: "fbbms_session",
  OTP: "fbbms_otp"
};

const FB_CATEGORIES = {
  sports: ["Football","Basketball","Volleyball","Netball","Gym Equipment","Jerseys & Apparel","Footwear","Accessories","Other"],
  scents: ["Perfume - Men","Perfume - Women","Unisex Perfume","Body Spray","Oud & Bakhoor","Deodorant","Air Freshener","Other"]
};

function fbInitDatabase(){
  if(!localStorage.getItem(FB_KEYS.STAFF)){
    localStorage.setItem(FB_KEYS.STAFF, JSON.stringify({
      sports: { email:"sports@fourbrothers.online", password:"Fourbrothers@2026", name:"Sports Manager", active:true },
      scents: { email:"scents@fourbrothers.online", password:"Fourbrothers@2026", name:"Scents Manager", active:true },
      super:  { email:"manager@fourbrothers.online", password:"Fourbrothers@2026", name:"Super Manager", active:true }
    }));
  }
  if(!localStorage.getItem(FB_KEYS.RECORDS_SPORTS)){
    localStorage.setItem(FB_KEYS.RECORDS_SPORTS, JSON.stringify(fbSeedRecords("sports")));
  }
  if(!localStorage.getItem(FB_KEYS.RECORDS_SCENTS)){
    localStorage.setItem(FB_KEYS.RECORDS_SCENTS, JSON.stringify(fbSeedRecords("scents")));
  }
  if(!localStorage.getItem(FB_KEYS.INVENTORY_SPORTS)){
    localStorage.setItem(FB_KEYS.INVENTORY_SPORTS, JSON.stringify(fbSeedInventory("sports")));
  }
  if(!localStorage.getItem(FB_KEYS.INVENTORY_SCENTS)){
    localStorage.setItem(FB_KEYS.INVENTORY_SCENTS, JSON.stringify(fbSeedInventory("scents")));
  }
}

function fbSeedRecords(kind){
  const items = kind === "sports"
    ? [["Football",FB_CATEGORIES.sports[0]],["Basketball",FB_CATEGORIES.sports[1]],["Jersey - Simba SC",FB_CATEGORIES.sports[5]],["Running Shoes",FB_CATEGORIES.sports[6]],["Gym Gloves",FB_CATEGORIES.sports[7]]]
    : [["Oud Al Malaki",FB_CATEGORIES.scents[4]],["Bleu Homme",FB_CATEGORIES.scents[0]],["Rose Noire",FB_CATEGORIES.scents[1]],["Fresh Unisex",FB_CATEGORIES.scents[2]],["Deo Spray",FB_CATEGORIES.scents[5]]];
  const customers = ["John Mwakalinga","Amina Hassan","Peter Kileo","Grace Mushi","Ibrahim Suedi","Neema Joseph","David Mrema"];
  const out = [];
  const now = new Date();
  for(let i=0;i<26;i++){
    const daysAgo = Math.floor(Math.random()*75);
    const d = new Date(now); d.setDate(d.getDate()-daysAgo);
    const [item, category] = items[Math.floor(Math.random()*items.length)];
    const qty = Math.floor(Math.random()*4)+1;
    const unit = (Math.floor(Math.random()*18)+2) * 5000;
    out.push({
      id: fbGenerateId(kind==="sports"?"SPT":"SCT"),
      date: fbFormatDateShort(d),
      customer: customers[Math.floor(Math.random()*customers.length)],
      item, category, quantity: qty, unitPrice: unit, total: qty*unit,
      addedAt: d.toISOString()
    });
  }
  return out.sort((a,b)=> new Date(b.date) - new Date(a.date));
}

/* ---------------- Inventory seed ---------------- */
function fbSeedInventory(kind){
  const inv = {};
  FB_CATEGORIES[kind].forEach(c=>{
    if(c === "Other"){ inv[c] = { amount:0, unit:"units" }; return; }
    let unit = "pieces";
    if(/footwear|shoes/i.test(c)) unit = "pairs";
    else if(/jersey|apparel/i.test(c)) unit = "pieces";
    else if(/perfume|spray|deodorant|freshener|oud/i.test(c)) unit = "bottles";
    inv[c] = { amount: Math.floor(Math.random()*30)+15, unit };
  });
  return inv;
}

/* ---------------- Staff ---------------- */
function fbGetStaff(){ return JSON.parse(localStorage.getItem(FB_KEYS.STAFF)); }
function fbSaveStaff(staff){ localStorage.setItem(FB_KEYS.STAFF, JSON.stringify(staff)); }
function fbUpdateStaffAccount(role, updates){
  const staff = fbGetStaff();
  staff[role] = { ...staff[role], ...updates };
  fbSaveStaff(staff);
}

/* ---------------- Records ---------------- */
function fbGetRecords(kind){
  return JSON.parse(localStorage.getItem(kind==="sports"?FB_KEYS.RECORDS_SPORTS:FB_KEYS.RECORDS_SCENTS)) || [];
}
function fbSaveRecords(kind, records){
  localStorage.setItem(kind==="sports"?FB_KEYS.RECORDS_SPORTS:FB_KEYS.RECORDS_SCENTS, JSON.stringify(records));
}
function fbAddRecord(kind, record){
  const records = fbGetRecords(kind);
  record.id = fbGenerateId(kind==="sports"?"SPT":"SCT");
  record.addedAt = new Date().toISOString();
  record.total = Number(record.quantity) * Number(record.unitPrice);
  records.unshift(record);
  fbSaveRecords(kind, records);
  // Sales automatically deduct stock from the matching inventory category
  fbDeductInventory(kind, record.category, Number(record.quantity) || 0);
  return record;
}
function fbDeleteRecord(kind, id){
  const records = fbGetRecords(kind);
  const target = records.find(r=> r.id === id);
  fbSaveRecords(kind, records.filter(r=> r.id !== id));
  // Deleting a sale record restores the stock that was deducted for it
  if(target){
    fbAddInventoryStock(kind, target.category, `${target.quantity} ${fbGetInventory(kind)[target.category]?.unit || "units"}`.trim());
  }
}

/* ---------------- Inventory ---------------- */
function fbGetInventory(kind){
  const key = kind === "sports" ? FB_KEYS.INVENTORY_SPORTS : FB_KEYS.INVENTORY_SCENTS;
  return JSON.parse(localStorage.getItem(key)) || {};
}
function fbSaveInventory(kind, inv){
  const key = kind === "sports" ? FB_KEYS.INVENTORY_SPORTS : FB_KEYS.INVENTORY_SCENTS;
  localStorage.setItem(key, JSON.stringify(inv));
}

/* Parses free text like "10 pairs", "25", "3 bottles" into { amount, unit } */
function fbParseQuantityText(text){
  const str = String(text || "").trim();
  const m = str.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if(m){
    return { amount: parseFloat(m[1]) || 0, unit: (m[2] || "").trim() || "units" };
  }
  return { amount: 0, unit: str || "units" };
}

/* Adds stock to a category. Accepts free text quantity, e.g. "10 pairs". */
function fbAddInventoryStock(kind, category, qtyText){
  const inv = fbGetInventory(kind);
  const parsed = fbParseQuantityText(qtyText);
  if(!inv[category]) inv[category] = { amount: 0, unit: parsed.unit || "units" };
  inv[category].amount = Math.round((inv[category].amount + parsed.amount) * 100) / 100;
  if(parsed.unit) inv[category].unit = parsed.unit;
  fbSaveInventory(kind, inv);
  return inv[category];
}

/* Deducts stock when a sale record is added */
function fbDeductInventory(kind, category, qty){
  const inv = fbGetInventory(kind);
  if(!inv[category]) inv[category] = { amount: 0, unit: "units" };
  inv[category].amount = Math.round((inv[category].amount - Number(qty || 0)) * 100) / 100;
  fbSaveInventory(kind, inv);
  return inv[category];
}

/* Returns a display-ready list: every known category plus any custom ones on record */
function fbGetInventoryList(kind){
  const inv = fbGetInventory(kind);
  const known = FB_CATEGORIES[kind];
  const out = known.map(c => ({
    category: c,
    amount: inv[c]?.amount ?? 0,
    unit: inv[c]?.unit || "units"
  }));
  Object.keys(inv).forEach(c=>{
    if(!known.includes(c)){
      out.push({ category: c, amount: inv[c].amount, unit: inv[c].unit || "units" });
    }
  });
  return out;
}

/* ---------------- Session ---------------- */
function fbSetSession(session){ localStorage.setItem(FB_KEYS.SESSION, JSON.stringify(session)); }
function fbGetSession(){ try{ return JSON.parse(localStorage.getItem(FB_KEYS.SESSION)); }catch(e){ return null; } }
function fbClearSession(){ localStorage.removeItem(FB_KEYS.SESSION); }

/* ---------------- OTP ---------------- */
function fbCreateOtp(purpose, meta={}){
  const code = fbGenerateOtp();
  const payload = { code, purpose, meta, createdAt: Date.now(), expiresAt: Date.now() + 5*60*1000 };
  localStorage.setItem(FB_KEYS.OTP, JSON.stringify(payload));
  return payload;
}
function fbGetOtp(){ try{ return JSON.parse(localStorage.getItem(FB_KEYS.OTP)); }catch(e){ return null; } }
function fbVerifyOtp(code){
  const otp = fbGetOtp();
  if(!otp) return { ok:false, reason:"No OTP request found. Please request a new code." };
  if(Date.now() > otp.expiresAt) return { ok:false, reason:"This code has expired. Please request a new one." };
  if(otp.code !== String(code)) return { ok:false, reason:"Incorrect code. Please try again." };
  return { ok:true, meta: otp.meta };
}
function fbClearOtp(){ localStorage.removeItem(FB_KEYS.OTP); }

fbInitDatabase();
