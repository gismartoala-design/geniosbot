FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY index.html styles.css script.js login.html login.js admin.html admin.js ./
COPY assets ./assets
COPY scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 8080

CMD ["node", "server.js"]
