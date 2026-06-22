FROM mcr.microsoft.com/playwright:v1.61.0-jammy

# bust cache: v3
ARG CACHEBUST=3

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
