// src/hooks/usePushNotifications.js
import { useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(currentUser) {
  useEffect(() => {
    if (!currentUser?.email) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    async function subscribe() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;

        // Verificar si ya hay suscripción activa
        const existing = await registration.pushManager.getSubscription();
        const sub = existing || await registration.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        await fetch('/api/save-push-subscription', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            user_id:      currentUser.email,
            subscription: sub.toJSON(),
          }),
        });
      } catch (err) {
        console.warn('Push subscription error:', err);
      }
    }

    subscribe();
  }, [currentUser?.email]);
}
