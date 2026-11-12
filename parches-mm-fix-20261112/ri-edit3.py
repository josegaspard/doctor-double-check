def rep(p, pairs):
    s=open(p,encoding="utf8").read()
    for a,b in pairs:
        n=s.count(a)
        assert n==1, (p, n, a[:60])
        s=s.replace(a,b)
    open(p,"w",encoding="utf8").write(s)
rep("src/App.tsx", [
("""// Prefetch popular route chunks during browser idle time
if (typeof window !== 'undefined') {
  const prefetch = () => {
    import("./pages/Doctors");""",
"""// Prefetch popular route chunks during browser idle time (solo con sesión y
// buena red: ver canDoBackgroundWork).
if (typeof window !== 'undefined') {
  const prefetch = () => {
    if (!canDoBackgroundWork()) return;
    import("./pages/Doctors");"""),
])
s=open("src/App.tsx",encoding="utf8").read()
# añade el import tras el último import de nivel superior
lines=s.split("\n")
last=max(i for i,l in enumerate(lines) if l.startswith("import ") )
# el import puede ocupar varias líneas: avanzar hasta la línea que termina en ;
j=last
while not lines[j].rstrip().endswith(";"):
    j+=1
lines.insert(j+1,'import { canDoBackgroundWork } from "@/lib/backgroundWork";')
open("src/App.tsx","w",encoding="utf8").write("\n".join(lines))
rep("src/main.tsx", [
("""import { initialLanguage } from "./contexts/LanguageContext";""",
"""import { initialLanguage } from "./contexts/LanguageContext";
import { canDoBackgroundWork } from "./lib/backgroundWork";"""),
("""    const warm = async () => {
      try {""",
"""    const warm = async () => {
      // Solo con sesión iniciada: los visitantes anónimos no abren grabaciones
      // ni cierran lives, y la portada no debe gastar red en esto.
      if (!canDoBackgroundWork()) return;
      try {"""),
])
print("ok")
