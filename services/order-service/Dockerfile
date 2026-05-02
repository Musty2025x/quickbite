FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:18-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER app
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["node", "server.js"]
