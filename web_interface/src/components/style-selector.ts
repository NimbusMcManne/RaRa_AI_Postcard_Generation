import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface ApiCategory {
  id: string;
  name: { en: string; et: string };
  hasImages: boolean;
  exampleImageUrl: string | null;
}
interface ApiPeriod {
  id: string;
  name: { en: string; et: string };
  yearRange: { start: number; end: number };
  categories: ApiCategory[];
}

@customElement('style-selector')
export class StyleSelector extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      width: 100%;
    }
    select {
      width: 100%;
      max-width: 50%;
      margin: 0 auto 1rem auto;
      padding: 0.5rem;
      font-size: 1rem;
      border-radius: 4px;
      border: 1px solid #ccc;
    }
    .style-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
      padding-top: 1rem;
    }
    .style-option {
      position: relative;
      aspect-ratio: 1 / 1.2;
      border: 2px solid #ccc;
      border-radius: 8px;
      cursor: pointer;
      overflow: hidden;
      background-color: #f0f0f0;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .style-option.disabled {
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
    .style-option img {
      width: 100%;
      height: 85%;
      object-fit: cover;
    }
    .style-option .placeholder {
      font-size: 0.8em;
      color: #666;
      padding: 0.5rem;
      height: 85%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .style-option .category-name {
        font-size: 0.8em;
        padding: 0.3rem;
        color: #333;
        height: 15%;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
    }
    .loading, .error {
        color: #666;
        padding: 1rem;
        text-align: center;
    }
  `;

  @state() private _periods: ApiPeriod[] = [];
  @state() private _selectedPeriod: ApiPeriod | null = null;
  @state() private _selectedCategoryId: string | null = null;
  @state() private _isLoading = true;
  @state() private _error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._fetchStyles();
  }

  async _fetchStyles() {
    this._isLoading = true;
    this._error = null;
    const apiUrl = '/api/styles';

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: { periods: ApiPeriod[] } = await response.json();
      this._periods = data.periods || [];
    } catch (e) {
      console.error('Failed to fetch styles:', e);
      this._error = 'Could not load styles. Please try again later.';
      if (e instanceof Error) {
           this._error += ` (${e.message})`;
      }
    } finally {
      this._isLoading = false;
    }
  }

  _handlePeriodChange(e: Event) {
    const selectElement = e.target as HTMLSelectElement;
    const periodId = selectElement.value;
    this._selectedPeriod = this._periods.find(p => p.id === periodId) || null;
    this._selectedCategoryId = null;
    this._dispatchSelection();
  }

  _handleCategorySelect(category: ApiCategory) {
    this._selectedCategoryId = category.id;
    this._dispatchSelection();
  }

  _dispatchSelection() {
    const detail = {
        periodId: this._selectedPeriod?.id || null,
        categoryId: this._selectedCategoryId || null
    };
    console.log('Dispatching style-selected:', detail);
    this.dispatchEvent(new CustomEvent('style-selected', {
        detail: { style: detail },
        bubbles: true,
        composed: true
    }));
  }

  render() {
    if (this._isLoading) {
      return html`<div class="loading">Loading styles...</div>`;
    }
    if (this._error) {
      return html`<div class="error">${this._error}</div>`;
    }

    return html`
      <h3>Select Style Period & Category</h3>
      <select @change=${this._handlePeriodChange}>
        <option value="">-- Select a Period --</option>
        ${this._periods.map(period => html`
          <option value="${period.id}">
            ${period.name.en} (${period.yearRange.start}-${period.yearRange.end})
          </option>
        `)}
      </select>

      ${this._selectedPeriod ? html`
        <div class="style-grid">
          ${this._selectedPeriod.categories
            .filter(category => category.hasImages)
            .map(category => html`
            <div
              class="style-option ${category.id === this._selectedCategoryId ? 'selected' : ''}"
              @click=${() => this._handleCategorySelect(category)}
              title="${category.name.en}"
            >
              ${category.exampleImageUrl
                ? html`<img src="${category.exampleImageUrl}?thumb=1" alt="${category.name.en} example">`
                : html`<div class="placeholder">No Image</div>`
              }
              <div class="category-name">${category.name.en}</div>
            </div>
          `)}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'style-selector': StyleSelector;
  }
}
