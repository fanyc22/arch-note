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

