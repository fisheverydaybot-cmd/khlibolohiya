# Збирає сайт: python3 src/build.py <папка>   (без папки — у _site)
# Бере src/content.md (текст), src/settings.json (назви, заклади), src/forms.json (бланки).
import json, os, sys
d = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(d), '_site')
os.makedirs(out, exist_ok=True)
rd = lambda n: open(os.path.join(d, n), encoding='utf-8').read()
cfg = json.loads(rd('settings.json'))     # якщо тут помилка — у settings.json зламана кома чи лапка
forms = json.loads(rd('forms.json'))      # те саме для forms.json
md, qr, app, t = rd('content.md'), rd('package/qrcode.js'), rd('app.js'), rd('template.html')
ids = [f['id'] for f in forms]
assert len(ids) == len(set(ids)), 'у forms.json два бланки з однаковим id'
for f in forms:
    for p in f.get('parts', []):
        assert len(p['cols']) == len(p['widths']), 'бланк %s: кількість колонок не збігається з widths' % f['id']
sj = json.dumps(cfg, ensure_ascii=False).replace('</', '<\\/')
fj = json.dumps(forms, ensure_ascii=False).replace('</', '<\\/')
for x in (md, qr, app): assert '</script' not in x.lower()
c = cfg.get('colors', {})
html = (t.replace('__TITLE__', cfg['title']).replace('__BRAND__', cfg['brand'])
         .replace('__EMOJI__', cfg.get('emoji', '')).replace('__NOTE__', (' · ' + cfg['note']) if cfg.get('note') else '')
         .replace('__HINT__', cfg.get('searchHint', 'Пошук…'))
         .replace('__C2__', c.get('light', '#f7ecdd')).replace('__C__', c.get('main', '#8a4b14')).replace('__BG__', c.get('bg', '#faf7f2'))
         .replace('__SETTINGS__', sj).replace('__FORMS__', fj)
         .replace('__CONTENT__', md).replace('__QRLIB__', qr).replace('__APP__', app))
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
open(os.path.join(out, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps({
    "name": cfg['title'] + ' · ' + cfg['brand'], "short_name": "НАССР", "start_url": ".", "display": "standalone",
    "background_color": c.get('bg', '#faf7f2'), "theme_color": c.get('main', '#8a4b14'), "lang": "uk",
    "icons": [{"src": "icon.svg", "sizes": "any", "type": "image/svg+xml"},
              {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}]}, ensure_ascii=False, indent=1))
import hashlib
ver = hashlib.md5(html.encode()).hexdigest()[:8]
open(os.path.join(out, 'sw.js'), 'w').write("""const C='dovidnyk-%s';const F=['./','index.html','manifest.webmanifest','icon.svg','icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))))});
""" % ver)
for n in ('icon.svg', 'icon-192.png', 'icon-512.png'):
    src = os.path.join(d, 'icons', n)
    if os.path.exists(src) and os.path.abspath(out) != os.path.abspath(os.path.join(d, 'icons')):
        open(os.path.join(out, n), 'wb').write(open(src, 'rb').read())
print('ok', len(html), 'бланків:', len(forms))
