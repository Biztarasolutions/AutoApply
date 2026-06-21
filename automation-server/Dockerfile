FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install

# Playwright browsers are already bundled in the base image above
# (mcr.microsoft.com/playwright includes chromium + system deps)

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
