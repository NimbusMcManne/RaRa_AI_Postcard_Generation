import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';

import './image-upload.js';
import './style-selector.js';
import './result-display.js';
import { ResultDisplay } from './result-display.js';

@customElement('rara-app') 
export class RaraApp extends LitElement { 
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      font-family: sans-serif;
      background-color: #e7e7ff;
      opacity: 0.6;
    }
    .main_container { 
      display: flex;
      gap: 10px;
    }
    .container_image_upload {
      flex: 1;
      align-items: center;
      background-color: #ff3300;
      line-height: 100px;
      border: 2px solid #15151e;
    }
    .input-section {
      flex: 1.5;
      min-width: 300px;
      display: flex;
      background-color: #ff3300;
      flex-direction: column;
      gap: 16px;
      border: 2px solid #15151e;
    }
    .style_gallery { 
      display: flex;
      height: auto;
      object-fit: cover;
      border: 2px solid #15151e;
      border-radius: 8px;
    }
    .output { 
      display: flex;
      gap: 10px;
      border: 2px solid #15151e;
    }
    .output-section { 
        flex: 1;
        min-width: 300px;
    }
    button {
        padding: 13px 24px;
        cursor: pointer;
        font-size: 18px;
        font-weight: 500;
        background-color: #15151e;
        color: white;
        border: none;
        border-radius: 4px;
        transition: background-color 0.2s, transform 0.2s;
    }
    button:hover { 
        background-color: #2a2a3a;
        transform: translateY(-2px);
    }
    button:active {
        transform: translateY(0);
    }
  `;

  @state()
  private imgFile: File | null = null;
  @state()
  private styleFile: File | string | null = null;

  @query('result-display')
  private _resultDisplay!: ResultDisplay;

  render() {
    return html`
      <h1>RaRa postkaardid AI-ga</h1>
      <div class="main_container">
        <div class="container_image_upload">
          <image-upload @image-selected=${this.handleContentImage}></image-upload>
        </div>
        <div class="input-section">
          <div class="style_gallery">
            <style-selector @style-selected=${this.handleStyleImage}></style-selector>
          </div>
          <button @click=${(_e: Event) => { console.log('Button clicked!'); this.startTransformation(); }}  >Transform Image</button>
        </div>
      </div>
      <div class="output">
        <div class="output-section">
          <result-display></result-display>
        </div>
      </div>
    `;
  }

  handleContentImage(e: CustomEvent) {
    this.imgFile = e.detail.file;
    console.log('Content Image stored:', this.imgFile?.name);
  }

  handleStyleImage(e: CustomEvent) {
     this.styleFile = e.detail.style;
     console.log('Style stored:', this.styleFile);
  }

  startTransformation() {
    console.log('Starting dummy transformation...');
    if (!this.imgFile || !this.styleFile) {
      alert("Please select both reference image and content image");
      return;
    }

    if (this._resultDisplay) {
      this._resultDisplay.loading = true;
      this._resultDisplay.imageUrl = null;
    }

    setTimeout(() => {
      console.log('Dummy transformation complete.');
      if (this._resultDisplay) {
        this._resultDisplay.loading = false;
        this._resultDisplay.imageUrl = 'https://via.placeholder.com/400x300.png?text=Dummy+Result';
      }
    }, 2000);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'rara-app': RaraApp; 
  }
}
