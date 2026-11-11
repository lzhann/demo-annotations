---
name: demo-annotations
description: 为已有网页 Demo 接入或修复批注模式、持久备注、圆标定位、Tab/范围隔离和验收流程。适用于 HTML、React、Vue 等网页原型，不用于文档批注或截图涂画。
---

# Demo 批注

在现有 Demo 上增加反馈层，保留原来的样式、业务数据、导航、下钻和筛选交互。使用随包无依赖 JS/CSS，不复制其他项目的备注。

## 接入

先查看页面入口、路由、卡片 DOM、Tab/筛选状态和已有批注实现。避免同时挂载两套 `#demo-notes`。

核心文件：[assets/component/demo-notes.js](assets/component/demo-notes.js)、[assets/component/demo-notes.css](assets/component/demo-notes.css)。普通 HTML Demo 把它们放在共同根目录，在需要批注的页面引用：

```html
<link rel="stylesheet" href="demo-notes.css">
<script src="demo-notes.js" data-project="demo的独立稳定编号" defer></script>
```

同一 Demo 多页共享 projectId，不同 Demo 独立。已有备注的编号空间保持稳定，除非用户明确要另开空间。首次接入为空，不读取原商业 Demo 的存储键或目录。

给模块设置稳定、页面内唯一的 `data-note-id` 和可读 `data-note-label`，避免只依赖 DOM 序号；无需移动业务内容。

```html
<section data-note-id="sales-summary" data-note-label="销售概览">
  <!-- 原内容与交互 -->
</section>
```

## 视图归属

简单页面默认识别选中的 `[role=tab][aria-selected=true]` 或 `[data-note-tab].active`、`body.dataset.noteScope` 和 URL 查询参数。Tab 切换时同步 aria-selected。

复杂页面、嵌套 Tab、组织或筛选组合，读取 [references/integration.md](references/integration.md)，配置 `getContext()` 返回 `{key,label,scope}`，并用 `restoreContext(context,note)` 调用应用自己的状态更新方法。不要只改 DOM 伪造筛选。

页面/路由身份放在 `getPageKey()`，同页 Tab、项目与统计范围放在 `getContext()`。只计入实际需要区分的条件。定位先恢复真实视图再滚动，恢复不了时提示用户，不定位到其他同名指标。

默认 baseURL 是 JS 所在目录。JS 放入 assets 子目录时显式设为整个 Demo 根 URL，保证多页及离线打开。React/Vue 入口仅初始化一次，DOM 更新后 refresh，移除整套功能时 destroy。可运行的双页示例见 [assets/component/examples](assets/component/examples)。

## 保留的行为

- 退出批注仍显示未验收圆标，刷新保留备注和编号。
- 圆标不阻挡原链接、下钻、Tab、筛选器和按钮；批注模式也允许业务控件操作。
- 悬停圆标显示备注；定位只滚动高亮，不弹编辑框。
- 编辑框和汇总可关闭，长文本不撑破手机布局。
- 待处理、已处理、已验收分开。已验收隐藏圆标，保留汇总；编辑或重新打开后可继续处理。
- 页面、Tab、项目/范围不串标；动态重绘后用稳定锚点定位。
- 同项目 JSON 导入/导出，按 ID/时间合并。导入校验项目、格式和导航路径；备注以文本节点渲染，不执行 HTML。

备注仅保存在当前浏览器，不宣称多人协同。单纯添加批注不授权上传备注、业务数据或扩大网站受众。移交备注用导入/导出；与原商业驾驶舱导出格式不同，不承诺直接兼容。

## 验收与交付

在实际 Demo 检查：新增→刷新→换 Tab/范围→定位→编辑→已处理→验收隐藏→重新打开，以及导入/导出去重。确认原下钻、筛选和返回可用，手机编辑框和汇总不溢出。离线包用 file:// 验证跨页定位。

[assets/component/tests/verify.mjs](assets/component/tests/verify.mjs) 是隔离示例的组件测试，需要 Playwright；不能替代实际 Demo 集成验收，不用真实用户备注做破坏性测试。

交付说明接入文件、projectId、存储备份方式和验证范围。用户已授权发布时沿用原流程；不额外要求重复批准。
