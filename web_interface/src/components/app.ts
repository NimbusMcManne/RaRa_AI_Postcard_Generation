import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';

import './image-upload.js';
import './style-selector.js';
import './result-display.js';
import { ResultDisplay } from './result-display.js';

interface StyleSelectionDetail {
    periodId: string | null;
    categoryId: string | null;
}

@customElement('rara-app')
export class RaraApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      font-family: sans-serif;
      background-color: #e7e7ff;
    }
    .main_container { /* New class from diff */
      display: flex;
      gap: 10px;
    }
    .container_image_upload { /* New class from diff */
      flex: 1;
      align-items: center;
      background-color: #ff5c33;
      line-height: 100px;
      border: 2px solid #15151e;
    }
    .input-section { /* Modified styles from diff */
      flex: 1.5;
      min-width: 300px;
      display: flex;
      background-color: #ff5c33;
      flex-direction: column;
      gap: 16px;
      border: 2px solid #15151e;
    }
    .style_gallery { /* New class from diff */
      display: flex;
      height: auto;
      object-fit: cover;
      border: 2px solid #15151e;
      border-radius: 8px;
    }
    .output { /* New class from diff */
      display: flex;
      gap: 10px;
      border: 2px solid #15151e;
    }
    .output-section { /* Kept original, seems used by output */
        flex: 1;
        min-width: 300px;
    }
    button { /* Modified styles from diff */
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
    button:hover { /* New styles from diff */
        background-color: #2a2a3a;
        transform: translateY(-2px);
    }
    button:active { /* New styles from diff */
        transform: translateY(0);
    }
    /* Add style for the error message */
    .error-message {
        color: #D8000C; /* Standard error red */
        background-color: #FFD2D2; /* Light red background */
        border: 1px solid #D8000C;
        padding: 10px;
        margin-top: 10px;
        border-radius: 4px;
        text-align: center;
    }
    /* Add style for the mode selector */
    .processing-mode-selector {
        margin-top: 15px;
        padding: 10px;
        background-color: #f0f0f0;
        border-radius: 4px;
        border: 1px solid #ccc;
        text-align: center;
    }
    .processing-mode-selector label {
        margin-left: 10px;
        margin-right: 10px;
        cursor: pointer;
    }
  `;

  @state()
  private imgFile: File | null = null;

  @state()
  private selectedStyleIds: StyleSelectionDetail = { periodId: null, categoryId: null };

  @state()
  private _errorMessage: string | null = null;

  @state()
  private _processingMode: 'local' | 'cloud' = 'local';

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
            <style-selector @style-selected=${this.handleStyleSelection}></style-selector>
          </div>
          <button @click=${(_e: Event) => { console.log('Button clicked!'); this.startTransformation(); }}  >Transform Image</button>
          ${this._errorMessage
            ? html`<div class="error-message">Error: ${this._errorMessage}</div>`
            : ''}
        </div>
      </div>

      <div class="processing-mode-selector">
        Processing Mode:
        <label>
          <input
            type="radio"
            name="processingMode"
            value="local"
            .checked=${this._processingMode === 'local'}
            @change=${this._handleModeChange}
          />
          Local (CPU/GPU)
        </label>
        <label>
          <input
            type="radio"
            name="processingMode"
            value="cloud"
            .checked=${this._processingMode === 'cloud'}
            @change=${this._handleModeChange}
          />
          Cloud (Hugging Face Space)
        </label>
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

  handleStyleSelection(e: CustomEvent) {
     this.selectedStyleIds = e.detail.style;
     console.log('Style IDs stored:', this.selectedStyleIds);
  }

  async startTransformation() {
    console.log('Starting transformation...');
    if (!this.imgFile || !this.selectedStyleIds.periodId || !this.selectedStyleIds.categoryId) {
      alert("Please select both a content image and a style period/category");
      return;
    }

    this._errorMessage = null;
    if (this._resultDisplay) {
      this._resultDisplay.loading = true;
      this._resultDisplay.imageUrl = null;
    }

    const formData = new FormData();
    formData.append('content_image', this.imgFile);
    formData.append('period_id', this.selectedStyleIds.periodId);
    formData.append('category_id', this.selectedStyleIds.categoryId);
    formData.append('processing_mode', this._processingMode);

    // Add other parameters if needed (e.g., from config or UI)
    // formData.append('style_weight', '1e6');
    // formData.append('content_weight', '1.0');
    // formData.append('num_steps', '300');

    const apiUrl = '/api/transform';

    try {
      console.log('Sending data to API:', apiUrl);
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('API Response:', result);

      if (this._resultDisplay) {
        const resultImageUrl = result.result_id ? `/api/result/${result.result_id}` : null;
        this._resultDisplay.imageUrl = resultImageUrl || 'https://via.placeholder.com/400x300.png?text=Error+Loading+Result'; // Update result display
      }

    } catch (error) {
      console.error('Transformation failed:', error);
      this._errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      if (this._resultDisplay) {
         this._resultDisplay.imageUrl = 'https://via.placeholder.com/400x300.png?text=Transformation+Failed'; // Show error in result area
      }
    } finally {
      if (this._resultDisplay) {
        this._resultDisplay.loading = false;
      }
    }
  }

  private _handleModeChange(e: Event) {
      const input = e.target as HTMLInputElement;
      this._processingMode = input.value as 'local' | 'cloud';
      console.log('Processing mode set to:', this._processingMode);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'rara-app': RaraApp;
  }
}
