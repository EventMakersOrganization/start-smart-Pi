# NestJS API — production image
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
# Copy configs first, then full source — avoids stale `COPY . .` cache omitting new files
COPY nest-cli.json tsconfig.build.json tsconfig.json ./
COPY src ./src
RUN npm run build
RUN ls -la dist/users/schemas && \
    test -f dist/users/schemas/student-profile.schema.js && \
    test -f dist/users/schemas/user.schema.js

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
