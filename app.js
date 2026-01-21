const STORAGE_KEY = "befaring_state_v4";
const BRREG_URL = "https://data.brreg.no/enhetsregisteret/api/enheter";

let state = {
  inspectionDate: new Date().toISOString().slice(0,10),
  customer: { orgnr:"", name:"", orgForm:"", industry:"" },

  locations: [
    newLocation("LOC-1")
  ],
  activeLocationId: "LOC-1",

  // NYTT: avvik ligger globalt, men er alltid bundet til locationId
  deviations: [] // { id, locationId, title, severity, desc, photoDataUrl, createdAt }
};

let lastAddrSuggestions = [];

const $ = (id) => document.getElementById(id);
const digits = (s) => (s||"").replace(/\D+/g,"");
const esc = (s) => String(s??"").replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function newLocation(id){
  return {
    id,
    address: "",
    geo: { lat:null, lng:null, accuracy:null, ts:null }
  };
}

function getActiveLocation(){
  return state.locations.find(l => l.id === state.activeLocationId) || state.locations[0];
}

function locationIndexById(id){
  return Math.max(0, state.locations.findIndex(l => l.id === id));
}

function shortAddress(addr, fallback){
  const s = (addr || "").trim();
  if (!s) return fallback;
  return s.length > 50 ? s.slice(0, 47) + "…" : s;
}

function getDeviationsForLocation(locationId){
  return (state.deviations || []).filter(d => d.locationId === locationId);
}

function nextDeviationIdForLocation(locationId){
  const count = getDeviationsForLocation(locationId).length;
  return `AV-${String(count + 1).padStart(4,"0")}`;
}

function normalizeState(){
  // Ensure required structures exist
  if (!state.locations || !Array.isArray(state.locations) || state.locations.length === 0) {
    state.locations = [ newLocation("LOC-1") ];
  }
  if (!state.activeLocationId) state.activeLocationId = state.locations[0].id;

  // Ensure deviations exist
  if (!state.deviations || !Array.isArray(state.deviations)) state.deviations = [];

  // Remove deviations pointing to non-existing locations
  const locIds = new Set(state.locations.map(l => l.id));
  state.deviations = state.deviations.filter(d => locIds.has(d.locationId));
}

function clearDeviationForm(){
  $("devTitle").value = "";
  $("devDesc").value = "";
  $("devPhoto").value = "";
}

function init(){
  normalizeState();

  $("inspectionDate").value = state.inspectionDate;

  $("orgnr").addEventListener("input", onOrgnr);
  $("customerName").addEventListener("input", e => state.customer.name = e.target.value);
  $("orgForm").addEventListener("input", e => state.customer.orgForm = e.target.value);
  $("industry").addEventListener("input", e => state.customer.industry = e.target.value);

  $("inspectionDate").addEventListener("input", e => state.inspectionDate = e.target.value);

  $("address").addEventListener("input", e => {
    const loc = getActiveLocation();
    loc.address = e.target.value;
    renderLocationTabs();
    renderDevHeader();
  });

  $("btnGPS").addEventListener("click", getGPS);
  $("btnAddDev").addEventListener("click", addDeviation);
  $("btnAddLocation").addEventListener("click", addLocation);

  $("btnSave").addEventListener("click", save);
  $("btnLoad").addEventListener("click", load);
  $("btnReset").addEventListener("click", resetAll);

  $("btnExport").addEventListener("click", exportWord);
  $("btnExportPdf").addEventListener("click", exportPdf);
  $("btnShare").addEventListener("click", shareReport);

  renderAll();
}

function addLocation(){
  const id = `LOC-${state.locations.length + 1}`;
  state.locations.push(newLocation(id));
  state.activeLocationId = id;

  renderAddressSuggestions([]);
  clearDeviationForm();
  renderAll();
}

function setActiveLocation(id){
  state.activeLocationId = id;

  renderAddressSuggestions([]);
  clearDeviationForm();
  renderAll();
}

function renderAll(){
  renderLocationTabs();

  const loc = getActiveLocation();
  $("inspectionDate").value = state.inspectionDate || new Date().toISOString().slice(0,10);
  $("address").value = loc.address || "";

  if(loc.geo.lat && loc.geo.lng){
    $("gpsStatus").textContent =
      `GPS: ${loc.geo.lat.toFixed(5)}, ${loc.geo.lng.toFixed(5)} (±${Math.round(loc.geo.accuracy||0)}m)`;
  } else {
    $("gpsStatus").textContent = "GPS: ikke hentet";
  }

  renderDevHeader();
  renderDevs();
}

