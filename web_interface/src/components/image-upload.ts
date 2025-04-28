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
      margin-bottom: 8px;
      padding: 13px 24px;
      font-size: 18px;
      cursor: pointer;
      background-color: #15151e;
      color: white;
      border: none;
      border-radius: 4px;
      transition: background-color 0.2s, transform 0.2s;
    }
    input[type="file"]:hover {
      background-color: #2a2a3a;
      transform: translateY(-2px);
    }
    input[type="file"]:active {
      transform: translateY(0);
    }
    img {
      max-width: 100%;
      max-height: 300px;
      margin-top: 16px;
      display: block;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      object-fit: contain;
    }
    .preview-container {
      margin-top: 16px;
      text-align: center;
    }
  `;

  @state()
  private previewURL: string | null = null;

  render() {
    return html`
      <h2>Upload Content Image</h2>
      <input type="file" accept="image/*" @change=${this.handleFile} />
      ${this.previewURL ? html`
        <div class="preview-container">
          <img src="${this.previewURL}" alt="Image preview" />
        </div>
      ` : ''}
    `;
  }

  private handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      const reader = new FileReader();
      reader.onload = () => {
        this.previewURL = reader.result as string;
      }
      reader.readAsDataURL(file);

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
