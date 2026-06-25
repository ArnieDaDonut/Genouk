import * as path from 'path';
import type * as LinearModule from './LinearService';

/**
 * Lazily load the Linear integration. `@linear/sdk` is ~1.3 MB — 93% of what the
 * extension bundle would otherwise weigh — yet Linear is only touched when the
 * user actually syncs. esbuild builds LinearService into its own chunk
 * (dist/linear.js); we `require` it by a path computed at runtime so esbuild
 * can't inline the SDK back into extension.js. Net effect: activation parses
 * ~110 KB instead of ~1.45 MB, and the SDK loads on first sync only.
 */
let cached: typeof LinearModule | undefined;

export function loadLinear(): typeof LinearModule {
  if (!cached) {
    // Computed path keeps this require opaque to esbuild's bundler.
    cached = require(path.join(__dirname, 'linear.js')) as typeof LinearModule;
  }
  return cached;
}
