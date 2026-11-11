# Demo 批注 Skill

为现有网页 Demo 接入可保存、定位、导入导出和验收的批注功能。适用于普通 HTML、React、Vue 等原型，不改变原有业务交互。

## 一条命令安装

安装到 Codex，跨项目使用：

```sh
npx skills add lzhann/demo-annotations --skill demo-annotations -a codex -g -y
```

选择其他支持的 AI 开发工具：

```sh
npx skills add lzhann/demo-annotations
```

需要 Node.js 22.20 或更新版本，以及可访问 GitHub 的网络。

## 安装后使用

在目标 Demo 项目中对助手说：

```text
使用 $demo-annotations 给当前 Demo 接入批注和备注汇总，保持原页面样式及交互。
```

Skill 内含独立 JS/CSS、双页示例、接入文档及组件测试。支持刷新保留圆标、Tab/范围隔离、定位、悬停浮层、已处理/已验收及 JSON 导入导出。

备注保存在各自浏览器，不会自动上传或形成多人实时协同。每个 Demo 使用独立且稳定的 projectId，移交备注使用导出/导入。

详细工作流见 [SKILL.md](SKILL.md)，手工接入见 [references/integration.md](references/integration.md)。
