# Zotero 9 Compatibility Audit

Checked against Zotero Desktop `9.0.4` from `/Applications/Zotero.app` and the current Zotero developer documentation.

## Install Manifest

The manifest uses the same MV2 shape as installed Zotero 9 plugins:

- `manifest_version: 2`
- `applications.zotero.id`
- `applications.zotero.update_url`
- `applications.zotero.strict_min_version`
- `applications.zotero.strict_max_version`

The add-on id is email-style: `arch-note-zotero-deepseek@example.com`.

The version range is `8.0.1` to `10.*`, matching the format accepted by installed Zotero 9 plugins such as Better BibTeX.

Local Zotero 9.0.4 Marionette testing showed that a permanent XPI install without `applications.zotero.update_url` fails with `ERROR_CORRUPT_FILE`; adding `update_url` makes an otherwise minimal MV2 bootstrap add-on install successfully.

## Runtime API Checks

Compatible with Zotero 9.0.4 source:

- `Zotero.PreferencePanes.register()` is async and returns a pane id; shutdown now unregisters that pane id.
- Preference pane scripts load before XHTML fragments; `preferences.xhtml` now calls `ArchNotePrefs.init()` from the root `vbox` `onload`, and `preferences.js` exposes `window.ArchNotePrefs`.
- `Zotero.Items.getAll(libraryID, true, false)` exists and is used for top-level non-trash library scans.
- `Zotero.Fulltext.getItemCacheFile()` and `Zotero.Fulltext.indexItems(itemIDs, options)` exist.
- `item.getFilePathAsync()` exists for attachments.

## Known Conservative Choices

`Zotero.MenuManager` exists in Zotero 9, but its schema only accepts localized `l10nID` labels and rejects unknown fields. This plugin keeps manual Tools-menu insertion to preserve plain labels without bundling a localization system.

The bootstrap code uses `Services.sys.mjs` and no longer falls back to legacy `Services.jsm`.
