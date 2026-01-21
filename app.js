const STORAGE_KEY = "befaring_state_v1";
const BRREG_URL = "https://data.brreg.no/enhetsregisteret/api/enheter";

let state = {
  inspectionDate: new Date().toISOString().slice(0,10),
  customer: { orgnr:"", name:"", orgForm:"", industry:"" },
  address: "",
  geo: { lat:null, lng:null, accuracy:null, ts:null },
  deviations: [] // {id,title,severity,desc,photoDataUrl}
};

const $ = (id) => document.getElementById(id);
const digits = (s) => (s||"").replace(/\D+/g,"");
const esc = (s) => String(s??"").replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function init(){
  $("inspectionDate").value = state.inspectionDate;

  $("orgnr").addEventListener("input", onOrgnr);
  $("customerName").addEventListener("input", e => state.customer.name = e.target.value);
  $("orgForm").addEventListener("input", e => state.customer.orgForm = e.target.value);
  $("industry").addEventListener("input", e => state.customer.industry = e.target.value);

  $("address").addEventListener("input", e => state.address = e.target.value);
  $("inspectionDate").addEventListener("input", e => state.inspectionDate = e.target.value);

  $("btnGPS").addEventListener("click", getGPS);
  $("btnAddDev").addEventListener("click", addDeviation);

  $("btnSave").addEventListener("click", save);
  $("btnLoad").addEventListener("click", load);
  $("btnReset").addEventListener("click", resetAll);
  $("btnExport").addEventListener("click", exportWord);

  render();
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
  if(!navigator.geolocation){
    alert("GPS ikke tilgjengelig i denne nettleseren.");
    return;
  }
  $("gpsStatus").textContent = "GPS: henter…";
  navigator.geolocation.getCurrentPosition(pos=>{
    state.geo.lat = pos.coords.latitude;
    state.geo.lng = pos.coords.longitude;
    state.geo.accuracy = pos.coords.accuracy;
    state.geo.ts = new Date(pos.timestamp).toISOString();
    $("gpsStatus").textContent = `GPS: ${state.geo.lat.toFixed(5)}, ${state.geo.lng.toFixed(5)} (±${Math.round(state.geo.accuracy)}m)`;
  }, err=>{
    alert("GPS-feil: " + err.message);
    $("gpsStatus").textContent = "GPS: ikke hentet";
  }, { enableHighAccuracy:true, timeout:12000, maximumAge:15000 });
}

async function addDeviation(){
  const title = $("devTitle").value.trim();
  if(!title){ alert("Tittel mangler."); return; }

  const severity = $("devSeverity").value;
  const desc = $("devDesc").value.trim();

  let photoDataUrl = "";
  const file = $("devPhoto").files?.[0];
  if (file) photoDataUrl = await readAsDataUrl(file);

  const id = `AV-${String(state.deviations.length+1).padStart(6,"0")}`;
  state.deviations.push({ id, title, severity, desc, photoDataUrl });

  $("devTitle").value = "";
  $("devDesc").value = "";
  $("devPhoto").value = "";
  render();
}

function render(){
  // defaults
  $("inspectionDate").value = state.inspectionDate || new Date().toISOString().slice(0,10);

  if(state.geo.lat && state.geo.lng){
    $("gpsStatus").textContent = `GPS: ${state.geo.lat.toFixed(5)}, ${state.geo.lng.toFixed(5)} (±${Math.round(state.geo.accuracy||0)}m)`;
  }

  const root = $("devList");
  if(!state.deviations.length){
    root.innerHTML = `<p class="muted">Ingen avvik registrert.</p>`;
    return;
  }

  root.innerHTML = state.deviations.map(d => `
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
      state.deviations = state.deviations.filter(x => x.id !== id);
      render();
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

  $("orgnr").value = state.customer.orgnr || "";
  $("customerName").value = state.customer.name || "";
  $("orgForm").value = state.customer.orgForm || "";
  $("industry").value = state.customer.industry || "";
  $("address").value = state.address || "";
  $("inspectionDate").value = state.inspectionDate || new Date().toISOString().slice(0,10);

  render();
  alert("Lastet.");
}

function resetAll(){
  if(!confirm("Nullstille alt?")) return;
  state = {
    inspectionDate: new Date().toISOString().slice(0,10),
    customer: { orgnr:"", name:"", orgForm:"", industry:"" },
    address: "",
    geo: { lat:null, lng:null, accuracy:null, ts:null },
    deviations: []
  };

  $("orgnr").value = "";
  $("customerName").value = "";
  $("orgForm").value = "";
  $("industry").value = "";
  $("address").value = "";
  $("inspectionDate").value = state.inspectionDate;
  $("brregStatus").textContent = "BRREG: klar";
  $("gpsStatus").textContent = "GPS: ikke hentet";

  render();
}

function exportWord(){
  const dateStr = state.inspectionDate || new Date().toISOString().slice(0,10);
  const fnameBase = (state.customer.name || "Befaring")
    .replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"_") || "Befaring";
  const fname = `${fnameBase}_${dateStr}.doc`;

  const devs = state.deviations.map(d=>`
    <h3>Avvik ${esc(d.id)} – ${esc(d.title)}</h3>
    <div><strong>Alvorlighet:</strong> ${esc(d.severity)}</div>
    ${d.desc ? `<div><strong>Beskrivelse:</strong><br>${esc(d.desc).replaceAll("\n","<br>")}</div>` : ""}
    ${d.photoDataUrl ? `<div style="margin-top:10px;"><img src="${d.photoDataUrl}" style="max-width:100%; border:1px solid #ddd; border-radius:10px;"></div>` : ""}
    <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;">
  `).join("");

  const html = `
    <!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#333;">
    <h1>Befaringsrapport</h1>
    <div><strong>Dato:</strong> ${esc(dateStr)}</div>
    <div><strong>Kunde:</strong> ${esc(state.customer.name)} &nbsp; <strong>Org.nr:</strong> ${esc(state.customer.orgnr)}</div>
    ${state.customer.orgForm ? `<div><strong>Org.form:</strong> ${esc(state.customer.orgForm)}</div>` : ""}
    ${state.customer.industry ? `<div><strong>Næringskode:</strong> ${esc(state.customer.industry)}</div>` : ""}
    <div><strong>Adresse:</strong> ${esc(state.address||"")}</div>
    ${(state.geo.lat&&state.geo.lng) ? `<div><strong>Koordinater:</strong> ${state.geo.lat.toFixed(5)}, ${state.geo.lng.toFixed(5)} (±${Math.round(state.geo.accuracy||0)}m)</div>` : ""}
    <h2>Avvik</h2>
    ${devs || "<div>Ingen avvik.</div>"}
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

function readAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = ()=> reject(r.error);
    r.readAsDataURL(file);
  });
}

init();
