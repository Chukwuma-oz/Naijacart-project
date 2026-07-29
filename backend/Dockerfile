# NaijaCart API container image — for ECS Fargate (Session 22) or local Docker.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8080
# Container health check mirrors the ALB health check
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["node", "server.js"]
