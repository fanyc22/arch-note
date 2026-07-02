/* eslint-env browser */

(function initArchNoteProgress(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArchNoteProgress = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function progressFactory() {
  "use strict";

  function clampPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function formatProgressText(summary) {
    const data = summary || {};
    const total = Math.max(Number(data.total) || 0, 0);
    const completed = Math.max(Number(data.completed) || 0, 0);
    const succeeded = Math.max(Number(data.succeeded) || 0, 0);
    const failed = Math.max(Number(data.failed) || 0, 0);
    const skipped = Math.max(Number(data.skipped) || 0, 0);
    const phase = data.phase || (completed >= total ? "complete" : "processing");
    const currentTitle = data.currentTitle ? ` - ${data.currentTitle}` : "";
    return `${completed}/${total} ${phase} (ok ${succeeded}, failed ${failed}, skipped ${skipped})${currentTitle}`;
  }

  function createProgressReporter(env, options) {
    const opts = options || {};
    const total = Math.max(Number(opts.total) || 0, 0);
    const headline = opts.headline || "Arch Note";
    const icon = opts.icon || "chrome://zotero/skin/tick.png";
    const logger = env?.log || function noop() {};
    const ProgressWindow = env?.win?.Zotero?.ProgressWindow || env?.Zotero?.ProgressWindow;
    let progressWindow = null;
    let itemProgress = null;
    let visible = false;

    try {
      if (typeof ProgressWindow === "function") {
        try {
          progressWindow = new ProgressWindow({ closeOnClick: false });
        } catch (_) {
          progressWindow = new ProgressWindow();
        }
        if (progressWindow.changeHeadline) {
          progressWindow.changeHeadline(headline);
        }
        if (typeof progressWindow.ItemProgress === "function") {
          itemProgress = new progressWindow.ItemProgress(icon, formatProgressText({
            total,
            completed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            phase: "queued"
          }));
          if (itemProgress.setProgress) {
            itemProgress.setProgress(0);
          }
        } else if (progressWindow.addDescription) {
          progressWindow.addDescription(formatProgressText({
            total,
            completed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            phase: "queued"
          }));
        }
        if (progressWindow.show) {
          progressWindow.show();
        }
        visible = true;
      }
    } catch (error) {
      logger(`progress window unavailable: ${error.message}`);
      progressWindow = null;
      itemProgress = null;
      visible = false;
    }

    function render(summary) {
      const text = formatProgressText({ total, ...(summary || {}) });
      const completed = Math.max(Number(summary?.completed) || 0, 0);
      const percent = total ? clampPercent((completed / total) * 100) : 100;
      if (itemProgress?.setText) {
        itemProgress.setText(text);
      }
      if (itemProgress?.setProgress) {
        itemProgress.setProgress(percent);
      }
      logger(`${headline}: ${text}`);
    }

    return {
      isVisible() {
        return visible;
      },

      update(summary) {
        render(summary);
      },

      finish(summary) {
        render({ ...(summary || {}), completed: total, phase: "complete" });
        if (progressWindow?.startCloseTimer) {
          const failed = Number(summary?.failed) || 0;
          progressWindow.startCloseTimer(failed ? 8000 : 4000);
        }
      }
    };
  }

  return {
    clampPercent,
    createProgressReporter,
    formatProgressText
  };
});
