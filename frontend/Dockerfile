# Angular production build + nginx static hosting
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration=production

FROM nginx:1.27-alpine
COPY nginx.default.conf /etc/nginx/conf.d/default.conf
# Fail fast if an old template (variable resolver) was copied — avoids silent 502 on /api/
RUN grep -q 'upstream nest_backend' /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/frontend /usr/share/nginx/html
EXPOSE 80
