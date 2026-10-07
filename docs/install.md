# Install

1. Build the XPI:

   ```bash
   npm run build
   ```

2. Open Zotero.
3. Go to `Tools > Add-ons`.
4. Choose `Install Add-on From File...`.
5. Select `dist/arch-note-zotero-deepseek-0.1.10.xpi`.
6. Restart Zotero if prompted.
7. Open Zotero Preferences and configure:

   - API provider: DeepSeek or Poixe
   - the selected provider's API key, Base URL, and model
   - model
   - output language
   - auto-run delay

The default model is `deepseek-v4-flash`.

For Poixe, select `Poixe`, enter a Poixe API key, and use `https://api.poixe.com/v1` as the Base URL. The default example model is `gpt-5.2`; use a model ID available to your Poixe account. Switching providers preserves each provider's settings separately. See the [Poixe Chat Completions documentation](https://docs.poixe.com/cn/api-reference/text-api/openai-completions/overview).

All generation modes use the same 13-section system prompt. Set `Max output tokens` to `16384` for detailed guides if your existing setting is lower and the selected model supports this output budget.

No local skill, Python CLI, or corpus database is required. Attach a PDF to the paper and let Zotero index it.
