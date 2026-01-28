(function(){
  const ENABLE_INSPECTION_STORAGE = true;
  const STORAGE_KEY = "befaringer";
  const ACTIVE_KEY = "befaringActiveId";
  const THROTTLE_MS = 3000;
  let lastSaveAt = 0;

  const safeJson = (fn, fallback) => {
    try { return fn(); } catch { return fallback; }
  };

  const loadAll = () => {
    return safeJson(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    }, []);
  };

  const saveAll = (list) => {
    safeJson(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(list)), null);
  };

  const getActiveId = () => safeJson(() => localStorage.getItem(ACTIVE_KEY), "");
  const setActiveId = (id) => safeJson(() => {
    if(id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }, null);

  const genId = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  };

  const snapshot = (state) => safeJson(() => JSON.parse(JSON.stringify(state || {})), {});

  const getTitle = (state) => {
    const loc = (state?.locations || []).find(l => l.id === state.activeLocationId) || (state?.locations || [])[0] || {};
    const addr = loc.address || "";
    const obj = loc.objectName || "";
    const title = [obj, addr].filter(Boolean).join(" – ");
    return title || state?.customer?.name || "Befaring";
  };

  const detectStep = () => {
    const steps = ["landing","locations","findings","report"];
    for(const step of steps){
      const el = document.getElementById(`step${step[0].toUpperCase()}${step.slice(1)}`);
      if(!el) continue;
      const display = el.style.display || window.getComputedStyle(el).display;
      if(display !== "none") return step;
    }
    return "landing";
  };

  const upsert = (list, item) => {
    const idx = list.findIndex(x => x.id === item.id);
    if(idx >= 0) list[idx] = item;
    else list.unshift(item);
    return list;
  };

  const saveDraftInternal = (state, step, ignoreThrottle) => {
    if(!ENABLE_INSPECTION_STORAGE) return;

    const now = Date.now();
    if(!ignoreThrottle && now - lastSaveAt < THROTTLE_MS) return;
    lastSaveAt = now;

    const id = getActiveId() || genId();
    const list = loadAll();
    const existing = list.find(x => x.id === id);
    if(existing && existing.status === "avsluttet") return;

    const item = {
      id,
      status: "påbegynt",
      tittel: getTitle(state),
      sistOppdatert: new Date().toISOString(),
      lastStep: step,
      data: snapshot(state)
    };

    saveAll(upsert(list, item));
    setActiveId(id);
  };

  const saveDraft = (state) => {
    const step = detectStep();
    if(step === "landing") return;
    saveDraftInternal(state, step, false);
  };

  const saveDraftManual = (state) => {
    const step = detectStep();
    saveDraftInternal(state, step || "landing", true);
  };

  const markCompleted = (state) => {
    if(!ENABLE_INSPECTION_STORAGE) return;
    const id = getActiveId();
    if(!id) return;
    const list = loadAll();
    const existing = list.find(x => x.id === id);
    if(!existing) return;

    const item = {
      ...existing,
      status: "avsluttet",
      tittel: getTitle(state || existing.data),
      sistOppdatert: new Date().toISOString(),
      lastStep: existing.lastStep || "report",
      data: snapshot(state || existing.data)
    };

    saveAll(upsert(list, item));
    setActiveId("");
  };

  const listAll = () => loadAll();
  const getById = (id) => loadAll().find(x => x.id === id);

  const resume = (id) => {
    const item = getById(id);
    if(!item || !item.data) return false;
    safeJson(() => localStorage.setItem("befaringState", JSON.stringify(item.data)), null);
    sessionStorage.setItem("befaringResumeStep", item.lastStep || "locations");
    setActiveId(id);
    return true;
  };

  window.InspectionsStore = {
    ENABLE_INSPECTION_STORAGE,
    saveDraft,
    saveDraftManual,
    markCompleted,
    listAll,
    getById,
    resume,
    setActiveId,
    getActiveId
  };
})();
