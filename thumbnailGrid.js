// Thumbnail Grid Component
// Shows all images for a finding/building with status badges

class ThumbnailGrid {
  constructor(containerId, parentId, parentType) {
    this.containerId = containerId;
    this.parentId = parentId;
    this.parentType = parentType;
    this.images = [];
  }
  
  async render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    // Load images from IndexedDB
    this.images = await window.ImageStore.getImagesByParent(this.parentId, this.parentType);
    
    if (this.images.length === 0) {
      container.innerHTML = `
        <div class="thumbnail-grid-empty">
          <p>Ingen bilder lagt til ennå</p>
        </div>
      `;
      return;
    }
    
    const html = `
      <div class="thumbnail-grid">
        ${this.images.map(img => this.renderThumbnail(img)).join("")}
      </div>
    `;
    
    container.innerHTML = html;
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  renderThumbnail(image) {
    const displayURL = image.hasAnnotations ? image.annotatedDataURL : image.originalDataURL;
    const badge = image.hasAnnotations ? "✏️ Annotert" : "📷 Original";
    const badgeClass = image.hasAnnotations ? "badge-annotated" : "badge-original";
    
    return `
      <div class="thumbnail-item" data-image-id="${image.id}">
        <img src="${displayURL}" alt="Bilde" />
        <div class="thumbnail-badge ${badgeClass}">${badge}</div>
        <div class="thumbnail-actions">
          <button class="btn btn--icon-sm" data-action="edit" title="Rediger">✏️</button>
          <button class="btn btn--icon-sm" data-action="delete" title="Slett">🗑️</button>
        </div>
      </div>
    `;
  }
  
  setupEventListeners() {
    // Edit buttons
    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = e.target.closest(".thumbnail-item");
        const imageId = item.dataset.imageId;
        this.editImage(imageId);
      });
    });
    
    // Delete buttons
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = e.target.closest(".thumbnail-item");
        const imageId = item.dataset.imageId;
        this.deleteImage(imageId);
      });
    });
    
    // Click thumbnail to view full size
    document.querySelectorAll(".thumbnail-item img").forEach(img => {
      img.addEventListener("click", (e) => {
        const item = e.target.closest(".thumbnail-item");
        const imageId = item.dataset.imageId;
        this.viewImage(imageId);
      });
    });
  }
  
  async editImage(imageId) {
    const image = await window.ImageStore.getImage(imageId);
    if (!image) return;
    
    // Create annotator container
    const container = document.createElement("div");
    container.id = "annotatorContainer";
    document.body.appendChild(container);
    
    // Use existing annotation or start fresh
    const baseImage = image.hasAnnotations ? image.annotatedDataURL : image.originalDataURL;
    
    const annotator = new window.ImageAnnotator(
      "annotatorContainer",
      baseImage,
      async (annotatedDataURL, annotationJson) => {
        await window.ImageStore.updateImageAnnotations(
          imageId,
          annotatedDataURL,
          annotationJson
        );
        
        // Re-render grid
        await this.render();
      },
      () => {
        // Cancel - do nothing
      }
    );
  }
  
  async deleteImage(imageId) {
    if (!confirm("Er du sikker på at du vil slette dette bildet?")) return;
    
    await window.ImageStore.deleteImage(imageId);
    await this.render();
  }
  
  async viewImage(imageId) {
    const image = await window.ImageStore.getImage(imageId);
    if (!image) return;
    
    const displayURL = image.hasAnnotations ? image.annotatedDataURL : image.originalDataURL;
    
    const html = `
      <div class="modal-overlay" id="imageViewModal">
        <div class="modal large">
          <div class="modal-header">
            <h2>Bildevisning</h2>
            <button class="btn btn--icon" id="btnCloseImageView">✕</button>
          </div>
          <div class="modal-body center">
            <img src="${displayURL}" style="max-width: 100%; max-height: 70vh;" />
            ${image.notes ? `<p class="image-notes">${image.notes}</p>` : ""}
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" id="btnEditFromView">✏️ Rediger</button>
            <button class="btn btn--danger" id="btnDeleteFromView">🗑️ Slett</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML("beforeend", html);
    
    document.getElementById("btnCloseImageView").addEventListener("click", () => {
      document.getElementById("imageViewModal").remove();
    });
    
    document.getElementById("btnEditFromView").addEventListener("click", () => {
      document.getElementById("imageViewModal").remove();
      this.editImage(imageId);
    });
    
    document.getElementById("btnDeleteFromView").addEventListener("click", async () => {
      document.getElementById("imageViewModal").remove();
      await this.deleteImage(imageId);
    });
  }
}

// Export
window.ThumbnailGrid = ThumbnailGrid;
