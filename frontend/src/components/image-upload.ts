import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('image-upload')
export class ImageUpload extends LitElement {
  static styles = css`
    :host {
      display: block;
      border: 1px solid #ccc;
      padding: 1rem;
      border-radius: 4px;
    }
    input[type="file"] {
      margin-bottom: 0.5rem;
    }
    img {
      max-width: 100%;
      max-height: 200px;
      margin-top: 0.5rem;
      display: block;
    }
  `;

  @state()
  private previewURL: string | null = null;

  render() {
    return html`
      <h3>Upload Content Image</h3>
      <input type="file" accept="image/*" @change=${this.handleFile} />
      ${this.previewURL ? html`<img src="\${this._previewUrl}" alt="Image preview" />` : ''}
    `;
  }

  private handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Create a preview URL
      const reader = new FileReader();
      reader.onload = () => {
        this.previewURL = reader.result as string;
      }
      reader.readAsDataURL(file);

      // Dispatch an event with the file object
      this.dispatchEvent(new CustomEvent('image-selected', {
        detail: { file },
        bubbles: true,
        composed: true
      }));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'image-upload': ImageUpload;
  }
}
