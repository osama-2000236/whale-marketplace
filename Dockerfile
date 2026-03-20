FROM node:20-alpine

WORKDIR /app

# Force cache bust by adding a comment with build version
# v4 — install all deps to avoid missing production modules
COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE ${PORT}

CMD ["node", "entrypoint.js"]
