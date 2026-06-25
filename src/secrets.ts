import * as vscode from 'vscode';

/**
 * Credential storage for Genouk. API keys belong in VS Code's encrypted
 * SecretStorage, not in settings.json — settings sync to the cloud in plaintext.
 * We still read the legacy `genouk.*ApiKey` settings (and env vars) as a fallback
 * so existing setups keep working, and we migrate any plaintext keys we find on
 * activation. New keys should be set via the `genouk.setApiKey` command.
 */

let storage: vscode.SecretStorage | undefined;

/**
 * The Vultr key shipped with the extension. This is an intentionally-public,
 * shared key so every marketplace user gets working AI with zero setup. It is
 * compiled into dist/extension.js by esbuild, so it ships even when no .env is
 * bundled in the .vsix. Anyone can extract it from the published bundle and it
 * shares one quota across all users — rotate it here and republish to revoke.
 */
const BUNDLED_VULTR_KEY = 'VWX7BPFJCLREGFSHAZRPCQ5PIDPPUPTDIWNQ';

/** The secret-bearing keys Genouk manages: a SecretStorage id + its legacy setting. */
export const SECRET_KEYS = {
  vultr: { secret: 'genouk.vultrApiKey', setting: 'vultrApiKey', env: 'VULTR_API_KEY', label: 'Vultr API key', bundled: BUNDLED_VULTR_KEY },
  linear: { secret: 'genouk.linearApiKey', setting: 'linearApiKey', env: undefined, label: 'Linear API key', bundled: undefined },
} as const;

export type SecretName = keyof typeof SECRET_KEYS;

/** Wire up SecretStorage. Call once from activate() before any key is read. */
export function initSecrets(context: vscode.ExtensionContext): void {
  storage = context.secrets;
}

/**
 * Resolve a credential. The shared key wins by design so the extension always
 * "just works" for everyone: environment variable (loaded from .env in dev) →
 * the bundled key compiled into the build → a user-set key in SecretStorage →
 * legacy `genouk.*` setting. Returns undefined if none is set.
 */
export async function getSecret(name: SecretName): Promise<string | undefined> {
  const { secret, setting, env, bundled } = SECRET_KEYS[name];

  // 1. Environment variable — dotenv loads .env into process.env at startup, so
  //    in development the .env key always takes priority (this also overrides any
  //    stale key previously saved in the OS keychain).
  if (env && process.env[env] && process.env[env]!.trim()) return process.env[env]!.trim();

  // 2. Key bundled into the published extension — guarantees zero-setup AI for
  //    every marketplace user even when no .env ships alongside the .vsix.
  if (bundled && bundled.trim()) return bundled.trim();

  // 3. A key the user set themselves via the "Genouk: Set API Key" command.
  if (storage) {
    const fromStore = await storage.get(secret);
    if (fromStore && fromStore.trim()) return fromStore.trim();
  }

  // 4. Legacy plaintext setting.
  const fromSetting = vscode.workspace.getConfiguration('genouk').get<string>(setting);
  if (fromSetting && fromSetting.trim()) return fromSetting.trim();

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
