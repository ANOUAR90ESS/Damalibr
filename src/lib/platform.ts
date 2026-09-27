import { Capacitor } from '@capacitor/core';

/** true inside the iOS/Android app (Capacitor), false on the web. */
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'web' | 'ios' | 'android';

/** Custom URL scheme registered by the native apps (deep links, auth callbacks). */
export const APP_SCHEME = 'com.lamina.app';

// The web build calls its own server with relative URLs. The native app is served
// from capacitor://localhost, so it needs the server's public URL (VITE_API_URL).
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}

/** Relative media URLs (local /media) must also point at the server inside the app. */
export function mediaUrl(url: string | undefined): string | undefined {
  return url && url.startsWith('/') ? apiUrl(url) : url;
}

/** Where Supabase sends the user back after email/Google sign-in. */
export function authRedirectUrl(): string {
  return isNative ? `${APP_SCHEME}://auth-callback` : `${window.location.origin}/profile`;
}

/**
 * Apple and Google require their own in-app purchase systems for digital goods,
 * so Stripe checkout is only offered on the web.
 */
export const purchasesAvailable = !isNative;
