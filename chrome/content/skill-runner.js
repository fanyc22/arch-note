/* eslint-env browser */

(function initSkillRunner(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArchNoteSkillRunner = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function skillRunnerFactory() {
  "use strict";

  function normalizeCommand(command) {
    return String(command || "arch-note").trim() || "arch-note";
  }

  function hasPathSeparator(command) {
    return /[\\/]/.test(command);
  }

  function pathJoin(runtime, ...parts) {
    if (runtime?.PathUtils?.join) {
      return runtime.PathUtils.join(...parts);
    }
    if (runtime?.OS?.Path?.join) {
      return runtime.OS.Path.join(...parts);
    }
    return parts.join("/").replace(/\/+/g, "/");
  }

  function metadataPrefix(metadata) {
    const meta = metadata || {};
    const lines = ["# Zotero Metadata"];
    if (meta.title) {
      lines.push(`Title: ${meta.title}`);
    }
    if (Array.isArray(meta.creators) && meta.creators.length) {
      lines.push(`Authors: ${meta.creators.join(", ")}`);
    }
    if (meta.year || meta.date) {
      lines.push(`Year: ${meta.year || meta.date}`);
    }
    if (meta.venue) {
      lines.push(`Venue: ${meta.venue}`);
    }
    if (meta.doi) {
      lines.push(`DOI: ${meta.doi}`);
    }
    if (meta.url) {
      lines.push(`URL: ${meta.url}`);
    }
    if (meta.abstractNote) {
      lines.push(`Abstract: ${meta.abstractNote}`);
    }
    return `${lines.join("\n")}\n\n# Paper Text\n\n`;
  }

  function buildPromptArgs(options) {
    const opts = options || {};
    const args = [
      "prompt",
      "--paper",
      opts.paperTextPath,
      "--format",
      opts.format || "detailed",
      "--style",
      opts.style || "group_meeting",
      "--top-k",
      String(opts.topK || 4),
      "--max-chars",
      String(opts.maxChars || 60000),
      "--out",
      opts.promptPath
    ];
    if (opts.dbPath) {
      args.splice(3, 0, "--db", opts.dbPath);
    }
    if (opts.query) {
      args.push("--query", opts.query);
    }
    return args;
  }

  function buildPaperTextArgs(options) {
    return ["paper", "text", options.paperPath, "--out", options.outPath];
  }

  function promptToMessages(skillPrompt, fallbackSystem) {
    const prompt = String(skillPrompt || "").trim();
    const systemMarker = "# SYSTEM";
    const userMarker = "# USER";
    const systemIndex = prompt.indexOf(systemMarker);
    const userIndex = prompt.indexOf(userMarker);

    if (systemIndex >= 0 && userIndex > systemIndex) {
      const system = prompt.slice(systemIndex + systemMarker.length, userIndex).trim();
      const user = prompt.slice(userIndex + userMarker.length).trim();
      return [
        { role: "system", content: system || fallbackSystem || "You are a paper reading assistant." },
        { role: "user", content: user || prompt }
      ];
    }

    return [
      { role: "system", content: fallbackSystem || "You are a paper reading assistant." },
      { role: "user", content: prompt }
    ];
  }

  async function makeDirectory(path, runtime) {
    if (runtime?.IOUtils?.makeDirectory) {
      await runtime.IOUtils.makeDirectory(path, { ignoreExisting: true });
      return;
    }
    if (runtime?.OS?.File?.makeDir) {
      await runtime.OS.File.makeDir(path, { ignoreExisting: true, from: runtime.OS.Constants.Path.tmpDir });
      return;
    }
    throw new Error("No supported file API is available to create a skill workspace");
  }

  async function writeTextFile(path, text, runtime) {
    if (runtime?.IOUtils?.writeUTF8) {
      await runtime.IOUtils.writeUTF8(path, text);
      return;
    }
    if (runtime?.Zotero?.File?.putContentsAsync) {
      await runtime.Zotero.File.putContentsAsync(path, text);
      return;
    }
    throw new Error("No supported file API is available to write skill input");
  }

  async function readTextFile(path, runtime) {
    if (runtime?.IOUtils?.readUTF8) {
      return runtime.IOUtils.readUTF8(path);
    }
    if (runtime?.Zotero?.File?.getContentsAsync) {
      return runtime.Zotero.File.getContentsAsync(path);
    }
    throw new Error("No supported file API is available to read skill output");
  }

  async function removePath(path, runtime) {
    try {
      if (runtime?.IOUtils?.remove) {
        await runtime.IOUtils.remove(path, { recursive: true, ignoreAbsent: true });
      } else if (runtime?.OS?.File?.removeDir) {
        await runtime.OS.File.removeDir(path, { ignoreAbsent: true });
      }
    } catch (error) {
      runtime?.Zotero?.debug?.(`Arch Note Zotero: failed to remove temp path ${path}: ${error.message}`);
    }
  }

  function getTempDirectory(runtime) {
    const zoteroTemp = runtime?.Zotero?.getTempDirectory?.();
    if (zoteroTemp?.path) {
      return zoteroTemp.path;
    }
    if (runtime?.PathUtils?.tempDir) {
      return runtime.PathUtils.tempDir;
    }
    if (runtime?.OS?.Constants?.Path?.tmpDir) {
      return runtime.OS.Constants.Path.tmpDir;
    }
    return "/tmp";
  }

  function makeWorkspacePath(runtime, itemID) {
    const suffix = `${Date.now()}-${itemID || "paper"}-${Math.random().toString(36).slice(2, 8)}`;
    return pathJoin(runtime, getTempDirectory(runtime), `arch-note-zotero-${suffix}`);
  }

  async function executeWithZoteroExec(command, args, runtime, timeoutSeconds) {
    const exec = runtime?.Zotero?.Utilities?.Internal?.exec;
    if (!exec) {
      return false;
    }
    const result = await exec(command, args, { timeout: timeoutSeconds * 1000 });
    if (result && typeof result === "object" && "status" in result && result.status !== 0) {
      throw new Error(`arch-note exited with status ${result.status}: ${result.stderr || ""}`.trim());
    }
    return true;
  }

  function executeWithNsIProcess(command, args, runtime) {
    const components = runtime?.Components || (typeof Components !== "undefined" ? Components : null);
    if (!components?.classes) {
      throw new Error("Zotero does not expose an external process API in this environment");
    }

    const actualCommand = normalizeCommand(command);
    let executable = actualCommand;
    let processArgs = args.slice();
    if (!hasPathSeparator(actualCommand)) {
      if (runtime?.Zotero?.isWin) {
        throw new Error("Set Arch Note command to a full executable path on Windows");
      }
      executable = "/usr/bin/env";
      processArgs = [actualCommand, ...processArgs];
    }

    const file = components.classes["@mozilla.org/file/local;1"].createInstance(components.interfaces.nsIFile);
    file.initWithPath(executable);
    const process = components.classes["@mozilla.org/process/util;1"].createInstance(components.interfaces.nsIProcess);
    process.init(file);
    if (process.runw) {
      process.runw(true, processArgs, processArgs.length);
    } else {
      process.run(true, processArgs, processArgs.length);
    }
    if (process.exitValue !== 0) {
      throw new Error(`arch-note exited with status ${process.exitValue}`);
    }
  }

  async function executeCommand(command, args, runtime, timeoutSeconds) {
    if (await executeWithZoteroExec(command, args, runtime, timeoutSeconds || 300)) {
      return;
    }
    executeWithNsIProcess(command, args, runtime);
  }

  async function preparePaperText(options, runtime, workspacePath) {
    const opts = options || {};
    const rawTextPath = pathJoin(runtime, workspacePath, "paper.raw.txt");
    const paperTextPath = pathJoin(runtime, workspacePath, "paper.skill.txt");
    const command = normalizeCommand(opts.command);
    const timeoutSeconds = Number(opts.timeoutSeconds || 300);

    if (opts.paperPath) {
      const lower = String(opts.paperPath).toLowerCase();
      if (lower.endsWith(".pdf")) {
        await executeCommand(command, buildPaperTextArgs({ paperPath: opts.paperPath, outPath: rawTextPath }), runtime, timeoutSeconds);
      } else {
        const sourceText = await readTextFile(opts.paperPath, runtime);
        await writeTextFile(rawTextPath, sourceText, runtime);
      }
    } else {
      await writeTextFile(rawTextPath, opts.paperText || "", runtime);
    }

    const rawText = await readTextFile(rawTextPath, runtime);
    await writeTextFile(paperTextPath, `${metadataPrefix(opts.metadata)}${rawText}`, runtime);
    return paperTextPath;
  }

  async function runSkillPrompt(options, runtime) {
    const opts = options || {};
    const command = normalizeCommand(opts.command);
    const workspacePath = makeWorkspacePath(runtime, opts.itemID);
    await makeDirectory(workspacePath, runtime);
    const promptPath = pathJoin(runtime, workspacePath, "prompt.md");

    try {
      const paperTextPath = await preparePaperText(opts, runtime, workspacePath);
      const promptArgs = buildPromptArgs({
        paperTextPath,
        promptPath,
        dbPath: opts.dbPath,
        format: opts.format,
        style: opts.style,
        topK: opts.topK,
        maxChars: opts.maxChars,
        query: opts.query
      });
      await executeCommand(command, promptArgs, runtime, Number(opts.timeoutSeconds || 300));
      const prompt = await readTextFile(promptPath, runtime);
      return {
        prompt,
        promptPath,
        workspacePath,
        usedSkill: true
      };
    } finally {
      if (!opts.keepArtifacts) {
        await removePath(workspacePath, runtime);
      }
    }
  }

  return {
    buildPaperTextArgs,
    buildPromptArgs,
    executeCommand,
    metadataPrefix,
    normalizeCommand,
    promptToMessages,
    runSkillPrompt
  };
});

