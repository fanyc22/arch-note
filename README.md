# Arch Note Zotero DeepSeek

[![CI](https://github.com/fanyc22/arch-note/actions/workflows/ci.yml/badge.svg)](https://github.com/fanyc22/arch-note/actions/workflows/ci.yml)
[![Zotero](https://img.shields.io/badge/Zotero-8.0.1%20to%2010.*-CC2936)](https://www.zotero.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

English | [中文](README-cn.md)

Arch Note Zotero DeepSeek is a Zotero desktop add-on that generates detailed paper reading guides and attaches them to Zotero items as child notes. It can use the local `arch-paper-reading-skill` CLI to extract papers and retrieve context, then call DeepSeek or Poixe Chat Completions to write a Markdown guide.

The add-on is designed for architecture reading groups, PhD paper-reading workflows, and personal literature libraries where each paper should get a structured, critique-oriented note shortly after it is imported.

## Features

- Automatically watches newly added Zotero paper items and PDF attachments.
- Waits for Zotero PDF full-text indexing before generating a note.
- Uses the local `arch-note` CLI when available.
- Uses one 13-section system prompt for selected papers, automatic generation, and batch backfills.
- Falls back to Zotero-indexed paper text if the skill CLI fails.
- Supports DeepSeek and Poixe with separate API keys, Base URLs, and model settings.
- Writes the generated Markdown as a Zotero child note.
- Marks processed items with `arch-note:done`, `arch-note:failed`, and `arch-note:report` tags.
- Adds Tools menu actions for selected papers, selected-collection backfilling, and current-library backfilling.
- Processes batch jobs serially to avoid accidental API bursts.
- Shows a Zotero progress window for manual and batch generation jobs.

## Screenshots

Screenshots are not bundled yet. The main UI surfaces are:

- `Tools > Arch Note Zotero Settings`
- `Tools > Generate Arch Note`
- `Tools > Generate Missing Arch Notes in Current Library`
- `Tools > Generate Missing Arch Notes in Selected Collection`
- `Preferences > Arch Note Zotero`

## Compatibility

- Zotero Desktop: `8.0.1` to `10.*`
- Tested locally with Zotero `9.0.4`
- Platform: macOS tested; the add-on uses Zotero APIs and should be portable to Linux and Windows after path configuration
- Runtime: Zotero MV2 bootstrap add-on

## Installation

Download the latest `.xpi` from the GitHub Releases page, then install it in Zotero:

1. Open Zotero.
2. Go to `Tools > Add-ons`.
3. Click the gear icon.
4. Choose `Install Add-on From File...`.
5. Select `arch-note-zotero-deepseek-<version>.xpi`.
6. Restart Zotero if prompted.

For a local development build:

```bash
npm test
npm run build
```

Then install:

```text
dist/arch-note-zotero-deepseek-0.1.9.xpi
```

## Configuration

Open:

```text
Tools > Arch Note Zotero Settings
```

Recommended settings:

| Field | Recommended value |
| --- | --- |
| Enable plugin | enabled |
| Generate automatically when new papers are added | optional |
| Use arch-paper-reading-skill via arch-note CLI | enabled |
| Fall back to the built-in prompt if arch-note fails | enabled |
| Keep temporary skill prompt files for debugging | disabled |
| Ask Zotero to index PDF text before generation | enabled |
| arch-note command | absolute path to `arch-note` |
| Skill corpus DB | path to `data/indexes/arch_corpus.sqlite` |
| Skill top-k | `4` |
| Skill timeout seconds | `300` |
| API provider | `DeepSeek` or `Poixe` |
| API key | key for the selected provider |
| Base URL | `https://api.deepseek.com` |
| Model | for example `deepseek-v4-pro` |
| Language | `Chinese` or `English` |
| Max paper chars | `60000` |
| Max output tokens | `16384`, subject to the model's output limit |
| Auto-run delay seconds | `20` |

The API key is stored in Zotero preferences on the local machine. Use a restricted key and rotate it if it is exposed.

### Using Poixe

Select `Poixe` under `API provider`, enter your Poixe API key, use `https://api.poixe.com/v1` as the Base URL, and enter a model ID available in your Poixe console, such as `gpt-5.2`. DeepSeek and Poixe keep separate keys, URLs, and models. Switching providers preserves edits in the open settings pane; click Save to persist them. Requests follow the [official Poixe Chat Completions protocol](https://docs.poixe.com/cn/api-reference/text-api/openai-completions/overview).

You can also enter `https://api.poixe.com` or the full `https://api.poixe.com/v1/chat/completions` URL; the add-on normalizes the path without duplicating it. The primary Poixe endpoint has a 120-second timeout. For long guides, you can configure `https://api-eu-central-1-dc8.poixe.com/v1` or `https://api-eu-central-1-dc15.poixe.com/v1`. See the [Poixe Base URL documentation](https://docs.poixe.com/cn/api-reference/introduction/base-url).

Upgrades preserve existing DeepSeek settings and token limits. If your limit is still `4096`, consider increasing it to `16384` when the selected model supports that budget.

## Using arch-paper-reading-skill

Install the skill CLI first:

```bash
cd /path/to/arch-paper-reading-skill
python3 -m pip install -e ".[dev]"
arch-note --help
```

Set `arch-note command` to the absolute path from:

```bash
which arch-note
```

When the skill integration is enabled, this add-on extracts paper text and metadata, then runs commands equivalent to:

```bash
arch-note paper text paper.pdf --out paper.raw.txt
arch-note prompt \
  --paper paper.skill.txt \
  --db /path/to/data/indexes/arch_corpus.sqlite \
  --format detailed \
  --style group_meeting \
  --top-k 4 \
  --out prompt.md
```

API requests use the add-on's unified system prompt. The `# USER` section generated by `arch-note prompt` provides paper excerpts, factual anchors, and retrieved context. The skill's `# SYSTEM` section and legacy output schema no longer choose the note format. The add-on uses `detailed` and `group_meeting` to collect skill context.

## Usage

### Generate a note for selected papers

1. Select one or more Zotero paper items.
2. Click `Tools > Generate Arch Note`.
3. The add-on creates or updates an `Arch Note` child note.

### Generate notes for missing papers in the current library

1. Open the target Zotero library.
2. Click `Tools > Generate Missing Arch Notes in Current Library`.
3. Confirm the batch prompt.
4. The add-on scans top-level paper items and queues papers without an existing Arch Note report.

Items are processed in deterministic order by `dateAdded`, title, and item id.

### Generate notes for missing papers in the selected collection

1. Select a Zotero collection in the left sidebar.
2. Click `Tools > Generate Missing Arch Notes in Selected Collection`.
3. Confirm the batch prompt.
4. The add-on scans eligible paper items in that collection, including child collections when Zotero exposes them, and queues papers without an existing Arch Note report.

Manual and batch jobs show a Zotero progress window with completed, successful, failed, and skipped counts.

### Automatic mode

Enable `Generate a guide automatically when new papers are added`. When a new paper or attachment arrives, the add-on waits for the configured delay, asks Zotero to index PDF text, then generates a child note.

## Note Format

The generated note is Markdown converted to Zotero note HTML. It contains a hidden marker so the add-on can detect and update existing reports instead of creating duplicates.

Every generation mode uses the same system prompt and these ordered sections:

1. Research problem, importance, and value.
2. Prior work and its shortcomings.
3. A possible path to the idea from existing background.
4. The core intuition.
5. Input, processing, and output explained through a concrete example.
6. Mathematical derivation and accessible theoretical background, when applicable.
7. Experimental validation: question -> experiment -> answer.
8. Takeaways.
9. The most fragile assumption.
10. A minimal reproduction plan for one week.
11. Counterexamples to the core claims.
12. Follow-up work, extensions, rebuttals, and new understanding.
13. A research idea motivated by limitations and unmet needs.

The prompt draws on Andrej Karpathy's concrete technical situations and Kaiming He's technical clarity. It distinguishes paper claims, prior literature, evidence-based inferences, and uncertain speculation. Output format and style selectors have been removed.

The add-on currently provides no web-search tools. Section 12 must disclose that no live search was performed and use only verifiable supplied sources, with questions for later investigation. Section 13 must disclose unverified novelty. Selecting Poixe does not enable web search.

## Troubleshooting

### The Tools menu entries do not appear

Make sure the installed add-on is version `0.1.8` or later. Older local builds could install successfully but fail to register Zotero UI surfaces.

### Zotero says the XPI is incompatible

Install the newest release. Zotero 9 requires permanent-install metadata in `manifest.json`, including `applications.zotero.update_url`.

### Notes are generated from metadata only

This means Zotero did not have usable PDF text. Try opening the PDF in Zotero, wait for indexing, or enable `Ask Zotero to index PDF text before generation`.

### API errors

Check:

- API provider and its API key
- Base URL
- Model name
- Account quota
- Network connectivity

### arch-note fails

Check the absolute `arch-note command` path and the corpus DB path. You can temporarily enable `Keep temporary skill prompt files for debugging`.

## Development

```bash
npm test
npm run build
```

Important files:

| Path | Purpose |
| --- | --- |
| `bootstrap.js` | Zotero bootstrap entry point |
| `preferences.xhtml` | Zotero preference pane UI |
| `preferences.js` | Preference pane controller |
| `chrome/content/arch-note-zotero.js` | Zotero item, menu, note, and batch workflow |
| `chrome/content/skill-runner.js` | `arch-note` CLI integration |
| `chrome/content/deepseek-client.js` | DeepSeek / Poixe Chat Completions client |
| `chrome/content/prompt.js` | Unified system prompt and paper input context |
| `chrome/content/markdown.js` | Markdown to Zotero note HTML |
| `chrome/content/progress.js` | Zotero progress-window adapter |
| `scripts/build-xpi.mjs` | XPI packaging script |
| `test/` | Node test suite |

## Release

1. Update `manifest.json` and `package.json` versions.
2. Run `npm test`.
3. Run `npm run build`.
4. Upload `dist/arch-note-zotero-deepseek-<version>.xpi` to a GitHub Release.
5. Update the add-on update manifest URL if you publish automatic updates.

## Privacy

The add-on reads Zotero item metadata, attachment paths, and Zotero-indexed full text. It sends prompts to the selected provider's endpoint. DeepSeek uses the configured DeepSeek endpoint; Poixe uses the configured Poixe endpoint and routes requests to the selected model's upstream provider. The add-on does not use a ChatGPT Pro subscription.

## License

MIT. See [LICENSE](LICENSE).
