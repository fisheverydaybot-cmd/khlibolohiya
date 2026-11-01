// node src/gen_pdf.js <папка сайту> — готові PDF бланків для друку з телефона:
// pdf/<бланк>.pdf і pdf/<бланк>--<заклад>-<оператор>.pdf
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const dir=path.resolve(process.argv[2]||'.');fs.mkdirSync(dir+'/pdf',{recursive:true});
const src=path.dirname(__filename);
const cfg=JSON.parse(fs.readFileSync(src+'/settings.json','utf8'));
const FORMS=JSON.parse(fs.readFileSync(src+'/forms.json','utf8')).map(f=>f.id);
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.emulateMedia({media:'print'});
const url='file://'+dir+'/index.html';const variants=[[null,0,null]];
for(const s of cfg.points||[])s.ops.forEach((o,i)=>variants.push([s.id,i,o]));
let c=0;
for(const [s,i,o] of variants){await p.goto(url);
 await p.evaluate(([s,o])=>{localStorage.clear();if(s){localStorage.setItem('shop',s);localStorage.setItem('op-'+s,o);}},[s,o]);
 await p.goto(url+'#blanky');await p.reload();await p.evaluate(()=>{window.print=()=>{}});
 for(const f of FORMS){await p.evaluate(f=>window.__dovForm(f),f);await p.waitForTimeout(60);
  const name=f+(s?'--'+s+'-'+i:'')+'.pdf';await p.pdf({path:dir+'/pdf/'+name,preferCSSPageSize:true});c++;}}
console.log('pdf',c);await b.close();})();
