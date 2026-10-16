FROM node:24-alpine AS build
WORKDIR /app

# Install build tools using Alpine's package manager (apk)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage
FROM node:24-alpine AS runtime
WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

RUN mkdir -p /app/data \
    && chown -R node:node /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]