/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  // Completely disable source maps
  productionBrowserSourceMaps: false,
  webpack: (config, { dev, isServer }) => {
    // Completely disable all source map generation
    config.devtool = false;
    
    // Remove any existing source map plugins
    config.plugins = config.plugins.filter(plugin => {
      return !plugin.constructor.name.includes('SourceMap');
    });
    
    return config;
  },
};

module.exports = nextConfig;