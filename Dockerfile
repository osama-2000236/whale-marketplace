FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN npm run seed

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
