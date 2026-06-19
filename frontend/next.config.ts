import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@google/generative-ai",
    "unpdf",
    "mammoth",
    "pg",
    "dotenv",
  ],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
