FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
RUN addgroup -S mcp && adduser -S mcp -G mcp
WORKDIR /app
ENV NODE_ENV=production
# Bind all interfaces inside the container so the published port works.
# Put a TLS-terminating reverse proxy in front. Do not expose this port on the public internet.
ENV HOST=0.0.0.0
ENV ALLOWED_HOSTS=127.0.0.1,localhost
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER mcp
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3001/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
