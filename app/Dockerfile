# cd "C:\path"
# docker build -t butterfly-effect .

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:all

FROM node:22-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-ssr ./dist-ssr
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/db ./db

EXPOSE 3000

# NODE_ENV/LOAD_TEST_MODE/CLUSTER_MODE/SANITY_DATASET etc. are passed at
# `docker run` time (-e flags), not baked in here, so the same image works
# for a real prod run and a k6 run without a rebuild.
CMD ["node", "dist-server/backend/index.js"]

# Example
# docker run --rm --name butterfly-effect-loadtest `
#>>   --cpus=2 --memory=1g `
#>>   -p 3000:3000 `
#>>   --env-file "C:\Users\Efe Ozalp\Desktop\butterfly-effect\app\.env" `
#>>   -e NODE_ENV=production `
#>>   -e CLUSTER_MODE=true `
#>>   -e LOAD_TEST_MODE=true `
#>>   -e HOST=0.0.0.0 `
#>>   butterfly-effect
