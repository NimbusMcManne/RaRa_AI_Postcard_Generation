import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('style-selector')
export class StyleSelector extends LitElement {
  static styles = css`
    :host {
      display: block;
      border: 1px solid #ccc;
      padding: 1rem;
      border-radius: 4px;
    }
    /* TODO: Add styles for selection methods (file input, dropdown...) */
  `;

  // TODO: Implement logic for style selection (upload or period selection)
  // TODO: Dispatch 'style-selected' event

  render() {
    return html`
      <h3>Select Style</h3>
      <p><i>(Style selection, upload style image or choose period)</i></p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'style-selector': StyleSelector;
  }
}
