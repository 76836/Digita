// This service worker leaves a lot to be desired, I'll come back to it later...
// I told you I'd come back. This sw.js looks better now.
const CACHE_NAME = 'DigitaPWACache';

// Install event - just set up the cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(['./index','./settings']);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
});

// Helper to clone and add headers
async function cloneWithHeaders(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// Fetch event - serve from cache, or cache on first fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      } else {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            const pathname = new URL(event.request.url).pathname;
            let responseWithHeaders = networkResponse;
            if (pathname.startsWith('/Digita')) {
              responseWithHeaders = await cloneWithHeaders(networkResponse.clone());
            }
            cache.put(event.request, responseWithHeaders.clone());
            return responseWithHeaders;
          } else {
            return networkResponse;
          }
        } catch (err) {
          console.error('Fetch failed:', err);
          throw err;
        }
      }
    })
  );
});

// Update event - force refresh all cached files (except vrm models)
if (event.data.action === 'updateCache') {
  caches.open(CACHE_NAME).then((cache) => {
    cache.keys().then((keys) => {
      keys.forEach((request) => {
        const url = request.url;
        const pathname = new URL(url).pathname;
        if (!url.includes('.vrm')) {  // skip vrm model files
          fetch(request).then(async (response) => {
            if (response.ok) {
              let responseWithHeaders = response;
              if (pathname.startsWith('/Digita')) {
                responseWithHeaders = await cloneWithHeaders(response.clone());
              }
              cache.put(request, responseWithHeaders);
            }
          }).catch((err) => {
            console.error(`Failed to update ${url}:`, err);
          });
        }
      });
    });
  });
}
});
