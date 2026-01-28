const STORAGE_KEY = "befaring_state_v5";
const BRREG_URL = "https://data.brreg.no/enhetsregisteret/api/enheter";

// For raskere adresseforslag (cache + parallell)
const addrCache = new Map();
const ADDR_CACHE_TTL_MS = 2 * 60 * 1000;

let state = {
  inspectionDate: new Date().toISOString().slice(0,10),
  reportAuthor: "",
  attendees: [],
  customer: { orgnr:"", name:"", orgForm:"", industry:"" },
  locations: [ newLocation("LOC-1") ],
  activeLocationId: "LOC-1",

  // Items: avvik/anbefalinger, bundet til locationId
  items: [] // {id, locationId, refNo, type, severity, dueDate, title, desc, photos:[{dataUrl, reportDataUrl, comment}], createdAt}
};

let lastAddrSuggestions = [];

const $ = (id) => document.getElementById(id);
const digits = (s) => (s||"").replace(/\D+/g,"");
const esc = (s) => String(s??"").replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[c]));

function newLocation(id){
  return { id, address:"", geo:{ lat:null, lng:null, accuracy:null, ts:null } };
}
function getActiveLocation(){
  return state.locations.find(l => l.id === state.activeLocationId) || state.locations[0];
}
function locationIndexById(id){
  return Math.max(0, state.locations.findIndex(l => l.id === id));
}
function shortAddress(addr, fallback){
  const s = (addr||"").trim();
  if(!s) return fallback;
  return s.length > 50 ? s.slice(0,47)+"..." : s;
}
function normalizeState(){
  if(!state.locations || !Array.isArray(state.locations) || !state.locations.length){
    state.locations = [ newLocation("LOC-1") ];
  }
  if(!state.activeLocationId) state.activeLocationId = state.locations[0].id;

  if(!state.items || !Array.isArray(state.items)) state.items = [];
  if(!state.attendees || !Array.isArray(state.attendees)) state.attendees = [];
  if(!state.reportAuthor) state.reportAuthor = "";

  const locIds = new Set(state.locations.map(l=>l.id));
  state.items = state.items.filter(it => locIds.has(it.locationId));
}
function getItemsForLocation(locationId){
  return (state.items||[]).filter(it => it.locationId === locationId);
}
function nextItemIdForLocation(locationId){
  const count = getItemsForLocation(locationId).length;
  return `IT-${String(count+1).padStart(4,"0")}`;
}
function buildRefNo(locationId){
  const locIdx = locationIndexById(locationId) + 1;
  const seq = nextItemIdForLocation(locationId).split("-")[1];
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = String(d.getFullYear()).slice(-2);
  return `L${locIdx}-${seq}-${mm}${yy}`; // eksempel: L2-0003-0126
}

function setItemFormDefaults(){
  const loc = getActiveLocation();
  $("itemType").value = "AVVIK";
  $("itemSeverity").value = "Middels";
  $("itemDue").value = "";
  $("itemTitle").value = "";
  $("itemDesc").value = "";
  $("itemPhotos").value = "";
  $("itemRef").value = buildRefNo(loc.id);
  updateItemFormVisibility();
}
function updateItemFormVisibility(){
  const isAvvik = $("itemType").value === "AVVIK";
  $("itemSeverity").disabled = !isAvvik;
  $("itemDue").disabled = !isAvvik;
}

