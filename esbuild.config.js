const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: {
    extension: 'src/extension.ts',
    blastRadiusApp: 'src/webviews/blast-radius-app/index.tsx',
  },
  bundle: true,
  outdir: 'dist',
  external: ['vscode'],          // vscode is provided by the host, never bundle it
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

async function main() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('👀 esbuild watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('✅ Build complete');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
