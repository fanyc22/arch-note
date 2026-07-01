/* eslint-env browser */

(function initPrompt(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArchNotePrompt = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function promptFactory() {
  "use strict";

  const CRITIQUE_PATTERNS = [
    "weak baseline",
    "missing sensitivity study",
    "unrealistic hardware cost",
    "hidden compiler assumption",
    "weak scalability argument",
    "missing correctness argument",
    "unclear deployability"
  ];

  const STYLE_DESCRIPTIONS = {
    group_meeting: "group-meeting handout: concise, discussion-oriented, with critique questions",
    cmu_summary: "CMU-style paper summary: problem, key idea, mechanism, evaluation, limitations",
    uw_review: "review form: strengths, weaknesses, questions, and recommendation-style critique",
    lecture_slide: "lecture-note outline: concepts first, then mechanism and evaluation"
  };

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeMetadata(metadata) {
    const safe = metadata || {};
    return {
      title: normalizeWhitespace(safe.title) || "Unknown title",
      creators: Array.isArray(safe.creators) ? safe.creators.map(normalizeWhitespace).filter(Boolean) : [],
      year: normalizeWhitespace(safe.year || safe.date),
      venue: normalizeWhitespace(safe.venue || safe.publicationTitle || safe.conferenceName),
      doi: normalizeWhitespace(safe.doi || safe.DOI),
      url: normalizeWhitespace(safe.url || safe.URL),
      abstractNote: normalizeWhitespace(safe.abstractNote),
      tags: Array.isArray(safe.tags) ? safe.tags.map(normalizeWhitespace).filter(Boolean) : []
    };
  }

  function truncateText(text, maxChars) {
    const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
    const limit = Number.isFinite(Number(maxChars)) && Number(maxChars) > 0 ? Number(maxChars) : 60000;
    if (normalized.length <= limit) {
      return normalized;
    }
    return `${normalized.slice(0, limit)}\n\n[Truncated to ${limit} characters before sending to the model.]`;
  }

  function metadataBlock(metadata) {
    const meta = normalizeMetadata(metadata);
    const lines = [
      `Title: ${meta.title}`,
      `Authors: ${meta.creators.join(", ") || "Unknown"}`,
      `Year: ${meta.year || "Unknown"}`,
      `Venue: ${meta.venue || "Unknown"}`,
      `DOI: ${meta.doi || "Unknown"}`,
      `URL: ${meta.url || "Unknown"}`
    ];
    if (meta.tags.length) {
      lines.push(`Zotero Tags: ${meta.tags.join(", ")}`);
    }
    if (meta.abstractNote) {
      lines.push(`Abstract: ${meta.abstractNote}`);
    }
    return lines.join("\n");
  }

  function systemMessage(language) {
    const targetLanguage = language === "en" ? "English" : "Chinese";
    return [
      "You are a senior computer-architecture paper reading assistant.",
      `Write in ${targetLanguage}.`,
      "Do not invent details that are not supported by the supplied metadata or text.",
      "When evidence is weak or missing, say so explicitly."
    ].join(" ");
  }

  function buildPaperPrompt(options) {
    const opts = options || {};
    const style = opts.style || "group_meeting";
    const text = truncateText(opts.text || "", opts.maxChars || 60000);
    const styleDescription = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS.group_meeting;
    const critiqueList = CRITIQUE_PATTERNS.map((pattern) => `- ${pattern}`).join("\n");
    const fullTextSection = text || "[No indexed full text was available. Use only metadata and abstract.]";

    return [
      "请根据下面的 Zotero metadata 和论文全文摘录，生成一份可直接作为 Zotero child note 保存的 Markdown 导读。",
      "",
      "硬性要求：",
      "- 只使用输入中能支持的信息；不确定时写明“材料不足”。",
      "- 面向计算机体系结构博士生，关注问题定义、机制、评价方法、硬件/编译器/系统假设和可部署性。",
      `- 风格：${styleDescription}。`,
      "- 不要输出代码块包裹整篇 Markdown。",
      "",
      "请包含这些 Markdown 小节：",
      "1. TL;DR",
      "2. 论文解决的问题",
      "3. 核心机制与关键假设",
      "4. 实验设置与主要结果",
      "5. 适合组会讨论的图表/段落",
      "6. Critique patterns",
      "7. 复现或部署注意事项",
      "8. 延伸阅读问题",
      "",
      "Critique patterns 只从下面列表中选择并解释证据强弱：",
      critiqueList,
      "",
      "# Metadata",
      metadataBlock(opts.metadata),
      "",
      "# Full Text Excerpt",
      fullTextSection
    ].join("\n");
  }

  return {
    CRITIQUE_PATTERNS,
    STYLE_DESCRIPTIONS,
    buildPaperPrompt,
    metadataBlock,
    normalizeMetadata,
    systemMessage,
    truncateText
  };
});

