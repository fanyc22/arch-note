const assert = require("node:assert/strict");
const { test } = require("node:test");

const progress = require("../chrome/content/progress.js");

test("formatProgressText includes counts and current title", () => {
  assert.equal(
    progress.formatProgressText({
      total: 4,
      completed: 2,
      succeeded: 1,
      failed: 1,
      skipped: 0,
      phase: "processing",
      currentTitle: "Paper A"
    }),
    "2/4 processing (ok 1, failed 1, skipped 0) - Paper A"
  );
});

test("createProgressReporter drives Zotero ProgressWindow item progress", () => {
  const calls = [];
  class FakeProgressWindow {
    constructor(options) {
      calls.push(["constructor", options.closeOnClick]);
    }

    changeHeadline(text) {
      calls.push(["headline", text]);
    }

    show() {
      calls.push(["show"]);
    }

    startCloseTimer(ms) {
      calls.push(["close", ms]);
    }
  }
  FakeProgressWindow.prototype.ItemProgress = class {
    constructor(icon, text) {
      calls.push(["item", icon, text]);
    }

    setText(text) {
      calls.push(["text", text]);
    }

    setProgress(percent) {
      calls.push(["progress", percent]);
    }
  };

  const reporter = progress.createProgressReporter({
    Zotero: { ProgressWindow: FakeProgressWindow },
    log(message) {
      calls.push(["log", message]);
    }
  }, {
    headline: "Arch Note: test",
    total: 2
  });

  assert.equal(reporter.isVisible(), true);
  reporter.update({ total: 2, completed: 1, succeeded: 1, failed: 0, skipped: 0 });
  reporter.finish({ total: 2, completed: 2, succeeded: 1, failed: 1, skipped: 0 });

  assert.ok(calls.some((call) => call[0] === "headline" && call[1] === "Arch Note: test"));
  assert.ok(calls.some((call) => call[0] === "progress" && call[1] === 50));
  assert.ok(calls.some((call) => call[0] === "progress" && call[1] === 100));
  assert.ok(calls.some((call) => call[0] === "close" && call[1] === 8000));
});
