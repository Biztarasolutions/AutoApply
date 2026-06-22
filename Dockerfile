FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# bust cache: v2
ARG CACHEBUST=2

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
