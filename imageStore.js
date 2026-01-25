// IndexedDB store for images and annotations
// Offline-first: all blobs stored locally, synced later

const DB_NAME = "BefaringImageDB";
const DB_VERSION = 1;
const STORE_NAME = "images";

let db = null;

// Initialize IndexedDB
async function initImageDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("parentId", "parentId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

// Generate unique ID
function generateImageId() {
  return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Save image asset
async function saveImageAsset(imageAsset) {
  if (!db) await initImageDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put(imageAsset);
    request.onsuccess = () => resolve(imageAsset.id);
    request.onerror = () => reject(request.error);
  });
}

// Get image asset by ID
async function getImageAsset(id) {
  if (!db) await initImageDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all images for a parent (finding/building)
async function getImagesByParent(parentId) {
  if (!db) await initImageDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("parentId");
    
    const request = index.getAll(parentId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Delete image asset
async function deleteImageAsset(id) {
  if (!db) await initImageDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Convert File/Blob to base64 data URL
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert data URL to Blob
function dataURLToBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// Create new image asset from file
async function createImageAsset(file, parentId, parentType = "finding") {
  const id = generateImageId();
  const originalDataURL = await blobToDataURL(file);
  
  const imageAsset = {
    id,
    parentId,
    parentType, // "finding" or "building"
    originalDataURL,
    annotatedDataURL: null,
    annotationJson: null,
    hasAnnotations: false,
    createdAt: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    notes: "",
    gps: null
  };
  
  await saveImageAsset(imageAsset);
  return imageAsset;
}

// Update image with annotations
async function updateImageAnnotations(id, annotatedDataURL, annotationJson) {
  const asset = await getImageAsset(id);
  if (!asset) throw new Error("Image not found");
  
  asset.annotatedDataURL = annotatedDataURL;
  asset.annotationJson = annotationJson;
  asset.hasAnnotations = !!annotationJson;
  asset.updatedAt = new Date().toISOString();
  
  await saveImageAsset(asset);
  return asset;
}

// Export functions
window.ImageStore = {
  initImageDB: initImageDB,
  generateId: generateImageId,
  saveImage: saveImageAsset,
  getImage: getImageAsset,
  getImagesByParent: getImagesByParent,
  deleteImage: deleteImageAsset,
  createImageAsset: createImageAsset,
  updateImageAnnotations: updateImageAnnotations,
  blobToDataURL,
  dataURLToBlob
};
