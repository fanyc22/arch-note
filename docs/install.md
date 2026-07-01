# Install

1. Build the XPI:

   ```bash
   npm run build
   ```

2. Open Zotero.
3. Go to `Tools > Add-ons`.
4. Choose `Install Add-on From File...`.
5. Select `dist/arch-note-zotero-deepseek-0.1.6.xpi`.
6. Restart Zotero if prompted.
7. Open Zotero Preferences and configure:

   - DeepSeek API key
   - `arch-note` command path
   - optional skill corpus DB path
   - model
   - output language
   - auto-run delay

The default model is `deepseek-v4-flash`.

For this local workspace, install the skill CLI first:

```bash
cd /Users/fanyuchen/Downloads/arch-paper-reading-skill
python3 -m pip install -e ".[dev]"
```

Then set `arch-note command` to the absolute path returned by:

```bash
which arch-note
```
