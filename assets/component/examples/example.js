(() => {
  const params = new URLSearchParams(location.search);
  const scope = document.getElementById('scope');
  scope.value = ['总部','项目A','项目B'].includes(params.get('scope')) ? params.get('scope') : '总部';
  let tab = params.get('tab') === 'year' ? 'year' : 'month';
  function render() {
    document.body.dataset.noteScope = scope.value;
    document.querySelectorAll('[data-note-tab]').forEach(b => b.setAttribute('aria-selected',String(b.dataset.noteTab === tab)));
    const u = new URL(location.href);u.searchParams.set('scope',scope.value);u.searchParams.set('tab',tab);history.replaceState(null,'',u);
    const cards = document.getElementById('cards');
    if (cards) cards.innerHTML = `<section class="card" data-note-id="orders" data-note-label="订单数"><h2>订单数</h2><strong>${tab==='year'?'1,280':'128'}</strong><p>${scope.value} · ${tab==='year'?'年累':'当月'}</p><a id="detail-link" href="detail.html${u.search}">查看明细 →</a></section><section class="card" data-note-id="amount" data-note-label="订单金额"><h2>订单金额</h2><strong>${tab==='year'?'328.0':'32.8'} 万</strong><p>这是用于测试批注的演示内容。</p></section>`;
    const back = document.getElementById('back-link');if(back)back.href='index.html'+u.search;
    window.DemoNotes?.instance?.refresh();
  }
  scope.addEventListener('change',render);
  document.querySelectorAll('[data-note-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.noteTab;render();}));
  document.getElementById('rerender')?.addEventListener('click',render);
  window.DEMO_NOTES_CONFIG = {
    projectId: 'demo-notes-example',
    restoreContext(context,note) {
      const u=new URL(note.url,location.href);scope.value=u.searchParams.get('scope')||'总部';tab=u.searchParams.get('tab')==='year'?'year':'month';render();
    }
  };
  render();
})();