function init(){
  normalizeState();

  $("inspectionDate").value = state.inspectionDate;
  $("reportAuthor").value = state.reportAuthor || "";

  // Attendees
  $("btnAddAttendee")?.addEventListener("click", () => {
    state.attendees.push({ name:"", title:"", employer:"" });
    renderAttendees();
  });
  renderAttendees();

  $("orgnr").addEventListener("input", onOrgnr);
  $("customerName").addEventListener("input", e => state.customer.name = e.target.value);
  $("orgForm").addEventListener("input", e => state.customer.orgForm = e.target.value);
  $("industry").addEventListener("input", e => state.customer.industry = e.target.value);

  $("inspectionDate").addEventListener("input", e => state.inspectionDate = e.target.value);
  $("reportAuthor")?.addEventListener("input", e => state.reportAuthor = e.target.value);

  $("address").addEventListener("input", e => {
    const loc = getActiveLocation();
    loc.address = e.target.value;
    renderLocationTabs();
    renderItemHeader();
  });

  $("btnGPS").addEventListener("click", getGPS);
  $("btnAddLocation").addEventListener("click", addLocation);

  $("btnSave").addEventListener("click", save);
  $("btnLoad").addEventListener("click", load);
  $("btnReset").addEventListener("click", resetAll);

  $("btnExport").addEventListener("click", exportWord);
  $("btnExportPdf").addEventListener("click", exportPdf);
  $("btnShare").addEventListener("click", shareReport);
  $("btnArchive")?.addEventListener("click", () => {
    saveFinalInspection();
    alert("Befaringen er lagret i arkivet.");
  });

  $("itemType").addEventListener("change", () => updateItemFormVisibility());
  $("btnAddItem").addEventListener("click", addItem);

  renderAll();
  loadInspectionForEditing();
}

function addLocation(){
  const id = `LOC-${state.locations.length + 1}`;
  state.locations.push(newLocation(id));
  state.activeLocationId = id;
  renderAddressSuggestions([]);
  renderAll();
}

function setActiveLocation(id){
  state.activeLocationId = id;
  renderAddressSuggestions([]);
  renderAll();
}

function renderAll(){
  renderLocationTabs();

  renderAttendees();

  const loc = getActiveLocation();
  $("inspectionDate").value = state.inspectionDate || new Date().toISOString().slice(0,10);
  $("address").value = loc.address || "";

  if(loc.geo.lat && loc.geo.lng){
    $("gpsStatus").textContent =
      `GPS: ${loc.geo.lat.toFixed(5)}, ${loc.geo.lng.toFixed(5)} (±${Math.round(loc.geo.accuracy||0)}m)`;
  } else {
    $("gpsStatus").textContent = "GPS: ikke hentet";
  }

  renderItemHeader();
  setItemFormDefaults();
  renderItems();
}

function renderLocationTabs(){
  const root = $("locTabs");
  root.innerHTML = state.locations.map((l, idx) => {
    const active = (l.id === state.activeLocationId) ? "active" : "";
    const fallback = `Lokasjon ${idx+1}`;
    const label = shortAddress(l.address, fallback);
    const count = getItemsForLocation(l.id).length;

    return `
      <button class="locTab ${active}" data-loc="${esc(l.id)}" title="${esc(l.address || fallback)}">
        <span class="locTab__label">${esc(label)}</span>
        <span class="locTab__count">(${count})</span>
      </button>`;
  }).join("");

  root.querySelectorAll("[data-loc]").forEach(btn => {
    btn.addEventListener("click", () => setActiveLocation(btn.getAttribute("data-loc")));
  });
}

function renderItemHeader(){
  const loc = getActiveLocation();
  const idx = locationIndexById(loc.id);
  const locName = `Lokasjon ${idx+1}`;
  const addr = loc.address ? loc.address : "(adresse ikke valgt)";
  const count = getItemsForLocation(loc.id).length;

  $("devHeaderTitle").textContent = `Punkt – ${locName}`;
  $("devHeaderSub").textContent = `${addr} • ${count} punkt`;
}

function renderAttendees(){
  const root = $("attendees");
  if(!root) return;

  if(!state.attendees || !state.attendees.length){
    root.innerHTML = '<p class="muted">Ingen deltakere lagt til.</p>';
    return;
  }

  root.innerHTML = state.attendees.map((att, idx) => `
    <div class="row">
      <div>
        <label>Navn</label>
        <input data-idx="${idx}" data-field="name" value="${esc(att.name||"")}" placeholder="Navn" />
      </div>
      <div>
        <label>Tittel</label>
        <input data-idx="${idx}" data-field="title" value="${esc(att.title||"")}" placeholder="Tittel" />
      </div>
      <div>
        <label>Arbeidsgiver</label>
        <input data-idx="${idx}" data-field="employer" value="${esc(att.employer||"")}" placeholder="Arbeidsgiver" />
      </div>
      <button class="btn danger" data-del="${idx}">Slett</button>
    </div>
  `).join("");

  root.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", e => {
      const idx = Number(inp.getAttribute("data-idx"));
      const field = inp.getAttribute("data-field");
      state.attendees[idx][field] = e.target.value;
    });
  });

  root.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-del"));
      state.attendees.splice(idx,1);
      renderAttendees();
    });
  });
}

