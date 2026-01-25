// Image Capture Flow
// Handles: Capture → Annotate → "Add more?" → Repeat or Finish

class ImageCaptureFlow {
  constructor(parentId, parentType, onComplete) {
    this.parentId = parentId; // findingId or buildingId
    this.parentType = parentType; // "finding" or "building"
    this.onComplete = onComplete;
    this.capturedImages = [];
  }
  
  async start() {
    // Start with file input
    this.showCaptureOptions();
  }
  
  showCaptureOptions() {
    const html = `
      <div class="modal-overlay" id="captureModal">
        <div class="modal">
          <div class="modal-header">
            <h2>📷 Legg til bilder</h2>
            <button class="btn-icon" id="btnCloseCaptureModal">✕</button>
          </div>
          <div class="modal-body">
            <p>Ta bilde eller velg fra galleri</p>
            <input 
              type="file" 
              id="imageFileInput" 
              accept="image/*" 
              capture="environment" 
              style="display:none"
            />
            <button class="btn primary large" id="btnTakePhoto">
              📸 Ta bilde
            </button>
            <button class="btn large" id="btnSelectFromGallery">
              🖼️ Velg fra galleri
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML("beforeend", html);
    
    document.getElementById("btnTakePhoto").addEventListener("click", () => {
      const input = document.getElementById("imageFileInput");
      input.setAttribute("capture", "environment");
      input.click();
    });
    
    document.getElementById("btnSelectFromGallery").addEventListener("click", () => {
      const input = document.getElementById("imageFileInput");
      input.removeAttribute("capture");
      input.click();
    });
    
    document.getElementById("imageFileInput").addEventListener("change", (e) => {
      this.handleFileSelection(e.target.files);
    });
    
    document.getElementById("btnCloseCaptureModal").addEventListener("click", () => {
      this.closeCaptureModal();
    });
  }
  
  closeCaptureModal() {
    const modal = document.getElementById("captureModal");
    if (modal) modal.remove();
  }
  
  async handleFileSelection(files) {
    if (!files || files.length === 0) return;
    
    this.closeCaptureModal();
    
    for (const file of Array.from(files)) {
      await this.processImage(file);
    }
    
    // After processing all, ask if user wants more
    this.askForMore();
  }
  
  async processImage(file) {
    // Create ImageAsset in IndexedDB
    const imageAsset = await window.ImageStore.createImageAsset(
      file,
      this.parentId,
      this.parentType
    );
    
    // Show annotator
    await this.showAnnotator(imageAsset);
  }
  
  showAnnotator(imageAsset) {
    return new Promise((resolve) => {
      // Create annotator container
      const container = document.createElement("div");
      container.id = "annotatorContainer";
      document.body.appendChild(container);
      
      // Initialize annotator
      const annotator = new window.ImageAnnotator(
        "annotatorContainer",
        imageAsset.originalDataURL,
        async (annotatedDataURL, annotationJson) => {
          // Save annotations
          await window.ImageStore.updateImageAnnotations(
            imageAsset.id,
            annotatedDataURL,
            annotationJson
          );
          
          this.capturedImages.push(imageAsset.id);
          resolve();
        },
        () => {
          // Cancel - delete the image
          window.ImageStore.deleteImage(imageAsset.id);
          resolve();
        }
      );
    });
  }
  
  askForMore() {
    const html = `
      <div class="modal-overlay" id="askMoreModal">
        <div class="modal">
          <div class="modal-header">
            <h2>Dokumentere med flere bilder?</h2>
          </div>
          <div class="modal-body">
            <p>Du har lagt til ${this.capturedImages.length} bilde(r).</p>
            <p>Vil du legge til flere bilder?</p>
          </div>
          <div class="modal-footer">
            <button class="btn" id="btnFinishCapture">Ferdig</button>
            <button class="btn primary" id="btnAddMore">Legg til flere</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML("beforeend", html);
    
    document.getElementById("btnAddMore").addEventListener("click", () => {
      this.closeAskMoreModal();
      this.showCaptureOptions();
    });
    
    document.getElementById("btnFinishCapture").addEventListener("click", () => {
      this.closeAskMoreModal();
      this.finish();
    });
  }
  
  closeAskMoreModal() {
    const modal = document.getElementById("askMoreModal");
    if (modal) modal.remove();
  }
  
  async finish() {
    if (this.onComplete) {
      await this.onComplete(this.capturedImages);
    }
  }
}

// Export
window.ImageCaptureFlow = ImageCaptureFlow;
