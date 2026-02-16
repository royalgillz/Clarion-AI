/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image (Hugging Face Space).
  output: "standalone",
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;