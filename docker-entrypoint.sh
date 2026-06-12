#!/bin/bash
set -euo pipefail

cd /app

ENV_FILE=/app/config/.env
SETUP_FILE=/app/config/.setup-completed

# 容器内需要持久化这些目录，避免重建容器后丢失配置、数据和日志
mkdir -p /app/config /app/data /app/logs

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
}

get_file_value() {
  local key="$1"
  node -e "const fs=require('fs'); const dotenv=require('dotenv'); const p=process.argv[1]; const k=process.argv[2]; if (fs.existsSync(p)) { const parsed=dotenv.parse(fs.readFileSync(p)); if (Object.prototype.hasOwnProperty.call(parsed, k)) process.stdout.write(parsed[k] ?? ''); }" "$ENV_FILE" "$key"
}

pick_value() {
  local key="$1"
  local default_value="$2"
  local env_value="${!key-}"
  local file_value=""

  if [ -n "$env_value" ]; then
    printf '%s' "$env_value"
    return
  fi

  file_value="$(get_file_value "$key")"
  if [ -n "$file_value" ]; then
    printf '%s' "$file_value"
    return
  fi

  printf '%s' "$default_value"
}

write_dotenv_line() {
  local key="$1"
  local value="$2"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s="%s"\n' "$key" "$value"
}

sync_env_file() {
  NODE_ENV_VALUE="$(pick_value NODE_ENV production)"
  PORT_VALUE="$(pick_value PORT 14558)"
  AUTH_PORT_VALUE="$(pick_value AUTH_PORT 2233)"
  AUTH_SERVICE_URL_VALUE="$(pick_value AUTH_SERVICE_URL http://127.0.0.1:2233)"
  ALLOWED_ORIGINS_VALUE="$(pick_value ALLOWED_ORIGINS http://localhost:14558,http://127.0.0.1:14558)"

  ENCRYPTION_KEY_VALUE="$(pick_value ENCRYPTION_KEY "")"
  JWT_SECRET_VALUE="$(pick_value JWT_SECRET "")"
  if [ -z "$ENCRYPTION_KEY_VALUE" ]; then
    ENCRYPTION_KEY_VALUE="$(generate_secret)"
  fi
  if [ -z "$JWT_SECRET_VALUE" ]; then
    JWT_SECRET_VALUE="$(generate_secret)"
  fi

  DATABASE_STORAGE_VALUE="$(pick_value DATABASE_STORAGE mysql)"
  MYSQL_HOST_VALUE="$(pick_value MYSQL_HOST host.docker.internal)"
  MYSQL_PORT_VALUE="$(pick_value MYSQL_PORT 3306)"
  MYSQL_USER_VALUE="$(pick_value MYSQL_USER kiro)"
  MYSQL_PASSWORD_VALUE="$(pick_value MYSQL_PASSWORD "")"
  MYSQL_DATABASE_VALUE="$(pick_value MYSQL_DATABASE KrioServer)"

  REDIS_HOST_VALUE="$(pick_value REDIS_HOST host.docker.internal)"
  REDIS_PORT_VALUE="$(pick_value REDIS_PORT 6379)"
  REDIS_PASSWORD_VALUE="$(pick_value REDIS_PASSWORD "")"
  REDIS_DB_VALUE="$(pick_value REDIS_DB 0)"

  LOG_LEVEL_VALUE="$(pick_value LOG_LEVEL info)"
  KIRO_AUTO_SETUP_FROM_ENV_VALUE="$(pick_value KIRO_AUTO_SETUP_FROM_ENV true)"

  {
    write_dotenv_line NODE_ENV "$NODE_ENV_VALUE"
    write_dotenv_line PORT "$PORT_VALUE"
    write_dotenv_line AUTH_PORT "$AUTH_PORT_VALUE"
    write_dotenv_line AUTH_SERVICE_URL "$AUTH_SERVICE_URL_VALUE"
    write_dotenv_line ALLOWED_ORIGINS "$ALLOWED_ORIGINS_VALUE"
    echo
    write_dotenv_line ENCRYPTION_KEY "$ENCRYPTION_KEY_VALUE"
    write_dotenv_line JWT_SECRET "$JWT_SECRET_VALUE"
    echo
    write_dotenv_line DATABASE_STORAGE "$DATABASE_STORAGE_VALUE"
    write_dotenv_line MYSQL_HOST "$MYSQL_HOST_VALUE"
    write_dotenv_line MYSQL_PORT "$MYSQL_PORT_VALUE"
    write_dotenv_line MYSQL_USER "$MYSQL_USER_VALUE"
    write_dotenv_line MYSQL_PASSWORD "$MYSQL_PASSWORD_VALUE"
    write_dotenv_line MYSQL_DATABASE "$MYSQL_DATABASE_VALUE"
    echo
    write_dotenv_line REDIS_HOST "$REDIS_HOST_VALUE"
    write_dotenv_line REDIS_PORT "$REDIS_PORT_VALUE"
    write_dotenv_line REDIS_PASSWORD "$REDIS_PASSWORD_VALUE"
    write_dotenv_line REDIS_DB "$REDIS_DB_VALUE"
    echo
    write_dotenv_line LOG_LEVEL "$LOG_LEVEL_VALUE"
    write_dotenv_line KIRO_AUTO_SETUP_FROM_ENV "$KIRO_AUTO_SETUP_FROM_ENV_VALUE"
  } > "${ENV_FILE}.tmp"

  mv "${ENV_FILE}.tmp" "$ENV_FILE"

  export NODE_ENV="$NODE_ENV_VALUE"
  export PORT="$PORT_VALUE"
  export AUTH_PORT="$AUTH_PORT_VALUE"
  export AUTH_SERVICE_URL="$AUTH_SERVICE_URL_VALUE"
  export ALLOWED_ORIGINS="$ALLOWED_ORIGINS_VALUE"
  export ENCRYPTION_KEY="$ENCRYPTION_KEY_VALUE"
  export JWT_SECRET="$JWT_SECRET_VALUE"
  export DATABASE_STORAGE="$DATABASE_STORAGE_VALUE"
  export MYSQL_HOST="$MYSQL_HOST_VALUE"
  export MYSQL_PORT="$MYSQL_PORT_VALUE"
  export MYSQL_USER="$MYSQL_USER_VALUE"
  export MYSQL_PASSWORD="$MYSQL_PASSWORD_VALUE"
  export MYSQL_DATABASE="$MYSQL_DATABASE_VALUE"
  export REDIS_HOST="$REDIS_HOST_VALUE"
  export REDIS_PORT="$REDIS_PORT_VALUE"
  export REDIS_PASSWORD="$REDIS_PASSWORD_VALUE"
  export REDIS_DB="$REDIS_DB_VALUE"
  export LOG_LEVEL="$LOG_LEVEL_VALUE"
  export KIRO_AUTO_SETUP_FROM_ENV="$KIRO_AUTO_SETUP_FROM_ENV_VALUE"
}

