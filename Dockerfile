FROM mcr.microsoft.com/playwright:v1.56.0-noble
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production AI_DESIGN_DATA_DIR=/app/data
EXPOSE 3000
CMD ["npm", "run", "start"]
