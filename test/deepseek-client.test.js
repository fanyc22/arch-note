const assert = require("node:assert/strict");
const test = require("node:test");

const deepSeek = require("../chrome/content/deepseek-client.js");

test("buildDeepSeekRequest targets chat completions endpoint", () => {
  const request = deepSeek.buildDeepSeekRequest({
    apiKey: "sk-test",
    baseUrl: "https://api.deepseek.com/",
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 1024
  });
  const body = JSON.parse(request.init.body);

  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(request.init.headers.Authorization, "Bearer sk-test");
  assert.equal(body.model, "deepseek-v4-flash");
  assert.equal(body.max_tokens, 1024);
  assert.equal(body.stream, false);
});

test("parseDeepSeekResponse returns trimmed content", () => {
  const content = deepSeek.parseDeepSeekResponse({
    choices: [{ message: { content: "  # Report\n" } }]
  });
  assert.equal(content, "# Report");
});

test("complete throws useful API errors", async () => {
  await assert.rejects(
    () => deepSeek.complete(
      {
        apiKey: "sk-test",
        messages: [{ role: "user", content: "hello" }]
      },
      async () => ({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => JSON.stringify({ error: { message: "bad key" } })
      })
    ),
    /401.*bad key/
  );
});

test("Poixe accepts root, versioned, and complete URLs without duplicating paths", () => {
  const urls = [
    ["https://api.poixe.com", "https://api.poixe.com/v1/chat/completions"],
    ["https://api.poixe.com/v1/", "https://api.poixe.com/v1/chat/completions"],
    ["https://api.poixe.com/v1/chat/completions/", "https://api.poixe.com/v1/chat/completions"],
    ["https://api-eu-central-1-dc8.poixe.com/", "https://api-eu-central-1-dc8.poixe.com/v1/chat/completions"],
    ["https://api-eu-central-1-dc15.poixe.com/v1", "https://api-eu-central-1-dc15.poixe.com/v1/chat/completions"],
    ["https://gateway.example/proxy/v1?route=paper", "https://gateway.example/proxy/v1/chat/completions?route=paper"]
  ];
  for (const [baseUrl, expected] of urls) {
    const request = deepSeek.buildDeepSeekRequest({ provider: "poixe", baseUrl, apiKey: "sk-relay-test" });
    assert.equal(request.url, expected, baseUrl);
  }
});

test("Poixe requests follow the documented token limit and authentication protocol", () => {
  const messages = [{ role: "system", content: "paper guide" }, { role: "user", content: "paper evidence" }];
  const request = deepSeek.buildDeepSeekRequest({
    provider: "poixe",
    apiKey: " sk-relay-test ",
    model: "custom/model-name",
    messages,
    maxTokens: 16384,
    temperature: 0.2
  });
  const body = JSON.parse(request.init.body);
  assert.equal(request.url, "https://api.poixe.com/v1/chat/completions");
  assert.equal(request.init.headers.Authorization, "Bearer sk-relay-test");
  assert.equal(request.init.headers["Content-Type"], "application/json");
  assert.equal(body.model, "custom/model-name");
  assert.deepEqual(body.messages, messages);
  assert.equal(body.max_completion_tokens, 16384);
  assert.equal(body.stream, false);
  assert.equal("max_tokens" in body, false);
  assert.equal("temperature" in body, false);
});

test("DeepSeek continues to accept versioned and full endpoint URLs", () => {
  for (const baseUrl of ["https://api.deepseek.com/v1", "https://api.deepseek.com/v1/chat/completions"]) {
    const request = deepSeek.buildDeepSeekRequest({ apiKey: "sk-test", baseUrl });
    assert.equal(request.url, "https://api.deepseek.com/v1/chat/completions");
    assert.equal(JSON.parse(request.init.body).temperature, 0.2);
  }
});

test("Poixe surfaces relay errors without switching to another provider", async () => {
  const calls = [];
  await assert.rejects(
    deepSeek.complete({ provider: "poixe", apiKey: "sk-relay-test" }, async (url) => {
      calls.push(url);
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: "relay quota exceeded" } })
      };
    }),
    /Poixe request failed \(429\): relay quota exceeded/
  );
  assert.deepEqual(calls, ["https://api.poixe.com/v1/chat/completions"]);
});

test("Poixe validates keys and URL schemes before sending requests", () => {
  assert.throws(() => deepSeek.buildDeepSeekRequest({ provider: "poixe" }), /Poixe API key is required/);
  assert.throws(() => deepSeek.buildDeepSeekRequest({ provider: "poixe", apiKey: "sk-test", baseUrl: "not a URL" }), /Base URL is invalid/);
  assert.throws(() => deepSeek.buildDeepSeekRequest({ provider: "poixe", apiKey: "sk-test", baseUrl: "file:///tmp/test" }), /HTTP or HTTPS/);
});
