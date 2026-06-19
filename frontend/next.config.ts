import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@google/generative-ai",
    "pdf-parse",
    "mammoth",
    "pg",
    "dotenv",
  ],
};

export default nextConfig;
