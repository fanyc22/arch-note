# Changelog

## 0.1.8

- No functional changes.
- Version-only release for testing Zotero automatic updates.

## 0.1.7

- Add a Tools menu action to generate missing Arch Notes for all eligible papers in the selected collection.
- Include child collections when Zotero exposes them through the collection API.
- Add Zotero progress-window reporting for selected-item and batch generation jobs.

## 0.1.6

- Point GitHub metadata, release links, and Zotero update manifest URLs at `fanyc22/arch-note`.
- Add the Chinese README referenced from the main README.

## 0.1.5

- Register Zotero chrome resources during bootstrap startup.
- Register preference pane resources with explicit root URIs.
- Add startup error reporting for easier Zotero debugging.
- Add Tools menu smoke test.

## 0.1.4

- Add Zotero 9 permanent-install metadata, including `applications.zotero.update_url`.
- Add manifest icons.
- Add manifest regression test.

## 0.1.3

- Update Zotero 9 compatibility range to `8.0.1` through `10.*`.
- Use email-style add-on id.
- Fix Zotero 9 preference pane registration handling.

## 0.1.0

- Initial DeepSeek-backed Zotero add-on.
- Add selected-item generation, automatic generation, and current-library batch backfill.
- Add optional `arch-note` CLI integration.
