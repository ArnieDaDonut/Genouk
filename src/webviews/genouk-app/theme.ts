/**
 * Design tokens for the Genouk webview.
 *
 * Everything references a VS Code theme variable first with a sensible fallback,
 * so the panel reads correctly in both light and dark themes instead of leaning
 * on hardcoded neon hex values. Import `t` and reference tokens — do not scatter
 * raw colors through component styles.
 */
export const t = {
  color: {
    // surfaces & text
    bg: 'var(--vscode-sideBar-background, var(--vscode-editor-background, #1e1e1e))',
    fg: 'var(--vscode-foreground, #cccccc)',
    muted: 'var(--vscode-descriptionForeground, #8b8b8b)',
    border: 'var(--vscode-panel-border, var(--vscode-widget-border, rgba(128,128,128,0.25)))',
    surface: 'var(--vscode-editorWidget-background, rgba(127,127,127,0.06))',
    surfaceHover: 'var(--vscode-list-hoverBackground, rgba(127,127,127,0.10))',

    // primary action (uses the editor's own button color)
    accent: 'var(--vscode-textLink-foreground, #3794ff)',
    accentFg: 'var(--vscode-button-foreground, #ffffff)',
    accentBg: 'var(--vscode-button-background, #0e639c)',
    accentBgHover: 'var(--vscode-button-hoverBackground, #1177bb)',

    // inputs
    inputBg: 'var(--vscode-input-background, #2c2c2c)',
    inputFg: 'var(--vscode-input-foreground, #cccccc)',
    inputBorder: 'var(--vscode-input-border, rgba(128,128,128,0.30))',
    focus: 'var(--vscode-focusBorder, #007fd4)',

    // semantic / status
    good: 'var(--vscode-charts-green, #89d185)',
    warn: 'var(--vscode-charts-yellow, #cca700)',
    bad: 'var(--vscode-charts-red, #f14c4c)',
    info: 'var(--vscode-charts-blue, #3794ff)',

    errorBg: 'var(--vscode-inputValidation-errorBackground, rgba(241,76,76,0.12))',
    errorBorder: 'var(--vscode-inputValidation-errorBorder, #be1100)',
  },

  // 4px spacing scale
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },

  radius: { sm: 3, md: 6, lg: 10 },

  font: {
    ui: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
    mono: 'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace)',
    size: { xs: 10, sm: 11, base: 12, md: 13, lg: 15 },
    weight: { normal: 400, medium: 500, semibold: 600 },
  },

  // motion durations (seconds) — reserved for state changes, not constant decoration
  motion: { fast: 0.15, base: 0.25, slow: 0.4 },
} as const;

/** Pick a status color from a 0-100 score. */
export function scoreColor(score: number): string {
  if (score >= 80) return t.color.good;
  if (score >= 50) return t.color.warn;
  return t.color.bad;
}
