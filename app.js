const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api/enheter";

// Service Worker updater
let swReg = null;
let hasUpdate = false;

function setupUpdater(){
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./sw.js").then(reg => {
    swReg = reg;

    // Hvis en ny SW allerede ligger klar
    if (reg.waiting) {
      hasUpdate = true;
      showUpdateButton(true);
    }

    // Når en ny SW blir funnet
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        // Når installert og det finnes en eksisterende controller => oppdatering tilgjengelig
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          hasUpdate = true;
          showUpdateButton(true);
        }
      });
    });
  }).catch(() => {
    // silent
  });

  // Knapp: forsøk å oppdatere
  const btn = document.getElementById("btnUpdateApp");
  if (btn){
    btn.addEventListener("click", async () => {
      await forceUpdateNow();
    });
  }
}

function showUpdateButton(show){
  const btn = document.getElementById("btnUpdateApp");
  if (!btn) return;
  btn.style.display = show ? "inline-block" : "none";
}

async function forceUpdateNow(){
  // 1) Prøv å trigge oppdatering
  try {
    if (swReg) await swReg.update();
  } catch {}

  // 2) Hvis en SW venter, aktiver den
  if (swReg && swReg.waiting){
    try {
      swReg.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {}
  }

  // 3) Reload med cache-bust
  const u = new URL(location.href);
  u.searchParams.set("v", String(Date.now()));
  location.replace(u.toString());
}

// Adresseforslag (Nominatim) cache + parallell
const addrCache = new Map();
const ADDR_CACHE_TTL_MS = 2 * 60 * 1000;

// Offentlig virksomhet-forslag (Overpass)
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

let state = {
  inspectionDate: new Date().toISOString().slice(0,10),
  customer: { orgnr:"", name:"", orgForm:"", industry:"" },
  attendees: {
    klp: [ { name:"", title:"" } ],
    customer: [ { name:"", title:"" } ]
  },

  locations: [ newLocation("LOC-1") ],
  activeLocationId: "LOC-1",

  findings: [] // {id, locationId, refNo, type, severity, dueDate, title, desc, photos:[{dataUrl, reportDataUrl, comment:""}]}
};

const $ = (id) => document.getElementById(id);
const digits = (s) => (s||"").replace(/\D+/g,"");
const esc = (s) => String(s??"").replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const MATERIALS = [
  { code:"B", label:"B – Betong" },
  { code:"S", label:"S – Stål" },
  { code:"T", label:"T – Tre" },
  { code:"M", label:"M – Mur" },
  { code:"U", label:"U – Ubrennbar isolasjon" },
  { code:"C", label:"C – Brennbar isolasjon" }
];
const PROTECTION = [
  { code:"S", label:"S – Sprinkleranlegg" },
  { code:"A", label:"A – Brannalarmanlegg" },
  { code:"I", label:"I – Innbruddsalarmanlegg" },
  { code:"G", label:"G – Gasslokkeanlegg" },
  { code:"R", label:"R – Røykventilasjon" },
  { code:"D", label:"D – Delvis beskyttelse" }
];

const CONSTR_COL = [
  { code:"BETONG", label:"Betong" },
  { code:"STÅL", label:"Stål" },
  { code:"TRE", label:"Tre" },
  { code:"MUR", label:"Mur" },
  { code:"ANNET", label:"Annet" }
];
const CONSTR_BEAM = [...CONSTR_COL];
const CONSTR_DECK = [
  { code:"BETONG", label:"Betong" },
  { code:"TR", label:"Trebjelkelag" },
  { code:"STÅLPL", label:"Stålplater" },
  { code:"ANNET", label:"Annet" }
];
const CONSTR_ROOF = [
  { code:"TRE", label:"Tre" },
  { code:"STÅL", label:"Stål" },
  { code:"BETONG", label:"Betong" },
  { code:"PAPP", label:"Takpapp" },
  { code:"ANNET", label:"Annet" }
];
const CONSTR_WALL = [
  { code:"BETONG", label:"Betong" },
  { code:"MUR", label:"Mur" },
  { code:"SANDWICH", label:"Sandwich" },
  { code:"TRE", label:"Tre" },
  { code:"ANNET", label:"Annet" }
];

const KLP_EMPLOYEES = [
  "Aksel Hope Jøndahl",
  "Anders Storløkken",
  "Ann Kristin Terese Bjørgo",
  "Baard Isdahl",
  "Chris Ten Hoopen",
  "Christin Schackt Bjølverud",
  "Gry-Merete Olaisen",
  "Jochim Jakobsen",
  "Jonas Pedersen",
  "Jon Frode Skirbekk",
  "Jørgen Synnestvedt",
  "Lasse Andre Dahl",
  "Linda Brodin",
  "Odd Steinsrud",
  "Pål Fredrik Dolven",
  "Pål Stokkebryn",
  "Robert Skaug",
  "Steinar Haukeland",
  "Thomas Nilsen"
];

function newBuilding(id){
  return {
    id,
    label: "",        // Byggbeskrivelse (blir heading)
    buildingNo: "",   // Bygningsnummer
    businessInBuilding: [],

    buildYear:"",
    areaM2:"",
    areaBreakdown:{},
    floors:"",
    columns:[],
    beams:[],
    deck:[],
    roof:[],
    outerWall:[],
    materials:[],
    protection:[],
    description:"",
    safety:"",
    risk:""
  };
}

function newLocation(id){
  return {
    id,
    address:"",
    objectName:"",
    geo:{ lat:null, lng:null, accuracy:null, ts:null },

    buildings: [ newBuilding(`B-${id}-1`) ],
    activeBuildingId: `B-${id}-1`
  };
}

function init(){
  // Setup service worker updater
  setupUpdater();

  // Header labels
  $("landingDate").textContent = `Dato: ${formatDateNo(state.inspectionDate)}`;
  $("todayLabel").textContent = `Risikogjennomgang • ${formatDateNo(state.inspectionDate)}`;

  // Navigation buttons
  $("btnBackToLanding").addEventListener("click", () => showStep("landing"));
  $("btnGoLocations").addEventListener("click", () => showStep("locations"));
  $("btnGoFindings").addEventListener("click", () => showStep("findings"));

  $("btnStartInspection").addEventListener("click", () => {
    showStep("locations");
  });

  $("btnToFindings").addEventListener("click", () => showStep("findings"));
  $("btnBackToLocations").addEventListener("click", () => showStep("locations"));

  // BRREG: orgnr input auto fetch
  $("orgnr").addEventListener("input", async (e) => {
    const v = digits(e.target.value);
    e.target.value = v;
    state.customer.orgnr = v;
    if(v.length === 9) await fetchBrregByOrgnr(v);
  });

  $("btnSearchBrreg").addEventListener("click", async () => {
    const q = ($("companySearch").value || "").trim();
    const org = digits($("orgnr").value);
    if(org.length === 9){ await fetchBrregByOrgnr(org); return; }
    if(!q){ alert("Skriv org.nr (9 siffer) eller et navn å søke på."); return; }
    await searchBrregByName(q);
  });

  // Manual override
  $("customerName").addEventListener("input", e => state.customer.name = e.target.value);
  $("orgForm").addEventListener("input", e => state.customer.orgForm = e.target.value);
  $("industry").addEventListener("input", e => state.customer.industry = e.target.value);

  // Attendees
  $("btnAddKlp").addEventListener("click", () => { state.attendees.klp.push({name:"", title:""}); renderAttendees(); });
  $("btnAddCustomerAtt").addEventListener("click", () => { state.attendees.customer.push({name:"", title:""}); renderAttendees(); });

  // Locations
  $("btnAddLocation").addEventListener("click", addLocation);
  $("objectName").addEventListener("input", e => { getActiveLocation().objectName = e.target.value; renderLocationTabs(); });
  $("address").addEventListener("input", e => { getActiveLocation().address = e.target.value; renderLocationTabs(); });

  $("btnGPS").addEventListener("click", getGPS);

  // Buildings
  $("btnAddBuilding").addEventListener("click", addBuilding);

  $("buildingLabel").addEventListener("input", e => {
    const b = getActiveBuilding();
    b.label = e.target.value;
    renderBuildingTabs();
    renderFindingLocationSelect();
  });

  $("buildingNo").addEventListener("input", e => {
    const b = getActiveBuilding();
    b.buildingNo = e.target.value;
  });

  // Business: manuell input med Enter
  $("businessManual").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = ($("businessManual").value || "").trim();
    if(!val) return;

    const b = getActiveBuilding();
    if(!b.businessInBuilding.includes(val)) b.businessInBuilding.push(val);
    $("businessManual").value = "";
    renderBusinessSelected();
    renderAreaBreakdown();
  });

  // Business suggestions
  $("btnSuggestBusiness").addEventListener("click", suggestBusinessFromPublicSources);

  // Areal: trigger breakdown update
  $("areaM2").addEventListener("input", () => {
    onBuildingFieldChange();
    updateAreaSumStatus();
  });

  // Building fields
  ["buildYear","areaM2","floors","bDesc","bSafety","bRisk"]
    .forEach(id => $(id).addEventListener("input", onBuildingFieldChange));

  // Findings
  $("findingType").addEventListener("change", updateFindingFormVisibility);
  $("btnAddFinding").addEventListener("click", addFinding);

  renderAttendees();
  renderLocationTabs();
  renderActiveLocationFields();
  renderFindingLocationSelect();

  showStep("landing");
}

