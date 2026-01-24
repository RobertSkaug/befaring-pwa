const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api/enheter";

// Service Worker updater
let swReg = null;
let hasUpdate = false;

function setupUpdater(){
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./sw.js").then(reg => {
    swReg = reg;

    // Sjekk for oppdateringer hver 60. sekund
    setInterval(() => {
      reg.update();
    }, 60000);

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

  // Lytt på controller-endringer (når ny SW aktiveres)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Reload appen når ny SW tar over
    window.location.reload();
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

  // Eksport-knapper
  $("btnExportPDF").addEventListener("click", exportToPDF);
  $("btnExportEmail").addEventListener("click", exportAndEmail);
  $("btnExportWord").addEventListener("click", exportToWord);

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

/* =========================
   RAPPORTGENERERING
========================= */

function buildReportHtml(){
  const today = formatDateNo(state.inspectionDate);
  const customerName = esc(state.customer.name || "Ikke oppgitt");
  const orgnr = esc(state.customer.orgnr || "—");
  
  // Deltakere - grupperes i KLP og Kunde
  let klpList = "";
  state.attendees.klp.forEach(a => {
    if (a.name) {
      klpList += `<li>${esc(a.name)}${a.title ? " – " + esc(a.title) : ""}</li>\n`;
    }
  });
  
  let customerList = "";
  state.attendees.customer.forEach(a => {
    if (a.name) {
      customerList += `<li>${esc(a.name)}${a.title ? " – " + esc(a.title) : ""}</li>\n`;
    }
  });
  
  // Liste over objekter som er befart
  let objectsList = "";
  state.locations.forEach(loc => {
    loc.buildings.forEach(bld => {
      if (bld.label || loc.address){
        const label = bld.label || "Bygg";
        const addr = loc.address || "Adresse ikke oppgitt";
        const buildingNo = bld.buildingNo ? ` (bygningsnr. ${esc(bld.buildingNo)})` : "";
        objectsList += `<li><strong>${esc(label)}</strong>: ${esc(addr)}${buildingNo}</li>\n`;
      }
    });
  });
  
  // Kapittel 1: Beskrivelse av bygg (ett avsnitt pr bygg)
  let buildingsSection = "";
  state.locations.forEach(loc => {
    loc.buildings.forEach(bld => {
      const label = esc(bld.label || "Bygg");
      const addr = esc(loc.address || "—");
      const buildingNo = esc(bld.buildingNo || "—");
      
      // Virksomhet (flere valgt) - vis som punktliste
      let businessHtml = "";
      if (bld.businessInBuilding && bld.businessInBuilding.length > 0){
        businessHtml = "<ul>\n";
        bld.businessInBuilding.forEach(bus => {
          businessHtml += `  <li>${esc(bus)}</li>\n`;
        });
        businessHtml += "</ul>\n";
      } else {
        businessHtml = "<p>—</p>\n";
      }
      
      // Areal: totalareal + fordeling per virksomhet
      let areaHtml = "";
      if (bld.areaM2) {
        areaHtml = `<p><strong>Totalareal:</strong> ${esc(bld.areaM2)} m²</p>\n`;
        
        if (bld.areaBreakdown && Object.keys(bld.areaBreakdown).length > 0){
          areaHtml += "<p><strong>Fordeling per virksomhet:</strong></p>\n<ul>\n";
          Object.entries(bld.areaBreakdown).forEach(([k, v]) => {
            areaHtml += `  <li>${esc(k)}: ${esc(v)} m²</li>\n`;
          });
          areaHtml += "</ul>\n";
        }
      } else {
        areaHtml = "<p><strong>Areal:</strong> —</p>\n";
      }
      
      // Byggeår, etasjer, konstruksjon
      const buildYear = bld.buildYear ? esc(bld.buildYear) : "—";
      const floors = bld.floors ? esc(bld.floors) : "—";
      
      // Konstruksjon
      let constrHtml = "";
      const constrParts = [];
      if (bld.columns && bld.columns.length > 0) constrParts.push(`Søyler: ${bld.columns.join(", ")}`);
      if (bld.beams && bld.beams.length > 0) constrParts.push(`Bjelker: ${bld.beams.join(", ")}`);
      if (bld.deck && bld.deck.length > 0) constrParts.push(`Dekke: ${bld.deck.join(", ")}`);
      if (bld.roof && bld.roof.length > 0) constrParts.push(`Tak: ${bld.roof.join(", ")}`);
      if (bld.outerWall && bld.outerWall.length > 0) constrParts.push(`Yttervegg: ${bld.outerWall.join(", ")}`);
      
      if (constrParts.length > 0) {
        constrHtml = `<p><strong>Konstruksjon:</strong> ${esc(constrParts.join("; "))}</p>\n`;
      }
      
      // Materialer og beskyttelse - map codes til full labels
      let materialsHtml = "";
      if (bld.materials && bld.materials.length > 0) {
        const materialLabels = bld.materials.map(code => {
          const m = MATERIALS.find(x => x.code === code);
          return m ? m.label : code;
        });
        materialsHtml = `<p><strong>Bygningsmaterialer:</strong> ${esc(materialLabels.join(", "))}</p>\n`;
      }
      
      let protectionHtml = "";
      if (bld.protection && bld.protection.length > 0) {
        const protectionLabels = bld.protection.map(code => {
          const p = PROTECTION.find(x => x.code === code);
          return p ? p.label : code;
        });
        protectionHtml = `<p><strong>Beskyttelse:</strong> ${esc(protectionLabels.join(", "))}</p>\n`;
      }
      
      buildingsSection += `
<div class="report__building-meta">
<h3>${label}</h3>
<p><strong>Adresse:</strong> ${addr}</p>
<p><strong>Bygningsnummer:</strong> ${buildingNo}</p>

<p><strong>Virksomhet i bygg:</strong></p>
${businessHtml}

${areaHtml}

<p><strong>Byggeår:</strong> ${buildYear}</p>
<p><strong>Antall etasjer:</strong> ${floors}</p>
${constrHtml}
${materialsHtml}
${protectionHtml}
`;
      
      if (bld.description){
        buildingsSection += `<p><strong>Bygningsbeskrivelse:</strong> ${esc(bld.description)}</p>\n`;
      }
      if (bld.safety){
        buildingsSection += `<p><strong>Sikkerhetsforhold:</strong> ${esc(bld.safety)}</p>\n`;
      }
      if (bld.risk){
        buildingsSection += `<p><strong>Generell risiko:</strong> ${esc(bld.risk)}</p>\n`;
      }
      
      buildingsSection += `</div>\n`;
    });
  });
  
  // Kapittel 2: Avvik (MED bilder)
  const avvikList = state.findings.filter(f => (f.type || "").toUpperCase() === "AVVIK");
  let avvikSection = "";
  avvikList.forEach((f, idx) => {
    const num = idx + 1;
    const loc = state.locations.find(l => l.id === f.locationId);
    const bld = loc?.buildings.find(b => b.id === f.buildingId);
    const buildingLabel = bld?.label || f.buildingHeading || "Bygg";
    const buildingNo = bld?.buildingNo ? ` (${esc(bld.buildingNo)})` : "";
    
    const title = f.title ? esc(f.title) : "";
    const desc = f.desc ? esc(f.desc) : "";
    
    // Severity badge med farge
    let severityBadge = "";
    if (f.severity) {
      let severityLabel = f.severity;
      let severityColor = "";
      
      if (f.severity.toLowerCase() === "lav") {
        severityLabel = "Mindre";
        severityColor = "background: #FFEB3B; color: #000;";
      } else if (f.severity.toLowerCase() === "middels") {
        severityLabel = "Middels";
        severityColor = "background: #FF9800; color: #000;";
      } else if (f.severity.toLowerCase() === "høy") {
        severityLabel = "Alvorlig";
        severityColor = "background: #F44336; color: #fff;";
      }
      
      severityBadge = ` <span class="report__severity" style="${severityColor} padding: 2px 8px; border-radius: 3px; font-weight: 700; font-size: 10pt;">${severityLabel}</span>`;
    }
    
    let dueDateText = "";
    if (f.dueDate) dueDateText = `<p style="margin-top: 12px;"><strong>Frist for utbedring:</strong> ${formatDateNo(f.dueDate)}</p>`;
    
    // Bilder
    let photosHtml = "";
    if (f.photos && f.photos.length > 0) {
      photosHtml = '<div style="margin-top: 12px;">';
      f.photos.forEach(photo => {
        const imgSrc = photo.reportDataUrl || photo.dataUrl;
        photosHtml += `<img class="report__image" src="${imgSrc}" alt="Bilde for avvik 2.${num}" style="max-height: 8cm; margin: 8px 0;" />`;
        if (photo.comment){
          photosHtml += `<p class="report__image-caption">${esc(photo.comment)}</p>`;
        }
      });
      photosHtml += '</div>';
    }
    
    avvikSection += `
<li>
  <h3 style="background: transparent; padding: 0; margin: 16px 0 8px 0;">Referansenummer 2.${num}${severityBadge}</h3>
  <div class="report__finding-building">${esc(buildingLabel)}${buildingNo}</div>
  ${title ? `<p style="margin-top: 8px;"><strong>${title}</strong></p>` : ""}
  ${desc ? `<p>${desc}</p>` : ""}
  ${photosHtml}
  ${dueDateText}
</li>
`;
  });
  
  // Kapittel 3: Anbefalinger (MED bilder)
  const anbList = state.findings.filter(f => (f.type || "").toUpperCase() === "ANBEFALING");
  let anbSection = "";
  anbList.forEach((f, idx) => {
    const num = idx + 1;
    const loc = state.locations.find(l => l.id === f.locationId);
    const bld = loc?.buildings.find(b => b.id === f.buildingId);
    const buildingLabel = bld?.label || f.buildingHeading || "Bygg";
    const buildingNo = bld?.buildingNo ? ` (${esc(bld.buildingNo)})` : "";
    
    const title = f.title ? esc(f.title) : "";
    const desc = f.desc ? esc(f.desc) : "";
    
    let dueDateText = "";
    if (f.dueDate) dueDateText = `<p style="margin-top: 12px;"><strong>Frist for tilbakemelding:</strong> ${formatDateNo(f.dueDate)}</p>`;
    
    // Bilder
    let photosHtml = "";
    if (f.photos && f.photos.length > 0) {
      photosHtml = '<div style="margin-top: 12px;">';
      f.photos.forEach(photo => {
        const imgSrc = photo.reportDataUrl || photo.dataUrl;
        photosHtml += `<img class="report__image" src="${imgSrc}" alt="Bilde for anbefaling 3.${num}" style="max-height: 8cm; margin: 8px 0;" />`;
        if (photo.comment){
          photosHtml += `<p class="report__image-caption">${esc(photo.comment)}</p>`;
        }
      });
      photosHtml += '</div>';
    }
    
    anbSection += `
<li>
  <h3 style="background: transparent; padding: 0; margin: 16px 0 8px 0;">Referansenummer 3.${num}</h3>
  <div class="report__finding-building">${esc(buildingLabel)}${buildingNo}</div>
  ${title ? `<p style="margin-top: 8px;"><strong>${title}</strong></p>` : ""}
  ${desc ? `<p>${desc}</p>` : ""}
  ${photosHtml}
  ${dueDateText}
</li>
`;
  });
  
  // Kapittel 4 er fjernet - bilder vises nå inline i avvik og anbefalinger

  // Bygg komplett HTML med KLP-profil og embedded CSS
  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Befaringsrapport – ${customerName}</title>
  <style>
/* KLP-profilert rapportlayout - Printvennlig */
@page {
  size: A4 portrait;
  margin: 2.5cm 2.5cm 2cm 2.5cm;
}

body {
  margin: 0;
  padding: 0;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #333;
  background: #f5f5f5;
}

.report {
  width: 21cm;
  min-height: 29.7cm;
  margin: 20px auto;
  padding: 2.5cm 2.5cm 2cm 2.5cm;
  background: #fff;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  position: relative;
}

/* Logo øverst på alle sider */
.report__logo {
  position: absolute;
  top: 0.3cm;
  right: 2.5cm;
  width: 102px;
  z-index: 1000;
}

.report__logo img {
  width: 100%;
  height: auto;
  display: block;
}

.report__header {
  background: #F0F0F0;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 20px;
  margin-bottom: 30px;
  position: relative;
  overflow: hidden;
}

.report__header h1 {
  font-family: Georgia, serif;
  font-size: 20pt;
  font-weight: 700;
  color: #3D3D3D;
  margin: 0 0 12px 0;
  line-height: 1.3;
}

.report__meta {
  font-family: Arial, 'Helvetica Neue', sans-serif;
  font-size: 10pt;
  line-height: 1.5;
  color: #3D3D3D;
  margin: 8px 0;
}

.report__meta strong {
  font-weight: 700;
  color: #3D3D3D;
}

.report__attendees {
  margin-top: 16px;
}

.report__attendees h3 {
  font-family: Georgia, serif;
  font-size: 12pt;
  font-weight: 700;
  color: #3D3D3D;
  margin: 12px 0 6px 0;
}

.report__attendees ul {
  list-style: none;
  padding: 0;
  margin: 0 0 8px 0;
}

.report__attendees li {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  padding: 3px 0;
  color: #3D3D3D;
}

.report h2 {
  font-family: Georgia, serif;
  font-size: 14pt;
  font-weight: 700;
  color: #3D3D3D;
  margin: 32px 0 14px 0;
  padding-bottom: 6px;
  border-bottom: 2px solid #3D3D3D;
  page-break-after: avoid;
}

.report h3 {
  font-family: Georgia, serif;
  font-size: 12pt;
  font-weight: 700;
  color: #3D3D3D;
  margin: 20px 0 10px 0;
  background: #CDFAE2;
  padding: 8px 12px;
  border-radius: 3px;
  page-break-after: avoid;
}

.report h4 {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  font-weight: 700;
  color: #3D3D3D;
  margin: 16px 0 8px 0;
}

.report p {
  font-family: Georgia, serif;
  font-size: 11pt;
  line-height: 1.6;
  margin: 0 0 12px 0;
  text-align: left;
  color: #333;
}

.report ul,
.report ol {
  margin: 12px 0 16px 0;
  padding-left: 24px;
  font-family: Georgia, serif;
  font-size: 11pt;
  line-height: 1.6;
}

.report li {
  margin-bottom: 8px;
  color: #333;
}

.report__objects {
  background: #F0F0F0;
  padding: 16px 20px;
  border-left: 4px solid #CDFAE2;
  border-radius: 3px;
  margin: 16px 0;
}

.report__objects ul {
  margin: 0;
}

.report__infobox {
  background: #FFE1E1;
  border-left: 4px solid #3D3D3D;
  padding: 14px 18px;
  margin: 16px 0;
  border-radius: 3px;
}

.report__infobox p {
  margin: 0 0 8px 0;
  font-size: 10.5pt;
  font-style: italic;
  color: #555;
}

.report__infobox p:last-child {
  margin-bottom: 0;
}

.report__building-meta {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.5;
  margin: 12px 0 24px 0;
}

.report__building-meta p {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  margin: 6px 0;
}

.report__building-meta ul {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  margin: 6px 0;
}

.report__findings ol {
  counter-reset: item;
  list-style-type: none;
  padding-left: 0;
}

.report__findings li {
  counter-increment: item;
  margin-bottom: 16px;
  padding-left: 0;
}

.report__findings li::before {
  content: counter(item) ". ";
  font-weight: 700;
  color: #3D3D3D;
  font-family: Arial, sans-serif;
}

.report__finding-title {
  font-weight: 700;
  color: #3D3D3D;
  font-family: Georgia, serif;
  font-size: 11pt;
}

.report__finding-building {
  font-family: Arial, sans-serif;
  font-size: 9pt;
  color: #666;
  font-style: italic;
  margin-bottom: 4px;
}

.report__image {
  max-width: 100%;
  max-height: 10cm;
  height: auto;
  display: block;
  margin: 16px 0 8px 0;
  border: 1px solid #ddd;
  border-radius: 3px;
  page-break-inside: avoid;
}

.report__image-caption {
  font-family: Arial, sans-serif;
  font-size: 9pt;
  color: #666;
  font-style: italic;
  margin: 0 0 16px 0;
}

.report section {
  margin-bottom: 24px;
}

.report strong {
  font-weight: 700;
  color: #3D3D3D;
}

/* Print-optimalisering */
@media print {
  body {
    background: #fff;
  }
  
  .report {
    width: 100%;
    margin: 0;
    padding: 2.5cm 2.5cm 2cm 2.5cm;
    box-shadow: none;
    min-height: 0;
  }
  
  /* Logo vises øverst på alle sider */
  .report__logo {
    position: fixed;
    top: 0.2cm;
    right: 2.5cm;
    z-index: 9999;
  }
  
  .report h2 {
    page-break-after: avoid;
  }
  
  .report h3,
  .report h4 {
    page-break-after: avoid;
  }
  
  .report section {
    page-break-inside: avoid;
  }
  
  .report__image {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  
  .report__infobox {
    background: #f9f9f9;
    border-left: 3px solid #000;
  }
  
  .report h3 {
    background: #f0f0f0;
  }
}

/* Skjerm-visning */
@media screen {
  .report {
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
  }
}
  </style>
</head>
<body>
<article class="report">

<!-- Logo (vises øverst på alle sider ved print) -->
<div class="report__logo">
  <img src="./icons/KLP_logo_koksgraa.png" alt="KLP Logo" />
</div>

<!-- Header / Faktaboks -->
<div class="report__header">
  <h1>Befaringsrapport – Risikogjennomgang</h1>
  <div class="report__meta"><strong>Dato:</strong> ${today}</div>
  <div class="report__meta"><strong>Kunde:</strong> ${customerName} (org.nr: ${orgnr})</div>
  
  <div class="report__attendees">
    <h3>Deltakere fra KLP:</h3>
    <ul>${klpList || "<li><em>Ingen registrert</em></li>"}</ul>
    
    <h3>Deltakere fra kunde:</h3>
    <ul>${customerList || "<li><em>Ingen registrert</em></li>"}</ul>
  </div>
</div>

<!-- Formålet med befaringen -->
<section>
  <h2>Formålet med befaringen</h2>

  <p>
    KLP Skadeforsikring AS forsikrer ${customerName} sine bygninger, 
    og vi har derfor, sammen med dere, gjennomført en befaring ved bygg nevnt nedenfor.
  </p>

  <p>
    Rapporten oppsummerer de forholdene som ble kommentert under befaringen med fokus på 
    å identifisere risikoforhold og gi anbefalinger for å redusere sannsynlighet for skade.
  </p>

  <p>
    Det er derfor gjennomført befaring ved følgende objekter:
  </p>

  <div class="report__objects">
    <ul>
      ${objectsList || "<li><em>Ingen objekter registrert</em></li>"}
    </ul>
  </div>
</section>

<!-- Innholdet i befaringsrapporten -->
<section>
  <h2>Innholdet i befaringsrapporten</h2>
  <p>
    Beskrivelse av det eller de byggene som er befart, herunder bygningens størrelse, 
    konstruksjon, virksomhet og installerte sikkerhetssystemer. Rapporten dokumenterer 
    avvik og anbefalinger knyttet til risikoforhold som ble observert under befaringen.
  </p>
</section>

<!-- 1. Beskrivelse av bygg -->
<section>
  <h2>1. Beskrivelse av bygg</h2>
  ${buildingsSection || "<p><em>Ingen bygg registrert</em></p>"}
</section>

<!-- 2. Avvik ved risikoforhold -->
<section class="report__findings">
  <h2>2. Avvik ved risikoforhold</h2>

  <div class="report__infobox">
    <p>
      Angitte avvik beskriver de viktigste risikoforholdene som ble observert under befaringen. 
      Avvikene bør følges opp og utbedres for å redusere risiko for skade.
    </p>
  </div>

  <ol>
    ${avvikSection || "<li><em>Ingen avvik registrert</em></li>"}
  </ol>
</section>

<!-- 3. Anbefalinger -->
<section class="report__findings">
  <h2>3. Anbefalinger</h2>

  <div class="report__infobox">
    <p>
      Angitte anbefalinger beskriver tiltak som kan bidra til å redusere risiko og 
      forbedre sikkerheten ved bygget.
    </p>
  </div>

  <ol>
    ${anbSection || "<li><em>Ingen anbefalinger registrert</em></li>"}
  </ol>
</section>

<!-- 4. Forsikringsavtalen -->
<section>
  <h2>4. Forsikringsavtalen</h2>
  <p>
    I forsikringsavtalen er det ansvarsbegrensninger om hva som må meldes fra om ved endring av risikoen. Dette gjelder blant annet dersom:
  </p>
  <ul>
    <li>Bygningens verdi øker etter påbygging eller ombygging</li>
    <li>Bygningen blir benyttet til annet formål enn avtalt</li>
  </ul>
  <p>
    Det er kundens ansvar å melde fra om dette. Dersom dette ikke gjøres, kan retten til erstatning bortfalle helt eller delvis, jf. forsikringsavtaleloven (FAL) § 4-6.
  </p>
</section>

<!-- 5. Forsikringsvilkårene – Sikkerhetsforskrifter -->
<section>
  <h2>5. Forsikringsvilkårene – Sikkerhetsforskrifter</h2>
  <p>
    I forsikringsvilkårene er det sikkerhetsforskrifter som sier hva som må gjøres for å begrense eller unngå skader. 
    Erstatningen kan bli redusert eller falle bort hvis sikkerhetsforskriftene ikke overholdes jf. forsikringsavtaleloven (FAL) § 4-8.
  </p>
  
  <p><strong>Noen sentrale sikkerhetsforskrifter:</strong></p>
  
  <p><strong>Brann</strong></p>
  <ul>
    <li>Det er krav til utendørs plassering og oppbevaring av avfallsbeholdere og brennbart materiale. Det skal plasseres slik at en brann ikke kan smitte til byggverk, og minst 5 meter fra brennbar yttervegg. Flyttbare avfallsbeholdere skal være fastmontert</li>
    <li>Utendørs lagring av brennbart materiale som for eksempel trelast, trepaller, flis, plast, papir og lignende, skal skje minst 8 meter fra byggverk</li>
    <li>Lagring med høyde over 4 meter eller større areal enn 200 kvm, skal plasseres minst 25 meter fra byggverk</li>
    <li>Særskilte krav gjelder ved varme arbeider, og den som utfører arbeidet må ha gyldig sertifikat for det</li>
    <li>Ansatte skal være orientert om brannforebyggende tiltak, bruk av slokkeutstyr og alarmer</li>
    <li>Brannskillende bygningskonstruksjoner inkludert dører og porter skal være utført og holdt i funksjonsmessig stand</li>
    <li>Slokkeutstyr skal være tilstrekkelig og godt merket, og kontroll skal foretas minst en gang per år</li>
    <li>Særskilte krav ved varme arbeider, og krav om sertifikat ved utførelse av arbeidet</li>
  </ul>
  
  <p><strong>Vann</strong></p>
  <ul>
    <li>Bygning skal holdes tilstrekkelig oppvarmet for å unngå frostskader</li>
    <li>Særskilte krav til fraflyttede bygninger</li>
    <li>Varer skal lagres minst 10 cm over gulv</li>
  </ul>
  
  <p><strong>Tyveri</strong></p>
  <ul>
    <li>Det er krav til at sikring av dører, vinduer, porter, luker og lignende er i henhold til krav fra FG Skadeteknikk (FGs) regelverk</li>
  </ul>
  
  <p><strong>Bygningsarbeid og reparasjoner</strong></p>
  <ul>
    <li>Det er krav til forskriftsmessig utførelse av bygningsarbeid og reparasjoner</li>
    <li>Det er krav til skadeforebyggende tiltak under bygging, ombygging og rehabilitering</li>
  </ul>
</section>

</article>
</body>
</html>`;
}

/* =========================
   EKSPORT-FUNKSJONER
========================= */

// Bygg kun rapport-innhold (body HTML) - for print med ekstern CSS
function buildReportContent() {
  const today = formatDateNo(state.inspectionDate);
  const customerName = esc(state.customer.name || "Ikke oppgitt");
  const orgnr = esc(state.customer.orgnr || "—");
  
  // Deltakere - grupperes i KLP og Kunde
  let klpList = "";
  state.attendees.klp.forEach(a => {
    if (a.name) {
      klpList += `<li>${esc(a.name)}${a.title ? " – " + esc(a.title) : ""}</li>\n`;
    }
  });
  
  let customerList = "";
  state.attendees.customer.forEach(a => {
    if (a.name) {
      customerList += `<li>${esc(a.name)}${a.title ? " – " + esc(a.title) : ""}</li>\n`;
    }
  });
  
  // Liste over objekter som er befart
  let objectsList = "";
  state.locations.forEach(loc => {
    loc.buildings.forEach(bld => {
      if (bld.label || loc.address){
        const label = bld.label || "Bygg";
        const addr = loc.address || "Adresse ikke oppgitt";
        const buildingNo = bld.buildingNo ? ` (bygningsnr. ${esc(bld.buildingNo)})` : "";
        objectsList += `<li><strong>${esc(label)}</strong>: ${esc(addr)}${buildingNo}</li>\n`;
      }
    });
  });
  
  // Kapittel 1: Beskrivelse av bygg (ett avsnitt pr bygg)
  let buildingsSection = "";
  state.locations.forEach(loc => {
    loc.buildings.forEach(bld => {
      const label = esc(bld.label || "Bygg");
      const addr = esc(loc.address || "—");
      const buildingNo = esc(bld.buildingNo || "—");
      
      // Virksomhet (flere valgt) - vis som punktliste
      let businessHtml = "";
      if (bld.businessInBuilding && bld.businessInBuilding.length > 0){
        businessHtml = "<ul>\n";
        bld.businessInBuilding.forEach(bus => {
          businessHtml += `  <li>${esc(bus)}</li>\n`;
        });
        businessHtml += "</ul>\n";
      } else {
        businessHtml = "<p>—</p>\n";
      }
      
      // Areal: totalareal + fordeling per virksomhet
      let areaHtml = "";
      if (bld.areaM2) {
        areaHtml = `<p><strong>Totalareal:</strong> ${esc(bld.areaM2)} m²</p>\n`;
        
        if (bld.areaBreakdown && Object.keys(bld.areaBreakdown).length > 0){
          areaHtml += "<p><strong>Fordeling per virksomhet:</strong></p>\n<ul>\n";
          Object.entries(bld.areaBreakdown).forEach(([k, v]) => {
            areaHtml += `  <li>${esc(k)}: ${esc(v)} m²</li>\n`;
          });
          areaHtml += "</ul>\n";
        }
      } else {
        areaHtml = "<p><strong>Areal:</strong> —</p>\n";
      }
      
      // Byggeår, etasjer, konstruksjon
      const buildYear = bld.buildYear ? esc(bld.buildYear) : "—";
      const floors = bld.floors ? esc(bld.floors) : "—";
      
      // Konstruksjon
      let constrHtml = "";
      const constrParts = [];
      if (bld.columns && bld.columns.length > 0) constrParts.push(`Søyler: ${bld.columns.join(", ")}`);
      if (bld.beams && bld.beams.length > 0) constrParts.push(`Bjelker: ${bld.beams.join(", ")}`);
      if (bld.deck && bld.deck.length > 0) constrParts.push(`Dekke: ${bld.deck.join(", ")}`);
      if (bld.roof && bld.roof.length > 0) constrParts.push(`Tak: ${bld.roof.join(", ")}`);
      if (bld.outerWall && bld.outerWall.length > 0) constrParts.push(`Yttervegg: ${bld.outerWall.join(", ")}`);
      
      if (constrParts.length > 0) {
        constrHtml = `<p><strong>Konstruksjon:</strong> ${esc(constrParts.join("; "))}</p>\n`;
      }
      
      // Materialer og beskyttelse - map codes til full labels
      let materialsHtml = "";
      if (bld.materials && bld.materials.length > 0) {
        const materialLabels = bld.materials.map(code => {
          const m = MATERIALS.find(x => x.code === code);
          return m ? m.label : code;
        });
        materialsHtml = `<p><strong>Bygningsmaterialer:</strong> ${esc(materialLabels.join(", "))}</p>\n`;
      }
      
      let protectionHtml = "";
      if (bld.protection && bld.protection.length > 0) {
        const protectionLabels = bld.protection.map(code => {
          const p = PROTECTION.find(x => x.code === code);
          return p ? p.label : code;
        });
        protectionHtml = `<p><strong>Beskyttelse:</strong> ${esc(protectionLabels.join(", "))}</p>\n`;
      }
      
      buildingsSection += `
<div class="report__building-meta avoid-break">
<h3>${label}</h3>
<p><strong>Adresse:</strong> ${addr}</p>
<p><strong>Bygningsnummer:</strong> ${buildingNo}</p>

<p><strong>Virksomhet i bygg:</strong></p>
${businessHtml}

${areaHtml}

<p><strong>Byggeår:</strong> ${buildYear}</p>
<p><strong>Antall etasjer:</strong> ${floors}</p>
${constrHtml}
${materialsHtml}
${protectionHtml}
`;
      
      if (bld.description){
        buildingsSection += `<p><strong>Bygningsbeskrivelse:</strong> ${esc(bld.description)}</p>\n`;
      }
      if (bld.safety){
        buildingsSection += `<p><strong>Sikkerhetsforhold:</strong> ${esc(bld.safety)}</p>\n`;
      }
      if (bld.risk){
        buildingsSection += `<p><strong>Generell risiko:</strong> ${esc(bld.risk)}</p>\n`;
      }
      
      buildingsSection += `</div>\n`;
    });
  });
  
  // Kapittel 2: Avvik (MED bilder)
  const avvikList = state.findings.filter(f => (f.type || "").toUpperCase() === "AVVIK");
  let avvikSection = "";
  avvikList.forEach((f, idx) => {
    const num = idx + 1;
    const loc = state.locations.find(l => l.id === f.locationId);
    const bld = loc?.buildings.find(b => b.id === f.buildingId);
    const buildingLabel = bld?.label || f.buildingHeading || "Bygg";
    const buildingNo = bld?.buildingNo ? ` (${esc(bld.buildingNo)})` : "";
    
    const title = f.title ? esc(f.title) : "";
    const desc = f.desc ? esc(f.desc) : "";
    
    // Severity badge med farge
    let severityBadge = "";
    if (f.severity) {
      let severityLabel = f.severity;
      let severityColor = "";
      
      if (f.severity.toLowerCase() === "lav") {
        severityLabel = "Mindre";
        severityColor = "background: #FFEB3B; color: #000;";
      } else if (f.severity.toLowerCase() === "middels") {
        severityLabel = "Middels";
        severityColor = "background: #FF9800; color: #000;";
      } else if (f.severity.toLowerCase() === "høy") {
        severityLabel = "Alvorlig";
        severityColor = "background: #F44336; color: #fff;";
      }
      
      severityBadge = ` <span class="report__severity" style="${severityColor} padding: 2px 8px; border-radius: 3px; font-weight: 700; font-size: 10pt;">${severityLabel}</span>`;
    }
    
    let dueDateText = "";
    if (f.dueDate) dueDateText = `<p style="margin-top: 3mm;"><strong>Frist for utbedring:</strong> ${formatDateNo(f.dueDate)}</p>`;
    
    // Bilder
    let photosHtml = "";
    if (f.photos && f.photos.length > 0) {
      photosHtml = '<div style="margin-top: 3mm;">';
      f.photos.forEach(photo => {
        const imgSrc = photo.reportDataUrl || photo.dataUrl;
        photosHtml += `<figure class="avoid-break"><img class="report__image" src="${imgSrc}" alt="Bilde for avvik 2.${num}" />`;
        if (photo.comment){
          photosHtml += `<figcaption class="report__image-caption">${esc(photo.comment)}</figcaption>`;
        }
        photosHtml += `</figure>`;
      });
      photosHtml += '</div>';
    }
    
    avvikSection += `
<li class="avoid-break">
  <h3 style="background: transparent; padding: 0; margin: 4mm 0 2mm 0;">Referansenummer 2.${num}${severityBadge}</h3>
  <div class="report__finding-building">${esc(buildingLabel)}${buildingNo}</div>
  ${title ? `<p style="margin-top: 2mm;"><strong>${title}</strong></p>` : ""}
  ${desc ? `<p>${desc}</p>` : ""}
  ${photosHtml}
  ${dueDateText}
</li>
`;
  });
  
  // Kapittel 3: Anbefalinger (MED bilder)
  const anbList = state.findings.filter(f => (f.type || "").toUpperCase() === "ANBEFALING");
  let anbSection = "";
  anbList.forEach((f, idx) => {
    const num = idx + 1;
    const loc = state.locations.find(l => l.id === f.locationId);
    const bld = loc?.buildings.find(b => b.id === f.buildingId);
    const buildingLabel = bld?.label || f.buildingHeading || "Bygg";
    const buildingNo = bld?.buildingNo ? ` (${esc(bld.buildingNo)})` : "";
    
    const title = f.title ? esc(f.title) : "";
    const desc = f.desc ? esc(f.desc) : "";
    
    let dueDateText = "";
    if (f.dueDate) dueDateText = `<p style="margin-top: 3mm;"><strong>Frist for tilbakemelding:</strong> ${formatDateNo(f.dueDate)}</p>`;
    
    // Bilder
    let photosHtml = "";
    if (f.photos && f.photos.length > 0) {
      photosHtml = '<div style="margin-top: 3mm;">';
      f.photos.forEach(photo => {
        const imgSrc = photo.reportDataUrl || photo.dataUrl;
        photosHtml += `<figure class="avoid-break"><img class="report__image" src="${imgSrc}" alt="Bilde for anbefaling 3.${num}" />`;
        if (photo.comment){
          photosHtml += `<figcaption class="report__image-caption">${esc(photo.comment)}</figcaption>`;
        }
        photosHtml += `</figure>`;
      });
      photosHtml += '</div>';
    }
    
    anbSection += `
<li class="avoid-break">
  <h3 style="background: transparent; padding: 0; margin: 4mm 0 2mm 0;">Referansenummer 3.${num}</h3>
  <div class="report__finding-building">${esc(buildingLabel)}${buildingNo}</div>
  ${title ? `<p style="margin-top: 2mm;"><strong>${title}</strong></p>` : ""}
  ${desc ? `<p>${desc}</p>` : ""}
  ${photosHtml}
  ${dueDateText}
</li>
`;
  });
  
  // Returner kun body-innholdet (for print med ekstern CSS)
  return `<article class="report">

<!-- Header / Faktaboks -->
<div class="report__header">
  <h1>Befaringsrapport – Risikogjennomgang</h1>
  <div class="report__meta"><strong>Dato:</strong> ${today}</div>
  <div class="report__meta"><strong>Kunde:</strong> ${customerName} (org.nr: ${orgnr})</div>
  
  <div class="report__attendees">
    <h3>Deltakere fra KLP:</h3>
    <ul>${klpList || "<li><em>Ingen registrert</em></li>"}</ul>
    
    <h3>Deltakere fra kunde:</h3>
    <ul>${customerList || "<li><em>Ingen registrert</em></li>"}</ul>
  </div>
</div>

<!-- Formålet med befaringen -->
<section>
  <h2>Formålet med befaringen</h2>

  <p>
    KLP Skadeforsikring AS forsikrer ${customerName} sine bygninger, 
    og vi har derfor, sammen med dere, gjennomført en befaring ved bygg nevnt nedenfor.
  </p>

  <p>
    Rapporten oppsummerer de forholdene som ble kommentert under befaringen med fokus på 
    å identifisere risikoforhold og gi anbefalinger for å redusere sannsynlighet for skade.
  </p>

  <p>
    Det er derfor gjennomført befaring ved følgende objekter:
  </p>

  <div class="report__objects">
    <ul>
      ${objectsList || "<li><em>Ingen objekter registrert</em></li>"}
    </ul>
  </div>
</section>

<!-- Innholdet i befaringsrapporten -->
<section>
  <h2>Innholdet i befaringsrapporten</h2>
  <p>
    Beskrivelse av det eller de byggene som er befart, herunder bygningens størrelse, 
    konstruksjon, virksomhet og installerte sikkerhetssystemer. Rapporten dokumenterer 
    avvik og anbefalinger knyttet til risikoforhold som ble observert under befaringen.
  </p>
</section>

<!-- 1. Beskrivelse av bygg -->
<section>
  <h2>1. Beskrivelse av bygg</h2>
  ${buildingsSection || "<p><em>Ingen bygg registrert</em></p>"}
</section>

<!-- 2. Avvik ved risikoforhold -->
<section class="report__findings">
  <h2>2. Avvik ved risikoforhold</h2>

  <div class="report__infobox">
    <p>
      Angitte avvik beskriver de viktigste risikoforholdene som ble observert under befaringen. 
      Avvikene bør følges opp og utbedres for å redusere risiko for skade.
    </p>
  </div>

  <ol>
    ${avvikSection || "<li><em>Ingen avvik registrert</em></li>"}
  </ol>
</section>

<!-- 3. Anbefalinger -->
<section class="report__findings">
  <h2>3. Anbefalinger</h2>

  <div class="report__infobox">
    <p>
      Angitte anbefalinger beskriver tiltak som kan bidra til å redusere risiko og 
      forbedre sikkerheten ved bygget.
    </p>
  </div>

  <ol>
    ${anbSection || "<li><em>Ingen anbefalinger registrert</em></li>"}
  </ol>
</section>

<!-- 4. Forsikringsavtalen -->
<section>
  <h2>4. Forsikringsavtalen</h2>
  <p>
    I forsikringsavtalen er det ansvarsbegrensninger om hva som må meldes fra om ved endring av risikoen. Dette gjelder blant annet dersom:
  </p>
  <ul>
    <li>Bygningens verdi øker etter påbygging eller ombygging</li>
    <li>Bygningen blir benyttet til annet formål enn avtalt</li>
  </ul>
  <p>
    Det er kundens ansvar å melde fra om dette. Dersom dette ikke gjøres, kan retten til erstatning bortfalle helt eller delvis, jf. forsikringsavtaleloven (FAL) § 4-6.
  </p>
</section>

<!-- 5. Forsikringsvilkårene – Sikkerhetsforskrifter -->
<section>
  <h2>5. Forsikringsvilkårene – Sikkerhetsforskrifter</h2>
  <p>
    I forsikringsvilkårene er det sikkerhetsforskrifter som sier hva som må gjøres for å begrense eller unngå skader. 
    Erstatningen kan bli redusert eller falle bort hvis sikkerhetsforskriftene ikke overholdes jf. forsikringsavtaleloven (FAL) § 4-8.
  </p>
  
  <p><strong>Noen sentrale sikkerhetsforskrifter:</strong></p>
  
  <p><strong>Brann</strong></p>
  <ul>
    <li>Det er krav til utendørs plassering og oppbevaring av avfallsbeholdere og brennbart materiale. Det skal plasseres slik at en brann ikke kan smitte til byggverk, og minst 5 meter fra brennbar yttervegg. Flyttbare avfallsbeholdere skal være fastmontert</li>
    <li>Utendørs lagring av brennbart materiale som for eksempel trelast, trepaller, flis, plast, papir og lignende, skal skje minst 8 meter fra byggverk</li>
    <li>Lagring med høyde over 4 meter eller større areal enn 200 kvm, skal plasseres minst 25 meter fra byggverk</li>
    <li>Særskilte krav gjelder ved varme arbeider, og den som utfører arbeidet må ha gyldig sertifikat for det</li>
    <li>Ansatte skal være orientert om brannforebyggende tiltak, bruk av slokkeutstyr og alarmer</li>
    <li>Brannskillende bygningskonstruksjoner inkludert dører og porter skal være utført og holdt i funksjonsmessig stand</li>
    <li>Slokkeutstyr skal være tilstrekkelig og godt merket, og kontroll skal foretas minst en gang per år</li>
    <li>Særskilte krav ved varme arbeider, og krav om sertifikat ved utførelse av arbeidet</li>
  </ul>
  
  <p><strong>Vann</strong></p>
  <ul>
    <li>Bygning skal holdes tilstrekkelig oppvarmet for å unngå frostskader</li>
    <li>Særskilte krav til fraflyttede bygninger</li>
    <li>Varer skal lagres minst 10 cm over gulv</li>
  </ul>
  
  <p><strong>Tyveri</strong></p>
  <ul>
    <li>Det er krav til at sikring av dører, vinduer, porter, luker og lignende er i henhold til krav fra FG Skadeteknikk (FGs) regelverk</li>
  </ul>
  
  <p><strong>Bygningsarbeid og reparasjoner</strong></p>
  <ul>
    <li>Det er krav til forskriftsmessig utførelse av bygningsarbeid og reparasjoner</li>
    <li>Det er krav til skadeforebyggende tiltak under bygging, ombygging og rehabilitering</li>
  </ul>
</section>

</article>`;
}

async function printReport(reportHtml) {
  // Fetch report.css som tekst (cache bust)
  const reportCss = await fetch("./report.css", { cache: "no-store" })
    .then(r => r.text())
    .catch(() => "");

  // Print-spesifikke CSS regler
  const printCss = `
    @page { size: A4; margin: 16mm; }
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { background:#fff !important; }
      img { max-width: 100% !important; height: auto !important; }
      .no-print { display:none !important; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
      h1,h2,h3 { break-after: avoid-page; page-break-after: avoid; }
    }
  `;

  // Åpne nytt vindu og injiser CSS + HTML
  const w = window.open("", "_blank");
  if (!w) {
    alert("Kunne ikke åpne vindu. Sjekk popup-blokkering.");
    return;
  }
  
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
    <style>${reportCss}</style><style>${printCss}</style>
    </head><body>${reportHtml}</body></html>`);
  w.document.close();
  w.focus();
  
  // Vent på at bilder lastes før print-dialog åpnes
  setTimeout(() => w.print(), 200);
}

async function exportToPDF(){
  const html = buildReportContent();
  await printReport(html);
}

async function exportToWord(){
  const html = buildReportHtml();
  
  const blob = new Blob([html], {
    type: "application/msword"
  });
  
  const filename = `Befaringsrapport-${state.customer.name || "rapport"}-${state.inspectionDate}.doc`;
  
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })){
    try {
      const file = new File([blob], filename, { type: blob.type });
      await navigator.share({
        title: "Befaringsrapport – Risikogjennomgang",
        text: `Befaringsrapport for ${state.customer.name || "kunde"} datert ${formatDateNo(state.inspectionDate)}.`,
        files: [file]
      });
    } catch (err){
      if (err.name !== "AbortError"){
        // Fallback: last ned
        downloadFile(blob, filename);
      }
    }
  } else {
    // Fallback: last ned
    downloadFile(blob, filename);
  }
}

