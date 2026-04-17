export async function disableLegacyServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const host = window.location.hostname;
  const isPreviewHost = host.includes("id-preview--") || host.includes("lovableproject.com");

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations.map(async (registration) => {
        await registration.unregister();
      })
    );

    if (isPreviewHost && "caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  } catch (error) {
    console.error("Failed to disable legacy service workers", error);
  }
}
