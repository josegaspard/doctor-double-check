def sub(path, old, new, count=1):
    s=open(path).read()
    n=s.count(old)
    assert n>=1, (path, old)
    if count==1: assert n==1,(path,old,n)
    s=s.replace(old,new) if count!=1 else s.replace(old,new,1)
    open(path,"w").write(s); print("ok",path,n)
# R1
sub("src/components/doctor/schedule/ScheduleEditor.tsx",'<div className="sticky bottom-3 z-20">','<div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] sm:bottom-3 z-20">')
# R2
sub("src/components/layout/MainLayout.tsx",'pb-[72px] sm:pb-0 overflow-x-clip min-h-[calc(100vh-56px-72px)]','pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-0 overflow-x-clip min-h-[calc(100vh-56px-72px-env(safe-area-inset-bottom))]')
# R7 bottom nav
sub("src/components/layout/MainLayout.tsx",'text-[10.5px] font-medium leading-tight','text-[11px] font-medium leading-tight',count=2)
# R3
s=open("index.html").read()
s2=s.replace(", maximum-scale=1.0, user-scalable=no","")
assert s2!=s; open("index.html","w").write(s2); print("ok index.html")
# R4
sub("src/pages/Landing.tsx",'<div className="relative h-14">','<div className="relative h-10 min-[360px]:h-14">')
# R7
for f,old,new in [("src/pages/Landing.tsx","text-[10px]","text-[11px]"),
                  ("src/pages/MedicalMarketplace.tsx","text-[10px]","text-[11px]"),
                  ("src/pages/MedicalMarketplace.tsx","text-[10.5px]","text-[11px]"),
                  ("src/pages/Notifications.tsx","text-[10px]","text-[11px]")]:
    sub(f,old,new,count=0)
sub("src/components/layout/UnifiedFooter.tsx",'text-[11px] sm:text-xs text-white mb-3','text-xs text-white mb-3')
sub("src/styles/diseno-comunidad.css","font-size: 10.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;","font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;")
sub("src/index.css","  font-size: 10.5px; font-weight: 700; letter-spacing: .01em; white-space: nowrap; flex-shrink: 0;","  font-size: 11px; font-weight: 700; letter-spacing: .01em; white-space: nowrap; flex-shrink: 0;")
# R5
sub("src/pages/MedicalMarketplace.tsx",'<img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />','<img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" onError={e => { const img = e.currentTarget; if (!img.src.endsWith(\'/placeholder.svg\')) img.src = \'/placeholder.svg\'; }} />')
# R6 header
sub("src/index.css","  height: 38px !important;\n  min-height: 38px !important;\n  min-width: 38px !important;\n  border-radius: 11px !important;","  height: 40px !important;\n  min-height: 40px !important;\n  min-width: 40px !important;\n  border-radius: 11px !important;")
sub("src/components/layout/UnifiedFooter.tsx","inline-flex min-h-[36px] items-center sm:min-h-0","inline-flex min-h-[40px] items-center sm:min-h-0")
sub("src/index.css",".pro-lane-row .pro-lane-item { width: auto; flex: 0 0 auto; height: 38px;",".pro-lane-row .pro-lane-item { width: auto; flex: 0 0 auto; height: 40px;")
sub("src/components/common/SectionTabs.tsx","'inline-flex flex-none items-center gap-2 h-9 px-3.5","'inline-flex flex-none items-center gap-2 h-10 sm:h-9 px-3.5")
sub("src/components/common/SectionTabs.tsx","'flex items-center gap-1 p-1 rounded-2xl max-w-full overflow-x-auto',","'mm-scroll-fade flex items-center gap-1 p-1 rounded-2xl max-w-full overflow-x-auto',")
# R8 doctors
sub("src/pages/Doctors.tsx",'<div className="flex gap-2 mb-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">\n        <div className="md:hidden flex gap-2">','<div className="mm-scroll-fade flex gap-2 mb-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">\n        <div className="md:hidden flex gap-2">')
s=open("src/pages/Doctors.tsx").read()
i=s.index('<div className="md:hidden flex gap-2">'); j=s.index("        </div>\n        <button",i)
blk=s[i:j]
for key in ["specialtyLabel","cityLabel","hospitalLabel"]:
    old="placeholder={t('mm2.community.%s')}"%key
    assert blk.count(old)==1,key
    ind = blk[:blk.index(old)].rsplit("\n",1)[1]
    blk=blk.replace(old, old+"\n"+ind+"label={t('mm2.community.%s')}"%key)
s=s[:i]+blk+s[j:]; open("src/pages/Doctors.tsx","w").write(s); print("ok doctors labels")
# R10
sub("src/App.tsx",'                      <Route path="/login" element={<Login />} />','                      <Route path="/login" element={<Login />} />\n                      <Route path="/register" element={<Navigate to="/login" replace state={{ mode: \'signup\' }} />} />\n                      <Route path="/signup" element={<Navigate to="/login" replace state={{ mode: \'signup\' }} />} />')
