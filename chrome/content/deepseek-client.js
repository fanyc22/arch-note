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

  function stripTrailingSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function buildDeepSeekRequest(options) {
    const opts = options || {};
    const apiKey = String(opts.apiKey || "").trim();
    if (!apiKey) {
      throw new Error("DeepSeek API key is required");
    }

    const baseUrl = stripTrailingSlash(opts.baseUrl || "https://api.deepseek.com");
    const model = opts.model || "deepseek-v4-flash";
    const body = {
      model,
      messages: opts.messages || [],
      stream: false,
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2
    };

    if (opts.maxTokens) {
      body.max_tokens = Number(opts.maxTokens);
    }

    return {
      url: `${baseUrl}/chat/completions`,
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
      throw new Error("DeepSeek response did not include choices[0].message.content");
    }
    return content.trim();
  }

  async function complete(options, fetchImpl) {
    const request = buildDeepSeekRequest(options);
    const fetcher = fetchImpl || fetch;
    const response = await fetcher(request.url, request.init);
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`DeepSeek returned non-JSON response: ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      const message = payload?.error?.message || response.statusText || "unknown error";
      throw new Error(`DeepSeek request failed (${response.status}): ${message}`);
    }

    return parseDeepSeekResponse(payload);
  }

  return {
    buildDeepSeekRequest,
    complete,
    parseDeepSeekResponse
  };
});

