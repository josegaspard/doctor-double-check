import { chromium } from '/Users/josegaspard/clients/conciertos-global/node_modules/playwright/index.mjs';
const b = await chromium.launch();
for(const [lang,label] of [['de','ALEMÁN'],['fr','FRANCÉS']]){
  const p = await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await p.addInitScript((l)=>{ try{localStorage.setItem('preferred_language',l);}catch(e){} }, lang);
  for(const r of ['/', '/login', '/app']){
    await p.goto('https://medical-masters.com'+r,{waitUntil:'networkidle',timeout:45000}).catch(()=>{});
    await p.waitForTimeout(1500);
    const res=await p.evaluate(()=>{
      const vw=document.documentElement.clientWidth;
      const overflowX=document.documentElement.scrollWidth-vw;
      const clipped=[];
      document.querySelectorAll('button,a,[role="tab"],h1,h2,span,p').forEach(el=>{
        if(el.scrollWidth>el.clientWidth+3 && el.clientWidth>30 && (el.innerText||'').trim().length>2 && el.getBoundingClientRect().height>0 && el.children.length===0){
          clipped.push((el.innerText||'').trim().slice(0,30));
        }
      });
      return {overflowX, lang:localStorage.getItem('preferred_language'), clipped:[...new Set(clipped)].slice(0,6)};
    });
    console.log(`[${label}] ${r} lang=${res.lang} overflowX=${res.overflowX} clipped:`, res.clipped.join(' | ')||'(ninguno)');
  }
  await p.close();
}
await b.close();