function showStep(step){
  $("stepLanding").style.display = (step==="landing") ? "block" : "none";
  $("stepLocations").style.display = (step==="locations") ? "block" : "none";
  $("stepFindings").style.display = (step==="findings") ? "block" : "none";

  const inFlow = (step !== "landing");
  $("btnBackToLanding").style.display = inFlow ? "inline-block" : "none";
  $("btnGoLocations").style.display = inFlow ? "inline-block" : "none";
  $("btnGoFindings").style.display = inFlow ? "inline-block" : "none";

  if(step === "locations"){
    renderActiveLocationFields();
    renderFindingLocationSelect(); // keep in sync
  }
  if(step === "findings"){
    renderFindingLocationSelect();
    updateFindingFormVisibility();
    renderFindingsList();
  }

  setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
}

function formatDateNo(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/* =========================
   BRREG
========================= */
async function fetchBrregByOrgnr(orgnr){
  setBrregStatus("BRREG: henter…");
  hideBrregResults();

  try{
    const res = await fetch(`${BRREG_BASE}/${encodeURIComponent(orgnr)}`, { headers: { "Accept":"application/json" }});
    if(!res.ok){
      setBrregStatus(res.status === 404 ? "BRREG: ikke funnet" : `BRREG: feil (${res.status})`);
      return;
    }
    const e = await res.json();
    applyBrregEntity(e);
    setBrregStatus("BRREG: OK");
  } catch {
    setBrregStatus("BRREG: feil (nett)");
  }
}

async function searchBrregByName(q){
  setBrregStatus("BRREG: søker…");
  hideBrregResults();

  try{
    const url = `${BRREG_BASE}?navn=${encodeURIComponent(q)}&size=10`;
    const res = await fetch(url, { headers: { "Accept":"application/json" }});
    if(!res.ok){
      setBrregStatus(`BRREG: feil (${res.status})`);
      return;
    }
    const data = await res.json();
    const hits = data?._embedded?.enheter || [];
    if(!hits.length){
      setBrregStatus("BRREG: ingen treff");
      return;
    }
    setBrregStatus(`BRREG: ${hits.length} treff`);
    showBrregResults(hits);
  } catch {
    setBrregStatus("BRREG: feil (nett)");
  }
}

function applyBrregEntity(e){
  state.customer.orgnr = e.organisasjonsnummer ? String(e.organisasjonsnummer) : (state.customer.orgnr || "");
  state.customer.name = e.navn || "";
  state.customer.orgForm = e.organisasjonsform?.kode ? `${e.organisasjonsform.kode} – ${e.organisasjonsform.beskrivelse||""}` : "";
  state.customer.industry = e.naeringskode1?.kode ? `${e.naeringskode1.kode} – ${e.naeringskode1.beskrivelse||""}` : "";

  $("orgnr").value = state.customer.orgnr;
  $("customerName").value = state.customer.name;
  $("orgForm").value = state.customer.orgForm;
  $("industry").value = state.customer.industry;
}

function showBrregResults(hits){
  const box = $("brregResults");
  const list = $("brregList");
  box.style.display = "block";

  list.innerHTML = hits.map((h, idx) => {
    const org = h.organisasjonsnummer || "";
    const name = h.navn || "";
    const form = h.organisasjonsform?.kode || "";
    return `
      <div class="addrItem" data-hit="${idx}">
        <div class="addrItem__main">${esc(name)}</div>
        <div class="addrItem__sub">Org.nr: ${esc(org)} ${form ? `• ${esc(form)}` : ""}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-hit]").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-hit"));
      const picked = hits[idx];
      if(!picked) return;
      applyBrregEntity(picked);
      hideBrregResults();
      setBrregStatus("BRREG: OK");
    });
  });
}

function hideBrregResults(){
  $("brregResults").style.display = "none";
  $("brregList").innerHTML = "";
}
function setBrregStatus(t){ $("brregStatus").textContent = t; }

/* =========================
   Attendees
========================= */
function renderAttendees(){
  renderAttList("klpAttendees", state.attendees.klp, "klp");
  renderAttList("customerAttendees", state.attendees.customer, "customer");
}

function renderAttList(containerId, arr, group){
  const root = $(containerId);
  
  // For KLP: lag datalist med ansatte + tidligere brukte navn
  let datalistHtml = "";
  if(group === "klp"){
    const customNames = getCustomKlpNames();
    const allOptions = [...KLP_EMPLOYEES, ...customNames];
    const uniqueOptions = [...new Set(allOptions)];
    
    datalistHtml = `<datalist id="klpNameList">${uniqueOptions.map(n => `<option value="${esc(n)}"></option>`).join("")}</datalist>`;
  }
  
  root.innerHTML = datalistHtml + arr.map((p, idx) => `
    <div class="personRow">
      <div>
        <label>Navn</label>
        <input data-att-group="${group}" data-att-idx="${idx}" data-att-key="name" value="${esc(p.name)}" placeholder="Navn" ${group === "klp" ? 'list="klpNameList"' : ""} />
      </div>
      <div>
        <label>Tittel</label>
        <input data-att-group="${group}" data-att-idx="${idx}" data-att-key="title" value="${esc(p.title)}" placeholder="Tittel" />
      </div>
      <div>
        <button class="btn danger" data-att-del="${group}|${idx}">Slett</button>
      </div>
    </div>
  `).join("");

  root.querySelectorAll("input[data-att-key]").forEach(inp => {
    inp.addEventListener("input", () => {
      const g = inp.getAttribute("data-att-group");
      const i = Number(inp.getAttribute("data-att-idx"));
      const k = inp.getAttribute("data-att-key");
      state.attendees[g][i][k] = inp.value;
      
      // Lagre egendefinerte KLP-navn
      if(g === "klp" && k === "name" && inp.value.trim()){
        saveCustomKlpName(inp.value.trim());
      }
    });
  });

  root.querySelectorAll("[data-att-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [g, iStr] = btn.getAttribute("data-att-del").split("|");
      const i = Number(iStr);
      state.attendees[g].splice(i,1);
      if(state.attendees[g].length === 0) state.attendees[g].push({ name:"", title:"" });
      renderAttendees();
    });
  });
}

function getCustomKlpNames(){
  try{
    const stored = localStorage.getItem("customKlpNames");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCustomKlpName(name){
  const names = getCustomKlpNames();
  if(!KLP_EMPLOYEES.includes(name) && !names.includes(name)){
    names.push(name);
    localStorage.setItem("customKlpNames", JSON.stringify(names));
  }
}

/* =========================
   Locations + Tabs
========================= */
function getActiveLocation(){
  return state.locations.find(l => l.id === state.activeLocationId) || state.locations[0];
}
function getActiveBuilding(){
  const loc = getActiveLocation();
  return loc.buildings.find(b => b.id === loc.activeBuildingId) || loc.buildings[0];
}
function locationIndexById(id){
  return Math.max(0, state.locations.findIndex(l => l.id === id));
}
function shortLabel(loc, idx){
  const name = (loc.objectName||"").trim();
  const addr = (loc.address||"").trim();
  if(name) return name.length > 28 ? name.slice(0,25)+"…" : name;
  if(addr) return addr.length > 28 ? addr.slice(0,25)+"…" : addr;
  return `Lokasjon ${idx+1}`;
}
function addLocation(){
  const id = `LOC-${state.locations.length + 1}`;
  state.locations.push(newLocation(id));
  state.activeLocationId = id;
  renderLocationTabs();
  renderActiveLocationFields();
  renderFindingLocationSelect();
}

function setActiveLocation(id){
  state.activeLocationId = id;
  renderLocationTabs();
  renderActiveLocationFields();
}

function addBuilding(){
  const loc = getActiveLocation();
  const id = `B-${loc.id}-${loc.buildings.length + 1}`;
  loc.buildings.push(newBuilding(id));
  loc.activeBuildingId = id;
  renderBuildingTabs();
  renderActiveBuildingFields();
  renderFindingLocationSelect();
}

function setActiveBuilding(id){
  const loc = getActiveLocation();
  loc.activeBuildingId = id;
  renderBuildingTabs();
  renderActiveBuildingFields();
}

function buildingShortLabel(b, idx){
  const t = (b.label||"").trim();
  if(t) return t.length > 28 ? t.slice(0,25)+"…" : t;
  const n = (b.buildingNo||"").trim();
  if(n) return `Bygg ${idx+1} • ${n}`;
  return `Bygg ${idx+1}`;
}

function renderBuildingTabs(){
  const loc = getActiveLocation();
  const root = $("buildingTabs");
  root.innerHTML = (loc.buildings || []).map((b, idx) => {
    const active = (b.id === loc.activeBuildingId) ? "active" : "";
    return `<button class="locTab ${active}" data-bid="${esc(b.id)}">
      <span class="locTab__label">${esc(buildingShortLabel(b, idx))}</span>
    </button>`;
  }).join("");

  root.querySelectorAll("[data-bid]").forEach(btn => {
    btn.addEventListener("click", () => setActiveBuilding(btn.getAttribute("data-bid")));
  });
}

function renderActiveBuildingFields(){
  const b = getActiveBuilding();

  $("buildingLabel").value = b.label || "";
  $("buildingNo").value = b.buildingNo || "";
  $("businessManual").value = "";

  $("buildYear").value = b.buildYear || "";
  $("areaM2").value = b.areaM2 || "";
  $("floors").value = b.floors || "";

  $("bDesc").value = b.description || "";
  $("bSafety").value = b.safety || "";
  $("bRisk").value = b.risk || "";

  renderBuildingChips();
  renderConstructionChips();
  renderBusinessSelected();
  renderAreaBreakdown();
}

function renderLocationTabs(){
  const root = $("locTabs");
  root.innerHTML = state.locations.map((l, idx) => {
    const active = (l.id === state.activeLocationId) ? "active" : "";
    return `
      <button class="locTab ${active}" data-loc="${esc(l.id)}">
        <span class="locTab__label">${esc(shortLabel(l, idx))}</span>
      </button>`;
  }).join("");

  root.querySelectorAll("[data-loc]").forEach(btn => {
    btn.addEventListener("click", () => setActiveLocation(btn.getAttribute("data-loc")));
  });
}

function renderActiveLocationFields(){
  const loc = getActiveLocation();
  $("objectName").value = loc.objectName || "";
  $("address").value = loc.address || "";

  if(loc.geo.lat && loc.geo.lng){
    $("gpsStatus").textContent = `GPS: ${loc.geo.lat.toFixed(5)}, ${loc.geo.lng.toFixed(5)} (±${Math.round(loc.geo.accuracy||0)}m)`;
  } else {
    $("gpsStatus").textContent = "GPS: ikke hentet";
  }

  renderBuildingTabs();
  renderActiveBuildingFields();

  renderAddressSuggestions([]);
  renderBusinessSuggestions([]);
  $("businessStatus").textContent = "";
}

function onBuildingFieldChange(){
  const b = getActiveBuilding();
  b.buildYear = $("buildYear").value;
  b.areaM2 = $("areaM2").value;
  b.floors = $("floors").value;
  b.description = $("bDesc").value;
  b.safety = $("bSafety").value;
  b.risk = $("bRisk").value;
}

function toggleInArray(arr, val){
  const i = arr.indexOf(val);
  if(i >= 0) arr.splice(i,1); else arr.push(val);
}

function renderBusinessSelected(){
  const b = getActiveBuilding();
  const root = $("businessSelected");
  const status = $("businessStatus");
  if(!root) return;

  const count = (b.businessInBuilding || []).length;
  if(status) status.textContent = count ? `Valgt: ${count} bruksområde${count !== 1 ? 'r' : ''}` : "";

  root.innerHTML = (b.businessInBuilding || []).map((x, idx) => `
    <button class="chip on" data-del-biz="${idx}">
      ${esc(x)} ✕
    </button>
  `).join("");

  root.querySelectorAll("[data-del-biz]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-del-biz"));
      b.businessInBuilding.splice(i, 1);
      renderBusinessSelected();
      renderAreaBreakdown();
    });
  });
}

function renderAreaBreakdown(){
  const b = getActiveBuilding();
  const root = $("areaBreakdown");
  const status = $("areaSumStatus");
  if(!root || !status) return;

  const keys = (b.businessInBuilding || []).slice();
  if(!keys.length){
    root.innerHTML = `<p class="muted">Legg til virksomheter først for å fordele arealet.</p>`;
    status.textContent = "";
    return;
  }

  // sørg for at breakdown har nøkler
  b.areaBreakdown = b.areaBreakdown || {};
  for(const k of keys){
    if(b.areaBreakdown[k] == null) b.areaBreakdown[k] = "";
  }
  // fjern gamle nøkler som ikke er valgt lenger
  for(const k of Object.keys(b.areaBreakdown)){
    if(!keys.includes(k)) delete b.areaBreakdown[k];
  }

  root.innerHTML = keys.map(k => `
    <div class="row" style="margin-top:8px;">
      <div style="flex:2;">
        <label>${esc(k)}</label>
        <input data-ab-key="${esc(k)}" inputmode="numeric" placeholder="m²" value="${esc(b.areaBreakdown[k] || "")}">
      </div>
      <div></div>
    </div>
  `).join("");

  root.querySelectorAll("input[data-ab-key]").forEach(inp => {
    inp.addEventListener("input", () => {
      const key = inp.getAttribute("data-ab-key");
      b.areaBreakdown[key] = inp.value;
      updateAreaSumStatus();
    });
  });

  updateAreaSumStatus();
}

function updateAreaSumStatus(){
  const b = getActiveBuilding();
  const total = Number((b.areaM2 || "").replace(",", "."));
  const sum = Object.values(b.areaBreakdown || {}).reduce((acc, v) => {
    const n = Number(String(v||"").replace(",", "."));
    return acc + (isFinite(n) ? n : 0);
  }, 0);

  const status = $("areaSumStatus");
  if(!status) return;

  if(!b.areaM2){
    status.textContent = sum ? `Sum fordelt areal: ${sum} m²` : "";
    return;
  }
  
  const diff = Math.abs(total - sum);
  let message = `Sum fordelt areal: ${sum} m² (Total: ${total} m²)`;
  
  if(diff > 0.1 && sum > 0){
    if(sum > total){
      message += ` ⚠️ Fordelt areal overstiger total med ${(sum - total).toFixed(0)} m²`;
    } else if(sum < total){
      message += ` ℹ️ ${(total - sum).toFixed(0)} m² gjenstår å fordele`;
    }
  }
  
  status.textContent = message;
}

function renderBuildingChips(){
  const b = getActiveBuilding();

  $("matChips").innerHTML = MATERIALS.map(m => {
    const on = b.materials.includes(m.code) ? "on" : "";
    return `<button class="chip ${on}" data-mat="${m.code}">${esc(m.label)}</button>`;
  }).join("");

  $("protChips").innerHTML = PROTECTION.map(p => {
    const on = b.protection.includes(p.code) ? "on" : "";
    return `<button class="chip ${on}" data-prot="${p.code}">${esc(p.label)}</button>`;
  }).join("");

  $("matChips").querySelectorAll("[data-mat]").forEach(btn => {
    btn.addEventListener("click", () => { toggleInArray(b.materials, btn.getAttribute("data-mat")); renderBuildingChips(); });
  });
  $("protChips").querySelectorAll("[data-prot]").forEach(btn => {
    btn.addEventListener("click", () => { toggleInArray(b.protection, btn.getAttribute("data-prot")); renderBuildingChips(); });
  });
}

function renderConstructionChips(){
  const b = getActiveBuilding();
  renderChipGroup("colChips", CONSTR_COL, b.columns, (code) => { toggleInArray(b.columns, code); renderConstructionChips(); });
  renderChipGroup("beamChips", CONSTR_BEAM, b.beams, (code) => { toggleInArray(b.beams, code); renderConstructionChips(); });
  renderChipGroup("deckChips", CONSTR_DECK, b.deck, (code) => { toggleInArray(b.deck, code); renderConstructionChips(); });
  renderChipGroup("roofChips", CONSTR_ROOF, b.roof, (code) => { toggleInArray(b.roof, code); renderConstructionChips(); });
  renderChipGroup("wallChips", CONSTR_WALL, b.outerWall, (code) => { toggleInArray(b.outerWall, code); renderConstructionChips(); });
}

function renderChipGroup(containerId, options, selectedArr, onToggle){
  const root = $(containerId);
  if(!root) return;

  root.innerHTML = options.map(o => {
    const on = selectedArr.includes(o.code) ? "on" : "";
    return `<button class="chip ${on}" data-code="${esc(o.code)}">${esc(o.label)}</button>`;
  }).join("");

  root.querySelectorAll("[data-code]").forEach(btn => {
    btn.addEventListener("click", () => onToggle(btn.getAttribute("data-code")));
  });
}

/* =========================
   GPS -> Address suggestions
========================= */
function cacheKey(lat,lng){
  const r = (x) => Math.round(x * 4000) / 4000;
  return `${r(lat)},${r(lng)}`;
}

function getGPS(){
  const loc = getActiveLocation();
  if(!navigator.geolocation){
    alert("GPS ikke tilgjengelig i denne nettleseren.");
    return;
  }

  renderAddressSuggestions([]);
  $("gpsStatus").textContent = "GPS: henter…";

  navigator.geolocation.getCurrentPosition(async pos => {
    loc.geo.lat = pos.coords.latitude;
    loc.geo.lng = pos.coords.longitude;
    loc.geo.accuracy = pos.coords.accuracy;
    loc.geo.ts = new Date(pos.timestamp).toISOString();

    $("gpsStatus").textContent =
      `GPS: ${loc.geo.lat.toFixed(5)}, ${loc.geo.lng.toFixed(5)} (±${Math.round(loc.geo.accuracy)}m) – søker adresser…`;

    try{
      const list = await fetchAddressSuggestions(loc.geo.lat, loc.geo.lng);
      $("gpsStatus").textContent =
        `GPS: ${loc.geo.lat.toFixed(5)}, ${loc.geo.lng.toFixed(5)} (±${Math.round(loc.geo.accuracy)}m)`;
      renderAddressSuggestions(list);
    } catch {
      $("gpsStatus").textContent =
        `GPS: ${loc.geo.lat.toFixed(5)}, ${loc.geo.lng.toFixed(5)} (±${Math.round(loc.geo.accuracy)}m)`;
      renderAddressSuggestions([]);
    }

  }, err => {
    alert("GPS-feil: " + err.message);
    $("gpsStatus").textContent = "GPS: ikke hentet";
  }, { enableHighAccuracy:true, timeout:12000, maximumAge:15000 });
}

async function fetchAddressSuggestions(lat, lng){
  const key = cacheKey(lat,lng);
  const cached = addrCache.get(key);
  if (cached && (Date.now() - cached.t) < ADDR_CACHE_TTL_MS) return cached.list;

  const d = 0.00025;
  const points = [
    {lat, lng},
    {lat: lat + d, lng},
    {lat: lat - d, lng},
    {lat, lng: lng + d},
    {lat, lng: lng - d}
  ];

  const tasks = points.map(p => reverseGeocodeNominatimWithTimeout(p.lat, p.lng, 2200));
  const settled = await Promise.allSettled(tasks);

  const results = settled
    .filter(x => x.status === "fulfilled" && x.value)
    .map(x => x.value);

  const seen = new Set();
  const unique = [];
  for (const r of results) {
    const name = r.display_name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    unique.push(r);
  }

  const list = unique.slice(0,6);
  addrCache.set(key, { t: Date.now(), list });
  return list;
}

async function reverseGeocodeNominatimWithTimeout(lat, lng, timeoutMs = 2000){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try{
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept":"application/json" }, signal: controller.signal });
    if(!res.ok) return null;

    const data = await res.json();
    if(!data || !data.display_name) return null;

    const a = data.address || {};
    const line1 = [a.road, a.house_number].filter(Boolean).join(" ").trim();
    const city = a.city || a.town || a.village || a.municipality || "";
    const line2 = [a.postcode, city].filter(Boolean).join(" ").trim();

    return { display_name: data.display_name, line1: line1 || data.display_name, line2: line2 || "" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function renderAddressSuggestions(list){
  const box = $("addrBox");
  const root = $("addrSuggestions");

  if (!list || !list.length){
    box.style.display = "none";
    root.innerHTML = "";
    return;
  }

  box.style.display = "block";
  root.innerHTML = list.map((x, idx) => `
    <div class="addrItem" data-idx="${idx}">
      <div class="addrItem__main">${esc(x.line1)}</div>
      <div class="addrItem__sub">${esc(x.line2 || x.display_name)}</div>
    </div>
  `).join("");

  root.querySelectorAll(".addrItem").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-idx"));
      const picked = list[idx];
      if (!picked) return;

      const loc = getActiveLocation();
      loc.address = picked.display_name;
      $("address").value = picked.display_name;

      $("addrBox").style.display = "none";
      renderLocationTabs();
      renderFindingLocationSelect();
    });
  });
}

/* =========================
   Business suggestions (Overpass)
========================= */
async function suggestBusinessFromPublicSources(){
  const loc = getActiveLocation();
  if(!loc.geo.lat || !loc.geo.lng){
    alert("Hent GPS først, så kan vi foreslå virksomhet i bygg basert på nærliggende registrerte steder.");
    return;
  }

  $("businessStatus").textContent = "Henter forslag…";
  try{
    const list = await fetchBusinessCandidatesOverpass(loc.geo.lat, loc.geo.lng);
    loc.businessCandidates = list;
    renderBusinessSuggestions(list);
    $("businessStatus").textContent = list.length ? `Fant ${list.length} forslag` : "Ingen forslag funnet";
  } catch {
    $("businessStatus").textContent = "Kunne ikke hente forslag";
  }
}

async function fetchBusinessCandidatesOverpass(lat, lng){
  const r = 80;
  const query = `
    [out:json][timeout:15];
    (
      node(around:${r},${lat},${lng})["name"];
      way(around:${r},${lat},${lng})["name"];
      relation(around:${r},${lat},${lng})["name"];
    );
    out center tags;
  `;
  const res = await fetch(OVERPASS_URL, {
    method:"POST",
    headers: { "Content-Type":"text/plain" },
    body: query
  });
  if(!res.ok) return [];
  const data = await res.json();

  const mapped = (data.elements || [])
    .map(e => {
      const tags = e.tags || {};
      const name = tags.name;
      if(!name) return null;
      const kind = tags.amenity || tags.shop || tags.office || tags.tourism || tags.leisure || tags.man_made || tags.building || "Ukjent";
      return { name, kind: `Type: ${kind}` };
    })
    .filter(Boolean);

  const seen = new Set();
  const unique = [];
  for(const x of mapped){
    const k = x.name.trim().toLowerCase();
    if(seen.has(k)) continue;
    seen.add(k);
    unique.push(x);
  }
  return unique.slice(0,8);
}

function renderBusinessSuggestions(list){
  const box = $("businessSuggestions");
  const root = $("businessList");

  if(!list || !list.length){
    box.style.display = "none";
    root.innerHTML = "";
    return;
  }

  box.style.display = "block";
  root.innerHTML = list.map((x, idx) => `
    <div class="addrItem" data-biz="${idx}">
      <div class="addrItem__main">${esc(x.name)}</div>
      <div class="addrItem__sub">${esc(x.kind)}</div>
    </div>
  `).join("");

  root.querySelectorAll("[data-biz]").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-biz"));
      const picked = list[idx];
      if(!picked) return;

      const b = getActiveBuilding();
      const name = picked.name.trim();

      // toggle multi-select
      const i = b.businessInBuilding.indexOf(name);
      if(i >= 0) b.businessInBuilding.splice(i,1);
      else b.businessInBuilding.push(name);

      renderBusinessSelected();
      renderAreaBreakdown();
    });
  });
}

/* =========================
   Findings (Avvik/Anbefaling)
========================= */
function renderFindingLocationSelect(){
  const sel = $("findingLocation");

  // Byggliste: "LOCID|BUILDID"
  const options = [];
  for(const loc of state.locations){
    for(const b of (loc.buildings || [])){
      const label = (b.label||"").trim();
      const no = (b.buildingNo||"").trim();

      let text = label || "Bygg";
      if (no) text = label ? `${label} (${no})` : no;

      options.push({
        value: `${loc.id}|${b.id}`,
        text
      });
    }
  }

  sel.innerHTML = options.map(o => `<option value="${esc(o.value)}">${esc(o.text)}</option>`).join("");

  // Default: aktiv lokasjon + aktivt bygg
  const active = `${state.activeLocationId}|${getActiveLocation().activeBuildingId}`;
  sel.value = options.some(o => o.value === active) ? active : (options[0]?.value || "");
}

function updateFindingFormVisibility(){
  const isAvvik = $("findingType").value === "AVVIK";
  $("findingSeverity").disabled = !isAvvik;
  $("findingDue").disabled = !isAvvik;
}

function nextFindingSeqForLocation(locationId){
  const count = state.findings.filter(f => f.locationId === locationId).length;
  return count + 1;
}
function buildRefNo(locationId){
  const locIdx = locationIndexById(locationId) + 1;
  const seq = String(nextFindingSeqForLocation(locationId)).padStart(4,"0");
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = String(d.getFullYear()).slice(-2);
  return `L${locIdx}-${seq}-${mm}${yy}`;
}

async function addFinding(){
  const locs = state.locations || [];
  if(!locs.length){ alert("Legg til minst én lokasjon først."); return; }

  let composite = $("findingLocation").value;
  if(state.locations.length > 1 && !composite){
    alert("Velg hvilket bygg dette gjelder.");
    return;
  }
  if(!composite){
    composite = `${state.activeLocationId}|${getActiveLocation().activeBuildingId}`;
  }
  const [locationId, buildingId] = composite.split("|");

  const loc = state.locations.find(l => l.id === locationId);
  const b = (loc?.buildings || []).find(x => x.id === buildingId);

  const buildingHeading = (b?.label || "").trim()
    || (b?.buildingNo ? `Bygningsnr ${b.buildingNo}` : "Bygg");

  const type = $("findingType").value;
  const severity = $("findingSeverity").value;
  const dueDate = $("findingDue").value;
  const title = ($("findingTitle").value || "").trim();
  const desc = ($("findingDesc").value || "").trim();

  if(!title){ alert("Tittel mangler."); return; }

  const files = Array.from($("findingPhotos").files || []);
  const photos = [];

  for (const f of files) {
    try {
      // Prøv "rapportvennlig" (resized JPEG)
      const reportDataUrl = await readAsDataUrlConstrained(f, 900, 550, 0.80);
      // Prøv "full" (større)
      const dataUrl = await readAsDataUrlConstrained(f, 1400, 1400, 0.80);

      photos.push({ dataUrl, reportDataUrl, comment: "" });
    } catch (e) {
      // Fallback: hvis canvas/konvertering feiler, ta rå dataURL
      const raw = await readFileAsDataUrl(f);
      photos.push({ dataUrl: raw, reportDataUrl: raw, comment: "" });
    }
  }

  const finding = {
    id: `F-${Date.now()}`,
    locationId,
    buildingId,
    buildingHeading,
    refNo: buildRefNo(locationId),
    type,
    severity: type==="AVVIK" ? severity : "",
    dueDate: type==="AVVIK" ? dueDate : "",
    title,
    desc,
    photos
  };

  state.findings.push(finding);

  // Reset form
  $("findingTitle").value = "";
  $("findingDesc").value = "";
  $("findingPhotos").value = "";
  $("findingDue").value = "";
  $("findingType").value = "AVVIK";
  $("findingSeverity").value = "Middels";
  updateFindingFormVisibility();

  renderFindingsList();
}

function renderFindingsList(){
  const root = $("findingList");
  if(!state.findings.length){
    root.innerHTML = `<p class="muted">Ingen avvik/anbefalinger registrert.</p>`;
    return;
  }

  // grupper per lokasjon (tydelig)
  const byLoc = new Map();
  for(const f of state.findings){
    if(!byLoc.has(f.locationId)) byLoc.set(f.locationId, []);
    byLoc.get(f.locationId).push(f);
  }

  const locName = (id) => {
    const idx = locationIndexById(id);
    const l = state.locations.find(x=>x.id===id);
    return (l?.objectName||"").trim() || (l?.address||"").trim() || `Lokasjon ${idx+1}`;
  };

  root.innerHTML = Array.from(byLoc.entries()).map(([locId, arr]) => {
    const items = arr.map(f => `
      <div class="dev">
        <div><strong>${esc(f.title)}</strong> <span class="muted">(${esc(f.type)})</span></div>
        <div class="muted">Objekt: ${esc(f.buildingHeading || locName(locId))} • Ref.nr: ${esc(f.refNo)} ${f.dueDate ? `• Frist: ${esc(f.dueDate)}` : ""}</div>
        ${f.desc ? `<div class="muted" style="margin-top:6px;">${esc(f.desc).replaceAll("\n","<br>")}</div>` : ""}
        ${(f.photos && f.photos.length) ? `
          <div class="thumbs">
            ${f.photos.map(p => `<img class="thumb" src="${esc(p.reportDataUrl || p.dataUrl)}" alt="">`).join("")}
          </div>
        ` : `<div class="muted" style="margin-top:6px;">Ingen bilder</div>`}
        <div class="inline" style="margin-top:10px;">
          <button class="btn danger" data-del-f="${esc(f.id)}">Slett</button>
        </div>
      </div>
    `).join("");

    return `
      <h3 style="margin:16px 0 8px;">${esc(locName(locId))}</h3>
      ${items}
    `;
  }).join("");

  root.querySelectorAll("[data-del-f]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-f");
      state.findings = state.findings.filter(x => x.id !== id);
      renderFindingsList();
    });
  });
}

/* =========================
   Image helper
========================= */
function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function readAsDataUrlConstrained(file, maxW = 1200, maxH = 1200, quality = 0.8){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => { img.src = reader.result; };
    reader.onerror = () => reject(reader.error);

    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const scale = Math.min(1, maxW / w, maxH / h);
      const nw = Math.max(1, Math.round(w * scale));
      const nh = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = nw;
      canvas.height = nh;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, nw, nh);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => reject(new Error("Kunne ikke lese bilde"));
    reader.readAsDataURL(file);
  });
}

init();
