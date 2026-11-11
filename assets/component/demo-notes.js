/* Demo Notes 1.0.0 — plain JavaScript, no dependencies or network requests. */
(() => {
  'use strict';
  const script = document.currentScript;
  const scriptBase = new URL('.', script?.src || location.href).href;
  let instance = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const text = (tag, value, cls) => { const e = document.createElement(tag); e.textContent = value; if (cls) e.className = cls; return e; };
  const uniqueId = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

  function create(options) {
    if (!options.projectId || typeof options.projectId !== 'string') throw new Error('DemoNotes: 请设置独立的 projectId。');
    if (document.getElementById('demo-notes')) throw new Error('DemoNotes: 页面已存在 #demo-notes，请勿重复接入。');
    const cfg = {targetSelector:'[data-note-id],[data-note-target],.metric,.card,.panel,section,main', ignoreSelector:'[data-note-ignore],a[href],button,input,select,textarea,[role="tab"]', ...options};
    const base = new URL(cfg.baseURL || scriptBase, location.href);
    const key = cfg.storageKey || 'demo-notes:' + cfg.projectId + ':v1';
    const controller = new AbortController(), signal = controller.signal;
    let destroyed = false, notes = [], active = false, editing = null, anchor = null, filter = 'all', range = 'all', frame = null, hoverPointer = null;
    let storageWarning = '';
    const timers = new Set();
    const later = (fn, delay) => { const id = setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, delay); timers.add(id); };
    const on = (el, event, fn, opt={}) => el.addEventListener(event, fn, {...opt,signal});
    function safeURL(route) {
      if (typeof route !== 'string' || !route || /^[a-z][a-z\d+.-]*:|^[/\\]/i.test(route) || route.includes('\\')) throw new Error('批注路径无效');
      const u = new URL(route, base);
      if (u.protocol !== base.protocol || u.host !== base.host || !u.pathname.startsWith(base.pathname)) throw new Error('批注不能定位到其他 Demo');
      return u;
    }
    function routeURL() {
      const u = new URL(location.href);
      if (u.protocol !== base.protocol || u.host !== base.host || !u.pathname.startsWith(base.pathname)) throw new Error('DemoNotes: 页面不在 baseURL 内，请将 baseURL 设为 Demo 根目录。');
      u.searchParams.delete('dn-note');
      return u.pathname.slice(base.pathname.length) + u.search + u.hash;
    }
    routeURL();
    const pageKey = () => String(cfg.getPageKey ? cfg.getPageKey() : new URL(routeURL(),base).pathname.slice(base.pathname.length));
    function context() {
      if (cfg.getContext) {
        const c = cfg.getContext() || {};
        return {key:String(c.key ?? ''),label:String(c.label || '默认视图'),scope:String(c.scope || '默认范围')};
      }
      const u = new URL(location.href); u.searchParams.delete('dn-note');
      if (Array.isArray(cfg.queryKeys)) for (const k of [...u.searchParams.keys()]) if (!cfg.queryKeys.includes(k)) u.searchParams.delete(k);
      u.searchParams.sort();
      const selected = [...document.querySelectorAll('[role="tab"][aria-selected="true"],[data-note-tab].active')].filter(e=>!root.contains(e));
      const tabs = selected.map(e=>({id:e.getAttribute('data-note-tab') || e.id || e.textContent.trim(),label:e.textContent.trim()}));
      const scope = document.body.dataset.noteScope || '默认范围';
      return {key:JSON.stringify([u.search,scope,document.body.dataset.noteContext||'',tabs.map(t=>t.id)]),label:document.body.dataset.noteContextLabel || tabs.map(t=>t.label).join(' / ') || '默认视图',scope,tabIds:tabs.map(t=>t.id)};
    }
    const sameContext = note => note.page === pageKey() && note.context.key === context().key;
    const rank = n => n.accepted ? 'accepted' : n.resolved ? 'resolved' : 'pending';
    const root = document.createElement('div'); root.id = 'demo-notes';
    root.innerHTML = `<div class="dn-tools"><button data-action="toggle" aria-pressed="false">批注模式</button><button data-action="list">备注汇总 <span id="dn-count"></span></button><span id="dn-status" role="status" aria-live="polite"></span></div><div id="dn-pins"></div><div id="dn-hover" role="tooltip" hidden><strong></strong><p></p></div><dialog id="dn-editor" aria-labelledby="dn-editor-title"><form><div class="dn-dialog-header"><h2 id="dn-editor-title">添加备注</h2><button type="button" class="dn-dialog-close" data-action="cancel" aria-label="关闭备注编辑">×</button></div><p id="dn-context"></p><label for="dn-text">备注内容</label><textarea id="dn-text" rows="5" required maxlength="5000" placeholder="记录意见或待确认事项"></textarea><div class="dn-actions"><button type="button" data-action="cancel">取消</button><button type="submit" class="dn-primary">保存备注</button></div></form></dialog><dialog id="dn-list" aria-labelledby="dn-list-title"><div class="dn-dialog-header"><h2 id="dn-list-title">备注汇总</h2><button type="button" class="dn-dialog-close" data-action="close" aria-label="关闭备注汇总">×</button></div><p id="dn-list-summary"></p><label class="dn-scope-control">批注范围<select id="dn-scope-filter"><option value="all">全部范围</option><option value="page">当前页面</option><option value="current">当前页面及视图</option></select></label><div id="dn-filters" role="group" aria-label="备注状态筛选"></div><details class="dn-transfer"><summary>备份与导入</summary><div class="dn-actions"><button data-action="export">导出备注</button><button data-action="import">导入备注</button></div></details><div id="dn-items"></div><input type="file" id="dn-file" accept="application/json,.json" hidden></dialog>`;
    document.body.append(root);
    const $ = selector => root.querySelector(selector), editor = $('#dn-editor'), list = $('#dn-list');
    function status(message) { $('#dn-status').textContent = message; }
    function validate(data) {
      if (!data || data.version !== 1 || data.projectId !== cfg.projectId || !Array.isArray(data.notes) || data.notes.length > 5000) throw new Error('请选择同一 Demo 导出的备注文件');
      const seen = new Set();
      for (const n of data.notes) {
        if (!n || !['id','page','url','title','label','selector','text','updatedAt'].every(k=>typeof n[k]==='string') || n.text.length>5000 || n.selector.length>3000 || !Number.isFinite(Date.parse(n.updatedAt)) || !n.context || !['key','label','scope'].every(k=>typeof n.context[k]==='string') || typeof n.resolved!=='boolean' || typeof n.accepted!=='boolean' || !Number.isInteger(n.number) || n.number<1 || seen.has(n.id) || n.accepted&&!n.resolved) throw new Error('备注格式无效');
        safeURL(n.url); seen.add(n.id);
      }
      return clone(data.notes);
    }
    const envelope = () => ({version:1,projectId:cfg.projectId,exportedAt:new Date().toISOString(),notes:clone(notes)});
    try { const raw = localStorage.getItem(key); if (raw) notes=validate(JSON.parse(raw)); }
    catch (_) { storageWarning='本地备注暂不可读取，请检查浏览器存储或导入备份'; }
    function save(next) {
      notes = next;
      try { localStorage.setItem(key,JSON.stringify(envelope())); storageWarning=''; status('已保存'); }
      catch (_) { storageWarning='无法持久保存，请及时导出备注备份'; status(storageWarning); }
      render();
      document.dispatchEvent(new CustomEvent('demo-notes:change',{detail:{projectId:cfg.projectId,count:notes.length}}));
      cfg.onChange?.(clone(notes));
    }
    function selectorFor(el) {
      if (el.dataset.noteId) return `[data-note-id="${CSS.escape(el.dataset.noteId)}"]`;
      if (el.id) return '#'+CSS.escape(el.id);
      const parts=[];
      while(el && el!==document.body) { const siblings=[...el.parentElement.children].filter(c=>c.tagName===el.tagName); parts.unshift(el.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(el)+1)+')');el=el.parentElement; }
      return 'body > '+parts.join(' > ');
    }
    function labelFor(el) { return (el.dataset.noteLabel || el.getAttribute('aria-label') || el.querySelector('h1,h2,h3,[data-note-label]')?.textContent || el.textContent || '页面位置').trim().replace(/\s+/g,' ').slice(0,100); }
    function find(note) {
      if (!sameContext(note)) return null;
      try { const el=document.querySelector(note.selector); return el&&!root.contains(el)?el:null; } catch (_) { return null; }
    }
    function openEditor(note, target) {
      hideHover(); editing=note?.id||null;
      anchor=note?clone(note):{page:pageKey(),url:routeURL(),title:document.title,label:labelFor(target),selector:selectorFor(target),context:context()};
      $('#dn-context').textContent=anchor.title+' · '+anchor.context.scope+' · '+anchor.context.label+' · '+anchor.label;
      $('#dn-text').value=note?.text||''; $('#dn-editor-title').textContent=note?'编辑备注':'添加备注';editor.showModal();$('#dn-text').focus();
    }
    const button = (label,handler) => {const b=text('button',label);b.type='button';b.onclick=handler;return b;};
    function showList() {render();hideHover();if(!list.open)list.showModal();}
    async function locate(note) {
      list.close();hideHover();
      if (note.page!==pageKey()) { const u=safeURL(note.url);u.searchParams.set('dn-note',note.id);location.href=u.href;return; }
      if (!sameContext(note)) {
        if(cfg.restoreContext) await cfg.restoreContext(clone(note.context),clone(note));
        else if(note.context.tabIds) for(const id of note.context.tabIds) {
          const tab=[...document.querySelectorAll('[data-note-tab]')].find(e=>e.dataset.noteTab===id);if(tab)tab.click();
        }
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(!sameContext(note)) {status('请切换到「'+note.context.scope+' / '+note.context.label+'」后定位，或配置 restoreContext');return;}
      }
      const el=find(note);if(!el){status('原位置已调整，请在备注汇总中查看');return;}
      el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      el.classList.add('dn-highlight');later(()=>el.classList.remove('dn-highlight'),2500);schedule();
    }
    function render() {
      $('#dn-count').textContent='('+notes.length+')';
      const counts={pending:0,resolved:0,accepted:0};notes.forEach(n=>counts[rank(n)]++);
      $('#dn-list-summary').textContent=`共 ${notes.length} 条 · 待处理 ${counts.pending} 条 · 已处理 ${counts.resolved} 条 · 已验收 ${counts.accepted} 条`;
      const filters=$('#dn-filters');filters.replaceChildren();
      for(const [value,label,count] of [['all','全部',notes.length],['pending','待处理',counts.pending],['resolved','已处理',counts.resolved],['accepted','已验收',counts.accepted]]) {
        const b=button(label,()=>{filter=value;render();});b.dataset.noteFilter=value;b.setAttribute('aria-pressed',String(filter===value));b.append(text('span',String(count)));filters.append(b);
      }
      const items=$('#dn-items');items.replaceChildren();
      const rows=notes.filter(n=>(filter==='all'||rank(n)===filter)&&(range==='all'||range==='page'&&n.page===pageKey()||range==='current'&&sameContext(n))).sort((a,b)=>({pending:0,resolved:1,accepted:2}[rank(a)]-({pending:0,resolved:1,accepted:2}[rank(b)]))||b.updatedAt.localeCompare(a.updatedAt));
      if(!rows.length)items.append(text('p',notes.length?'当前筛选下暂无备注':'打开批注模式，点击需要反馈的位置添加备注。','dn-empty'));
      for(const note of rows) {
        const article=document.createElement('article');article.className='dn-note-card';article.dataset.noteId=note.id;
        const head=text('div','','dn-note-head');head.append(text('strong',`#${note.number} ${note.title}`,'dn-note-location'),text('span',{pending:'待处理',resolved:'已处理',accepted:'已验收'}[rank(note)],'dn-state dn-state-'+{pending:'pending',resolved:'done',accepted:'accepted'}[rank(note)]));
        const scope=text('div',note.context.scope+' · '+note.context.label,'dn-note-scope'),target=text('div','位置：'+note.label,'dn-note-target'),body=text('p',note.text,'dn-note-body'),footer=text('div','','dn-note-footer'),actions=text('div','','dn-actions');
        actions.append(button('定位',()=>locate(note).catch(()=>status('暂时无法定位，请检查页面路径'))),button('编辑',()=>{list.close();openEditor(note);}),button('删除',()=>{if(confirm('删除这条备注？'))save(notes.filter(n=>n.id!==note.id));}),button(note.resolved?'重新打开':'标记已处理',()=>save(notes.map(n=>n.id===note.id?{...n,resolved:!n.resolved,accepted:false,updatedAt:new Date().toISOString()}:n))));
        if(note.resolved&&!note.accepted){const b=button('确认验收',()=>save(notes.map(n=>n.id===note.id?{...n,accepted:true,updatedAt:new Date().toISOString()}:n)));b.className='dn-accept-note';actions.append(b);}
        footer.append(text('small',new Date(note.updatedAt).toLocaleString()),actions);article.append(head,scope,target,body,footer);items.append(article);
      }
      renderPins();
    }
    function hideHover() {$('#dn-hover').hidden=true;}
    function renderPins() {
      if(destroyed)return;
      const pins=$('#dn-pins');pins.replaceChildren();
      for(const n of notes) {
        if(n.accepted)continue;const el=find(n);if(!el)continue;const r=el.getBoundingClientRect();
        if(!r.width||!r.height||r.bottom<0||r.top>innerHeight)continue;
        const pin=button(String(n.number),()=>openEditor(n));pin.dataset.noteId=n.id;pin.className='dn-pin'+(n.resolved?' dn-pin-resolved':'');pin.setAttribute('aria-label','查看备注 '+n.label);pin.style.left=Math.max(0,Math.min(innerWidth-24,r.right-18))+'px';pin.style.top=Math.max(0,r.top-20)+'px';pin.tabIndex=active?0:-1;pin.setAttribute('aria-hidden',String(!active));pins.append(pin);
      }
      if(hoverPointer)showHover(hoverPointer);else hideHover();
    }
    function showHover(e) {
      if(e.pointerType==='touch'||editor.open||list.open){hideHover();return;}
      const pin=[...$('#dn-pins').children].find(el=>{const b=el.getBoundingClientRect();return e.clientX>=b.left-3&&e.clientX<=b.right+3&&e.clientY>=b.top-3&&e.clientY<=b.bottom+3;});
      const note=pin&&notes.find(n=>n.id===pin.dataset.noteId);if(!note){hideHover();return;}
      const box=$('#dn-hover');box.querySelector('strong').textContent='#'+note.number+' · '+note.context.scope+' · '+note.label;box.querySelector('p').textContent=note.text;box.hidden=false;const r=pin.getBoundingClientRect();box.style.left=Math.max(12,Math.min(innerWidth-box.offsetWidth-12,r.right+10))+'px';box.style.top=Math.max(12,Math.min(innerHeight-box.offsetHeight-12,r.top))+'px';
    }
    function schedule() {if(!destroyed&&!frame)frame=requestAnimationFrame(()=>{frame=null;renderPins();});}
    function setEnabled(value) {active=!!value;document.body.classList.toggle('dn-selecting',active);const b=$('[data-action="toggle"]');b.textContent=active?'退出批注':'批注模式';b.setAttribute('aria-pressed',String(active));status(active?'点击卡片或模块添加备注':storageWarning);schedule();}
    function exportNotes() {const blob=new Blob([JSON.stringify(envelope(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=cfg.projectId.replace(/[^\p{L}\p{N}_-]/gu,'_')+'-备注.json';a.click();later(()=>URL.revokeObjectURL(url),1000);}
    function importNotes(data) {
      const incoming=validate(typeof data==='string'?JSON.parse(data):data),merged=new Map(notes.map(n=>[n.id,n]));let number=Math.max(0,...notes.map(n=>n.number));
      for(const n of incoming){const old=merged.get(n.id);if(!old)merged.set(n.id,{...n,number:++number});else if(n.updatedAt>old.updatedAt)merged.set(n.id,{...n,number:old.number});}
      save([...merged.values()]);return notes.length;
    }
    on(root,'click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='toggle')setEnabled(!active);if(action==='list')showList();if(action==='cancel')editor.close();if(action==='close')list.close();if(action==='export')exportNotes();if(action==='import')$('#dn-file').click();});
    on(editor.querySelector('form'),'submit',e=>{
      e.preventDefault();const value=$('#dn-text').value.trim();if(!value)return;const old=notes.find(n=>n.id===editing);const note={...anchor,id:editing||uniqueId(),number:old?.number||Math.max(0,...notes.map(n=>n.number))+1,text:value,resolved:false,accepted:false,updatedAt:new Date().toISOString()};save(notes.filter(n=>n.id!==note.id).concat(note));editor.close();
    });
    on(document,'click',e=>{
      if(!active||root.contains(e.target)||e.target.closest(cfg.ignoreSelector))return;
      const target=e.target.closest(cfg.targetSelector);if(!target||target===document.body)return;e.preventDefault();e.stopImmediatePropagation();openEditor(null,target);
    },{capture:true});
    on($('#dn-file'),'change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw new Error('文件过大');importNotes(await f.text());status('导入完成');}catch(err){status('导入失败：'+err.message);}e.target.value='';});
    on($('#dn-scope-filter'),'change',e=>{range=e.target.value;render();});
    on(document,'pointermove',e=>{hoverPointer={pointerType:e.pointerType,clientX:e.clientX,clientY:e.clientY};showHover(hoverPointer);});on(document,'pointerleave',()=>{hoverPointer=null;hideHover();});
    on(document,'scroll',schedule,{capture:true,passive:true});on(window,'resize',schedule);on(window,'load',schedule);on(window,'hashchange',schedule);on(window,'popstate',schedule);on(document,'demo-notes:refresh',schedule);
    on(window,'storage',e=>{if(e.key===key){try{notes=e.newValue?validate(JSON.parse(e.newValue)):[];render();}catch(_){status('备注同步失败，请检查备份格式');}}});
    const observer=new MutationObserver(records=>{if(records.some(r=>!root.contains(r.target)))schedule();});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-selected','class','hidden','data-note-scope','data-note-context','data-note-context-label']});
    render();if(storageWarning)status(storageWarning);
    const requested=new URLSearchParams(location.search).get('dn-note');
    if(requested)later(async()=>{const n=notes.find(n=>n.id===requested);if(n)await locate(n).catch(()=>status('暂时无法定位该备注'));const u=new URL(location.href);u.searchParams.delete('dn-note');try{history.replaceState(null,'',u);}catch(_){}},150);
    return Object.freeze({projectId:cfg.projectId,refresh:schedule,showList,setEnabled,getNotes:()=>clone(notes),exportData:envelope,exportNotes,importNotes,destroy(){destroyed=true;controller.abort();observer.disconnect();if(frame)cancelAnimationFrame(frame);timers.forEach(clearTimeout);document.querySelectorAll('.dn-highlight').forEach(e=>e.classList.remove('dn-highlight'));document.body.classList.remove('dn-selecting');root.remove();if(instance?.projectId===cfg.projectId)instance=null;}});
  }
  window.DemoNotes=Object.freeze({version:'1.0.0',init(config){if(instance){if(instance.projectId===config.projectId)return instance;instance.destroy();}instance=create(config);return instance;},get instance(){return instance;}});
  const auto=()=>{const config=window.DEMO_NOTES_CONFIG || (script?.dataset.project?{projectId:script.dataset.project}:null);if(config)window.DemoNotes.init(config);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',auto,{once:true});else auto();
})();
