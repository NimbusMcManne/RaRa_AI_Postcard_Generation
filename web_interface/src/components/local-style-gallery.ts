import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';


interface LocalStyleItem {
    id: string;
    displayName: string;
    imageDataUrl: string;
}

@customElement('local-style-gallery')
export class LocalStyleGallery extends LitElement {
  static styles = css`
    :host {
        display: block;
        padding: 16px;
        width: 100%;
    }
    .style-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
    .style-option {
        position: relative;
        border: 2px solid #ccc;
        border-radius: 8px;
        cursor: pointer;
        overflow: hidden;
        background-color: #f0f0f0;
        transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        aspect-ratio: 1 / 1;
        display: flex; 
        align-items: center;
        justify-content: center;
    }
    .style-option img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .style-option:hover {
      transform: scale(1.03);
      border-color: #aaa;
    }
    .style-option.selected {
      border-color: #007bff;
      box-shadow: 0 0 8px rgba(0, 123, 255, 0.5);
      transform: scale(1.03);
    }
    .loading, .error {
        color: #666;
        padding: 1rem;
        text-align: center;
    }
  `;

  @state() private _localStyles: LocalStyleItem[] = [];
  @state() private _selectedLocalStyleId: string | null = null;
  @state() private _isLoading = true;
  @state() private _error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._fetchLocalStyles();
  }

  async _fetchLocalStyles() {
    this._isLoading = true;
    this._error = null;
    const apiUrl = '/api/local-test-styles';

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: { styles: LocalStyleItem[] } = await response.json();
      this._localStyles = data.styles || [];
    } catch (e) {
      console.error('Failed to fetch local test styles:', e);
      this._error = 'Could not load local test styles.';
      if (e instanceof Error) {
           this._error += ` (${e.message})`;
      }
    } finally {
      this._isLoading = false;
    }
  }

  _handleLocalStyleSelect(styleItem: LocalStyleItem) {
    this._selectedLocalStyleId = styleItem.id;
    this._dispatchSelection();
  }

  _dispatchSelection() {
    const detail = { styleId: this._selectedLocalStyleId };
    this.dispatchEvent(new CustomEvent('local-style-selected', {
        detail: detail,
        bubbles: true,
        composed: true
    }));
  }

  render() {
    if (this._isLoading) {
      return html`<div class="loading">Loading local test styles...</div>`;
    }
    if (this._error) {
      return html`<div class="error">${this._error}</div>`;
    }
    if (this._localStyles.length === 0) {
        return html`<div class="placeholder">No local test styles found.</div>`;
    }

    return html`
      <h3>Select Local Test Style</h3>
      <div class="style-grid">
        ${this._localStyles.map(styleItem => html`
          <div
            class="style-option ${styleItem.id === this._selectedLocalStyleId ? 'selected' : ''}"
            @click=${() => this._handleLocalStyleSelect(styleItem)}
            title=${styleItem.displayName}
          >
            <img src="${styleItem.imageDataUrl}" alt="${styleItem.displayName}" loading="lazy">
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'local-style-gallery': LocalStyleGallery;
  }
}
