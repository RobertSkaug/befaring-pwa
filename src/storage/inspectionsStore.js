(function(){
  const ENABLE_INSPECTION_STORAGE = true;
  const META_KEY = "befaringer_meta";
  const LEGACY_KEY = "befaringer";
  const ACTIVE_KEY = "befaringActiveId";
  const SNAPSHOT_FALLBACK_PREFIX = "befaringSnapshot:";
  const DB_NAME = "befaring-pwa";
  const STORE = "inspectionSnapshots";
  const VERSION = 1;
  const META_VERSION = "v1";
  const THROTTLE_MS = 3000;
  let lastSaveAt = 0;

  const safeJson = (fn, fallback) => {
    try { return fn(); } catch { return fallback; }
  };

  const openDb = () => new Promise((resolve, reject) => {
    if(!("indexedDB" in window)) return reject();
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const idbPut = async (key, value) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbGet = async (key) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  };

  const idbDelete = async (key) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  };

  const loadMeta = () => {
    const existing = safeJson(() => {
      const raw = localStorage.getItem(META_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    }, []);

    if(existing.length > 0) return existing;

    const legacy = safeJson(() => {
      const raw = localStorage.getItem(LEGACY_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    }, []);

    if(legacy.length === 0) return existing;

    const mapped = legacy.map(item => {
      const id = item.id || genId();
      const status = item.status === "avsluttet" ? "completed" : "draft";
      const updatedAt = item.sistOppdatert || new Date().toISOString();
      const snap = item.data || {};

      safeJson(() => {
        localStorage.setItem(`${SNAPSHOT_FALLBACK_PREFIX}${id}`, JSON.stringify(snap));
      }, null);

      return {
        id,
        status,
        title: item.tittel || getTitle(snap),
        updatedAt,
        createdAt: updatedAt,
        progressHint: item.lastStep || "locations",
        version: META_VERSION,
        inspectionDate: snap?.inspectionDate || ""
      };
    });

    saveMeta(mapped);
    safeJson(() => localStorage.removeItem(LEGACY_KEY), null);
    return mapped;
  };

  const saveMeta = (list) => {
    safeJson(() => localStorage.setItem(META_KEY, JSON.stringify(list)), null);
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
    const customer = (state?.customer?.name || "").trim();
    if(customer) return customer;
    const loc = (state?.locations || []).find(l => l.id === state.activeLocationId) || (state?.locations || [])[0] || {};
    const addr = loc.address || "";
    const obj = loc.objectName || "";
    const title = [obj, addr].filter(Boolean).join(" – ");
    return title || "Befaring";
  };

  const getInspectionDate = (state) => (state?.inspectionDate || "");

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

  const upsertMeta = (list, item) => {
    const idx = list.findIndex(x => x.id === item.id);
    if(idx >= 0) list[idx] = item;
    else list.unshift(item);
    return list;
  };

  const saveSnapshot = async (id, snap) => {
    try {
      await idbPut(id, snap);
      safeJson(() => localStorage.setItem(`${SNAPSHOT_FALLBACK_PREFIX}${id}`, JSON.stringify(snap)), null);
      return true;
    } catch {
      safeJson(() => localStorage.setItem(`${SNAPSHOT_FALLBACK_PREFIX}${id}`, JSON.stringify(snap)), null);
      return false;
    }
  };

  const loadSnapshot = async (id) => {
    const fromLocal = safeJson(() => {
      const raw = localStorage.getItem(`${SNAPSHOT_FALLBACK_PREFIX}${id}`);
      return raw ? JSON.parse(raw) : null;
    }, null);
    if(fromLocal) return fromLocal;

    try {
      const fromIdb = await idbGet(id);
      if(fromIdb) return fromIdb;
    } catch {}
    return null;
  };

  const removeSnapshot = async (id) => {
    try { await idbDelete(id); } catch {}
    safeJson(() => localStorage.removeItem(`${SNAPSHOT_FALLBACK_PREFIX}${id}`), null);
  };

  const createDraft = async (initialSnapshot) => {
    if(!ENABLE_INSPECTION_STORAGE) return "";
    const id = genId();
    const now = new Date().toISOString();
    const meta = {
      id,
      status: "draft",
      title: getTitle(initialSnapshot),
      updatedAt: now,
      createdAt: now,
      progressHint: detectStep(),
      version: META_VERSION,
      inspectionDate: getInspectionDate(initialSnapshot)
    };

    saveMeta(upsertMeta(loadMeta(), meta));
    await saveSnapshot(id, snapshot(initialSnapshot));
    setActiveId(id);
    return id;
  };

  const saveDraft = async (id, snap) => {
    if(!ENABLE_INSPECTION_STORAGE) return;
    if(!id) return;

    const now = Date.now();
    if(now - lastSaveAt < THROTTLE_MS) return;
    lastSaveAt = now;

    const list = loadMeta();
    const existing = list.find(x => x.id === id);
    if(existing && existing.status === "completed") return;

    const meta = {
      id,
      status: "draft",
      title: getTitle(snap),
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      progressHint: detectStep(),
      version: META_VERSION,
      inspectionDate: getInspectionDate(snap)
    };

    saveMeta(upsertMeta(list, meta));
    await saveSnapshot(id, snapshot(snap));
  };

  const markCompleted = async (id, snap) => {
    if(!ENABLE_INSPECTION_STORAGE) return;
    if(!id) return;
    const list = loadMeta();
    const existing = list.find(x => x.id === id);
    if(!existing) return;

    const meta = {
      ...existing,
      status: "completed",
      title: getTitle(snap || existing.title),
      updatedAt: new Date().toISOString(),
      progressHint: existing.progressHint || "report",
      version: META_VERSION,
      inspectionDate: getInspectionDate(snap) || existing.inspectionDate || ""
    };

    saveMeta(upsertMeta(list, meta));
    await saveSnapshot(id, snapshot(snap));
    setActiveId("");
  };

  const listSummaries = () => {
    const list = loadMeta();
    return {
      drafts: list.filter(x => x.status === "draft"),
      completed: list.filter(x => x.status === "completed")
    };
  };

  const load = async (id) => loadSnapshot(id);

  const remove = async (id) => {
    if(!id) return;
    const list = loadMeta().filter(x => x.id !== id);
    saveMeta(list);
    await removeSnapshot(id);
    if(getActiveId() === id) setActiveId("");
  };

  window.InspectionsStore = {
    ENABLE_INSPECTION_STORAGE,
    createDraft,
    saveDraft,
    markCompleted,
    listSummaries,
    load,
    remove,
    setActiveId,
    getActiveId
  };
})();
