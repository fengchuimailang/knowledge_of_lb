# LLM 知识库构建术

> 翻译整理自 Andrej Karpathy 2026年4月3日 Twitter/X

## 背景

Karpathy 分享了他最近在用的 LLM 知识库系统，核心思路是：**用 LLM 来组织和管理知识，而不是单纯把 LLM 当搜索引擎用。**

---

## 完整工作流

```
数据采集 (raw/)
    ↓
LLM 编译 → Wiki (.md 目录)
    ↓
Obsidian 前端查看
    ↓
CLI 工具（Q&A、搜索、Lint）
    ↓
输出 → Markdown / 幻灯片 / 可视化
    ↓
反哺 Wiki（持续积累）
```

---

## 各环节详解

### 1. 数据采集

- **来源**：文章、论文、代码仓库、数据集、图片
- **工具**：Obsidian Web Clipper 插件抓取网页文章
- **关键**：同时下载相关图片到本地，让 LLM 方便引用

### 2. 知识编译

LLM 把 raw/ 目录里的原始文档**增量编译**成 wiki：

- 写入所有原始数据的摘要
- 自动创建文档间的 backlinks
- 按概念分类，写成文章并相互链接

> 核心洞察：Wiki 是 LLM 的输出物，人几乎不直接编辑

### 3. IDE：Obsidian 作为前端

- 查看 raw 数据
- 查看编译后的 wiki
- 查看衍生可视化（Marp 幻灯片等）

### 4. 知识问答

当 wiki 足够大（Karpathy 某个研究专题 ~100篇文章/~400K词）：

- 直接问 LLM 复杂问题
- LLM 自动检索、研究、回答
- 不需要 fancy RAG，LLM 能自动维护索引和摘要

### 5. 输出格式

不只输出文字/终端：

- Markdown 文件
- Marp 格式幻灯片
- Matplotlib 可视化图片
- 所有输出存回 wiki

> 探索结果会"沉积"在知识库里，后续查询越来越丰富

### 6. Lint / 健康检查

LLM 定期扫描 wiki：

- 发现不一致的数据
- 补全缺失信息（带网络搜索）
- 挖掘文档间的新连接
- 提出值得进一步研究的问题

### 7. 额外工具

Karpathy 自己 vibe coding 了：

- Wiki 的小型搜索引擎（Web UI + CLI）
- 方便 LLM 在大查询时调用

---

## 进阶方向

> 随着知识库增长，自然会想到：**合成数据 + 微调**，让 LLM"记住"知识而非只靠 context。

---

## 我的思考

Karpathy 的系统和传统 PKM 最大的区别：

| 传统 PKM | LLM 知识库 |
|---------|-----------|
| 人维护结构 | LLM 维护结构 |
| 人写笔记 | LLM 写笔记 |
| 搜索为主 | 问答 + 探索为主 |
| 静态积累 | 动态反哺 |

> **"You rarely ever write or edit the wiki manually, it's the domain of the LLM."**

---

## 参考

- 原文：Andrej Karpathy @karpathy（2026-04-03）
- 博客：https://karpathy.github.io/
- 相关文章：[A Recipe for Training Neural Networks](https://karpathy.github.io/2019/04/25/recipe/)

---

*本文整理自 Twitter/X，原作者 Andrej Karpathy。*
