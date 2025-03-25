import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('home-page')
export class HomePage extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem 0;
    }
    .hero {
      text-align: center;
      padding: 4rem 0;
    }
    .hero h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: var(--primary-color);
    }
    .hero p {
      font-size: 1.2rem;
      color: var(--text-color);
      max-width: 600px;
      margin: 0 auto;
    }
    .cta-button {
      margin-top: 2rem;
    }
  `;

  render() {
    return html`
      <div class="hero">
        <h1>Welcome to RaRa AI Postcard Generator</h1>
        <p>Create beautiful, personalized postcards using artificial intelligence. Share your memories in a unique way.</p>
        <md-filled-button class="cta-button" href="/generate">Start Creating</md-filled-button>
      </div>
    `;
  }
} 