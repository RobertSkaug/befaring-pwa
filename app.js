const STORAGE_KEY = "befaring_state_v2";
const BRREG_URL = "https://data.brreg.no/enhetsregisteret/api/enheter";

let state = {
  inspectionDate: new Date().toISOString().slice(0,10),
  customer: { orgnr:"", name:"", orgForm:"", industry:"" },

  // NYTT: flere lokasjoner
  locations: [
    newLocation("LOC-1")
  ],
  activeLocationId: "LOC-1"
};

let lastAddrSuggestions = [];

const $ = (id) => document.getElementById(id);
const digits = (s) => (s||"").replace(/\D+/g,"");
const esc = (s) => String(s??"").replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function newLocation(id){
  return {
    id,
    address: "",
    geo: { lat:null, lng:null, accuracy:null, ts:null },
    deviations: [] // {id,title,severity,desc,photoDataUrl}
  };
}

function getActiveLocation(){
  return state.locations.find(l => l.id === state.activeLocationId) || state.locations[0];
}

function init(){
  $("inspectionDate").value = state.inspectionDate;

  $("orgnr").addEventListener("input", onOrgnr);
  $("customerName").addEventListener("input", e => state.customer.name = e.target.value);
  $("orgForm").addEventListener("input", e => state.customer.orgForm = e.target.value);
  $("industry").addEventListener("input", e => state.customer.industry = e.target.value);

  $("inspectionDate").addEventListener("input", e => state.inspectionDate = e.target.value);

  $("address").addEventListener("input", e => {
    const loc = getActiveLocation();
    loc.address = e.target.value;
  });

  $("btnGPS").addEventListener("click", getGPS);
  $("btnAddDev").addEventListener("click", addDeviation);

  $("btnAddLocation").addEventListener("click", addLocation);

  $("btnSave").addEventListener("click", save);
  $("btnLoad").addEventListener("click", load);
  $("btnReset").addEventListener("click", resetAll);
  $("btnExport").addEventListener("click", exportWord);

  renderAll();
}

function addLocation(){
  const nextNr = state.locations.length + 1;
  const id = `LOC-${nextNr}`;
  state.locations.push(newLocation(id));
  state.activeLocationId = id;

  // rydd forslag ved bytte
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

  const loc = getActiveLocation();
  $("inspectionDate").value = state.inspectionDate || new Date().toISOString().slice(0,10);
  $("address").value = loc.address || "";

  if(loc.geo.lat && loc.geo.lng){
    $("gpsStatus").textContent =
      `GPS: ${loc.geo.lat.toFixed(5)}, ${loc.geo.lng.toFixed(5)} (±${Math.round(loc.geo.accuracy||0)}m)`;
  } else {
    $("gpsStatus").textContent = "GPS: ikke hentet";
  }

  renderDevs();
}

