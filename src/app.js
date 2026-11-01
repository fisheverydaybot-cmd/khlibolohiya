(function () {
'use strict';

// ---------- Дані: налаштування і бланки (src/settings.json, src/forms.json) ----------
var CFG = JSON.parse(document.getElementById('settings-json').textContent);
var FORMS = JSON.parse(document.getElementById('forms-json').textContent);
var SHOPS = CFG.points || [];
var CITY = CFG.city || '';
var FORM_MATCH = [];
FORMS.forEach(function (f) { (f.match || [f.title]).forEach(function (m) { FORM_MATCH.push([m.toLowerCase(), f.id]); }); });
var QR_DEFAULT = CFG.qrDefault || ['home'];
var PL = CFG.pointLabel || 'Заклад';

// ---------- Утиліти ----------
function $(s, r) { return (r || document).querySelector(s); }
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
var UA = navigator.userAgent || '';
var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(UA);
var inApp = /Viber|Telegram|FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(UA);
var inFrame = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

function inline(t) {
  t = esc(t).replace(/\\([_*\\])/g, '$1');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return t;
}

var TR = { 'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ie','ж':'zh','з':'z','и':'y','і':'i','ї':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'iu','я':'ia' };
function slug(t) {
  return t.toLowerCase().split('').map(function (c) { return TR[c] !== undefined ? TR[c] : c; }).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

// ---------- Розбір змісту ----------
function blocksToHtml(lines) {
  var out = [], i = 0;
  while (i < lines.length) {
    var l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^\d+\.\s/.test(l)) {
      var items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(/^\d+\.\s/, '')) + '</li>'); i++; }
      out.push('<ol>' + items.join('') + '</ol>'); continue;
    }
    if (/^[-*]\s/.test(l)) {
      var it = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { it.push('<li>' + inline(lines[i].replace(/^[-*]\s/, '')) + '</li>'); i++; }
      out.push('<ul>' + it.join('') + '</ul>'); continue;
    }
    if (/^\|/.test(l)) {
      var rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      var cells = function (r) { return r.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
      var h = cells(rows[0]);
      var body = rows.slice(2).map(function (r) { return '<tr>' + cells(r).map(function (c, i) { return '<td data-l="' + esc(h[i] || '') + '">' + inline(c) + '</td>'; }).join('') + '</tr>'; });
      out.push('<div class="tw"><table' + (h.length > 3 ? ' class="stack"' : '') + '><thead><tr>' + h.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + body.join('') + '</tbody></table></div>');
      continue;
    }
    if (/^(Бланк|Документ):/.test(l)) {
      out.push(formLine(l)); i++; continue;
    }
    out.push('<p>' + inline(l) + '</p>'); i++;
  }
  return out.join('');
}

function formsIn(text) {
  var low = text.toLowerCase(), found = [];
  FORM_MATCH.forEach(function (m) { if (low.indexOf(m[0]) >= 0 && found.indexOf(m[1]) < 0) found.push(m[1]); });
  return found;
}
function formLine(l) {
  var parts = l.split(/(?=Документ:)/);
  var html = '';
  var b = parts.filter(function (p) { return /^Бланк:/.test(p); })[0];
  var d = parts.filter(function (p) { return /^Документ:/.test(p); })[0];
  if (b) {
    var ids = formsIn(b);
    html += '<div class="forms-row"><span class="lbl">Бланк:</span>' + (ids.length ? ids.map(function (id) {
      var f = FORMS.filter(function (x) { return x.id === id; })[0];
      return '<button class="chip" data-print="' + id + '">🖨 ' + esc(f.title) + '</button>';
    }).join('') : inline(b.replace(/^Бланк:\s*/, ''))) + '</div>';
  }
  if (d) html += '<p class="doc">' + inline(d.trim()) + '</p>';
  return html;
}

