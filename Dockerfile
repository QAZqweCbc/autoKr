# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps

WORKDIR /app

# 先安装依赖，利用 Docker 层缓存减少重复构建时间
COPY package*.json ./
RUN npm ci

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

FROM deps AS build

COPY . .
RUN npm run build && npm run frontend:build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=14558 \
    AUTH_PORT=2233 \
    AUTH_SERVICE_URL=http://127.0.0.1:2233

WORKDIR /app

COPY package*.json ./

# 安装生产依赖和 Chromium 系统运行库，供自动化浏览器功能使用
RUN npm ci --omit=dev \
    && npx playwright install-deps chromium \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY .env.example ./.env.example
COPY docker-entrypoint.sh /usr/local/bin/kiro-docker-entrypoint

RUN chmod +x /usr/local/bin/kiro-docker-entrypoint \
    && mkdir -p /app/data /app/logs /app/config \
    && chown -R node:node /app /home/node

USER node

RUN npx playwright install chromium

EXPOSE 14558

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:14558/health-basic').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["kiro-docker-entrypoint"]
