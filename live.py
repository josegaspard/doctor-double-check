import asyncio
from playwright.async_api import async_playwright
CASES=[(390,750,'0px','0px','iPhone 14/15 Safari'),(390,844,'59px','34px','iPhone notch app'),
       (360,730,'0px','0px','Android estandar'),(375,667,'0px','0px','iPhone SE'),
       (844,390,'0px','0px','movil horizontal'),(768,1024,'0px','0px','tablet'),(1440,900,'0px','0px','escritorio')]
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch()
        for w,h,sat,sab,name in CASES:
            ctx=await b.new_context(viewport={"width":w,"height":h},device_scale_factor=2,
                                    is_mobile=w<700,has_touch=w<700,locale="es-MX")
            pg=await ctx.new_page()
            await pg.goto("https://medical-masters.com/?rev=2",wait_until="networkidle",timeout=60000)
            await pg.evaluate(f"()=>{{document.documentElement.style.setProperty('--sat','{sat}');document.documentElement.style.setProperty('--sab','{sab}')}}")
            await pg.wait_for_timeout(1600)
            await pg.screenshot(path=f"LIVE2-{name.replace(' ','_')}.png")
            r=await pg.evaluate("""() => {
              const hero=document.querySelector('header');
              const bar=hero.querySelector('.mt-auto')||hero.querySelector('[class*=absolute][class*=bottom]');
              const cards=hero.querySelector('.md\\\\:hidden.land\\\\:hidden.flex.items-start');
              const sab=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab'))||0;
              const cb=cards?cards.getBoundingClientRect():null, bb=bar?bar.getBoundingClientRect():null;
              const sp=[...document.querySelectorAll('.animate-scroll span')].filter(s=>s.className.includes('nowrap'));
              return {hero:Math.round(hero.getBoundingClientRect().height),
                      finBarra:bb?Math.round(bb.bottom):null, util:Math.round(innerHeight-sab),
                      solape:(cb&&bb)?Math.round(cb.bottom-bb.top):null,
                      cintaComprimida:sp.filter(s=>s.scrollWidth>s.clientWidth+1).length,
                      desbordeX:document.documentElement.scrollWidth-innerWidth};
            }""")
            ok = r['finBarra'] is None or r['finBarra']<=r['util']
            print(f"{name:22s} {w}x{h} hero={r['hero']:4d} barra_fin={r['finBarra']} util={r['util']:4d} "
                  f"{'OK' if ok else 'FALTA '+str(r['finBarra']-r['util'])} solape={r['solape']} "
                  f"cinta_rota={r['cintaComprimida']} desbordeX={r['desbordeX']}")
            await ctx.close()
        await b.close()
asyncio.run(main())