function parse(md) {
  var sections = [], intro = null, cur = null, q = null;
  md.split('\n').forEach(function (line) {
    var m;
    if ((m = /^## (.+)$/.exec(line))) {
      cur = { title: m[1].trim(), qs: [], lines: [] };
      if (/^Як користуватися/.test(cur.title)) intro = cur; else sections.push(cur);
      q = null; return;
    }
    if ((m = /^### (.+?)(?:\s*\{#([a-z0-9-]+)\})?$/.exec(line))) {
      q = { title: m[1].trim(), id: m[2] || slug(m[1]), lines: [], section: cur };
      cur.qs.push(q); return;
    }
    if (q) q.lines.push(line); else if (cur) cur.lines.push(line);
  });
  sections.forEach(function (s, si) {
    s.id = 'r' + (si + 1);
    s.num = (/^(\d+)\./.exec(s.title) || [, si + 1])[1];
    s.name = s.title.replace(/^\d+\.\s*/, '');
    s.qs.forEach(function (q) {
      q.html = blocksToHtml(q.lines);
      q.text = (q.title + ' ' + q.lines.join(' ')).toLowerCase();
    });
    s.notes = blocksToHtml(s.lines);
  });
  if (intro) intro.html = blocksToHtml(intro.lines);
  return { intro: intro, sections: sections };
}

var DATA = parse(document.getElementById('content-md').textContent);
var ALLQ = [];
DATA.sections.forEach(function (s) { s.qs.forEach(function (q) { ALLQ.push(q); }); });

var ICONS = CFG.icons || {};

// ---------- Вибір закладу ----------
function currentShop() {
  var id = store('shop'); var s = SHOPS.filter(function (x) { return x.id === id; })[0];
  return s || null;
}
function currentOp(shop) {
  if (!shop) return '';
  var o = store('op-' + shop.id);
  return shop.ops.indexOf(o) >= 0 ? o : shop.ops[0];
}
function shopPicker() {
  var s = currentShop();
  if (!SHOPS.length) return '<div class="picker"></div>';
  var html = '<div class="picker"><label>' + esc(PL) + '<select id="pick-shop"><option value="">— оберіть —</option>' +
    SHOPS.map(function (x) { return '<option value="' + x.id + '"' + (s && s.id === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>';
  if (s && s.ops.length > 1) {
    var o = currentOp(s);
    html += '<label>Оператор<select id="pick-op">' + s.ops.map(function (x) { return '<option' + (x === o ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>';
  } else if (s) {
    html += '<div class="op1">Оператор: ' + esc(s.ops[0]) + '</div>';
  }
  return html + '</div>';
}

// ---------- Подання ----------
var main = document.getElementById('main');

function viewHome() {
  var h = '<section class="hero"><p>' + 'Знайдіть відповідь або бланк. <strong>' + esc(CFG.rule || '') + '</strong>' + '</p></section>';
  h += '<div class="grid">' + DATA.sections.map(function (s) {
    return '<a class="tile" href="#' + s.id + '"><span class="ico">' + (ICONS[s.num] || '•') + '</span><span>' + esc(s.name) + '</span><small>' + s.qs.length + ' питань</small></a>';
  }).join('') +
  '<a class="tile alt" href="#blanky"><span class="ico">🖨</span><span>Бланки для друку</span><small>' + FORMS.length + ' бланків</small></a>' +
  '<a class="tile alt" href="#yak"><span class="ico">ℹ️</span><span>Як користуватися</span><small>і QR-наклейки</small></a></div>';
  main.innerHTML = h;
}

function viewSection(s) {
  var h = '<a class="back" href="#">← Усі розділи</a><h2>' + (ICONS[s.num] || '') + ' ' + esc(s.name) + '</h2>';
  h += '<ul class="qlist">' + s.qs.map(function (q) { return '<li><a href="#q-' + q.id + '">' + esc(q.title) + '</a></li>'; }).join('') + '</ul>';
  if (s.notes) h += '<div class="note">' + s.notes + '</div>';
  main.innerHTML = h;
}

function viewQuestion(q) {
  var s = q.section, idx = s.qs.indexOf(q);
  var h = '<a class="back" href="#' + s.id + '">← ' + esc(s.name) + '</a><article class="card"><h2>' + esc(q.title) + '</h2>' + q.html + '</article>';
  var others = s.qs.filter(function (x) { return x !== q; }).slice(0, 4);
  if (others.length) h += '<h3 class="more">Ще в цьому розділі</h3><ul class="qlist">' + others.map(function (x) { return '<li><a href="#q-' + x.id + '">' + esc(x.title) + '</a></li>'; }).join('') + '</ul>';
  h += '<div class="ask">Не знайшли відповіді? Зателефонуйте ' + esc(CFG.askWho || 'старшому') + '.</div>';
  main.innerHTML = h;
  void idx;
}

function viewForms() {
  var h = '<a class="back" href="#">← Усі розділи</a><h2>🖨 Бланки для друку</h2>' +
    '<p class="sub">Оберіть заклад — його назва, адреса й оператор будуть у шапці бланка.</p>' + shopPicker();
  h += '<ul class="flist">' + FORMS.map(function (f) {
    return '<li><div><strong>' + esc(f.title) + '</strong><small>' + esc(f.when) + ' · на основі ' + esc(f.basis) + '</small></div><button class="btn" data-print="' + f.id + '">Друкувати</button></li>';
  }).join('') + '</ul>';
  if (inFrame) h += '<p class="warn">У попередньому перегляді друк може бути заблоковано. На робочому сайті кнопка «Друкувати» відкриває друк або збереження в PDF.</p>';
  main.innerHTML = h;
}

function viewHelp() {
  var h = '<a class="back" href="#">← Усі розділи</a><h2>ℹ️ Як користуватися</h2>' + (DATA.intro ? DATA.intro.html : '');
  h += '<h3>Як додати довідник на телефон</h3><ol><li>Відкрийте посилання з робочої групи.</li><li>Android (Chrome): меню ⋮ → «Додати на головний екран».</li><li>iPhone (Safari): кнопка «Поділитися» → «На екран „Додому“».</li></ol>';
  h += '<h3>QR-наклейки</h3><p>Для старшого зміни: <a href="#qr">аркуш QR-наклейок для друку</a> і плакат А4 з QR-кодом на головну сторінку довідника. Наклейте їх на холодильник, піч, вітрину, біля рукомийника і мийки для яєць — працівник наводить камеру й одразу бачить відповідь.</p>';
  main.innerHTML = h;
}

function viewQR() {
  var saved = store('qr-base');
  var guess = inFrame ? (CFG.siteUrl || '') : location.href.split('#')[0];
  var base = saved || guess;
  var sel = (store('qr-sel2') || QR_DEFAULT.join(',')).split(',');
  var h = '<a class="back" href="#yak">← Як користуватися</a><h2>QR-наклейки</h2>' +
    '<label class="full">Адреса сайту довідника<input id="qr-base" type="url" placeholder="https://..." value="' + esc(base) + '"></label>' +
    '<div class="actions"><button class="btn ghost" id="qr-poster">🖨 Плакат А4: QR на головну сторінку</button></div>' +
    '<p class="sub">Позначте наклейки:</p><div class="qsel">' +
    '<label><input type="checkbox" value="home"' + (sel.indexOf('home') >= 0 ? ' checked' : '') + '> <b>Головна сторінка довідника (усі відповіді і бланки)</b></label>' +
    ALLQ.map(function (q) { return '<label><input type="checkbox" value="' + q.id + '"' + (sel.indexOf(q.id) >= 0 ? ' checked' : '') + '> ' + esc(q.title) + '</label>'; }).join('') +
    '</div><button class="btn" id="qr-go">Показати аркуш для друку</button><div id="qr-sheet"></div>';
  main.innerHTML = h;
  $('#qr-go').onclick = buildQR;
  $('#qr-poster').onclick = printPoster;
  if (base) buildQR();
}

function qrSvg(text) {
  var qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  var n = qr.getModuleCount(), p = [];
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) p.push('M' + c + ' ' + r + 'h1v1h-1z');
  return '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/><path d="' + p.join('') + '" fill="#000"/></svg>';
}

function buildQR() {
  var base = ($('#qr-base').value || '').trim();
  var ids = Array.prototype.map.call(document.querySelectorAll('.qsel input:checked'), function (x) { return x.value; });
  store('qr-base', base); store('qr-sel2', ids.join(','));
  var out = $('#qr-sheet');
  if (!/^https?:\/\//.test(base)) { out.innerHTML = '<p class="warn">Вкажіть адресу сайту (починається з https://), щоб QR-коди вели на неї.</p>'; return; }
  base = base.split('#')[0];
  var cards = ids.map(function (id) {
    if (id === 'home') return '<div class="sticker home"><div class="qr">' + qrSvg(base) + '</div><div class="st-t">' + esc(CFG.title) + ' — усі відповіді і бланки</div><div class="st-s">Наведіть камеру телефону · ' + esc(CFG.brand) + '</div></div>';
    var q = ALLQ.filter(function (x) { return x.id === id; })[0]; if (!q) return '';
    return '<div class="sticker"><div class="qr">' + qrSvg(base + '#q-' + id) + '</div><div class="st-t">' + esc(q.title) + '</div><div class="st-s">Наведіть камеру телефону · ' + esc(CFG.title) + '</div></div>';
  }).join('');
  out.innerHTML = '<div class="actions"><button class="btn" id="qr-print">Друкувати аркуш</button></div><div class="stickers print-area">' + cards + '</div>';
  $('#qr-print').onclick = function () { doPrint(out.querySelector('.stickers').outerHTML, true); };
}

function printPoster() {
  var base = ($('#qr-base').value || '').trim();
  if (!/^https?:\/\//.test(base)) { alert('Вкажіть адресу сайту (починається з https://)'); return; }
  base = base.split('#')[0]; store('qr-base', base);
  doPrint('<div class="poster">' + (CFG.logo ? '<img class="p-logo" src="' + esc(CFG.logo) + '" alt="">' : '') + '<div class="p-t">' + esc((CFG.logo ? '' : CFG.emoji + ' ') + CFG.title) + '</div><div class="p-s">' + esc(CFG.brand) + '</div><div class="p-qr">' + qrSvg(base) + '</div>' +
    '<div class="p-c">Наведіть камеру телефону на код</div><ul class="p-l"><li>що робити, якщо щось пішло не так</li><li>яйця, випікання, охолодження, строки, алергени</li><li>миття, гігієна, температури</li><li>бланки і журнали для друку</li></ul><div class="p-u">' + esc(base) + '</div></div>', true);
}

function viewSearch(term) {
  var t = term.toLowerCase().trim();
  var words = t.split(/\s+/).filter(Boolean);
  var hits = ALLQ.map(function (q) {
    var score = 0;
    words.forEach(function (w) { var stem = w.length > 5 ? w.slice(0, w.length - 2) : w; if (q.title.toLowerCase().indexOf(stem) >= 0) score += 3; else if (q.text.indexOf(stem) >= 0) score += 1; else score -= 10; });
    return { q: q, s: score };
  }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
  var fh = FORMS.filter(function (f) { return words.every(function (w) { return f.title.toLowerCase().indexOf(w.slice(0, Math.max(3, w.length - 2))) >= 0; }); });
  var h = '<h2>Пошук: «' + esc(term) + '»</h2>';
  if (!hits.length && !fh.length) h += '<p>Нічого не знайдено. Спробуйте інше слово або <a href="#">перегляньте розділи</a>.</p>';
  h += '<ul class="qlist">' + hits.map(function (x) { return '<li><a href="#q-' + x.q.id + '">' + esc(x.q.title) + '<small>' + esc(x.q.section.name) + '</small></a></li>'; }).join('') + '</ul>';
  if (fh.length) h += '<h3 class="more">Бланки</h3><div class="forms-row">' + fh.map(function (f) { return '<button class="chip" data-print="' + f.id + '">🖨 ' + esc(f.title) + '</button>'; }).join('') + '</div>';
  main.innerHTML = h;
}

// ---------- Друк бланків ----------
function formHtml(f) {
  var shop = currentShop(), op = currentOp(shop);
  var head = '<div class="f-head"><div><div class="f-org">' + esc(op || '______________________________') + '</div><div>' + esc(shop ? shop.name + (CITY ? ', ' + CITY : '') : '______________________________') + '</div></div>' +
    '<div class="f-code">' + esc(f.basis) + '<br>Система НАССР</div></div>' +
    '<h1 class="f-title">' + esc(f.title) + '</h1>' + (f.date === 'number' || f.fields ? '<div class="f-period">№ ______ від «____» ______________ 20___ р.</div>' : '<div class="f-period">' + (f.date === 'day' ? 'Дата: «____» ______________ 20___ р.' : 'Період: з «____» __________ 20___ р. по «____» __________ 20___ р.') + '</div>');
  var body = '';
  if (f.intro) body += '<p class="f-intro">' + esc(f.intro) + '</p>';
  if (f.fields) {
    body += '<table class="f-fields">' + f.fields.map(function (x) { return '<tr><th>' + esc(x) + '</th><td></td></tr>'; }).join('') + '</table>';
  }
  (f.parts || []).forEach(function (p) {
    if (p.caption) body += '<div class="f-cap">' + esc(p.caption) + '</div>';
    var cg = '<colgroup>' + p.widths.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup>';
    var th = '<thead><tr>' + p.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead>';
    var rows = '';
    (p.fixed || []).forEach(function (r) { rows += '<tr>' + p.cols.map(function (c, i) { return '<td>' + esc(r[i] || '') + '</td>'; }).join('') + '</tr>'; });
    for (var i = 0; i < p.rows; i++) rows += '<tr>' + p.cols.map(function () { return '<td></td>'; }).join('') + '</tr>';
    body += '<table class="f-grid">' + cg + th + '<tbody>' + rows + '</tbody></table>';
  });
  return '<div class="form-page ' + (f.portrait ? 'portrait' : 'landscape') + '">' + head + body + '</div>';
}

function doPrint(html, portrait) {
  var area = document.getElementById('print-root');
  area.innerHTML = html;
  document.getElementById('page-style').textContent = '@page{size:A4 ' + (portrait ? 'portrait' : 'landscape') + ';margin:10mm}';
  document.body.classList.add('printing');
  setTimeout(function () {
    try { window.print(); } catch (e) { /* ignore */ }
  }, 50);
}

function pdfName(f) {
  var s = currentShop();
  return 'pdf/' + f.id + (s ? '--' + s.id + '-' + s.ops.indexOf(currentOp(s)) : '') + '.pdf';
}
var pdfBlob = null, pdfFor = '';
function prefetchPdf(url) {
  pdfBlob = null; pdfFor = url;
  if (!window.fetch) return;
  fetch(url).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (b) { if (pdfFor === url) pdfBlob = b; }).catch(function () {});
}
function canShareFiles() {
  try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; }
}
var standalone = (function () { try { return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; } })();
function mMsg(t) { var m = $('#m-msg'); if (m) { m.textContent = t; m.hidden = !t; } }
window.__dovForm = function (id) { var f = FORMS.filter(function (x) { return x.id === id; })[0]; doPrint(formHtml(f), f.portrait); };

var curForm = null;
function updPdf() { if (curForm) { prefetchPdf(pdfName(curForm)); renderPreview(); } }
function sharePdf(f) {
  var url = pdfName(f);
  mMsg('');
  var go = function (blob) { return navigator.share({ files: [new File([blob], url.split('/').pop(), { type: 'application/pdf' })], title: f.title }); };
  var p = (pdfBlob && pdfFor === url) ? go(pdfBlob) :
    fetch(url).then(function (r) { if (!r.ok) throw new Error('http'); return r.blob(); }).then(function (b) { pdfBlob = b; pdfFor = url; return go(b); });
  p.catch(function (e) {
    if (e && e.name === 'AbortError') return;
    if (e && e.name === 'NotAllowedError') { mMsg('Бланк готовий. Натисніть «Друкувати» ще раз.'); return; }
    mMsg('Не вдалося підготувати бланк. Перевірте інтернет і спробуйте ще раз.');
  });
}
function renderPreview() {
  var pv = $('#preview'); if (!pv || pv.hidden || !curForm) return;
  var f = curForm, holder = $('.pv-scroll', pv);
  holder.innerHTML = '<div class="pv-sheet"><div class="pv-page ' + (f.portrait ? 'pv-p' : 'pv-l') + '">' + formHtml(f) + '</div></div>';
  var page = $('.pv-page', holder), sheet = $('.pv-sheet', holder);
  var avail = holder.clientWidth - 16, w = page.offsetWidth, k = Math.min(1, avail / w);
  page.style.transform = 'scale(' + k + ')';
  sheet.style.width = (w * k) + 'px'; sheet.style.height = (page.offsetHeight * k) + 'px';
}
function closePreview() { var pv = $('#preview'); if (pv) pv.hidden = true; document.body.classList.remove('pv-open'); curForm = null; }
function doPrintCurrent() {
  var f = curForm; if (!f) return;
  if (isMobile || inApp) {
    if (canShareFiles()) return sharePdf(f);
    if (!standalone) { window.open(pdfName(f), '_blank'); return; }
  }
  doPrint(formHtml(f), f.portrait);
}
function printForm(id) {
  var f = FORMS.filter(function (x) { return x.id === id; })[0]; if (!f) return;
  var pv = $('#preview');
  if (!pv) {
    pv = document.createElement('div'); pv.id = 'preview';
    pv.innerHTML = '<div class="pv-top"><div class="pv-title"></div><div class="pv-shop"></div><p id="m-msg" class="warn" hidden></p></div>' +
      '<div class="pv-scroll"></div>' +
      '<div class="pv-bar"><button class="btn ghost" id="pv-back">← Назад</button><button class="btn" id="pv-print">🖨 Друкувати</button></div>';
    document.body.appendChild(pv);
    $('#pv-back').onclick = closePreview;
    $('#pv-print').onclick = doPrintCurrent;
    window.addEventListener('resize', renderPreview);
  }
  curForm = f; pv.hidden = false; document.body.classList.add('pv-open');
  $('.pv-title', pv).textContent = f.title;
  $('.pv-shop', pv).innerHTML = shopPicker() + (inApp ? '<p class="warn">Ви відкрили довідник усередині Viber/Telegram. Якщо друк не відкривається, натисніть ⋮ угорі → «Відкрити в браузері».</p>' : '');
  mMsg('');
  prefetchPdf(pdfName(f));
  renderPreview();
}

function showModal(h) { var m = $('#modal'); $('#modal .box').innerHTML = h; m.hidden = false; }
function hideModal() { $('#modal').hidden = true; }

// ---------- Маршрутизація ----------
function route() {
  var h = location.hash.replace(/^#/, '');
  window.scrollTo(0, 0);
  if (!h) return viewHome();
  if (h === 'blanky') return viewForms();
  if (h === 'yak') return viewHelp();
  if (h === 'qr') return viewQR();
  if (/^q-/.test(h)) { var q = ALLQ.filter(function (x) { return 'q-' + x.id === h; })[0]; if (q) return viewQuestion(q); }
  var s = DATA.sections.filter(function (x) { return x.id === h; })[0]; if (s) return viewSection(s);
  viewHome();
}

document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-print]');
  if (b) { e.preventDefault(); printForm(b.getAttribute('data-print')); return; }
  if (e.target.id === 'modal') hideModal();
});
document.addEventListener('change', function (e) {
  if (e.target.id === 'pick-shop') { store('shop', e.target.value); var box = e.target.closest('.picker'); box.outerHTML = shopPicker(); updPdf(); }
  if (e.target.id === 'pick-op') { var s = currentShop(); if (s) store('op-' + s.id, e.target.value); updPdf(); }
});
var sf = document.getElementById('search');
var timer;
sf.addEventListener('input', function () {
  clearTimeout(timer);
  timer = setTimeout(function () { var v = sf.value.trim(); if (v.length >= 2) viewSearch(v); else route(); }, 150);
});
document.getElementById('search-form').addEventListener('submit', function (e) { e.preventDefault(); sf.blur(); });
document.getElementById('home').addEventListener('click', function () { sf.value = ''; });
window.addEventListener('hashchange', function () { sf.value = ''; closePreview(); route(); });
route();

if ('serviceWorker' in navigator && !inFrame && location.protocol === 'https:') {
  try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) { /* ignore */ }
}
})();
