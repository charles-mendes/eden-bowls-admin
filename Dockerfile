FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_ADMIN_API_BASE_URL=
ARG VITE_APP_BASE_PATH=/
ARG VITE_DEMO_INSIGHTS=false

ENV VITE_ADMIN_API_BASE_URL=${VITE_ADMIN_API_BASE_URL}
ENV VITE_APP_BASE_PATH=${VITE_APP_BASE_PATH}
ENV VITE_DEMO_INSIGHTS=${VITE_DEMO_INSIGHTS}

RUN npm run build

FROM caddy:2-alpine AS runtime
COPY infra/caddy/Caddyfile.admin /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80
