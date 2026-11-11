FROM mcr.microsoft.com/playwright:v1.56.0-noble
RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production AI_DESIGN_DATA_DIR=/app/data
EXPOSE 3000
CMD ["npm", "run", "start"]
