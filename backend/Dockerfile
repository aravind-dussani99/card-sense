FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY server.js ./

ENV NODE_ENV=production
EXPOSE 8081

CMD ["node", "server.js"]