function renderLocationTabs(){
  const root = $("locTabs");
  root.innerHTML = state.locations.map((l, idx) => {
    const active = (l.id === state.activeLocationId) ? "active" : "";
    const fallback = `Lokasjon ${idx+1}`;
    const label = shortAddress(l.address, fallback);
    const count = getDeviationsForLocation(l.id).length;

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

function renderDevHeader(){
  const loc = getActiveLocation();
  const idx = locationIndexById(loc.id);
  const locName = `Lokasjon ${idx + 1}`;
  const addr = loc.address ? loc.address : "(adresse ikke valgt)";
  const count = getDeviationsForLocation(loc.id).length;

  $("devHeaderTitle").textContent = `Avvik – ${locName}`;
  $("devHeaderSub").textContent = `${addr} • ${count} avvik`;
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
  const d = 0.00025; // ~25–30 meter
  const points = [
    {lat, lng},
    {lat: lat + d, lng},
    {lat: lat - d, lng},
    {lat, lng: lng + d},
    {lat, lng: lng - d}
  ];

  const results = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    try{
      const r = await reverseGeocodeNominatim(p.lat, p.lng);
      if (r) results.push(r);
    } catch {}
    await sleep(250);
  }

  const seen = new Set();
  const unique = [];
  for (const r of results) {
    const key = r.display_name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }

  return unique.slice(0, 6);
}

async function reverseGeocodeNominatim(lat, lng){
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept":"application/json" }});
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
      renderDevHeader();
    });
  });
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function addDeviation(){
  const loc = getActiveLocation();

  const title = $("devTitle").value.trim();
  if(!title){ alert("Tittel mangler."); return; }

  const severity = $("devSeverity").value;
  const desc = $("devDesc").value.trim();

  let photoDataUrl = "";
  let photoReportDataUrl = "";
  const file = $("devPhoto").files?.[0];

  if (file) {
    // 1) App-bilde (greit kompromiss mellom kvalitet og størrelse)
    photoDataUrl = await readAsDataUrlConstrained(file, 1400, 1400, 0.80);

    // 2) Rapport-bilde (hard begrenset: bredde/ høyde)
    // 16cm x 10cm i Word tilsvarer typisk rundt 600–700px x 380–450px i praksis.
    // Vi bruker litt romslig margin her, men holder høyden tydelig nede.
    photoReportDataUrl = await readAsDataUrlConstrained(file, 900, 550, 0.80);
  }

  const deviation = {
    id: nextDeviationIdForLocation(loc.id),
    locationId: loc.id,
    title,
    severity,
    desc,
    photoDataUrl,
    photoReportDataUrl,
    createdAt: new Date().toISOString()
  };

  state.deviations.push(deviation);

  clearDeviationForm();
  renderLocationTabs();
  renderDevHeader();
  renderDevs();
}

function renderDevs(){
  const loc = getActiveLocation();
  const list = getDeviationsForLocation(loc.id);
  const root = $("devList");

  if(!list.length){
    root.innerHTML = `<p class="muted">Ingen avvik registrert for denne lokasjonen.</p>`;
    return;
  }

  root.innerHTML = list.map(d => `
    <div class="dev">
      <div><strong>${esc(d.id)}</strong> – ${esc(d.title)} <span class="muted">(${esc(d.severity)})</span></div>
      ${d.desc ? `<div class="muted" style="margin-top:6px;">${esc(d.desc).replaceAll("\n","<br>")}</div>` : ""}
      ${d.photoDataUrl ? `<div class="thumbs"><img src="${d.photoDataUrl}" alt="Bilde"></div>` : ""}
      <div class="inline" style="margin-top:10px;">
        <button class="btn" data-del="${esc(d.id)}">Slett</button>
      </div>
    </div>
  `).join("");

  root.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      state.deviations = state.deviations.filter(x => x.id !== id || x.locationId !== loc.id);
      renderLocationTabs();
      renderDevHeader();
      renderDevs();
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

  // Migration from older versions where deviations were inside each location:
  if (!state.deviations && state.locations?.some(l => Array.isArray(l.deviations))) {
    const migrated = [];
    state.locations.forEach(l => {
      (l.deviations || []).forEach(d => migrated.push({ ...d, locationId: l.id }));
      delete l.deviations;
    });
    state.deviations = migrated;
  }

  normalizeState();

  $("orgnr").value = state.customer?.orgnr || "";
  $("customerName").value = state.customer?.name || "";
  $("orgForm").value = state.customer?.orgForm || "";
  $("industry").value = state.customer?.industry || "";
  $("inspectionDate").value = state.inspectionDate || new Date().toISOString().slice(0,10);

  renderAddressSuggestions([]);
  renderAll();
  alert("Lastet.");
}

function resetAll(){
  if(!confirm("Nullstille alt?")) return;

  state = {
    inspectionDate: new Date().toISOString().slice(0,10),
    customer: { orgnr:"", name:"", orgForm:"", industry:"" },
    locations: [ newLocation("LOC-1") ],
    activeLocationId: "LOC-1",
    deviations: []
  };

  $("orgnr").value = "";
  $("customerName").value = "";
  $("orgForm").value = "";
  $("industry").value = "";
  $("inspectionDate").value = state.inspectionDate;
  $("brregStatus").textContent = "BRREG: klar";

  renderAddressSuggestions([]);
  clearDeviationForm();
  renderAll();
}

