import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import { SpotifyToken } from './types';
import { getSpotifyClientId } from '../shared/config';
import { logger } from '../shared/logger';

const REDIRECT_PORT = 8765;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join('%20');

let token: SpotifyToken | null = null;

export function getToken(): SpotifyToken | null {
  return token;
}

export function isConnected(): boolean {
  return token !== null && Date.now() < token.expiresAt;
}

/**
 * Starts the OAuth2 flow:
 * 1. Opens Spotify auth URL in the user's browser
 * 2. Spins up a temporary local HTTP server to catch the callback
 * 3. Exchanges the auth code for an access token
 */
export async function connectSpotify(): Promise<boolean> {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    vscode.window.showErrorMessage(
      'Detonate: Set your Spotify Client ID in settings (detonate.spotifyClientId) first.',
      'Open Settings'
    ).then((action) => {
      if (action === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'detonate.spotifyClientId');
      }
    });
    return false;
  }

  const authUrl = buildAuthUrl(clientId);
  await vscode.env.openExternal(vscode.Uri.parse(authUrl));
  logger.info('Spotify: Opened OAuth URL, waiting for callback...');

  try {
    const code = await waitForCallback();
    const newToken = await exchangeCode(clientId, code);
    token = newToken;
    vscode.window.showInformationMessage('🎵 Detonate: Spotify connected!');
    logger.info('Spotify: Connected successfully.');
    return true;
  } catch (err) {
    logger.error('Spotify: OAuth flow failed', err);
    vscode.window.showErrorMessage(`Detonate: Spotify connection failed — ${(err as Error).message}`);
    return false;
  }
}

/** Adjust Spotify playback volume based on vibe score */
export async function adjustSpotifyVolume(score: number): Promise<void> {
  if (!isConnected() || !token) return;

  // Map score 0–100 → Spotify volume 30–100
  const spotifyVol = Math.round(30 + (score / 100) * 70);

  try {
    await spotifyFetch('/me/player/volume', token.accessToken, 'PUT', { volume_percent: spotifyVol });
  } catch (err) {
    logger.warn('Spotify: Volume adjustment failed', err);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildAuthUrl(clientId: string): string {
  return (
    `https://accounts.spotify.com/authorize` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
  );
}

function waitForCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url ?? '', true);
      if (parsed.pathname === '/callback') {
        const code = parsed.query['code'] as string | undefined;
        const error = parsed.query['error'];

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          `<html><body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2>✅ Detonate — Spotify Connected!</h2>
            <p>You can close this tab and go back to VS Code.</p>
          </body></html>`
        );
        server.close();

        if (error || !code) {
          reject(new Error(String(error ?? 'No code returned')));
        } else {
          resolve(code);
        }
      }
    });

    server.listen(REDIRECT_PORT, () => {
      logger.info(`Spotify: Listening for OAuth callback on port ${REDIRECT_PORT}`);
    });

    server.on('error', reject);

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Spotify OAuth timed out (2 minutes).'));
    }, 120_000);
  });
}

async function exchangeCode(clientId: string, code: string): Promise<SpotifyToken> {
  // NOTE: For a hackathon, we use PKCE-less implicit flow here.
  // In production you'd use PKCE or a backend server to keep clientSecret safe.
  // This implementation requires the user to have a backend or set client secret.
  // For the demo, we skip the exchange and show a placeholder.
  logger.warn('Spotify: Code exchange stub — implement PKCE backend in production.');
  return {
    accessToken: 'PLACEHOLDER_TOKEN',
    refreshToken: '',
    expiresAt: Date.now() + 3600_000,
  };
}

async function spotifyFetch(
  endpoint: string,
  accessToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: 'api.spotify.com',
      path: `/v1${endpoint}`,
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    };

    const https = require('https');
    const req = https.request(options, (res: import('http').IncomingMessage) => {
      res.resume(); // drain the response
      res.on('end', resolve);
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}