function renderLocationTabs(){
  const root = $("locTabs");
  const locs = state.locations;

  root.innerHTML = locs.map((l, idx) => {
    const active = l.id === state.activeLocationId ? "active" : "";
    const label = `Lokasjon ${idx+1}`;
    const hasAddr = l.address ? "•" : "";
    return `<button class="locTab ${active}" data-loc="${esc(l.id)}">${esc(label)} <span class="small">${esc(hasAddr)}</span></button>`;
  }).join("");

  root.querySelectorAll("[data-loc]").forEach(btn => {
    btn.addEventListener("click", () => setActiveLocation(btn.getAttribute("data-loc")));
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
      renderAll();
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
  const file = $("devPhoto").files?.[0];
  if (file) {
    // Komprimer bildet for å unngå gigantiske rapporter
    photoDataUrl = await readAsDataUrlCompressed(file, 1280, 0.82);
  }

  const id = `AV-${String(loc.deviations.length+1).padStart(6,"0")}`;
  loc.deviations.push({ id, title, severity, desc, photoDataUrl });

  $("devTitle").value = "";
  $("devDesc").value = "";
  $("devPhoto").value = "";
  renderDevs();
}

function renderDevs(){
  const loc = getActiveLocation();
  const root = $("devList");

  if(!loc.deviations.length){
    root.innerHTML = `<p class="muted">Ingen avvik registrert for denne lokasjonen.</p>`;
    return;
  }

  root.innerHTML = loc.deviations.map(d => `
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
      loc.deviations = loc.deviations.filter(x => x.id !== id);
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

  // Backward-compat: hvis gammel state mangler locations
  if (!state.locations || !state.locations.length) {
    state.locations = [ newLocation("LOC-1") ];
    state.activeLocationId = "LOC-1";
  }
  if (!state.activeLocationId) state.activeLocationId = state.locations[0].id;

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
    activeLocationId: "LOC-1"
  };

  $("orgnr").value = "";
  $("customerName").value = "";
  $("orgForm").value = "";
  $("industry").value = "";
  $("inspectionDate").value = state.inspectionDate;
  $("brregStatus").textContent = "BRREG: klar";

  renderAddressSuggestions([]);
  renderAll();
}

function exportWord(){
  const dateStr = state.inspectionDate || new Date().toISOString().slice(0,10);
  const fnameBase = (state.customer?.name || "Befaring")
    .replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"_") || "Befaring";
  const fname = `${fnameBase}_${dateStr}.doc`;

  // A4-vennlig bildeformat: max bredde og auto høyde
  const imgStyle = "width:100%; max-width:600px; height:auto; display:block; margin:10px 0; border:1px solid #ddd; border-radius:10px;";

  const locBlocks = state.locations.map((l, idx) => {
    const locTitle = `Lokasjon ${idx+1}`;
    const addr = l.address || "(adresse ikke satt)";
    const gps = (l.geo?.lat && l.geo?.lng) ? `${l.geo.lat.toFixed(5)}, ${l.geo.lng.toFixed(5)} (±${Math.round(l.geo.accuracy||0)}m)` : "ikke hentet";

    const devs = (l.deviations || []).map(d => `
      <h4 style="margin:14px 0 6px;">Avvik ${esc(d.id)} – ${esc(d.title)}</h4>
      <div><strong>Alvorlighet:</strong> ${esc(d.severity)}</div>
      ${d.desc ? `<div><strong>Beskrivelse:</strong><br>${esc(d.desc).replaceAll("\n","<br>")}</div>` : ""}
      ${d.photoDataUrl ? `<img src="${d.photoDataUrl}" style="${imgStyle}">` : ""}
    `).join("") || "<div>Ingen avvik.</div>";

    return `
      <hr style="border:none; border-top:2px solid #eee; margin:18px 0;">
      <h2 style="margin:0 0 8px;">${esc(locTitle)}</h2>
      <div><strong>Adresse:</strong> ${esc(addr)}</div>
      <div><strong>GPS:</strong> ${esc(gps)}</div>
      <h3 style="margin:14px 0 8px;">Avvik</h3>
      ${devs}
    `;
  }).join("");

  const html = `
    <!doctype html><html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;color:#333; font-size:11pt;">
      <h1 style="margin:0 0 10px;">Befaringsrapport</h1>
      <div><strong>Dato:</strong> ${esc(dateStr)}</div>
      <div><strong>Kunde:</strong> ${esc(state.customer?.name || "")} &nbsp; <strong>Org.nr:</strong> ${esc(state.customer?.orgnr || "")}</div>
      ${state.customer?.orgForm ? `<div><strong>Org.form:</strong> ${esc(state.customer.orgForm)}</div>` : ""}
      ${state.customer?.industry ? `<div><strong>Næringskode:</strong> ${esc(state.customer.industry)}</div>` : ""}
      ${locBlocks}
    </body></html>
  `;

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

/**
 * Leser bilde og komprimerer (nedskalering + JPEG quality).
 * maxDim: maks bredde/høyde (px). quality: 0..1
 */
function readAsDataUrlCompressed(file, maxDim = 1280, quality = 0.82){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => { img.src = reader.result; };
    reader.onerror = () => reject(reader.error);

    img.onload = () => {
      let w = img.width;
      let h = img.height;

      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale);
      h = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    };

    img.onerror = () => reject(new Error("Kunne ikke lese bilde"));
    reader.readAsDataURL(file);
  });
}

init();