async function onOrgnr(e){
  const v = digits(e.target.value);
  e.target.value = v;
  state.customer.orgnr = v;

  if (v.length === 9) {
    await brregFetch(v);
  } else {
    $("brregStatus").textContent = "BRREG: klar";
  }
}

async function brregFetch(orgnr){
  $("brregStatus").textContent = "BRREG: henter…";
  try{
    const res = await fetch(`${BRREG_URL}/${encodeURIComponent(orgnr)}`, { headers: { "Accept":"application/json" }});
    if(!res.ok){
      $("brregStatus").textContent = res.status === 404 ? "BRREG: ikke funnet" : `BRREG: feil (${res.status})`;
      return;
    }
    const e = await res.json();
    state.customer.name = e.navn || "";
    state.customer.orgForm = e.organisasjonsform?.kode ? `${e.organisasjonsform.kode} – ${e.organisasjonsform.beskrivelse||""}` : "";
    state.customer.industry = e.naeringskode1?.kode ? `${e.naeringskode1.kode} – ${e.naeringskode1.beskrivelse||""}` : "";

    $("customerName").value = state.customer.name;
    $("orgForm").value = state.customer.orgForm;
    $("industry").value = state.customer.industry;

    $("brregStatus").textContent = "BRREG: OK";
  } catch {
    $("brregStatus").textContent = "BRREG: feil (nett)";
  }
}

function cacheKey(lat,lng){
  const r = (x) => Math.round(x * 4000) / 4000; // ~0.00025
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
    const res = await fetch(url, {
      headers: { "Accept":"application/json" },
      signal: controller.signal
    });
    if(!res.ok) return null;

    const data = await res.json();
    if(!data || !data.display_name) return null;

    const a = data.address || {};
    const line1 = [a.road, a.house_number].filter(Boolean).join(" ").trim();
    const city = a.city || a.town || a.village || a.municipality || "";
    const line2 = [a.postcode, city].filter(Boolean).join(" ").trim();

    return {
      display_name: data.display_name,
      line1: line1 || data.display_name,
      line2: line2 || ""
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function renderAddressSuggestions(list){
  lastAddrSuggestions = list || [];
  const box = $("addrBox");
  const root = $("addrSuggestions");

  if (!lastAddrSuggestions.length){
    box.style.display = "none";
    root.innerHTML = "";
    return;
  }

  box.style.display = "block";
  root.innerHTML = lastAddrSuggestions.map((x, idx) => `
    <div class="addrItem" data-idx="${idx}">
      <div class="addrItem__main">${esc(x.line1)}</div>
      <div class="addrItem__sub">${esc(x.line2 || x.display_name)}</div>
    </div>
  `).join("");

  root.querySelectorAll(".addrItem").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-idx"));
      const picked = lastAddrSuggestions[idx];
      if (!picked) return;

      const loc = getActiveLocation();
      loc.address = picked.display_name;
      $("address").value = picked.display_name;

      $("addrBox").style.display = "none";

      renderLocationTabs();
      renderItemHeader();
    });
  });
}

async function addItem(){
  const loc = getActiveLocation();

  const type = $("itemType").value; // AVVIK / ANBEFALING
  const severity = $("itemSeverity").value;
  const dueDate = $("itemDue").value;
  const title = $("itemTitle").value.trim();
  const desc = $("itemDesc").value.trim();

  if(!title){
    alert("Tittel mangler.");
    return;
  }

  const refNo = $("itemRef").value || buildRefNo(loc.id);

  // Bilder: flere filer -> flere fotoobjekter med comment
  const files = Array.from($("itemPhotos").files || []);
  const photos = [];
  for (const f of files) {
    // app-versjon
    const dataUrl = await readAsDataUrlConstrained(f, 1400, 1400, 0.80);
    // rapport-versjon: hard begrenset
    const reportDataUrl = await readAsDataUrlConstrained(f, 900, 550, 0.80);
    photos.push({ dataUrl, reportDataUrl, comment: "" });
  }

  const item = {
    id: nextItemIdForLocation(loc.id),
    locationId: loc.id,
    refNo,
    type,
    severity: (type === "AVVIK") ? severity : "",
    dueDate: (type === "AVVIK") ? dueDate : "",
    title,
    desc,
    photos,
    createdAt: new Date().toISOString()
  };

  state.items.push(item);

  renderLocationTabs();
  renderItemHeader();
  setItemFormDefaults();
  renderItems();
}

