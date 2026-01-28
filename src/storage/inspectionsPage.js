(function(){
  const store = window.InspectionsStore;
  if(!store || !store.ENABLE_INSPECTION_STORAGE) return;

  const formatDate = (iso) => {
    if(!iso) return "";
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("nb-NO", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  };

  const sortByUpdated = (a,b) => (b.updatedAt || "").localeCompare(a.updatedAt || "");
  const { completed } = store.listSummaries();
  completed.sort(sortByUpdated);

  const session = store.loadSessionDraft();
  const drafts = session ? [{
    id: "session",
    status: "draft",
    title: session.title,
    updatedAt: session.updatedAt,
    inspectionDate: session.inspectionDate || session.updatedAt,
    progressHint: session.progressHint || "locations",
    snapshot: session.snapshot
  }] : [];

  const draftsEl = document.getElementById("draftList");
  const doneEl = document.getElementById("doneList");

  const renderList = (items, root, emptyText, opts) => {
    if(!root) return;
    if(items.length === 0){
      root.innerHTML = `<p class="muted">${emptyText}</p>`;
      return;
    }

    root.innerHTML = items.map(item => {
      const dateText = item.inspectionDate || item.updatedAt || "";
      return `
        <div class="card" style="padding:12px; margin-bottom:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div>
              <div style="font-weight:600;">${item.title || "Befaring"}</div>
              <div class="muted" style="font-size:13px;">Dato: ${formatDate(dateText)}</div>
              <div class="muted" style="font-size:12px;">Sist oppdatert: ${formatDate(item.updatedAt)}</div>
            </div>
            <div style="display:flex; gap:8px;">
              ${opts.resume ? `<button class="btn btn--primary" data-resume="${item.id}">Fortsett</button>` : ""}
              ${opts.open ? `<button class="btn btn--secondary" data-open="${item.id}">Åpne</button>` : ""}
              ${opts.delete ? `<button class="btn btn--tertiary" data-delete="${item.id}">Slett</button>` : ""}
            </div>
          </div>
          <div class="muted" style="font-size:13px; margin-top:8px;">Status: ${item.status}</div>
        </div>
      `;
    }).join("");

    root.querySelectorAll("[data-resume]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-resume");
        const item = items.find(x => x.id === id) || {};
        const snap = item.snapshot || await store.load(id);
        if(!snap) return;
        localStorage.setItem("befaringState", JSON.stringify(snap));
        sessionStorage.setItem("befaringResumeStep", item.progressHint || "locations");
        if(id !== "session") store.setActiveId(id);
        window.location.href = "./index.html";
      });
    });

    root.querySelectorAll("[data-open]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-open");
        const snap = await store.load(id);
        if(!snap) return;
        const item = items.find(x => x.id === id) || {};
        localStorage.setItem("befaringState", JSON.stringify(snap));
        sessionStorage.setItem("befaringResumeStep", item.progressHint || "report");
        store.setActiveId(id);
        window.location.href = "./index.html";
      });
    });

    root.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if(id === "session"){
          store.clearSessionDraft();
        } else {
          await store.remove(id);
        }
        window.location.reload();
      });
    });
  };

  renderList(drafts, draftsEl, "Ingen påbegynte befaringer", { resume:true, delete:true });
  renderList(completed, doneEl, "Ingen avsluttede befaringer", { open:true });
})();
