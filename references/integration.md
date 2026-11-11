# 通用 Demo 批注组件 1.0.0

从已使用的 Demo 批注交互中提取的独立版本。仅两个核心文件，不依赖框架、npm、CDN 或后端；不包含任何业务数据、旧备注或账号信息。可运行示例位于 assets/component/examples/。

## 接入普通 HTML

1. 把 `demo-notes.js`、`demo-notes.css` 放在 **Demo 根目录**，保持整个文件夹一起移动。
2. 在每个需要批注的页面加入：

```html
<link rel="stylesheet" href="demo-notes.css">
<script src="demo-notes.js" data-project="my-demo-v1" defer></script>
```

不同 Demo 使用不同编号；同一个 Demo 的多页使用同一个编号。改编号会切换到新的备注空间，原备注不会被删除。不要同时接入旧版批注脚本。

3. 给可批注的模块加上稳定、页面内唯一的标识，推荐这样做：

```html
<section data-note-id="revenue" data-note-label="收入模块">
  <h2>收入</h2>
  <!-- 原来的内容和交互保持原样 -->
</section>
```

也会自动识别 `.metric`、`.card`、`.panel`、`section`、`main`。未设稳定标识时回退到 DOM 位置；大幅改版后可能需要从汇总查看原备注。`data-note-ignore` 表示该控件或区域不拦截。

## 已包含的交互

- 批注模式：点击卡片或模块，新增或编辑文字；编辑框和汇总均有关闭按钮，Esc 也可关闭。
- 自动保存到当前浏览器；刷新后保留序号和备注。
- 待处理 → 已处理 → 已验收；已验收记录留在汇总，但不显示页面圆标。编辑后重新变为待处理。
- 定位直接滚动并高亮原位置，不弹编辑框。
- 鼠标悬停圆标显示备注浮层；退出批注后圆标不拦截链接点击。
- 区分多页、Tab 和范围；汇总可筛选状态、当前页面或当前页面及视图。
- JSON 导出／导入；同项目按备注 ID 和更新时间合并，不重复添加相同记录。
- 页面重新渲染、滚动、尺寸变化时更新圆标位置。

## 区分 Tab、项目、筛选范围

默认会把 URL 查询参数、页面范围和选中 Tab 一起作为视图标识。

```html
<body data-note-scope="项目A">
  <button role="tab" aria-selected="true" data-note-tab="month">当月</button>
  <button role="tab" aria-selected="false" data-note-tab="year">年累</button>
</body>
```

切换 Tab 时要同步 `aria-selected`；范围变化时同步 `body.dataset.noteScope`。嵌套 Tab、独立卡片筛选或复杂应用，建议主动提供 `getContext`；不需要计入视图的查询参数，可用 `queryKeys` 指定白名单。

```html
<script>
window.DEMO_NOTES_CONFIG = {
  projectId: 'another-demo-v1',
  getContext() {
    return {
      key: JSON.stringify([currentProjectId, activeTab, timeMode]),
      label: activeTabLabel + ' · ' + timeModeLabel,
      scope: currentProjectName
    };
  },
  async restoreContext(context, note) {
    // 使用你自己应用的方法恢复筛选和 Tab。
    // 让页面状态恢复到与 note.context.key 一致后再返回。
  }
};
</script>
<script src="demo-notes.js" defer></script>
```

上面 `currentProjectId` 等变量由你的 Demo 提供；普通页面不需要复制这段高级配置。可运行的恢复示例见 `examples/example.js`。没有恢复回调时，普通 `data-note-tab` 可自动点击恢复；复杂范围无法恢复时会提示手动切换，避免定位错页面。

## JS API / React / Vue / SPA

将 JS 与 CSS 在应用入口引入一次。组件挂载到 DOM 后初始化；页面或路由更新后调用 `refresh()`。卸载整个批注功能时调用 `destroy()`，不要给每张卡片重复初始化。

```js
const notes = window.DemoNotes.init({
  projectId: 'my-spa-v1',
  // 如果 JS 在 assets/ 下，设为整个 Demo 的根目录：
  baseURL: new URL('./', location.href).href,
  getPageKey: () => location.pathname + location.hash.split('?')[0],
  getContext: () => ({key: activeTabId, label: activeTabLabel, scope: projectName}),
  restoreContext: async (context, note) => { /* 用应用自己的 API 恢复状态 */ }
});

notes.refresh();                // DOM 更新完成后重新定位圆标
notes.setEnabled(true);         // 开启批注模式
notes.showList();               // 打开汇总
notes.getNotes();               // 返回备注副本
notes.exportData();             // 返回可备份的对象
notes.exportNotes();            // 下载 JSON
notes.importNotes(exportedData);// 导入同项目的备份，返回合并后条数
notes.destroy();                // 移除 UI、事件监听和观察器
```

同项目重复 `init()` 返回已有实例；初始化其他项目会先卸载原实例。`window.DemoNotes.instance` 获取当前实例。也可以派发 `document.dispatchEvent(new Event('demo-notes:refresh'))` 通知刷新。

`baseURL` 必须是包含各页面的公共根目录 URL，以 `/` 结束。默认是 JS 所在目录。跨页面定位限制在这个目录内；移动整个 Demo 文件夹后相对链接仍可工作。SPA 中 `getPageKey` 只包含页面／路由身份，筛选条件放到 `getContext`，这样同页 Tab 切换可以通过恢复回调完成。

## 文件、数据与分享

- **备注保存在当前浏览器的当前站点存储中**，不会写回 HTML，也不会自动上传服务器或同步给别人。
- 文件夹改位置、浏览器换了或浏览器清理站点数据，可能读不到原备注；迁移前用“备注汇总 → 备份与导入 → 导出备注”。
- 给同事发 Demo 时，程序文件与 JSON 备注备份分别提供；同事用相同项目编号接入后导入。
- 通用包使用自己的 JSON 格式和项目编号校验；原商业 Demo 的备注文件不是该通用包的导入格式。
- 浏览器禁用本地存储时，界面会提示导出备份；此时当前页仍可暂存，关闭页面会丢失未导出的内容。
- 当前版本支持同一 DOM 页面内的元素，不跨域读取 iframe 或 Shadow DOM。不含多人在线协同、截图涂画或云端同步服务。
- 示例可直接以文件方式打开；正式 Demo 也可通过自己的静态网站服务使用。现代 Chrome、Edge、Safari 支持所用的 dialog、Observer 等标准 API；已在随包测试报告所列的 Chromium 环境验证。

## 外观与开发验收

CSS 已限制在 `#demo-notes` 下；选中、高亮使用 `dn-` 前缀。可通过 `--dn-bottom`、`--dn-right` 调整工具栏位置。业务页面本身的布局不需要修改。

`tests/verify.mjs` 是可选的 Playwright 验收脚本；开发者装好 Playwright 后运行。组件的交互行为已在隔离示例中验证。这些测试只操作隔离的示例浏览器，不接触任何实际 Demo 的备注。
