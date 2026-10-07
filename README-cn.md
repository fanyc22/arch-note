# Arch Note Zotero

[![CI](https://github.com/fanyc22/arch-note/actions/workflows/ci.yml/badge.svg)](https://github.com/fanyc22/arch-note/actions/workflows/ci.yml)
[![Zotero](https://img.shields.io/badge/Zotero-8.0.1%20to%2010.*-CC2936)](https://www.zotero.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | 中文

Arch Note Zotero 是一个 Zotero 桌面插件，用于为论文生成详细导读 Markdown，并把导读作为 Zotero 子笔记附回对应条目。它直接读取 Zotero 已索引的 PDF 文本和条目 metadata，使用统一的 13 项 system prompt 调用 DeepSeek 或 Poixe Chat Completions API。

这个插件面向体系结构论文阅读组、博士生文献阅读流程，以及希望每篇论文入库后自动获得结构化导读和 critique 的个人文献库。

## 功能

- 监听新加入 Zotero 的论文条目和 PDF 附件。
- 在生成前等待 Zotero PDF 全文索引。
- 单篇、自动生成和批量补全统一使用 13 项深度导读 system prompt。
- 无需安装 Python、skill CLI 或 corpus 数据库。
- 在保存前验证导读包含全部 13 项章节，格式错误时保留原笔记并报告失败。
- 笔记标明实际服务商、模型、接口地址、插件版本和 prompt 版本。
- 支持 DeepSeek 和 Poixe 转发 API，分别保存 API key、Base URL 和模型。
- 把生成的 Markdown 写入 Zotero 子笔记。
- 使用 `arch-note:done`、`arch-note:failed`、`arch-note:report` 标签标记状态。
- 在 Tools 菜单中提供选中论文生成、选中 collection 补生成和全库补生成动作。
- 批量任务按顺序串行处理，避免意外 API 突发调用。
- 手动和批量生成时显示 Zotero 进度窗口。

## 兼容性

- Zotero Desktop: `8.0.1` 到 `10.*`
- 已在 Zotero `9.0.4` 本地测试
- 平台：macOS 已测试；Linux 和 Windows 需要正确配置路径
- 类型：Zotero MV2 bootstrap add-on

## 安装

从 GitHub Releases 下载最新 `.xpi`，然后在 Zotero 中安装：

1. 打开 Zotero。
2. 进入 `Tools > Add-ons`。
3. 点击齿轮图标。
4. 选择 `Install Add-on From File...`。
5. 选择 `arch-note-zotero-deepseek-<version>.xpi`。
6. 如果 Zotero 提示，重启 Zotero。

本地开发构建：

```bash
npm test
npm run build
```

生成文件位于：

```text
dist/arch-note-zotero-deepseek-0.1.10.xpi
```

## 配置

打开：

```text
Tools > Arch Note Zotero Settings
```

推荐配置：

| 字段 | 推荐值 |
| --- | --- |
| Enable plugin | enabled |
| Generate automatically when new papers are added | 按需开启 |
| Ask Zotero to index PDF text before generation | enabled |
| API provider | `DeepSeek` 或 `Poixe` |
| API key | 所选服务商的 API key |
| Base URL | `https://api.deepseek.com` |
| Model | 例如 `deepseek-v4-pro` |
| Language | `Chinese` 或 `English` |
| Max paper chars | `60000` |
| Max output tokens | `16384`，以模型支持的上限为准 |
| Auto-run delay seconds | `20` |

API key 存在本机 Zotero preferences 中。建议使用受限 key；如果曾经暴露，应立即轮换。

### 使用 Poixe 转发 API

在 `API provider` 中选择 `Poixe`，填写 Poixe API key，Base URL 使用 `https://api.poixe.com/v1`，Model 填写 Poixe 控制台支持的模型 ID，例如 `gpt-5.2`。切换服务商时，DeepSeek 和 Poixe 的 key、URL、模型分别保留；仅在点击 Save 后保存配置。接口遵循 [Poixe 官方 Chat Completions 文档](https://docs.poixe.com/cn/api-reference/text-api/openai-completions/overview)。

Base URL 也可以填写 `https://api.poixe.com` 或完整的 `https://api.poixe.com/v1/chat/completions`，插件会补全路径并避免重复拼接。Poixe 主接口存在 120 秒超时，详细导读遇到超时可以使用 `https://api-eu-central-1-dc8.poixe.com/v1` 或 `https://api-eu-central-1-dc15.poixe.com/v1`。详见 [Poixe Base URL 文档](https://docs.poixe.com/cn/api-reference/introduction/base-url)。

升级后保留已有的 DeepSeek 配置和输出 token 设置；如果仍使用 `4096`，建议根据模型上限手动提高到 `16384`，给 13 项详细导读留出空间。

## 论文输入

插件直接读取论文条目的 metadata 和 PDF 全文缓存；开启索引选项时，会先要求 Zotero 索引 PDF。已有的 skill、风格和格式配置不再影响请求，不会调用外部 CLI。

## 使用方法

### 为选中论文生成导读

1. 在 Zotero 中选中一篇或多篇论文。
2. 点击 `Tools > Generate Arch Note`。
3. 插件会创建或更新名为 `Arch Note` 的子笔记。

### 为当前库中缺少导读的论文批量补生成

1. 打开目标 Zotero library。
2. 点击 `Tools > Generate Missing Arch Notes in Current Library`。
3. 确认批量任务。
4. 插件会扫描顶层论文条目，并给没有 Arch Note report 的条目排队生成。

批量任务按 `dateAdded`、标题和 item id 的确定性顺序处理。

### 为选中 collection 中缺少导读的论文批量补生成

1. 在 Zotero 左侧栏选中一个 collection。
2. 点击 `Tools > Generate Missing Arch Notes in Selected Collection`。
3. 确认批量任务。
4. 插件会扫描该 collection 中符合条件的论文条目；当 Zotero API 能提供子 collection 时，也会包含子 collection。已有 Arch Note report 的条目会被跳过。

手动和批量任务会显示 Zotero 进度窗口，包含已完成、成功、失败和跳过计数。

### 自动生成

开启 `Generate a guide automatically when new papers are added` 后，新论文或附件进入 Zotero 时，插件会等待配置的延迟，要求 Zotero 建立 PDF 索引，然后生成子笔记。

## 导读格式

生成内容是 Markdown，并会转换为 Zotero note HTML。笔记中包含隐藏标记，因此插件可以识别并更新已有导读，而不是重复创建。

所有生成方式使用同一份 system prompt，按顺序包含：

1. 研究问题、重要性与价值。
2. 已有研究及其不足。
3. 从已有背景重建作者可能的思考路径。
4. 核心 idea 的 intuition。
5. 用具体例子解释输入、处理、输出 pipeline。
6. 数学推导和必要的理论背景；无推导时说明。
7. 实验验证：问题 -> 实验 -> 答案。
8. Take aways。
9. 最脆弱的假设。
10. 一周内可执行的最小复现实验。
11. 针对核心 claim 的反例。
12. 后续研究、扩展、反驳与新的认知。
13. 从 limitation 和需求出发的 follow-up idea。

写作参考 Andrej Karpathy 的具体技术情境和 Kaiming He 的技术清晰度，并明确区分论文原文、已有文献、合理推断和不确定猜测。设置中不再区分输出格式或风格。

插件当前没有联网搜索工具。第 12 项必须说明“未进行联网检索”，只分析输入中可核验的相关资料并列出待检索问题；第 13 项必须说明尚未验证的新颖性。配置 Poixe 不会自动提供搜索能力。

输出小节使用 `## 1. 标题` 到 `## 13. 标题`。缺少小节、重复编号或返回旧式短摘要时，该任务会失败并保留原笔记。笔记顶部的服务商、接口地址和 prompt 版本可用于核对实际生成来源。

## 常见问题

### Tools 菜单没有插件入口

确认安装的是 `0.1.8` 或更新版本。较早的本地构建可能能安装，但没有正确注册 Zotero UI。

### Zotero 提示 XPI 不兼容

安装最新 release。Zotero 9 需要 `manifest.json` 中包含 permanent-install metadata，尤其是 `applications.zotero.update_url`。

### 只根据 metadata 生成了导读

这说明 Zotero 没有可用的 PDF 全文。可以先在 Zotero 打开 PDF，等待索引完成，或开启 `Ask Zotero to index PDF text before generation`。

### API 报错

检查所选 API provider 的 API key、Base URL、模型名、账户额度和网络连接。Poixe 的 key 和模型应来自 Poixe 控制台。

### 升级后仍看到旧格式

关闭并重新打开 Zotero，选中目标论文，使用 `Tools > Generate Arch Note` 重新生成。批量补全只处理缺少导读的条目，不会改写已有导读。新笔记应显示 `Arch Note 0.1.10`、实际服务商和 `paper-reading-13-v2`。

## 开发

```bash
npm test
npm run build
```

重要文件：

| 路径 | 用途 |
| --- | --- |
| `bootstrap.js` | Zotero bootstrap 入口 |
| `preferences.xhtml` | Zotero preference pane UI |
| `preferences.js` | preference pane 控制器 |
| `chrome/content/arch-note-zotero.js` | Zotero 条目、菜单、笔记和批量流程 |
| `chrome/content/deepseek-client.js` | DeepSeek / Poixe Chat Completions 客户端 |
| `chrome/content/prompt.js` | 统一 system prompt 和论文输入上下文 |
| `chrome/content/markdown.js` | Markdown 到 Zotero note HTML 转换 |
| `chrome/content/progress.js` | Zotero 进度窗口适配 |
| `scripts/build-xpi.mjs` | XPI 打包脚本 |
| `test/` | Node 测试 |

## 发布

1. 更新 `manifest.json` 和 `package.json` 版本。
2. 运行 `npm test`。
3. 运行 `npm run build`。
4. 上传 `dist/arch-note-zotero-deepseek-<version>.xpi` 到 GitHub Release。
5. 更新 `updates.json` 中的 XPI 下载地址和 sha256。

## 隐私

插件会读取 Zotero 条目 metadata、附件路径和 Zotero 已索引的全文，并把 prompt 发送到所选服务商的 API endpoint。选择 DeepSeek 时数据发送到配置的 DeepSeek endpoint；选择 Poixe 时发送到配置的 Poixe endpoint，并由 Poixe 路由到所选模型的上游服务商。插件不使用 ChatGPT Pro 订阅。

## 许可证

MIT。见 [LICENSE](LICENSE)。
