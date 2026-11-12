#!/bin/bash
# Cola de builds de vite en el Basher (PAC-01, 11-nov-2026): deja correr 1 solo
# contenedor node:20-bookworm-slim con "vite build" y congela (docker pause) el resto;
# cuando termina el que corre, reanuda el siguiente (el más antiguo). Reversible:
# para soltarlo todo: pkill -f cola-builds.sh; docker ps -q --filter status=paused | xargs -r docker unpause
LOG=/root/mm-fix/cola-builds.log
idle=0
while :; do
  mapfile -t ids < <(docker ps --no-trunc --filter ancestor=node:20-bookworm-slim --format '{{.CreatedAt}}|{{.ID}}|{{.Command}}' | grep 'vite build' | sort | cut -d'|' -f2)
  if [ ${#ids[@]} -eq 0 ]; then idle=$((idle+1)); [ $idle -ge 120 ] && { echo "$(date +%T) sin builds 20 min, salgo" >>$LOG; exit 0; }; sleep 10; continue; fi
  idle=0
  running=(); paused=()
  for id in "${ids[@]}"; do
    st=$(docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null)
    [ "$st" = running ] && running+=("$id"); [ "$st" = paused ] && paused+=("$id")
  done
  if [ ${#running[@]} -gt 1 ]; then
    for id in "${running[@]:1}"; do docker pause "$id" >/dev/null && echo "$(date +%T) pausa $(docker inspect -f '{{.Name}}' $id)" >>$LOG; done
  elif [ ${#running[@]} -eq 0 ] && [ ${#paused[@]} -gt 0 ]; then
    docker unpause "${paused[0]}" >/dev/null && echo "$(date +%T) reanuda $(docker inspect -f '{{.Name}}' ${paused[0]})" >>$LOG
  fi
  sleep 5
done
