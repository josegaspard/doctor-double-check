#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  PUBLICAR medical-masters.com   ·   17-ago-2026
#  Doble clic en este fichero, o en la Terminal:  ./PUBLICAR.command
# ═══════════════════════════════════════════════════════════════════
cd "$(dirname "$0")" || exit 1
echo "▸ Proyecto: doctor-double-check  →  medical-masters.com"
echo

# Si no hay sesión de Vercel, la abre en el navegador. Hay que entrar con la
# cuenta DUEÑA del proyecto (team_r38BKKJzTFS2wCCzD85A4il1), NO con contacto-7685.
if ! vercel whoami >/dev/null 2>&1; then
  echo "▸ No hay sesión. Se abrirá el navegador para entrar en Vercel."
  echo "  ⚠️  Entra con la cuenta DUEÑA de doctor-double-check."
  vercel login || exit 1
  echo
fi

echo "▸ Publicando a producción…"
vercel --prod --yes || exit 1

echo
echo "▸ Comprobando que la web sirve el build nuevo…"
sleep 8
LIVE=$(curl -s https://medical-masters.com/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
LOCAL=$(ls dist/assets/index-*.js 2>/dev/null | head -1 | xargs basename 2>/dev/null)
echo "  en vivo: $LIVE"
echo "  local:   assets/$LOCAL"
[ "assets/$LOCAL" = "$LIVE" ] && echo "  ✅ LISTO — la web ya tiene los cambios" \
  || echo "  ⏳ la caché del CDN tarda un momento; recarga con Cmd+Shift+R"
