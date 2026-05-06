# Angular production build + nginx static hosting
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration=production

FROM nginx:1.27-alpine
# upstream must live in http context (separate file); not inside server { } or nginx will refuse to start
COPY nginx-upstream.conf /etc/nginx/conf.d/00-upstream.conf
COPY nginx.default.conf /etc/nginx/conf.d/default.conf
# Do not run nginx -t here: upstream DNS exists only at runtime in Kubernetes (build would fail on Docker Desktop).
RUN grep -q 'upstream nest_backend' /etc/nginx/conf.d/00-upstream.conf
COPY --from=builder /app/dist/frontend /usr/share/nginx/html
EXPOSE 80
