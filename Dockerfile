FROM node:20-alpine

WORKDIR /app

# Force cache bust by adding a comment with build version
# v3 — move dotenv to production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE ${PORT}

CMD ["node", "entrypoint.js"]
