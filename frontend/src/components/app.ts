import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Router } from '@lit-labs/router';

@customElement('rara-app')
export class RaraApp extends LitElement {
  private router: Router;

  static styles = css`
    :host {
      color: blue;
      display: block;
      min-height: 100vh;
    }
  `;

  constructor() {
    super();
    this.router = new Router(this, [
      {
        path: '/',
        render: () => html`<home-page></home-page>`,
      },
      {
        path: '/generate',
        render: () => html`<generate-page></generate-page>`,
      },
      {
        path: '/gallery',
        render: () => html`<gallery-page></gallery-page>`,
      },
    ]);
  }

  render() {
    return html`
      <nav class="container">
        <md-navigation-bar>
          <md-navigation-tab label="Home" href="/"></md-navigation-tab>
          <md-navigation-tab label="Generate" href="/generate"></md-navigation-tab>
          <md-navigation-tab label="Gallery" href="/gallery"></md-navigation-tab>
        </md-navigation-bar>
      </nav>
      <main class="container">
        ${this.router.outlet()}
      </main>
    `;
  }
} 