/**
 * Reliable export: PDF via browser print engine (images always render).
 * Opens a new tab with the report and triggers print dialog.
 */
function exportPdf(){
  const html = buildReportHtml({ forPrint: true });
  const w = window.open("", "_blank");
  if (!w) {
    alert("Kunne ikke åpne nytt vindu. Sjekk popup-blokkering.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // let the browser finish rendering images
  setTimeout(() => w.print(), 700);
}

/**
 * Word export: best-effort HTML .doc (can be inconsistent with embedded images in some Word setups).
 */
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
  const fname = `${fnameBase}_${dateStr}.doc`;

  // Vi bruker Word-rapporten (HTML .doc) fordi den kan deles som fil-vedlegg
  // uten ekstra bibliotek. PDF kan vi åpne/print'e, men ikke lage bytes stabilt uten pdf-lib.
  const html = buildReportHtml({ forPrint: false });
  const blob = new Blob([html], { type: "application/msword" });
  const file = new File([blob], fname, { type: "application/msword" });

  // Web Share API med filer (Share Sheet) – fungerer på moderne iOS/Android
  try{
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "Befaringsrapport",
        text: "Se vedlagt befaringrapport.",
        files: [file]
      });
      return;
    }
  } catch (e) {
    // Hvis deling feiler, faller vi tilbake under.
  }

  // Fallback: last ned filen og gi instruks om å legge ved manuelt
  exportWord();
  alert("Telefonen din støtter ikke deling med vedlegg fra nettleser/PWA. Rapporten er lastet ned – legg den ved manuelt i e-post.");
}

function buildReportHtml({ forPrint }){
  const dateStr = state.inspectionDate || new Date().toISOString().slice(0,10);

  // A4 text width safe inside Word/print with normal margins: ~16cm
  const imgStyle = "display:block; margin:10px 0; border:1px solid #ddd; border-radius:8px; max-width:16cm; height:auto;";

  const printCss = forPrint ? `
    <style>
      @page { size: A4; margin: 16mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1, h2, h3, h4 { page-break-after: avoid; }
      .loc { page-break-inside: avoid; }
      .dev { page-break-inside: avoid; }
      img { page-break-inside: avoid; }
    </style>
  ` : "";

  const locBlocks = state.locations.map((l, idx) => {
    const locTitle = `Lokasjon ${idx+1}`;
    const addr = l.address || "(adresse ikke valgt)";
    const gps = (l.geo?.lat && l.geo?.lng)
      ? `${l.geo.lat.toFixed(5)}, ${l.geo.lng.toFixed(5)} (±${Math.round(l.geo.accuracy||0)}m)`
      : "ikke hentet";

    const devs = getDeviationsForLocation(l.id);
    const devHtml = devs.length ? devs.map((d, n) => `
      <div class="dev" style="margin:12px 0 0;">
        <h4 style="margin:0 0 6px;">${n+1}. ${esc(d.title)} <span style="color:#666;">(${esc(d.severity)})</span></h4>
        <div style="margin:0 0 6px;"><strong>ID:</strong> ${esc(d.id)}</div>
        ${d.desc ? `<div style="margin:0 0 6px;"><strong>Beskrivelse:</strong><br>${esc(d.desc).replaceAll("\n","<br>")}</div>` : ""}
        ${(d.photoReportDataUrl || d.photoDataUrl) ? `<img src="${d.photoReportDataUrl || d.photoDataUrl}" style="${imgStyle}">` : ""}
      </div>
      <div style="border-top:1px solid #eee; margin:12px 0;"></div>
    `).join("") : "<div>Ingen avvik.</div>";

    return `
      <div class="loc" style="margin-top:18px;">
        <h2 style="margin:0 0 6px;">${esc(locTitle)} – ${esc(addr)}</h2>
        <div><strong>GPS:</strong> ${esc(gps)}</div>
        <h3 style="margin:12px 0 8px;">Avvik</h3>
        ${devHtml}
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

function readAsDataUrlConstrained(file, maxW = 1200, maxH = 1200, quality = 0.8){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => { img.src = reader.result; };
    reader.onerror = () => reject(reader.error);

    img.onload = () => {
      let w = img.width;
      let h = img.height;

      // Skaler ned slik at både bredde og høyde holder seg innenfor grensene
      const scale = Math.min(1, maxW / w, maxH / h);
      const nw = Math.max(1, Math.round(w * scale));
      const nh = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = nw;
      canvas.height = nh;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, nw, nh);

      // JPEG gir ofte mye mindre filer + bedre kompatibilitet i rapport
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };

    img.onerror = () => reject(new Error("Kunne ikke lese bilde"));
    reader.readAsDataURL(file);
  });
}

init();
