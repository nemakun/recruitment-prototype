FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/index.js"]
