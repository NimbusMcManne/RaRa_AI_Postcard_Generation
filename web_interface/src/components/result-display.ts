import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('result-display')
export class ResultDisplay extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin-top: 16px;
      text-align: center;
    }
    .result-container {
        border: 1px solid #ccc;
        padding: 10px;
        margin-bottom: 10px;
        display: inline-block;
        background-color: #f9f9f9;
        border-radius: 4px;
        vertical-align: top;
        max-width: 90%;
    }
    img {
      max-width: 100%;
      object-fit: contain;
      border: 1px solid #ddd;
      margin-bottom: 10px;
      display: block;
      margin-left: auto;
      margin-right: auto;
    }
    .placeholder {
      color: #666;
      height: 200px;
      width: 250px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed #ccc;
      margin: 0 auto 10px auto;
    }
    button {
      padding: 5px 10px;
      font-size: 0.9em;
      cursor: pointer;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 3px;
    }
    button:hover {
      background-color: #0056b3;
    }
  `;

  @property({ type: String }) imageUrl: string | null = null;
  @property({ type: String }) resultId: string | null = null;
  @property({ type: String }) filename: string = 'transformed_result.jpg';

  render() {
    return html`
      <div class="result-container">
        ${this.imageUrl
          ? html`<img src="${this.imageUrl}" alt="Transformation Result">`
          : html`<div class="placeholder">Result will appear here</div>`}

        <button @click=${this._handleDownload} ?disabled=${!this.resultId}>
          Download
        </button>
      </div>
    `;
  }

  private _handleDownload() {
    if (!this.resultId) {
      console.error("Cannot download: resultId is missing.");
      return;
    }
    const downloadUrl = `/api/result/${this.resultId}`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = this.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'result-display': ResultDisplay;
  }
}
