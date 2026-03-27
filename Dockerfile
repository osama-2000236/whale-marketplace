FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm install prisma@6.19.2
COPY . .
RUN node_modules/.bin/prisma generate
EXPOSE 3000
CMD ["node", "entrypoint.js"]
