#!/bin/sh
while [ "$(docker ps --format "{{.Image}}" | grep -c node:20-bookworm)" -ge 2 ]; do sleep 20; done
docker run --rm -v /root/mm-fix/seo-keywords:/app -v /root/mm-build/node_modules:/app/node_modules:ro -w /app -e NODE_OPTIONS=--max-old-space-size=2560 node:20-bookworm-slim npx vite build > /root/mm-fix/seo-keywords-build.log 2>&1
echo rc=$? >> /root/mm-fix/seo-keywords-build.log
