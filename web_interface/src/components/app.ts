import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import './image-upload.js';
import './style-selector.js';
import './result-display.js';
import './local-style-gallery.js';

interface StyleSelectionDetail {
    periodId: string | null;
    categoryId: string | null;
}

interface ResultItem {
    id: string;
    displayUrl: string;
    filename: string;
    timestamp: number;
}

const MAX_RESULTS_TO_SHOW = 5;

// Define constants for default values used in filename generation
const DEFAULT_CONTENT_WEIGHT = 1.0;
const DEFAULT_STYLE_WEIGHT = 1e6;
const DEFAULT_TV_WEIGHT = 1e-6;
const DEFAULT_NUM_STEPS = 300;
const DEFAULT_LEARNING_RATE = 0.02;

@customElement('rara-app')
export class RaraApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      font-family: sans-serif;
      background-color: #e7e7ff;
    }
    .main_container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .container_image_upload {
      align-items: center;
      background-color: #ff5c33;
      line-height: 100px;
      border: 2px solid #15151e;
      padding: 10px;
    }
    .input-section {
      min-width: 300px;
      display: flex;
      background-color: #ff5c33;
      flex-direction: column;
      gap: 16px;
      border: 2px solid #15151e;
      padding: 10px;
    }
    .style_gallery {
      display: flex;
      height: auto;
      object-fit: cover;
      border: 2px solid #15151e;
      border-radius: 8px;
    }
    .output {
      position: relative;
      display: flex;
      gap: 10px;
      border: 2px solid #15151e;
      padding: 10px;
      min-height: 100px;
    }
    .output-section {
        flex: 1;
        min-width: 300px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
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
    button:hover:not(:disabled) {
        background-color: #2a2a3a;
        transform: translateY(-2px);
    }
    button:active:not(:disabled) {
        transform: translateY(0);
    }
    button:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    .error-message {
        color: #D8000C;
        background-color: #FFD2D2;
        border: 1px solid #D8000C;
        padding: 10px;
        margin-top: 10px;
        border-radius: 4px;
        text-align: center;
    }
    .processing-model-selector {
        margin-top: 15px;
        padding: 10px;
        background-color: #f0f0f0;
        border-radius: 4px;
        border: 1px solid #ccc;
        text-align: center;
    }
    .processing-model-selector label {
        margin-left: 10px;
        margin-right: 10px;
        cursor: pointer;
    }
    .local-model-options {
      margin-left: 20px;
      margin-top: 5px;
      padding: 5px;
      border-left: 2px solid #ddd;
    }
    .tuning-parameters {
        margin-top: 15px;
        padding: 15px;
        background-color: #f8f8f8;
        border-radius: 4px;
        border: 1px solid #ccc;
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 10px;
        align-items: center;
    }
    .tuning-parameters h4 {
        grid-column: 1 / -1;
        margin: 0 0 10px 0;
        text-align: center;
    }
    .tuning-parameters label {
        text-align: right;
        padding-right: 5px;
    }
    .tuning-parameters input[type=number],
    .tuning-parameters input[type=range],
    .tuning-parameters input[type=checkbox] {
        width: auto;
        justify-self: start;
    }
    .tuning-parameters input[type=number].factor-input {
       width: 80px;
    }
    .tuning-parameters input[type=range] {
        width: 100%;
    }
    .tuning-parameters span {
        text-align: left;
        min-width: 30px;
    }
    .tuning-parameters .checkbox-label {
       grid-column: 1 / 2;
       justify-self: end;
    }
    .tuning-parameters .slider-container {
        grid-column: 2 / 4;
        display: flex;
        align-items: center;
        gap: 10px;
    }
     .tuning-parameters .input-container {

        grid-column: 2 / 4;
        justify-self: start;
    }
    .guidance-text {
        font-size: 0.9em;
        color: #555;
        text-align: center;
        padding: 0 10px 10px 10px;
        line-height: normal;
    }
    .loading-indicator {
        text-align: center;
        padding: 20px;
        font-size: 1.2em;
        color: #555;
    }
    .clear-button {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        cursor: pointer;
        font-size: 0.9em;
        background-color: #6c757d;
        color: white;
        border: none;
        border-radius: 3px;
        z-index: 10;
    }
    .clear-button:hover:not(:disabled) {
        background-color: #5a6268;
    }
     .clear-button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
     }
    .placeholder {
        color: #666;
        height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px dashed #ccc;
        margin: 10px;
        width: 250px;
    }
    .style-source-selector {
        margin-top: 15px;
        padding: 10px;
        background-color: #f0f0f0;
        border-radius: 4px;
        border: 1px solid #ccc;
        text-align: center;
    }
    .style-source-selector label {
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
  private _selectedLocalStyleId: string | null = null;

  @state()
  private _useLocalTestStyles: boolean = false;

  @state()
  private _errorMessage: string | null = null;

  @state()
  private _processingLocation: 'local' | 'cloud' = 'local';

  @state()
  private _selectedLocalModel: 'vgg' | 'magenta' = 'vgg';

  @state() private _contentWeight: number = 1.0;
  @state() private _styleWeight: number = 1e6;
  @state() private _tvWeight: number = 1e-6;
  @state() private _numSteps: number = 300;
  @state() private _learningRate: number = 0.02;

  @state() private _saturationEnabled: boolean = false;
  @state() private _saturationFactor: number = 1.2;
  @state() private _claheEnabled: boolean = false;
  @state() private _claheClipLimit: number = 2.0;
  @state() private _usmEnabled: boolean = false;
  @state() private _usmAmount: number = 1.0;

  @state() private _cloudStyleWeight: number = 1.0;
  @state() private _cloudContentWeight: number = 1.0;
  @state() private _cloudStyleBlur: boolean = false;

  @state() private _results: ResultItem[] = [];
  @state() private _isLoading: boolean = false;

  // Helper getter to determine the final AI model choice string for the API
  private get _selectedAiModelChoice(): string {
      if (this._processingLocation === 'local') {
          return `local_${this._selectedLocalModel}`;
      } else {
          return 'cloud_gradio';
      }
  }

  render() {
    const showVggTuning = this._processingLocation === 'local' && this._selectedLocalModel === 'vgg';
    const showMagentaTuning = this._processingLocation === 'local' && this._selectedLocalModel === 'magenta';
    const showCloudTuning = this._processingLocation === 'cloud';
    const showPostProcessing = this._processingLocation === 'local';
    console.log(this._selectedAiModelChoice)

    return html`
      <h1>RaRa postkaardid AI-ga</h1>
      <div class="main_container">
        <div class="container_image_upload">
          <p class="guidance-text">Upload your content image (Recommended minimum size: 512x512px)</p>
          <image-upload @image-selected=${this.handleContentImage}></image-upload>
        </div>
        <div class="input-section">
          <div class="style-source-selector">
            Style Source:
            <label>
              <input
                type="radio"
                name="styleSource"
                value="archive"
                .checked=${!this._useLocalTestStyles}
                @change=${this._handleStyleSourceChange}
                ?disabled=${this._isLoading}
              />
              Archive (Periods/Categories)
            </label>
            <label>
              <input
                type="radio"
                name="styleSource"
                value="local"
                .checked=${this._useLocalTestStyles}
                @change=${this._handleStyleSourceChange}
                ?disabled=${this._isLoading}
              />
              Local Test Images
            </label>
          </div>
          <div class="style_gallery">
            ${this._useLocalTestStyles
              ? html`<local-style-gallery @local-style-selected=${this._handleLocalStyleSelection}></local-style-gallery>`
              : html`<style-selector @style-selected=${this.handleStyleSelection}></style-selector>`}
          </div>

          <div class="processing-model-selector">
            Processing Location:
            <label>
              <input
                type="radio"
                name="processingLocation"
                value="local"
                .checked=${this._processingLocation === 'local'}
                @change=${this._handleLocationChange}
                ?disabled=${this._isLoading}
              />
              Local
            </label>
            <label>
              <input
                type="radio"
                name="processingLocation"
                value="cloud"
                .checked=${this._processingLocation === 'cloud'}
                @change=${this._handleLocationChange}
                ?disabled=${this._isLoading}
              />
              Cloud
            </label>

            ${this._processingLocation === 'local' ? html`
              <div class="local-model-options">
                Local Model:
                <label>
                  <input
                    type="radio"
                    name="localModel"
                    value="vgg"
                    .checked=${this._selectedLocalModel === 'vgg'}
                    @change=${this._handleLocalModelChange}
                    ?disabled=${this._isLoading}
                  />
                  VGG-based
                </label>
                <label>
                  <input
                    type="radio"
                    name="localModel"
                    value="magenta"
                    .checked=${this._selectedLocalModel === 'magenta'}
                    @change=${this._handleLocalModelChange}
                    ?disabled=${this._isLoading}
                  />
                  TFHub Magenta
                </label>
              </div>
            ` : ''}
          </div>

          ${showVggTuning
            ? html`
              <div class="tuning-parameters">
                <h4>Fine Tuning (Local VGG Model):</h4>

                 <div class="input-container">
                    <label for="content_weight">Content Weight:</label>
                    <input class="factor-input" type="number" id="content_weight" .value=${this._contentWeight} @input=${this._handleParamChange} data-param="_contentWeight" step="0.1" min="0.1">
                 </div>
                 <div></div>

                 <div class="input-container">
                    <label for="style_weight">Style Weight:</label>
                    <input class="factor-input" type="number" id="style_weight" .value=${this._styleWeight} @input=${this._handleParamChange} data-param="_styleWeight" step="10000" min="1000">
                 </div>
                 <div></div>

                 <div class="input-container">
                    <label for="tv_weight">TV Weight:</label>
                    <input class="factor-input" type="number" id="tv_weight" .value=${this._tvWeight} @input=${this._handleParamChange} data-param="_tvWeight" step="0.000001" min="0" max="0.01" .valueAsNumber=${this._tvWeight}>
                 </div>
                 <div></div>

                <div class="slider-container">
                    <label for="num_steps">Number of Steps:</label>
                    <input type="range" id="num_steps" .value=${this._numSteps} @input=${this._handleParamChange} data-param="_numSteps" min="50" max="500" step="10">
                    <span>${this._numSteps}</span>
                 </div>
                 <div></div>

                 <div class="input-container">
                    <label for="learning_rate">Learning Rate:</label>
                    <input class="factor-input" type="number" id="learning_rate" .value=${this._learningRate} @input=${this._handleParamChange} data-param="_learningRate" step="0.001" min="0.001" max="0.1">
                 </div>
                 <div></div>
              </div>`
            : ''}
           ${showMagentaTuning
            ? html`
              <div class="tuning-parameters">
                 <h4>Fine Tuning (Local Magenta Model):</h4>
                 <p style="grid-column: 1 / -1; text-align: center;">(No specific tuning parameters for this model currently)</p>
              </div>`
            : ''}

          ${showCloudTuning
            ? html`
              <div class="tuning-parameters">
                <h4>Cloud Model Tuning (Hugging Face Space):</h4>
                <label for="cloud_style_weight">Style Weight (${this._cloudStyleWeight.toFixed(1)}):</label>
                <div class="slider-container">
                   <input type="range" id="cloud_style_weight" min="0" max="2" step="0.1" .value=${this._cloudStyleWeight} @input=${(e: Event) => this._cloudStyleWeight = parseFloat((e.target as HTMLInputElement).value)}>
                   <span>${this._cloudStyleWeight.toFixed(1)}</span>
                 </div>
                 <div></div>

                <label for="cloud_content_weight">Content Weight (${this._cloudContentWeight.toFixed(1)}):</label>
                 <div class="slider-container">
                    <input type="range" id="cloud_content_weight" min="1" max="5" step="0.1" .value=${this._cloudContentWeight} @input=${(e: Event) => this._cloudContentWeight = parseFloat((e.target as HTMLInputElement).value)}>
                    <span>${this._cloudContentWeight.toFixed(1)}</span>
                 </div>
                 <div></div>

                <label class="checkbox-label" for="cloud_style_blur">Style Blur:</label>
                <input type="checkbox" id="cloud_style_blur" .checked=${this._cloudStyleBlur} @change=${(e: Event) => this._cloudStyleBlur = (e.target as HTMLInputElement).checked}>
                 <div></div>
              </div>`
            : ''}

           ${showPostProcessing ? html`
              <div class="tuning-parameters">
                  <h4>Post-Processing (Local):</h4>

                  <label class="checkbox-label" for="saturation_enabled">Saturation Boost:</label>
                  <input type="checkbox" id="saturation_enabled" .checked=${this._saturationEnabled} @change=${this._handleCheckboxChange} data-param="_saturationEnabled">
                  <div class="input-container">
                     <input
                         class="factor-input"
                         type="number"
                         id="saturation_factor"
                         min="0.1" max="3.0" step="0.1"
                         .value=${this._saturationFactor}
                         @input=${this._handleParamChange}
                         data-param="_saturationFactor"
                         ?disabled=${!this._saturationEnabled}>
                     <span>(${this._saturationFactor.toFixed(1)})</span>
                  </div>

                  <label class="checkbox-label" for="clahe_enabled">CLAHE Contrast:</label>
                  <input type="checkbox" id="clahe_enabled" .checked=${this._claheEnabled} @change=${this._handleCheckboxChange} data-param="_claheEnabled">
                   <div class="input-container">
                     <input
                         class="factor-input"
                         type="number"
                         id="clahe_clip_limit"
                         min="1.0" max="5.0" step="0.1"
                         .value=${this._claheClipLimit}
                         @input=${this._handleParamChange}
                         data-param="_claheClipLimit"
                         ?disabled=${!this._claheEnabled}>
                      <span>(${this._claheClipLimit.toFixed(1)})</span>
                  </div>

                  <label class="checkbox-label" for="usm_enabled">Unsharp Mask:</label>
                  <input type="checkbox" id="usm_enabled" .checked=${this._usmEnabled} @change=${this._handleCheckboxChange} data-param="_usmEnabled">
                  <div class="input-container">
                     <input
                         class="factor-input"
                         type="number"
                         id="usm_amount"
                         min="0.1" max="3.0" step="0.1"
                         .value=${this._usmAmount}
                         @input=${this._handleParamChange}
                         data-param="_usmAmount"
                         ?disabled=${!this._usmEnabled}>
                       <span>(${this._usmAmount.toFixed(1)})</span>
                  </div>
              </div>
           `: ''}

          <button @click=${this.startTransformation} ?disabled=${this._isLoading}>Transform Image</button>
          ${this._errorMessage
            ? html`<div class="error-message">Error: ${this._errorMessage}</div>`
            : ''}
        </div>
      </div>

      <div class="output">
        ${this._results.length > 0 ? html`
            <button
                class="clear-button"
                @click=${this._handleClearResults}
                ?disabled=${this._isLoading}
            >
                Clear Results
            </button>
        ` : ''}
        <div class="output-section">
          ${this._isLoading
            ? html`<div class="loading-indicator">Processing...</div>`
            : this._results.length === 0
                ? html`<div class="placeholder">Results will appear here</div>`
                : this._results.map(result => html`
                    <result-display
                      .imageUrl=${result.displayUrl}
                      .resultId=${result.id}
                      .filename=${result.filename}
                    ></result-display>
                  `)
          }
        </div>
      </div>
    `;
  }

  handleContentImage(e: CustomEvent) {
    this.imgFile = e.detail.file;
  }

  handleStyleSelection(e: CustomEvent) {
     this.selectedStyleIds = e.detail.style;
     this._selectedLocalStyleId = null;
  }

  private _handleLocalStyleSelection(e: CustomEvent) {
      this._selectedLocalStyleId = e.detail.styleId;
      this.selectedStyleIds = { periodId: null, categoryId: null };
  }

  private _handleStyleSourceChange(e: Event) {
      const input = e.target as HTMLInputElement;
      this._useLocalTestStyles = input.value === 'local';
      this.selectedStyleIds = { periodId: null, categoryId: null };
      this.selectedStyleIds = { periodId: null, categoryId: null };
      this._selectedLocalStyleId = null;
  }

  private _handleLocationChange(e: Event) {
      const input = e.target as HTMLInputElement;
      this._processingLocation = input.value as 'local' | 'cloud';
  }

   private _handleLocalModelChange(e: Event) {
      const input = e.target as HTMLInputElement;
      this._selectedLocalModel = input.value as 'vgg' | 'magenta';
   }

   private _formatWeightForFilename(value: number): string {
       if (value >= 1) {
           return value.toFixed(0); // Integer format for >= 1
       } else if (value >= 0.0001) {
           // Scientific notation for small numbers, adjusting precision
           return value.toExponential(0).replace('+', ''); // e.g., 1e-6
       } else {
           return '0'; // Handle very small or zero values
       }
   }

   private _generateFilename(params: Record<string, any>): string {
        // Use the constants defined at the top level
        const cw = params.content_weight ?? DEFAULT_CONTENT_WEIGHT;
        const sw = params.style_weight ?? DEFAULT_STYLE_WEIGHT;
        const tvw = params.tv_weight ?? DEFAULT_TV_WEIGHT;
        const steps = params.num_steps ?? DEFAULT_NUM_STEPS;
        const lr = params.learning_rate ?? DEFAULT_LEARNING_RATE;

        const pp_sharp = params.post_processing_applied?.unsharp_mask?.enabled ? `sharp${(params.post_processing_applied.unsharp_mask.amount ?? 1.0).toFixed(1)}` : '';
        const pp_con = params.post_processing_applied?.clahe_contrast?.enabled ? `con${(params.post_processing_applied.clahe_contrast.clip_limit ?? 2.0).toFixed(1)}` : '';
        const pp_sat = params.post_processing_applied?.saturation_boost?.enabled ? `sat${(params.post_processing_applied.saturation_boost.factor ?? 1.2).toFixed(1)}` : '';

        // Filter out empty parts and join with underscores
        const parts = [
            `cw${this._formatWeightForFilename(cw)}`,
            `sw${this._formatWeightForFilename(sw)}`,
            `tvw${this._formatWeightForFilename(tvw)}`,
            `st${steps}`,
            `lr${this._formatWeightForFilename(lr)}`,
            pp_sharp,
            pp_con,
            pp_sat
        ].filter(part => part !== '');

        return `${parts.join('_')}.jpg`;
    }

  async startTransformation() {
    let isSelectionValid = false;
    if (this._useLocalTestStyles) {
        isSelectionValid = !!this._selectedLocalStyleId;
    } else {
        isSelectionValid = !!(this.selectedStyleIds.periodId && this.selectedStyleIds.categoryId);
    }

    if (!this.imgFile || !isSelectionValid) {
      alert(`Please select both a content image and a ${this._useLocalTestStyles ? 'local test style' : 'style period/category'}`);
      return;
    }

    this._isLoading = true;
    this._errorMessage = null;

    const formData = new FormData();
    formData.append('content_image', this.imgFile);

    if (this._useLocalTestStyles) {
        formData.append('local_style_image_id', this._selectedLocalStyleId!);
    } else {
        formData.append('period_id', this.selectedStyleIds.periodId!);
        formData.append('category_id', this.selectedStyleIds.categoryId!);
    }

    formData.append('processing_mode', this._processingLocation);
    formData.append('ai_model_choice', this._selectedAiModelChoice);

    const requestParams: Record<string, any> = {
       processing_mode: this._processingLocation,
       ai_model_choice: this._selectedAiModelChoice
    };

    if (this._processingLocation === 'local') {
        requestParams.content_weight = this._contentWeight;
        requestParams.style_weight = this._styleWeight;
        requestParams.tv_weight = this._tvWeight;
        requestParams.num_steps = this._numSteps;
        requestParams.learning_rate = this._learningRate;

        formData.append('content_weight', String(this._contentWeight));
        formData.append('style_weight', String(this._styleWeight));
        formData.append('tv_weight', String(this._tvWeight));
        formData.append('num_steps', String(this._numSteps));
        formData.append('learning_rate', String(this._learningRate));

        requestParams.saturation_enabled = this._saturationEnabled;
        requestParams.saturation_factor = this._saturationFactor;
        requestParams.clahe_enabled = this._claheEnabled;
        requestParams.clahe_clip_limit = this._claheClipLimit;
        requestParams.usm_enabled = this._usmEnabled;
        requestParams.usm_amount = this._usmAmount;

        formData.append('saturation_enabled', String(this._saturationEnabled));
        formData.append('saturation_factor', String(this._saturationFactor));
        formData.append('clahe_enabled', String(this._claheEnabled));
        formData.append('clahe_clip_limit', String(this._claheClipLimit));
        formData.append('usm_enabled', String(this._usmEnabled));
        formData.append('usm_amount', String(this._usmAmount));

    } else if (this._processingLocation === 'cloud') {
        requestParams.style_weight = this._cloudStyleWeight;
        requestParams.content_weight = this._cloudContentWeight;
        requestParams.style_blur = this._cloudStyleBlur;

        formData.append('style_weight', String(this._cloudStyleWeight));
        formData.append('content_weight', String(this._cloudContentWeight));
        formData.append('style_blur', String(this._cloudStyleBlur));
    }

    const apiUrl = '/api/transform';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let detail = errorText;
        try {
            const errorJson = JSON.parse(errorText);
            detail = errorJson.detail || errorText;
        } catch (parseError) { }
        throw new Error(`API Error: ${response.status} - ${detail}`);
      }

      const result = await response.json();

      if (result.result_id) {
           const finalParams = result.parameters_used || requestParams; // Use returned params if available, else fallback to sent params
           const filename = this._generateFilename(finalParams);

          const newResult: ResultItem = {
              id: result.result_id,
              displayUrl: `/api/result/${result.result_id}?t=${Date.now()}`, // Add timestamp to bust cache
              filename: filename,
              timestamp: Date.now()
          };
          this._results = [newResult, ...this._results].slice(0, MAX_RESULTS_TO_SHOW);
      } else {
          this._errorMessage = "Transformation succeeded but result ID was missing.";
      }

    } catch (error) {
      this._errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error("Transformation error details:", error); // Log full error
    } finally {
      this._isLoading = false;
    }
  }

  private _handleParamChange(e: Event) {
      const input = e.target as HTMLInputElement;
      const paramName = input.dataset.param as keyof RaraApp;
      if (paramName) {
           const value = parseFloat(input.value);
           if (!isNaN(value)) {
              (this[paramName] as any) = value;
           }
      }
  }

  private _handleCheckboxChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const paramName = input.dataset.param as keyof RaraApp;
        if (paramName) {
            (this[paramName] as any) = input.checked;
        }
    }

  private _handleClearResults() {
      this._results = [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'rara-app': RaraApp;
  }
}
