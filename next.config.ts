import type { NextConfig } from 'next';
const nextConfig: NextConfig = { serverExternalPackages: ['better-sqlite3', 'playwright', 'playwright-core'] };
export default nextConfig;
