FROM node:24.22.1-alpine AS builder

RUN apk upgrade --no-cache ca-certificates-bundle

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:24.22.1-alpine

RUN apk upgrade --no-cache ca-certificates-bundle

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
