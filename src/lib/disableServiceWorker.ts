export async function disableLegacyServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const shouldReloadAfterCleanup =
      !!navigator.serviceWorker.controller || registrations.length > 0;

    await Promise.all(
      registrations.map(async (registration) => {
        await registration.unregister();
      })
    );

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    if (shouldReloadAfterCleanup) {
      const reloadFlag = "daher-sw-cleanup-reloaded";
      const hasReloaded = sessionStorage.getItem(reloadFlag) === "true";

      if (!hasReloaded) {
        sessionStorage.setItem(reloadFlag, "true");
        window.location.reload();
        return;
      }

      sessionStorage.removeItem(reloadFlag);
    }
  } catch (error) {
    console.error("Failed to disable legacy service workers", error);
  }
}
