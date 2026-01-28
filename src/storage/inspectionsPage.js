(function(){
  const store = window.InspectionsStore;
  if(!store || !store.ENABLE_INSPECTION_STORAGE) return;

  const formatDate = (iso) => {
    if(!iso) return "";
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("nb-NO", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  };

  const byStatus = (list, status) => list.filter(x => x.status === status)
    .sort((a,b) => (b.sistOppdatert || "").localeCompare(a.sistOppdatert || ""));

  const draftList = byStatus(store.listAll(), "påbegynt");
  const doneList = byStatus(store.listAll(), "avsluttet");

  const draftsEl = document.getElementById("draftList");
  const doneEl = document.getElementById("doneList");

  const renderList = (items, root, emptyText, withResume) => {
    if(!root) return;
    if(items.length === 0){
      root.innerHTML = `<p class="muted">${emptyText}</p>`;
      return;
    }

    root.innerHTML = items.map(item => {
      return `
        <div class="card" style="padding:12px; margin-bottom:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div>
              <div style="font-weight:600;">${item.tittel || "Befaring"}</div>
              <div class="muted" style="font-size:13px;">Sist oppdatert: ${formatDate(item.sistOppdatert)}</div>
            </div>
            ${withResume ? `<button class="btn btn--primary" data-resume="${item.id}">Fortsett</button>` : ""}
          </div>
          <div class="muted" style="font-size:13px; margin-top:8px;">Status: ${item.status}</div>
        </div>
      `;
    }).join("");

    if(withResume){
      root.querySelectorAll("[data-resume]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-resume");
          const ok = store.resume(id);
          if(ok) window.location.href = "./index.html";
        });
      });
    }
  };

  renderList(draftList, draftsEl, "Ingen påbegynte befaringer", true);
  renderList(doneList, doneEl, "Ingen avsluttede befaringer", false);
})();