function renderItems(){
  const loc = getActiveLocation();
  const list = getItemsForLocation(loc.id);
  const root = $("itemList");

  if(!list.length){
    root.innerHTML = `<p class="muted">Ingen avvik/anbefalinger registrert for denne lokasjonen.</p>`;
    return;
  }

  root.innerHTML = list.map(it => {
    const badgeClass = it.type === "AVVIK" ? "avvik" : "anb";
    const badgeText = it.type === "AVVIK" ? "AVVIK" : "ANBEFALING";

    const meta = [
      `Ref.nr: ${esc(it.refNo)}`,
      it.type === "AVVIK" && it.severity ? `Alvorlighet: ${esc(it.severity)}` : "",
      it.type === "AVVIK" && it.dueDate ? `Frist: ${esc(it.dueDate)}` : ""
    ].filter(Boolean).join(" • ");

    const photosHtml = (it.photos||[]).map((p, idx) => `
      <div class="photoRow">
        <img src="${p.dataUrl}" alt="Bilde">
        <div>
          <label>Kommentar til bilde</label>
          <textarea data-photo-comment="${esc(it.id)}|${idx}" placeholder="Kommentar / hva viser bildet?">${esc(p.comment||"")}</textarea>
        </div>
      </div>
    `).join("");

    return `
      <div class="dev">
        <div>
          <span class="badge ${badgeClass}">${badgeText}</span>
          <strong style="margin-left:8px;">${esc(it.title)}</strong>
        </div>

        <div class="itemMeta">${meta}</div>

        ${it.desc ? `<div class="muted" style="margin-top:8px;">${esc(it.desc).replaceAll("\n","<br>")}</div>` : ""}

        ${photosHtml ? `<div class="photoBlock"><strong>Bilder</strong>${photosHtml}</div>` : ""}

        <div class="inline" style="margin-top:12px;">
          <button class="btn" data-del-item="${esc(it.id)}">Slett</button>
        </div>
      </div>
    `;
  }).join("");

  // bind delete
  root.querySelectorAll("[data-del-item]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-item");
      state.items = state.items.filter(x => !(x.id === id && x.locationId === loc.id));
      renderLocationTabs();
      renderItemHeader();
      renderItems();
    });
  });

  // bind photo comment updates
  root.querySelectorAll("textarea[data-photo-comment]").forEach(t => {
    t.addEventListener("input", () => {
      const token = t.getAttribute("data-photo-comment");
      const [itemId, idxStr] = token.split("|");
      const idx = Number(idxStr);

      const item = state.items.find(x => x.id === itemId && x.locationId === loc.id);
      if(!item || !item.photos || !item.photos[idx]) return;

      item.photos[idx].comment = t.value;
    });
  });
}

function save(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    alert("Lagret.");
  } catch {
    alert("Kunne ikke lagre (kan skyldes store bilder).");
  }
}

function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){ alert("Ingen lagring funnet."); return; }

  state = JSON.parse(raw);
  normalizeState();

  $("orgnr").value = state.customer?.orgnr || "";
  $("customerName").value = state.customer?.name || "";
  $("orgForm").value = state.customer?.orgForm || "";
  $("industry").value = state.customer?.industry || "";
  $("inspectionDate").value = state.inspectionDate || new Date().toISOString().slice(0,10);
  $("reportAuthor").value = state.reportAuthor || "";

  renderAttendees();
  renderAddressSuggestions([]);
  renderAll();
  alert("Lastet.");
}

