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

  const saveSessionDraft = () => {
    try {
      store.saveSessionDraft(window.state);
    } catch {}
  };
  wrapAsync("exportToPDF", async () => {
    try {
      let id = store.getActiveId();
      if(!id) id = await store.createDraft(window.state);
      if(id) await store.markCompleted(id, window.state);
    } catch {}
  });
  wrapAsync("exportToWord", async () => {
    try {
      let id = store.getActiveId();
      if(!id) id = await store.createDraft(window.state);
      if(id) await store.markCompleted(id, window.state);
    } catch {}
  });
  wrapAsync("exportAndEmail", async () => {
    try {
      let id = store.getActiveId();
      if(!id) id = await store.createDraft(window.state);
      if(id) await store.markCompleted(id, window.state);
    } catch {}
  });

  const startBtn = document.getElementById("btnStartInspection");
  if(startBtn){
    startBtn.addEventListener("click", () => {
      setTimeout(() => {
        saveSessionDraft();
      }, 0);
    });
  }

  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "hidden") saveSessionDraft();
  });
  window.addEventListener("beforeunload", () => {
    saveSessionDraft();
  });

  const resumeStep = sessionStorage.getItem("befaringResumeStep");
  if(resumeStep && typeof window.showStep === "function"){
    window.showStep(resumeStep);
    sessionStorage.removeItem("befaringResumeStep");
  }
})();
