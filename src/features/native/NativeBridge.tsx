import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { StatusBar, Style } from '@capacitor/status-bar';
import { APP_SCHEME, isNative, platform } from '../../lib/platform';
import { supabase } from '../../lib/supabase';

/**
 * Handles a deep link such as com.lamina.app://auth-callback?code=... (Google or
 * email sign-in) or com.lamina.app://book/book-quijote. Returns the in-app route to open.
 */
export async function handleDeepLink(url: string): Promise<string | null> {
  if (!url.startsWith(`${APP_SCHEME}://`)) return null;
  const parsed = new URL(url.replace(`${APP_SCHEME}://`, 'https://app.local/'));

  if (parsed.pathname === '/auth-callback') {
    await Browser.close().catch(() => {}); // not open when coming from an email link
    const code = parsed.searchParams.get('code');
    if (code && supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) console.warn('No se pudo completar el inicio de sesión', error);
    }
    return '/profile';
  }

  return `${parsed.pathname}${parsed.search}` || '/';
}

// Mounted once inside the router: status bar, Android back button and deep links.
export function NativeBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative) return;

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

    const listeners = [
      App.addListener('appUrlOpen', async ({ url }: URLOpenListenerEvent) => {
        const route = await handleDeepLink(url);
        if (route) navigate(route);
      }),
    ];
    if (platform === 'android') {
      listeners.push(App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      }));
    }

    return () => {
      listeners.forEach(l => l.then(h => h.remove()));
    };
  }, [navigate]);

  return null;
}
