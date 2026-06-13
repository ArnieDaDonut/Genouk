// Template for local dev secrets. COPY this file to `devKeys.ts` and fill in
// your own key. `devKeys.ts` is gitignored; this `.example.ts` file is safe to
// commit because it contains no real secret.
//
//   cp src/shared/devKeys.example.ts src/shared/devKeys.ts
//
// config.ts uses DEV_GEMINI_API_KEY only as a fallback when the
// `detonate.geminiApiKey` VS Code setting is empty.

export const DEV_GEMINI_API_KEY = '';
