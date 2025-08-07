FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
RUN npm run build || true
EXPOSE 4000
CMD ["node", "dist/index.js"]