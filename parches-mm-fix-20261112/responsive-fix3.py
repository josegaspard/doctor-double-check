def sub(path, old, new):
    s=open(path).read(); assert s.count(old)==1,(path,old)
    open(path,"w").write(s.replace(old,new,1)); print("ok",path)
sub("src/pages/Landing.tsx",'<div className="relative h-10 min-[360px]:h-14">','<div className="mm-landing-logo relative h-14">')
sub("src/index.css","  .di-kpi-eye::after { content: ''; position: absolute; inset: -8px; }\n}\n",
 "  .di-kpi-eye::after { content: ''; position: absolute; inset: -8px; }\n}\n/* Portada a < 360 px: logo más bajo para que no pise el globo ni «Entrar». */\n@media (max-width: 359px) {\n  .landing-nav .mm-landing-logo { height: 2.5rem; }\n}\n")
