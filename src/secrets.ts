import * as vscode from 'vscode';

/**
 * Credential storage for Genouk. API keys belong in VS Code's encrypted
 * SecretStorage, not in settings.json — settings sync to the cloud in plaintext.
 * We still read the legacy `genouk.*ApiKey` settings (and env vars) as a fallback
 * so existing setups keep working, and we migrate any plaintext keys we find on
 * activation. New keys should be set via the `genouk.setApiKey` command.
 */

let storage: vscode.SecretStorage | undefined;

/** The secret-bearing keys Genouk manages: a SecretStorage id + its legacy setting. */
export const SECRET_KEYS = {
  vultr: { secret: 'genouk.vultrApiKey', setting: 'vultrApiKey', env: 'VULTR_API_KEY', label: 'Vultr API key' },
  groq: { secret: 'genouk.groqApiKey', setting: 'groqApiKey', env: 'GROQ_API_KEY', label: 'Groq API key' },
  gemini: { secret: 'genouk.geminiApiKey', setting: 'geminiApiKey', env: 'GEMINI_API_KEY', label: 'Gemini API key' },
  linear: { secret: 'genouk.linearApiKey', setting: 'linearApiKey', env: undefined, label: 'Linear API key' },
} as const;

export type SecretName = keyof typeof SECRET_KEYS;

/** Wire up SecretStorage. Call once from activate() before any key is read. */
export function initSecrets(context: vscode.ExtensionContext): void {
  storage = context.secrets;
}

/**
 * Resolve a credential, preferring the secure store: SecretStorage → legacy
 * `genouk.*` setting → environment variable. Returns undefined if none is set.
 */
export async function getSecret(name: SecretName): Promise<string | undefined> {
  const { secret, setting, env } = SECRET_KEYS[name];
  if (storage) {
    const fromStore = await storage.get(secret);
    if (fromStore && fromStore.trim()) return fromStore.trim();
  }
  const fromSetting = vscode.workspace.getConfiguration('genouk').get<string>(setting);
  if (fromSetting && fromSetting.trim()) return fromSetting.trim();
  if (env && process.env[env] && process.env[env]!.trim()) return process.env[env]!.trim();
  return undefined;
}

/** Store (or clear) a credential in SecretStorage. */
export async function storeSecret(name: SecretName, value: string): Promise<void> {
  const { secret } = SECRET_KEYS[name];
  if (!storage) return;
  if (value.trim()) await storage.store(secret, value.trim());
  else await storage.delete(secret);
}

/**
 * One-time migration: lift any plaintext keys out of settings.json into
 * SecretStorage, then clear the setting so the secret no longer lives on disk
 * (or in Settings Sync). Idempotent — once the settings are cleared it no-ops.
 */
export async function migrateSettingsKeysToSecrets(): Promise<void> {
  if (!storage) return;
  const config = vscode.workspace.getConfiguration('genouk');

  for (const name of Object.keys(SECRET_KEYS) as SecretName[]) {
    const { secret, setting } = SECRET_KEYS[name];
    const info = config.inspect<string>(setting);
    const value = (info?.globalValue ?? info?.workspaceValue ?? '').toString().trim();
    if (!value) continue;

    if (!(await storage.get(secret))) {
      await storage.store(secret, value);
    }
    if (info?.globalValue !== undefined) {
      await config.update(setting, undefined, vscode.ConfigurationTarget.Global);
    }
    if (info?.workspaceValue !== undefined) {
      await config.update(setting, undefined, vscode.ConfigurationTarget.Workspace);
    }
  }
}

/**
 * Interactive command: pick which key to set, then store it securely.
 * Registered as `genouk.setApiKey`.
 */
export async function promptToSetApiKey(): Promise<void> {
  const pick = await vscode.window.showQuickPick(
    (Object.keys(SECRET_KEYS) as SecretName[]).map((name) => ({ label: SECRET_KEYS[name].label, name })),
    { placeHolder: 'Which API key do you want to set?' },
  );
  if (!pick) return;

  const value = await vscode.window.showInputBox({
    prompt: `Enter your ${pick.label}`,
    password: true,
    ignoreFocusOut: true,
    placeHolder: 'Paste the key — it will be stored in the OS keychain, not in settings.json',
  });
  if (value === undefined) return; // cancelled

  await storeSecret(pick.name, value);
  vscode.window.showInformationMessage(
    value.trim() ? `Genouk: ${pick.label} saved securely.` : `Genouk: ${pick.label} cleared.`,
  );
}
