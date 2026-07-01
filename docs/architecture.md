# Architecture

```mermaid
flowchart LR
  A["Zotero item/PDF added"] --> B["Notifier observer"]
  Z["Manual batch: current library missing reports"] --> C
  B --> C["Delayed serial queue"]
  C --> D["Metadata + Zotero full-text cache"]
  D --> E["arch-note CLI prompt"]
  E --> F["DeepSeek chat completions"]
  F --> G["Markdown child note"]
  G --> H["Tags: arch-note:done / arch-note:failed"]
```

The Zotero runtime integration lives in `chrome/content/arch-note-zotero.js`.

The model-facing and note-rendering code is intentionally pure JavaScript:

- `chrome/content/prompt.js`
- `chrome/content/skill-runner.js`
- `chrome/content/deepseek-client.js`
- `chrome/content/markdown.js`

Those modules are loaded both by Zotero and by Node tests.
