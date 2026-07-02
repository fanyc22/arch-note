# Arch Note Zotero DeepSeek

[![CI](https://github.com/fanyc22/arch-note/actions/workflows/ci.yml/badge.svg)](https://github.com/fanyc22/arch-note/actions/workflows/ci.yml)
[![Zotero](https://img.shields.io/badge/Zotero-8.0.1%20to%2010.*-CC2936)](https://www.zotero.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | 中文

Arch Note Zotero DeepSeek 是一个 Zotero 桌面插件，用于为计算机体系结构论文生成导读 Markdown，并把导读作为 Zotero 子笔记附回对应条目。它可以调用本机 `arch-paper-reading-skill` 提供的 `arch-note` CLI 生成带检索上下文的 prompt，再使用 DeepSeek Chat Completions API 生成最终导读。

这个插件面向体系结构论文阅读组、博士生文献阅读流程，以及希望每篇论文入库后自动获得结构化导读和 critique 的个人文献库。

## 功能

- 监听新加入 Zotero 的论文条目和 PDF 附件。
- 在生成前等待 Zotero PDF 全文索引。
- 可选调用本机 `arch-note` CLI。
- 当 skill CLI 失败时，可回退到内置体系结构论文 prompt。
- 调用 DeepSeek 兼容的 `/chat/completions` 接口。
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
dist/arch-note-zotero-deepseek-0.1.8.xpi
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
| Use arch-paper-reading-skill via arch-note CLI | enabled |
| Fall back to the built-in prompt if arch-note fails | enabled |
| Keep temporary skill prompt files for debugging | disabled |
| Ask Zotero to index PDF text before generation | enabled |
| arch-note command | `arch-note` 的绝对路径 |
| Skill corpus DB | `data/indexes/arch_corpus.sqlite` 的路径 |
| Skill format | `detailed` |
| Skill top-k | `4` |
| Skill timeout seconds | `300` |
| DeepSeek API key | 你的 DeepSeek API key |
| Base URL | `https://api.deepseek.com` |
| Model | 例如 `deepseek-v4-pro` |
| Style | `group_meeting` |
| Language | `Chinese` 或 `English` |
| Max paper chars | `60000` |
| Max output tokens | `4096` |
| Auto-run delay seconds | `20` |

API key 存在本机 Zotero preferences 中。建议使用受限 key；如果曾经暴露，应立即轮换。

## 使用 arch-paper-reading-skill

先安装 skill CLI：

```bash
cd /path/to/arch-paper-reading-skill
python3 -m pip install -e ".[dev]"
arch-note --help
```

把 `arch-note command` 配置为下面命令输出的绝对路径：

```bash
which arch-note
```

启用 skill 集成后，插件会提取论文文本和 metadata，然后执行等价于下面的流程：

```bash
arch-note paper text paper.pdf --out paper.raw.txt
arch-note prompt \
  --paper paper.skill.txt \
  --db /path/to/data/indexes/arch_corpus.sqlite \
  --format detailed \
  --style group_meeting \
  --top-k 4 \
  --out prompt.md
```

DeepSeek 请求会使用 `arch-note prompt` 生成的 `# SYSTEM` 和 `# USER` 部分。

## 使用方法

### 为选中论文生成导读

1. 在 Zotero 中选中一篇或多篇论文。
2. 点击 `Tools > Generate Arch Note with DeepSeek`。
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

默认中文导读通常包含：

- 问题与动机
- 核心思想
- 机制与实现
- 评估总结
- 局限与 critique
- 讨论问题
- 对后续阅读的价值

## 常见问题

### Tools 菜单没有插件入口

确认安装的是 `0.1.8` 或更新版本。较早的本地构建可能能安装，但没有正确注册 Zotero UI。

### Zotero 提示 XPI 不兼容

安装最新 release。Zotero 9 需要 `manifest.json` 中包含 permanent-install metadata，尤其是 `applications.zotero.update_url`。

### 只根据 metadata 生成了导读

这说明 Zotero 没有可用的 PDF 全文。可以先在 Zotero 打开 PDF，等待索引完成，或开启 `Ask Zotero to index PDF text before generation`。

### DeepSeek 报错

检查 API key、Base URL、模型名、账户额度和网络连接。

### arch-note 失败

检查 `arch-note command` 的绝对路径和 corpus DB 路径。需要排查时可以临时开启 `Keep temporary skill prompt files for debugging`。

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
| `chrome/content/skill-runner.js` | `arch-note` CLI 集成 |
| `chrome/content/deepseek-client.js` | DeepSeek API 客户端 |
| `chrome/content/prompt.js` | 内置 fallback prompt |
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

插件会读取 Zotero 条目 metadata、附件路径和 Zotero 已索引的全文。它会把生成 prompt 发送到配置的 DeepSeek 兼容 API endpoint。插件不会向 OpenAI 发送数据，也不会使用 ChatGPT Pro。

## 许可证

MIT。见 [LICENSE](LICENSE)。
