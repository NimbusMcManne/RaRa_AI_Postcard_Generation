# Postcard AI Transformer - Web Interface

This directory contains the frontend user interface for the Postcard AI Transformer project. It is built using Web Components with the Lit library and TypeScript.

## Current Status & Functionality (April 2024)

*   **Framework:** Uses Lit for creating reactive web components.
*   **Build Tool:** Uses Vite for a fast development server (`npm run dev`) and optimized production builds (`npm run build`).
*   **Language:** Written in TypeScript for type safety.
*   **Components:** Includes basic components for:
    *   Uploading a content image (`image-upload.ts`) with a preview.
    *   Selecting a style (`style-selector.ts`) - currently a placeholder.
    *   Displaying the result (`result-display.ts`).
    *   An orchestrating parent component (`my-app.ts`).
*   **Interaction:**
    *   You can select an image, and it shows a preview.
    *   Clicking "Transform Image" simulates an API call (takes 2 seconds).
    *   The result area shows a "Processing..." message and then displays a placeholder image.
*   **Styling:**
    *   Uses a shared style file (`src/styles/shared-styles.ts`) for basic consistency (e.g., card layout, button style).
    *   Components import these shared styles and can add their own specific styles.

## Getting Started (For Novice Developer)

1.  **Install Dependencies:** If you haven't already, run `npm install` in this (`web_interface`) directory.
2.  **Run Development Server:** Run `npm run dev` in your terminal.
3.  **View in Browser:** Open the local URL provided by Vite (usually `http://localhost:5173/`).
4.  **Explore the Code:**
    *   Start with `index.html` - this is the main page that loads the app.
    *   Look at `src/components/my-app.ts` - this controls the overall layout and basic button logic.
    *   Examine the other components in `src/components/` to see how they handle uploads, display results, etc.
    *   Check `src/styles/shared-styles.ts` to see the common styles being used.
5.  **Making Changes:**
    *   Modify the HTML structure within the `render()` method of a component file (e.g., `my-app.ts`).
    *   Modify styles in `shared-styles.ts` or within the `static styles` block of a specific component.
    *   Add or change JavaScript/TypeScript logic within the component class methods (like `_startTransformation` in `my-app.ts`).
    *   Vite's dev server will automatically update the browser when you save changes (Hot Module Replacement).

## Notes for Bachelor Thesis

*   **Technology Choice:** The frontend utilizes Lit, a lightweight library for building framework-agnostic Web Components. This choice aligns with the requirement for potential integration into larger, pre-existing web applications without imposing a heavy framework dependency. Vite provides a modern and efficient development/build tooling experience.
*   **Component Architecture:** The interface is broken down into distinct, reusable components (`image-upload`, `style-selector`, `result-display`, `my-app`), promoting modularity and maintainability.
*   **Reactivity:** Lit's reactive properties (`@state`, `@property`) are used to manage component state and trigger re-renders efficiently when data changes (e.g., preview URL, loading state, result image URL).
*   **Asynchronous Operations:** The dummy API call simulation using `setTimeout` demonstrates the handling of asynchronous operations. This pattern will be replaced with `fetch` for actual API interaction, likely using `async/await` syntax.
*   **Styling Strategy:** Shared styles are encapsulated within a dedicated module (`shared-styles.ts`) and imported into components, demonstrating a common approach for maintaining visual consistency across a component-based application.
*   **Development Experience:** The use of TypeScript enhances developer productivity through static type checking and improved tooling support. Vite's fast HMR significantly speeds up the development feedback loop.