function resetAll(){
  if(!confirm("Nullstille alt?")) return;

  state = {
    inspectionDate: new Date().toISOString().slice(0,10),
    reportAuthor: "",
    attendees: [],
    customer: { orgnr:"", name:"", orgForm:"", industry:"" },
    locations: [ newLocation("LOC-1") ],
    activeLocationId: "LOC-1",
    items: []
  };

  $("orgnr").value = "";
  $("customerName").value = "";
  $("orgForm").value = "";
  $("industry").value = "";
  $("inspectionDate").value = state.inspectionDate;
  $("reportAuthor").value = "";
  $("brregStatus").textContent = "BRREG: klar";

  renderAttendees();

  renderAddressSuggestions([]);
  renderAll();
}

// Arkivlagring av fullført befaring
function saveFinalInspection(){
  const inspections = JSON.parse(localStorage.getItem("savedInspections") || "[]");
  const isEditing = Boolean(state.id);
  const id = isEditing ? state.id : Date.now();

  const payload = {
    id,
    inspectionDate: state.inspectionDate,
    reportAuthor: state.reportAuthor,
    attendees: state.attendees,
    customer: state.customer,
    locations: state.locations,
    activeLocationId: state.activeLocationId,
    items: state.items,
    savedDate: new Date().toISOString()
  };

  const idx = inspections.findIndex(x => x.id === id);
  if(idx >= 0){
    inspections[idx] = payload;
  } else {
    inspections.push(payload);
  }

  localStorage.setItem("savedInspections", JSON.stringify(inspections));
  state.id = id;
  return id;
}

function loadInspectionForEditing(){
  const raw = sessionStorage.getItem("editingInspection");
  if(!raw) return;
  try{
    const data = JSON.parse(raw);
    state = {
      id: data.id,
      inspectionDate: data.inspectionDate || new Date().toISOString().slice(0,10),
      reportAuthor: data.reportAuthor || "",
      attendees: data.attendees || [],
      customer: data.customer || { orgnr:"", name:"", orgForm:"", industry:"" },
      locations: data.locations || [ newLocation("LOC-1") ],
      activeLocationId: data.activeLocationId || (data.locations?.[0]?.id || "LOC-1"),
      items: data.items || []
    };
    normalizeState();

    $("orgnr").value = state.customer.orgnr || "";
    $("customerName").value = state.customer.name || "";
    $("orgForm").value = state.customer.orgForm || "";
    $("industry").value = state.customer.industry || "";
    $("inspectionDate").value = state.inspectionDate;
    $("reportAuthor").value = state.reportAuthor;

    renderAttendees();
    renderAddressSuggestions([]);
    renderAll();

    sessionStorage.removeItem("editingInspection");
    alert("✏️ Redigerer lagret befaring. Klikk Arkiver eller Eksporter for å oppdatere.");
  } catch(e){
    console.error("Kunne ikke laste editingInspection", e);
  }
}

