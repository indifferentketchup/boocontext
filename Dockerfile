FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --prod --frozen-lockfile 2>/dev/null || npm install --omit=dev

COPY dist/ ./dist/
COPY assets/ ./assets/

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--mcp"]