async function exportAndEmail(){
  const html = buildReportHtml();
  
  const blob = new Blob([html], {
    type: "application/msword"
  });
  
  const filename = `Befaringsrapport-${state.customer.name || "rapport"}-${formatDateNo(state.inspectionDate)}.doc`;
  
  if (navigator.share && navigator.canShare){
    try {
      const file = new File([blob], filename, { type: blob.type });
      
      // Sjekk om filer kan deles
      if (navigator.canShare({ files: [file] })){
        await navigator.share({
          title: "Befaringsrapport – Risikogjennomgang",
          text: `Vedlagt befaringsrapport for ${state.customer.name || "kunde"} datert ${formatDateNo(state.inspectionDate)}.\n\nKLP Skadeforsikring AS`,
          files: [file]
        });
      } else {
        // Ingen fil-deling, prøv bare tekst+URL
        await navigator.share({
          title: "Befaringsrapport – Risikogjennomgang",
          text: `Befaringsrapport for ${state.customer.name || "kunde"} datert ${formatDateNo(state.inspectionDate)}.\n\nOBS: Denne enheten støtter ikke automatisk vedlegg. Last ned rapporten separat med knappen "Last ned Word".`
        });
      }
    } catch (err){
      if (err.name !== "AbortError"){
        alert("Kunne ikke dele rapport. Prøv å laste ned og dele manuelt.");
      }
    }
  } else {
    // Ingen Web Share API
    alert("Deling via e-post støttes ikke på denne enheten.\n\nBruk en mobil enhet eller nettbrett, eller last ned rapporten og send manuelt.");
  }
}

function downloadFile(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

init();
