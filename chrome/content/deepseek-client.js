/* eslint-env browser */

(function initDeepSeek(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArchNoteDeepSeek = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function deepSeekFactory() {
  "use strict";

  const PROVIDERS = {
    deepseek: {
      id: "deepseek",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      prefs: { apiKey: "apiKey", baseUrl: "baseUrl", model: "model" }
    },
    poixe: {
      id: "poixe",
      label: "Poixe",
      baseUrl: "https://api.poixe.com/v1",
      model: "gpt-5.2",
      prefs: { apiKey: "poixeApiKey", baseUrl: "poixeBaseUrl", model: "poixeModel" }
    }
  };

  function getProviderConfig(provider) {
    return Object.prototype.hasOwnProperty.call(PROVIDERS, provider) ? PROVIDERS[provider] : PROVIDERS.deepseek;
  }

  function chatCompletionsURL(baseUrl, provider) {
    let url;
    try {
      url = new URL(String(baseUrl || provider.baseUrl).trim());
    } catch (_) {
      throw new Error(`${provider.label} Base URL is invalid`);
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`${provider.label} Base URL must use HTTP or HTTPS`);
    }
    const path = url.pathname.replace(/\/+$/, "");
    if (/\/chat\/completions$/.test(path)) {
      url.pathname = path;
    } else {
      const prefix = path || (provider.id === "poixe" ? "/v1" : "");
      url.pathname = `${prefix}/chat/completions`;
    }
    url.hash = "";
    return url.href;
  }

  function buildDeepSeekRequest(options) {
    const opts = options || {};
    const provider = getProviderConfig(opts.provider);
    const apiKey = String(opts.apiKey || "").trim();
    if (!apiKey) {
      throw new Error(`${provider.label} API key is required`);
    }

    const model = String(opts.model || provider.model).trim() || provider.model;
    const body = {
      model,
      messages: opts.messages || [],
      stream: false
    };

    // Relay models can reject temperature; let their upstream use its default.
    if (provider.id === "deepseek") {
      body.temperature = typeof opts.temperature === "number" ? opts.temperature : 0.2;
    }
    if (opts.maxTokens) {
      const tokenParameter = provider.id === "poixe" ? "max_completion_tokens" : "max_tokens";
      body[tokenParameter] = Number(opts.maxTokens);
    }

    return {
      url: chatCompletionsURL(opts.baseUrl, provider),
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    };
  }

  function parseDeepSeekResponse(payload) {
    const choice = payload?.choices?.[0];
    const content = choice?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("Chat Completions response did not include choices[0].message.content");
    }
    return content.trim();
  }

  async function complete(options, fetchImpl) {
    const provider = getProviderConfig(options?.provider);
    const request = buildDeepSeekRequest(options);
    const fetcher = fetchImpl || fetch;
    const response = await fetcher(request.url, request.init);
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`${provider.label} returned non-JSON response: ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      const message = payload?.error?.message || response.statusText || "unknown error";
      throw new Error(`${provider.label} request failed (${response.status}): ${message}`);
    }

    return parseDeepSeekResponse(payload);
  }

  return {
    PROVIDERS,
    buildDeepSeekRequest,
    complete,
    getProviderConfig,
    parseDeepSeekResponse
  };
});
