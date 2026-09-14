#!/bin/sh
# Aplica as migrations antes de subir a aplicacao.
set -e

echo "[entrypoint] alembic upgrade head"
alembic upgrade head

echo "[entrypoint] iniciando: $*"
exec "$@"
