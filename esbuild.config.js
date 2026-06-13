const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const extensionOptions = {
  entryPoints: { extension: 'src/extension.ts' },
  bundle: true,
  outdir: 'dist',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

// Standalone MCP memory server. Runs as its own Node process (launched by the user's
// agent), so it bundles its deps and excludes vscode entirely.
const mcpServerOptions = {
  entryPoints: { mcpServer: 'src/memory/mcpServer.ts' },
  bundle: true,
  outdir: 'dist',
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  banner: { js: '#!/usr/bin/env node' },
};

const webviewOptions = {
  entryPoints: { genoukApp: 'src/webviews/genouk-app/index.tsx' },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': production ? '"production"' : '"development"',
  },
};

async function main() {
  if (watch) {
    const [extCtx, mcpCtx, webCtx] = await Promise.all([
      esbuild.context(extensionOptions),
      esbuild.context(mcpServerOptions),
      esbuild.context(webviewOptions),
    ]);
    await Promise.all([extCtx.watch(), mcpCtx.watch(), webCtx.watch()]);
    console.log('👀 esbuild watching for changes...');
  } else {
    await Promise.all([
      esbuild.build(extensionOptions),
      esbuild.build(mcpServerOptions),
      esbuild.build(webviewOptions),
    ]);
    console.log('✅ Build complete');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
