FROM node:20-alpine

WORKDIR /app

# Force cache bust by adding a comment with build version
# v2 — fix package-lock sync
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN npx prisma generate

RUN addgroup -S whale && adduser -S whale -G whale

ENV NODE_ENV=production
ENV PORT=3000

# Ensure upload directories are writable by the non-root user
RUN mkdir -p /app/public/uploads/tmp && chown -R whale:whale /app/public/uploads

USER whale

EXPOSE ${PORT}

CMD ["node", "entrypoint.js"]
