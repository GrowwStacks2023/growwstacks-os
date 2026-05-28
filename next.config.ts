import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // File attachments now flow through a server action that POSTs to
      // the n8n webhook. Default Server Action body limit is 1 MB — too
      // small for the proposals/PDFs/screenshots people actually attach.
      // 10 MB is a deliberate v1 ceiling; larger files would warrant a
      // direct-from-browser-to-n8n route to skip the round-trip.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