maybe_mark_setup_complete() {
  local auto_setup="${KIRO_AUTO_SETUP_FROM_ENV,,}"

  if [ "$auto_setup" != "true" ] && [ "$auto_setup" != "1" ] && [ "$auto_setup" != "yes" ]; then
    return
  fi

  if [ -f "$SETUP_FILE" ]; then
    return
  fi

  if [ "$DATABASE_STORAGE" = "mysql" ]; then
    if [ -n "$MYSQL_HOST" ] && [ -n "$MYSQL_USER" ] && [ -n "$MYSQL_PASSWORD" ] && [ -n "$MYSQL_DATABASE" ]; then
      date -Iseconds > "$SETUP_FILE"
      echo "已根据环境变量标记初始化配置完成，启动时将连接 MySQL。"
    fi
    return
  fi

  if [ "$DATABASE_STORAGE" = "redis" ]; then
    if [ -n "$REDIS_HOST" ]; then
      date -Iseconds > "$SETUP_FILE"
      echo "已根据环境变量标记初始化配置完成，启动时将连接 Redis。"
    fi
  fi
}

sync_env_file

# 让现有代码继续使用 process.cwd() 下的 .env 和 .setup-completed
ln -sfn "$ENV_FILE" /app/.env
if [ ! -e /app/.setup-completed ] && [ ! -L /app/.setup-completed ]; then
  ln -s "$SETUP_FILE" /app/.setup-completed
fi

maybe_mark_setup_complete

shutdown() {
  trap - SIGINT SIGTERM
  if [ -n "${MAIN_PID:-}" ] && kill -0 "$MAIN_PID" 2>/dev/null; then
    kill -TERM "$MAIN_PID" 2>/dev/null || true
  fi
  if [ -n "${AUTH_PID:-}" ] && kill -0 "$AUTH_PID" 2>/dev/null; then
    kill -TERM "$AUTH_PID" 2>/dev/null || true
  fi
  wait "$MAIN_PID" "$AUTH_PID" 2>/dev/null || true
}

trap shutdown SIGINT SIGTERM

node dist/auth-service/index.js &
AUTH_PID=$!

node dist/index.js &
MAIN_PID=$!

set +e
wait -n "$MAIN_PID" "$AUTH_PID"
STATUS=$?
shutdown
exit "$STATUS"
