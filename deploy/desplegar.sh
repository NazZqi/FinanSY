#!/bin/sh
# Uso en el servidor, desde /mnt/datos/finansy/src:
#   deploy/desplegar.sh qa     compila HEAD y lo publica en QA
#   deploy/desplegar.sh prod   publica en prod la imagen que ya está en QA
set -eu
cd "$(dirname "$0")/.."
case "${1:-}" in
  qa)
    sha=$(git rev-parse --short HEAD)
    podman build -t "localhost/finansy:$sha" .
    podman tag "localhost/finansy:$sha" localhost/finansy:qa
    port=3103
    ;;
  prod)
    podman tag localhost/finansy:qa localhost/finansy:prod
    port=3104
    ;;
  *)
    echo "uso: $0 qa|prod" >&2
    exit 1
    ;;
esac
systemctl --user restart "finansy-$1.service"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$port/salud" >/dev/null 2>&1; then
    echo "finansy-$1 responde en el puerto $port"
    exit 0
  fi
  sleep 2
done
echo "finansy-$1 no responde: revisa journalctl --user -u finansy-$1.service" >&2
exit 1
