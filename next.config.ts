import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.*", "192.168.0.*", "10.0.0.*", "10.0.1.*"],
};

export default nextConfig;
