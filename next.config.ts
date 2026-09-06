import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Completely disable any Turbopack overrides
  serverExternalPackages: ["onnxruntime-web", "onnxruntime-node"],
  turbopack: {}, // Silences Next 16 Turbopack error when using webpack config
  // Allow Cloudflare tunnel and localtunnel domains for remote access
  allowedDevOrigins: ["*.trycloudflare.com", "*.loca.lt"],
  
  webpack: (config, { isServer }) => {
    // Force Webpack to completely ignore onnxruntime-web so it doesn't crash during parsing
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      encoding: false, // Fix node-fetch / face-api.js warning
    };
    
    // Ignore the specific onnxruntime-web module from being bundled by Webpack/Turbopack
    config.externals = [...(config.externals || []), "onnxruntime-web"];

    // Ignore mediapipe vision bundle warnings
    config.ignoreWarnings = [
      { module: /node_modules\/@mediapipe\/tasks-vision/ },
      { module: /node_modules\/face-api\.js/ },
    ];

    return config;
  },
};

export default withPWA(nextConfig);
