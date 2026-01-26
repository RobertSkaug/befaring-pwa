// Image Annotator with Fabric.js
// Supports: Arrow, Rectangle, Freehand, Text, Blur
// Touch-friendly with undo/redo

class ImageAnnotator {
  constructor(containerId, imageDataURL, onSave, onCancel) {
    this.containerId = containerId;
    this.imageDataURL = imageDataURL;
    this.onSave = onSave;
    this.onCancel = onCancel;
    
    this.canvas = null;
    this.fabricCanvas = null;
    this.currentTool = "select";
    this.isDrawing = false;
    this.history = [];
    this.historyStep = -1;
    
    this.init();
  }
  
  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error("Container not found:", this.containerId);
      return;
    }
    
    // Render UI
    container.innerHTML = this.renderUI();
    
    // Load image and setup canvas
    await this.loadImage();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Save initial state
    this.saveHistory();
  }
  
  renderUI() {
    return `
      <div class="annotator-overlay">
        <div class="annotator-container">
          <div class="annotator-header">
            <h2>Annoter bilde</h2>
            <button class="btn btn--icon" id="btnCloseAnnotator">✕</button>
          </div>
          
          <div class="annotator-toolbar">
            <button class="tool-btn active" data-tool="select" title="Velg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
              </svg>
            </button>
            <button class="tool-btn" data-tool="pen" title="Tegn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              </svg>
            </button>
            <button class="tool-btn" data-tool="arrow" title="Pil">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button class="tool-btn" data-tool="rect" title="Rektangel">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button class="tool-btn" data-tool="text" title="Tekst">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
              </svg>
            </button>
            <button class="tool-btn" data-tool="blur" title="Sladd/Blur">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6M23 12h-6m-6 0H1"/>
              </svg>
            </button>
            
            <div class="toolbar-divider"></div>
            
            <button class="tool-btn" id="btnUndo" title="Angre">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
              </svg>
            </button>
            <button class="tool-btn" id="btnRedo" title="Gjør om">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/>
              </svg>
            </button>
            <button class="tool-btn" id="btnDelete" title="Slett valgt">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>
              </svg>
            </button>
          </div>
          
          <div class="annotator-canvas-wrapper">
            <canvas id="annotatorCanvas"></canvas>
          </div>
          
          <div class="annotator-footer">
            <button class="btn btn--tertiary" id="btnCancelAnnotation">Avbryt</button>
            <button class="btn btn--primary" id="btnSaveAnnotation">Lagre og fortsett</button>
          </div>
        </div>
      </div>
    `;
  }
  
  async loadImage() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Setup canvas dimensions
        const maxWidth = Math.min(window.innerWidth - 40, 800);
        const maxHeight = window.innerHeight - 250;
        
        let width = img.width;
        let height = img.height;
        
        // Scale down if needed
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        // Initialize Fabric canvas
        this.fabricCanvas = new fabric.Canvas("annotatorCanvas", {
          width,
          height,
          backgroundColor: "#f0f0f0"
        });
        
        // Add background image
        fabric.Image.fromURL(this.imageDataURL, (img) => {
          img.scaleToWidth(width);
          img.scaleToHeight(height);
          img.selectable = false;
          img.evented = false;
          this.fabricCanvas.setBackgroundImage(img, this.fabricCanvas.renderAll.bind(this.fabricCanvas));
          resolve();
        });
      };
      img.onerror = reject;
      img.src = this.imageDataURL;
    });
  }
  
  setupEventListeners() {
    // Tool buttons
    document.querySelectorAll(".tool-btn[data-tool]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tool = btn.dataset.tool;
        this.setTool(tool);
        
        // Update active state
        document.querySelectorAll(".tool-btn[data-tool]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
    
    // Action buttons
    document.getElementById("btnUndo").addEventListener("click", () => this.undo());
    document.getElementById("btnRedo").addEventListener("click", () => this.redo());
    document.getElementById("btnDelete").addEventListener("click", () => this.deleteSelected());
    
    // Save/Cancel
    document.getElementById("btnSaveAnnotation").addEventListener("click", () => this.save());
    document.getElementById("btnCancelAnnotation").addEventListener("click", () => this.cancel());
    document.getElementById("btnCloseAnnotator").addEventListener("click", () => this.cancel());
    
    // Fabric canvas events
    this.fabricCanvas.on("mouse:down", (e) => this.onMouseDown(e));
    this.fabricCanvas.on("mouse:move", (e) => this.onMouseMove(e));
    this.fabricCanvas.on("mouse:up", (e) => this.onMouseUp(e));
    this.fabricCanvas.on("object:added", () => this.saveHistory());
    this.fabricCanvas.on("object:modified", () => this.saveHistory());
  }
  
  setTool(tool) {
    this.currentTool = tool;
    this.fabricCanvas.isDrawingMode = (tool === "pen");
    
    if (tool === "pen") {
      this.fabricCanvas.freeDrawingBrush.width = 3;
      this.fabricCanvas.freeDrawingBrush.color = "#E51C66";
    }
    
    // Enable/disable selection
    this.fabricCanvas.selection = (tool === "select");
    this.fabricCanvas.forEachObject(obj => {
      obj.selectable = (tool === "select");
    });
  }
  
  onMouseDown(e) {
    if (this.currentTool === "select" || this.currentTool === "pen") return;
    
    this.isDrawing = true;
    const pointer = this.fabricCanvas.getPointer(e.e);
    this.startX = pointer.x;
    this.startY = pointer.y;
    
    if (this.currentTool === "arrow") {
      this.createArrow(pointer.x, pointer.y, pointer.x, pointer.y);
    } else if (this.currentTool === "rect") {
      this.createRect(pointer.x, pointer.y, 0, 0);
    } else if (this.currentTool === "blur") {
      this.createBlur(pointer.x, pointer.y, 0, 0);
    } else if (this.currentTool === "text") {
      this.createText(pointer.x, pointer.y);
      this.isDrawing = false;
    }
  }
  
  onMouseMove(e) {
    if (!this.isDrawing || !this.currentObject) return;
    
    const pointer = this.fabricCanvas.getPointer(e.e);
    
    if (this.currentTool === "arrow") {
      this.updateArrow(pointer.x, pointer.y);
    } else if (this.currentTool === "rect") {
      this.updateRect(pointer.x, pointer.y);
    } else if (this.currentTool === "blur") {
      this.updateBlur(pointer.x, pointer.y);
    }
  }
  
  onMouseUp(e) {
    this.isDrawing = false;
    this.currentObject = null;
  }
  
  createArrow(x1, y1, x2, y2) {
    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: "#E51C66",
      strokeWidth: 3,
      selectable: true
    });
    
    // Create arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headlen = 15;
    
    const arrow = new fabric.Group([
      line,
      new fabric.Line([
        x2, y2,
        x2 - headlen * Math.cos(angle - Math.PI / 6),
        y2 - headlen * Math.sin(angle - Math.PI / 6)
      ], { stroke: "#E51C66", strokeWidth: 3 }),
      new fabric.Line([
        x2, y2,
        x2 - headlen * Math.cos(angle + Math.PI / 6),
        y2 - headlen * Math.sin(angle + Math.PI / 6)
      ], { stroke: "#E51C66", strokeWidth: 3 })
    ]);
    
    this.fabricCanvas.add(arrow);
    this.currentObject = arrow;
  }
  
  updateArrow(x2, y2) {
    if (!this.currentObject) return;
    this.fabricCanvas.remove(this.currentObject);
    this.createArrow(this.startX, this.startY, x2, y2);
  }
  
  createRect(x, y, width, height) {
    const rect = new fabric.Rect({
      left: x,
      top: y,
      width: Math.abs(width),
      height: Math.abs(height),
      fill: "transparent",
      stroke: "#E51C66",
      strokeWidth: 3,
      selectable: true
    });
    
    this.fabricCanvas.add(rect);
    this.currentObject = rect;
  }
  
  updateRect(x2, y2) {
    if (!this.currentObject) return;
    
    const width = x2 - this.startX;
    const height = y2 - this.startY;
    
    this.currentObject.set({
      left: width > 0 ? this.startX : x2,
      top: height > 0 ? this.startY : y2,
      width: Math.abs(width),
      height: Math.abs(height)
    });
    
    this.fabricCanvas.renderAll();
  }
  
  createBlur(x, y, width, height) {
    const rect = new fabric.Rect({
      left: x,
      top: y,
      width: Math.abs(width),
      height: Math.abs(height),
      fill: "rgba(0, 0, 0, 0.8)",
      stroke: "#000",
      strokeWidth: 2,
      selectable: true
    });
    
    this.fabricCanvas.add(rect);
    this.currentObject = rect;
  }
  
  updateBlur(x2, y2) {
    this.updateRect(x2, y2); // Same logic as rect
  }
  
  createText(x, y) {
    const text = new fabric.IText("Klikk for å redigere", {
      left: x,
      top: y,
      fontSize: 20,
      fill: "#E51C66",
      fontWeight: "bold",
      selectable: true
    });
    
    this.fabricCanvas.add(text);
    this.fabricCanvas.setActiveObject(text);
    text.enterEditing();
  }
  
  saveHistory() {
    const json = this.fabricCanvas.toJSON();
    this.history = this.history.slice(0, this.historyStep + 1);
    this.history.push(json);
    this.historyStep++;
  }
  
  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      this.fabricCanvas.loadFromJSON(this.history[this.historyStep], () => {
        this.fabricCanvas.renderAll();
      });
    }
  }
  
  redo() {
    if (this.historyStep < this.history.length - 1) {
      this.historyStep++;
      this.fabricCanvas.loadFromJSON(this.history[this.historyStep], () => {
        this.fabricCanvas.renderAll();
      });
    }
  }
  
  deleteSelected() {
    const activeObjects = this.fabricCanvas.getActiveObjects();
    if (activeObjects.length) {
      this.fabricCanvas.discardActiveObject();
      activeObjects.forEach(obj => this.fabricCanvas.remove(obj));
      this.saveHistory();
    }
  }
  
  async save() {
    // Export annotated image as PNG
    const annotatedDataURL = this.fabricCanvas.toDataURL({
      format: "png",
      quality: 0.9
    });
    
    // Export annotation JSON
    const annotationJson = JSON.stringify(this.fabricCanvas.toJSON());
    
    // Call save callback
    if (this.onSave) {
      await this.onSave(annotatedDataURL, annotationJson);
    }
    
    this.destroy();
  }
  
  cancel() {
    if (this.onCancel) {
      this.onCancel();
    }
    this.destroy();
  }
  
  destroy() {
    if (this.fabricCanvas) {
      this.fabricCanvas.dispose();
    }
    
    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = "";
    }
  }
}

// Export
window.ImageAnnotator = ImageAnnotator;
