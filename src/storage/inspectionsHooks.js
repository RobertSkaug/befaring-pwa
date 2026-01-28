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

  wrapSync("saveBuild", () => store.saveDraft(window.state));
  wrapAsync("exportToPDF", () => store.markCompleted(window.state));
  wrapAsync("exportToWord", () => store.markCompleted(window.state));
  wrapAsync("exportAndEmail", () => store.markCompleted(window.state));

  const hasCustomer = (state) => {
    const name = (state?.customer?.name || "").trim();
    const org = (state?.customer?.orgnr || "").trim();
    return Boolean(name || org);
  };

  const startBtn = document.getElementById("btnStartInspection");
  if(startBtn){
    startBtn.addEventListener("click", () => {
      setTimeout(() => {
        try { store.saveDraft(window.state); } catch {}
      }, 0);
    });
  }

  const saveBtn = document.getElementById("btnSaveDraft");
  if(saveBtn){
    saveBtn.addEventListener("click", () => {
      try {
        if(hasCustomer(window.state)){
          store.saveDraftManual(window.state);
        }
      } catch {}
    });
  }

  const resumeStep = sessionStorage.getItem("befaringResumeStep");
  if(resumeStep && typeof window.showStep === "function"){
    window.showStep(resumeStep);
    sessionStorage.removeItem("befaringResumeStep");
  }
})();
