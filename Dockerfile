FROM node:20-alpine

WORKDIR /app

# Force cache bust by adding a comment with build version
# v2 — fix package-lock sync
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE ${PORT}

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
