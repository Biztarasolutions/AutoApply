FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Copy only the automation-server subfolder (build context = repo root)
COPY automation-server/package.json ./
RUN npm install

COPY automation-server/ .

EXPOSE 4000

CMD ["node", "index.js"]
