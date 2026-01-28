(function(){
  const store = window.InspectionsStore;
  if(!store || !store.ENABLE_INSPECTION_STORAGE) return;

  const wrapSync = (name, after) => {
    const original = window[name];
    if(typeof original !== "function" || original.__wrapped) return;
    window[name] = function(...args){
      const result = original.apply(this, args);
      try { after(); } catch {}
      return result;
    };
    window[name].__wrapped = true;
  };

  const wrapAsync = (name, after) => {
    const original = window[name];
    if(typeof original !== "function" || original.__wrapped) return;
    window[name] = async function(...args){
      const result = await original.apply(this, args);
      try { after(); } catch {}
      return result;
    };
    window[name].__wrapped = true;
  };

  const hasCustomer = (state) => {
    const name = (state?.customer?.name || "").trim();
    const org = (state?.customer?.orgnr || "").trim();
    return Boolean(name || org);
  };

  const ensureDraftId = async () => {
    let id = store.getActiveId();
    if(!id){
      id = await store.createDraft(window.state);
    }
    return id;
  };

  const autoSave = async () => {
    try {
      if(!hasCustomer(window.state)) return;
      const id = await ensureDraftId();
      if(id) await store.saveDraft(id, window.state);
    } catch {}
  };

  wrapSync("saveBuild", () => autoSave());
  wrapAsync("exportToPDF", async () => {
    try {
      const id = store.getActiveId();
      if(id) await store.markCompleted(id, window.state);
    } catch {}
  });
  wrapAsync("exportToWord", async () => {
    try {
      const id = store.getActiveId();
      if(id) await store.markCompleted(id, window.state);
    } catch {}
  });
  wrapAsync("exportAndEmail", async () => {
    try {
      const id = store.getActiveId();
      if(id) await store.markCompleted(id, window.state);
    } catch {}
  });

  const startBtn = document.getElementById("btnStartInspection");
  if(startBtn){
    startBtn.addEventListener("click", () => {
      setTimeout(() => {
        autoSave();
      }, 0);
    });
  }

  const customerName = document.getElementById("customerName");
  if(customerName){
    customerName.addEventListener("input", () => {
      try { autoSave(); } catch {}
    });
  }
  const orgnr = document.getElementById("orgnr");
  if(orgnr){
    orgnr.addEventListener("input", () => {
      try { autoSave(); } catch {}
    });
  }

  document.addEventListener("input", () => {
    autoSave();
  }, true);
  document.addEventListener("change", () => {
    autoSave();
  }, true);

  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "hidden") autoSave();
  });
  window.addEventListener("beforeunload", () => {
    autoSave();
  });

  const resumeStep = sessionStorage.getItem("befaringResumeStep");
  if(resumeStep && typeof window.showStep === "function"){
    window.showStep(resumeStep);
    sessionStorage.removeItem("befaringResumeStep");
  }
})();
