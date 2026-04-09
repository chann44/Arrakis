FROM oven/bun:1.1.38-alpine AS base

WORKDIR /app

COPY package.json ./
RUN bun install --frozen-lockfile --production=false || bun install

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

EXPOSE 8090

CMD ["bun", "src/index.ts"]