function buildReportHtml({ forPrint }){
  const dateStr = state.inspectionDate || new Date().toISOString().slice(0,10);

  const imgStyle = "display:block; margin:10px 0; border:1px solid #ddd; border-radius:8px;";

  const printCss = forPrint ? `
    <style>
      @page { size: A4; margin: 16mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1, h2, h3, h4 { page-break-after: avoid; }
      .loc { page-break-inside: avoid; }
      .item { page-break-inside: avoid; }
      img { page-break-inside: avoid; }
    </style>
  ` : "";

  const locBlocks = state.locations.map((l, idx) => {
    const locTitle = `Lokasjon ${idx+1}`;
    const addr = l.address || "(adresse ikke valgt)";
    const gps = (l.geo?.lat && l.geo?.lng)
      ? `${l.geo.lat.toFixed(5)}, ${l.geo.lng.toFixed(5)} (±${Math.round(l.geo.accuracy||0)}m)`
      : "ikke hentet";

    const items = getItemsForLocation(l.id);
    const avvik = items.filter(x => x.type === "AVVIK");
    const anb = items.filter(x => x.type === "ANBEFALING");

    const renderItem = (it) => {
      const photos = (it.photos||[]).map(p => {
        const src = p.reportDataUrl || p.dataUrl;
        return `
          <div>
            <img src="${src}" style="${imgStyle}">
            ${p.comment ? `<div style="color:#666; font-size:10pt; margin:0 0 8px;"><strong>Kommentar:</strong> ${esc(p.comment)}</div>` : ""}
          </div>
        `;
      }).join("");

      const avvikMeta = it.type === "AVVIK"
        ? `<div><strong>Alvorlighet:</strong> ${esc(it.severity||"")} &nbsp; <strong>Frist:</strong> ${esc(it.dueDate||"")}</div>`
        : "";

      return `
        <div class="item" style="margin:12px 0 0;">
          <h4 style="margin:0 0 6px;">${esc(it.title)} <span style="color:#666;">(${esc(it.type)})</span></h4>
          <div style="margin:0 0 6px;"><strong>Ref.nr:</strong> ${esc(it.refNo)}</div>
          ${avvikMeta}
          ${it.desc ? `<div style="margin:0 0 8px;"><strong>Beskrivelse:</strong><br>${esc(it.desc).replaceAll("\n","<br>")}</div>` : ""}
          ${photos}
        </div>
        <div style="border-top:1px solid #eee; margin:12px 0;"></div>
      `;
    };

    const avvikHtml = avvik.length ? avvik.map(renderItem).join("") : "<div>Ingen avvik.</div>";
    const anbHtml = anb.length ? anb.map(renderItem).join("") : "<div>Ingen anbefalinger.</div>";

    return `
      <div class="loc" style="margin-top:18px;">
        <h2 style="margin:0 0 6px;">${esc(locTitle)} – ${esc(addr)}</h2>
        <div><strong>GPS:</strong> ${esc(gps)}</div>

        <h3 style="margin:12px 0 8px;">Avvik</h3>
        ${avvikHtml}

        <h3 style="margin:12px 0 8px;">Anbefalinger</h3>
        ${anbHtml}
      </div>
    `;
  }).join("");

  return `
    <!doctype html><html><head><meta charset="utf-8">
    ${printCss}
    </head>
    <body style="font-family:Arial,sans-serif;color:#333; font-size:11pt;">
      <h1 style="margin:0 0 10px;">Befaringsrapport</h1>
      <div><strong>Dato:</strong> ${esc(dateStr)}</div>
      <div><strong>Kunde:</strong> ${esc(state.customer?.name || "")} &nbsp; <strong>Org.nr:</strong> ${esc(state.customer?.orgnr || "")}</div>
      ${state.customer?.orgForm ? `<div><strong>Org.form:</strong> ${esc(state.customer.orgForm)}</div>` : ""}
      ${state.customer?.industry ? `<div><strong>Næringskode:</strong> ${esc(state.customer.industry)}</div>` : ""}
      ${locBlocks}
    </body></html>
  `;
}

function exportPdf(){
  const html = buildReportHtml({ forPrint: true });
  const w = window.open("", "_blank");
  if (!w) { alert("Kunne ikke åpne nytt vindu. Sjekk popup-blokkering."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 700);
}

function exportWord(){
  const dateStr = state.inspectionDate || new Date().toISOString().slice(0,10);
  const fnameBase = (state.customer?.name || "Befaring")
    .replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"_") || "Befaring";
  const fname = `${fnameBase}_${dateStr}.doc`;

  const html = buildReportHtml({ forPrint: false });

  const blob = new Blob([html], { type:"application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function shareReport(){
  const dateStr = state.inspectionDate || new Date().toISOString().slice(0,10);
  const fnameBase = (state.customer?.name || "Befaring")
    .replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"_") || "Befaring";

  // Del Word (enklest som fil). PDF kan dere fortsatt gjøre via print->share manuelt.
  const fname = `${fnameBase}_${dateStr}.doc`;
  const html = buildReportHtml({ forPrint: false });
  const blob = new Blob([html], { type: "application/msword" });
  const file = new File([blob], fname, { type: "application/msword" });

  try{
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "Befaringsrapport",
        text: "Se vedlagt befaringrapport.",
        files: [file]
      });
      return;
    }
  } catch {}

  exportWord();
  alert("Telefonen støtter ikke deling med vedlegg fra denne nettleseren. Rapporten er lastet ned – legg ved manuelt.");
}

/**
 * Leser bilde og begrenser fysisk størrelse (sikrer Word/PDF-layout).
 */
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
