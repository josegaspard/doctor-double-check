#!/bin/bash
# Despliegue revisión total MM 11-nov. Requiere build con «built in».
set -e
grep -q "built in" /root/mm-fix/FINAL-build.log || { echo "SIN built in: no despliego"; exit 1; }
V=/srv/supabase-mm/docker/volumes/functions
B=/srv/backups/medical-masters/functions-antes-revision-total-20261111
mkdir -p $B/_shared $B/auth-email-hook $B/bunny-webhook $B/admin-api-usage
cp -a $V/_shared/seo-render.ts $B/_shared/; cp -a $V/auth-email-hook/index.ts $B/auth-email-hook/; cp -a $V/bunny-webhook/index.ts $B/bunny-webhook/; cp -a $V/admin-api-usage/index.ts $B/admin-api-usage/
cp /srv/mm-seo/supabase/functions/_shared/seo-render.ts $B/mm-seo-seo-render.ts
cp /srv/mm-seo/scripts/seo-server.mjs $B/mm-seo-seo-server.mjs
# front
rsync -a /root/mm-build/dist/ /srv/sitios/medical-masters/
# edge
for f in _shared/seo-render.ts auth-email-hook/index.ts bunny-webhook/index.ts admin-api-usage/index.ts; do cp /root/mm-build/supabase/functions/$f $V/$f; done
# mm-seo
cp /root/mm-build/supabase/functions/_shared/seo-render.ts /srv/mm-seo/supabase/functions/_shared/seo-render.ts
systemctl restart mm-seo; sleep 2; systemctl is-active mm-seo
echo DEPLOY-OK
