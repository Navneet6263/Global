#!/usr/bin/env bash
set -euo pipefail

log_name="${1:-}"
if [[ ! "$log_name" =~ ^api-[a-z0-9-]+\.log$ ]]; then
  echo "A safe api-*.log filename is required" >&2
  exit 2
fi

if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
  kill "$API_PID"
  for attempt in $(seq 1 30); do
    if ! kill -0 "$API_PID" 2>/dev/null; then break; fi
    sleep 1
  done
  if kill -0 "$API_PID" 2>/dev/null; then kill -KILL "$API_PID"; fi
fi

log_path="${RUNNER_TEMP:?RUNNER_TEMP is required}/$log_name"
nohup node backend/dist/main.js >"$log_path" 2>&1 &
api_pid=$!
echo "API_PID=$api_pid" >> "${GITHUB_ENV:?GITHUB_ENV is required}"

for attempt in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1:4000/api/v1/health/ready >/dev/null; then
    exit 0
  fi
  sleep 2
done

cat "$log_path"
kill "$api_pid" 2>/dev/null || true
exit 1
