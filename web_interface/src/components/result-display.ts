import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';


@customElement('result-display')
export class ResultDisplay extends LitElement {
  static styles = css`
    :host {
      display: block;
      border: 1px solid #ccc;
      padding: 1rem;
       border-radius: 4px;
    }
    img {
      max-width: 100%;
      display: block;
    }
    .placeholder {
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        background-color: #f9f9f9; 
         border-radius: 4px;
    }
  `;

  @property({ type: String })
  imageUrl: string | null = null;

  @property({ type: Boolean })
  loading: boolean = false;

  render() {
    return html`
      <h3>Result</h3>
      ${this.loading
        ? html`<div class="placeholder">Processing...</div>`
        : this.imageUrl
          ? html`<img src="${this.imageUrl}" alt="Transformation result" />`
          : html`<div class="placeholder">Result will appear here</div>`
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'result-display': ResultDisplay;
  }
}
