// Service Worker Configuration
// -----------------------------------

// Parse debug level from registration URL if provided
const DEBUG_LEVEL = (function() {
  if (typeof self !== 'undefined') {
    const urlParams = new URLSearchParams(self.location.search);
    return urlParams.get('debug') || 'minimal'; // Default to minimal if not specified
  }
  return 'minimal'; // Default value
})();

// TDR Attendance System Service Worker
const CACHE_VERSION = 'tdr-offline-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const DB_NAME = 'tdr-offline-db';
const ATTENDANCE_STORE = 'offline-attendance';

// Essential static resources to cache during installation
const STATIC_RESOURCES = [
    '/offline.html',
    '/static/images/favicon.ico',
    '/static/images/tdr-logo.png',
    '/static/css/style.css',
    '/static/js/main.js',
    '/static/js/utils.js',
    '/static/js/notification.js',
    '/static/js/utils/attendance-utils.js',
    '/static/offline-db.js',
    '/static/manifest.json',
    '/static/images/icons/icon-72x72.png',
    '/static/images/icons/icon-96x96.png',
    '/static/images/icons/icon-128x128.png',
    '/static/images/icons/icon-144x144.png',
    '/static/images/icons/icon-152x152.png',
    '/static/images/icons/icon-192x192.png',
    '/static/images/icons/icon-384x384.png',
    '/static/images/icons/icon-512x512.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
];

// Routes to cache
const ROUTES_TO_CACHE = [
  '/',
  '/login',
    '/admin/dashboard',
  '/admin/user-management',
    '/admin/company-management',
    '/admin/enrollment-management',
  '/admin/view-attendance',
    '/admin/mark-attendance',
  '/admin/view-archive',
    '/instructor/dashboard',
    '/instructor/mark-attendance',
    '/instructor/view-attendance'
];

// API routes to cache
const API_ROUTES = [
  '/api/users',
  '/api/companies', 
  '/api/enrollments',
  '/api/classes',
  '/api/attendance'
];

// Log helper - only for important events
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[SW ${timestamp}] ${message}`);
}

// Simplified log for debugging - will not log routine network fetches
function debugLog(message) {
  if (DEBUG_LEVEL === 'verbose') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SW ${timestamp}] ${message}`);
  }
}

// Install event - cache static resources
self.addEventListener('install', event => {
  log('Installing Service Worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        log('Caching static assets...');
        // First, ensure the offline page is cached
        return cache.add('/offline.html')
          .then(() => {
            // Then cache the rest of the static resources
            return cache.addAll(STATIC_RESOURCES.filter(resource => resource !== '/offline.html'));
          });
      })
      .then(() => {
        log('Service Worker installed');
        return self.skipWaiting();
      })
      .catch(error => {
        log(`Installation failed: ${error.message}`);
        // Continue even if caching fails
        self.skipWaiting();
    })
  );
});

// Function to pre-cache important routes
const precacheRoutes = async () => {
  const cache = await caches.open(DYNAMIC_CACHE);
  log('Pre-caching important routes...');
  
  // Create a list of routes to pre-cache
  const routesToCache = ROUTES_TO_CACHE.map(route => new Request(route, { mode: 'navigate' }));
  
  // Try to pre-cache each route
  const precachePromises = routesToCache.map(async request => {
    try {
      // Check if already cached
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        log(`Route already cached: ${request.url}`);
        return;
      }
      
      // Fetch and cache
      log(`Pre-caching route: ${request.url}`);
      const response = await fetch(request);
      if (response.ok) {
        return cache.put(request, response);
      }
    } catch (error) {
      log(`Failed to pre-cache route: ${request.url}`);
      // Continue even if one route fails
    }
  });
  
  return Promise.all(precachePromises);
};

// Activate event - clean up old caches and pre-cache routes
self.addEventListener('activate', event => {
  log('Activating Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys()
        .then(cacheNames => {
          return Promise.all(
            cacheNames
              .filter(cacheName => 
                cacheName.startsWith('tdr-offline-') && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE &&
                cacheName !== DATA_CACHE
              )
              .map(cacheName => {
                log(`Deleting old cache: ${cacheName}`);
                return caches.delete(cacheName);
              })
          );
        }),
      // Claim clients so the service worker is in control
      self.clients.claim(),
      // Pre-cache important routes
      precacheRoutes()
    ])
  );
  log('Service Worker activated');
});

// Helper function to determine if URL is covered by our caching strategy
const shouldCache = (url) => {
  // Don't cache cross-origin requests
  if (!url.startsWith(self.location.origin) && 
      !url.startsWith('https://cdn.jsdelivr.net/')) {
    return false;
  }
  
  const pathname = new URL(url).pathname;
  
  // Cache static resources, app routes, and API routes (GET only)
  return STATIC_RESOURCES.includes(pathname) ||
         ROUTES_TO_CACHE.some(route => pathname.startsWith(route)) ||
         API_ROUTES.some(route => pathname.startsWith(route));
};

// Helper for network-first strategy
const networkFirst = async (request) => {
  const url = new URL(request.url);
  
  try {
    // Try network first
    debugLog(`Fetching from network: ${url.pathname}`);
    const networkResponse = await fetch(request);
    
    // Cache successful responses (but not DELETE/PUT/POST requests)
    if (networkResponse.ok && shouldCache(request.url) && 
        request.method !== 'DELETE' && request.method !== 'PUT' && request.method !== 'POST') {
      const clone = networkResponse.clone();
      const cache = await caches.open(
        url.pathname.startsWith('/api/') ? DATA_CACHE : DYNAMIC_CACHE
      );
      debugLog(`Caching successful response for: ${url.pathname}`);
      cache.put(request, clone);
    } else if (request.method === 'DELETE' || request.method === 'PUT' || request.method === 'POST') {
      debugLog(`Skipping cache for ${request.method} request: ${url.pathname}`);
    }
    
    return networkResponse;
  } catch (error) {
    debugLog(`Network request failed for ${url.pathname}, trying cache`);
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      debugLog(`Serving from cache: ${url.pathname}`);
      return cachedResponse;
    }
    
    // If it's a navigation request and not in cache, show offline page
    if (request.mode === 'navigate') {
      debugLog('Serving offline page for navigation request');
      return caches.match('/offline.html');
    }
    
    // For API requests, return a formatted error
    if (url.pathname.startsWith('/api/')) {
      debugLog(`API request failed for ${url.pathname}, returning error response`);
      return new Response(
        JSON.stringify({
          error: 'Offline',
          message: 'You are currently offline. This action will be synced when you reconnect.',
          offline: true,
          timestamp: new Date().toISOString()
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // For other resources, return a generic error
    return new Response('Network error', { status: 503 });
  }
};

// Helper for cache-first strategy
const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    debugLog(`Serving from cache: ${new URL(request.url).pathname}`);
    return cachedResponse;
  }
  
  try {
    debugLog(`Cache miss, fetching from network: ${new URL(request.url).pathname}`);
    const networkResponse = await fetch(request);
    
    // Cache successful static resource responses (but not DELETE/PUT/POST requests)
    if (networkResponse.ok && shouldCache(request.url) && 
        request.method !== 'DELETE' && request.method !== 'PUT' && request.method !== 'POST') {
      const clone = networkResponse.clone();
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, clone);
    } else if (request.method === 'DELETE' || request.method === 'PUT' || request.method === 'POST') {
      debugLog(`Skipping cache for ${request.method} request: ${new URL(request.url).pathname}`);
    }
    
    return networkResponse;
  } catch (error) {
    debugLog(`Failed to fetch: ${new URL(request.url).pathname}`);
    
    // For images, return a placeholder if available
    if (request.url.match(/\.(jpg|jpeg|png|gif|svg)$/i)) {
      return caches.match('/static/images/placeholder.png').catch(() => {
        return new Response('Image not available offline', { status: 503 });
      });
    }
    
    return new Response('Resource not available offline', { status: 503 });
  }
};

// Fetch event handler
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip logging for assets and API calls
  const shouldSkipDetailedLogging = 
    url.pathname.startsWith('/static/') || 
    url.pathname.startsWith('/npm/') || 
    url.pathname.startsWith('/ajax/');
  
  // Only log API requests and important operations
  if (!shouldSkipDetailedLogging) {
    debugLog(`Handling fetch: ${url.pathname}`);
  }
  
  // Skip non-GET/POST/PUT/DELETE requests and cross-origin requests (except CDN)
  if (request.method !== 'GET' && request.method !== 'DELETE' &&
      !(url.pathname.includes('/attendance') || url.pathname.startsWith('/api/attendance')) &&
      !(request.method === 'POST' || request.method === 'PUT')) {
    return;
  }
  
  // For DELETE, PUT, POST requests, pass through to network without caching
  if (request.method === 'DELETE' || request.method === 'PUT' || request.method === 'POST') {
    debugLog(`Handling ${request.method} request for: ${url.pathname}`);
    event.respondWith(fetch(request));
    return;
  }

  // Special handling for attendance POST/PUT requests
  if ((url.pathname.includes('/attendance') || url.pathname.startsWith('/api/attendance')) && 
      (request.method === 'POST' || request.method === 'PUT')) {
    
    event.respondWith(
      fetch(request.clone())
        .catch(async (error) => {
          debugLog('Attendance request failed, saving offline');
          
          // Store this request for later processing
          const timestamp = new Date().toISOString();
          
          // Clone the request and extract its properties
          const originalRequest = request.clone();
          
          // Log the request details for debugging
          debugLog(`Saving offline attendance request: ${originalRequest.url}, method: ${originalRequest.method}`);
          
          const offlineData = {
            url: originalRequest.url,
            method: originalRequest.method,
            headers: Array.from(originalRequest.headers.entries()),
            body: await originalRequest.clone().text(),
            timestamp
          };
          
          // Store offline attendance for later sync
          const dbName = 'tdr-offline-db';
          const dbVersion = 1;
          
          return new Promise((resolve) => {
            const request = indexedDB.open(dbName, dbVersion);
            
            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
                db.createObjectStore(ATTENDANCE_STORE, { keyPath: 'timestamp' });
              }
            };
            
            request.onsuccess = (event) => {
              const db = event.target.result;
              const transaction = db.transaction([ATTENDANCE_STORE], 'readwrite');
              const store = transaction.objectStore(ATTENDANCE_STORE);
              const addRequest = store.add(offlineData);
              
              addRequest.onsuccess = () => {
                debugLog('Attendance data saved for offline sync');
                
                // Try to register for background sync if available
                // Note: This will fail on non-HTTPS sites except localhost
                try {
                  // Check if we're in a secure context or localhost (required for background sync)
                  const isSecureContext = self.isSecureContext || 
                    self.location.hostname === 'localhost' || 
                    self.location.hostname === '127.0.0.1';
                  
                  if (isSecureContext && 'sync' in registration) {
                    registration.sync.register('sync-attendance')
                      .then(() => {
                        debugLog('Background sync registered successfully');
                      })
                      .catch(error => {
                        debugLog(`Background sync registration failed: ${error.message}`);
                        // This is expected on non-HTTPS sites - not a critical error
                        if (error.name === 'NotAllowedError') {
                          debugLog('Background sync requires HTTPS except on localhost - will use manual sync');
                        }
                      });
                  } else if (!isSecureContext) {
                    debugLog('Background sync requires HTTPS except on localhost - will use manual sync');
                  } else if (!('sync' in registration)) {
                    debugLog('Background sync API not available in this browser - will use manual sync');
                  }
                } catch (error) {
                  debugLog(`Error attempting background sync registration: ${error.message}`);
                }
                
                resolve(new Response(JSON.stringify({
                  status: 'offline',
                  message: 'Attendance saved offline. Will sync when online.',
                  timestamp
                }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                }));
              };
              
              addRequest.onerror = () => {
                debugLog('Failed to store offline attendance');
                resolve(new Response(JSON.stringify({
                  status: 'error',
                  message: 'Failed to save attendance data offline'
                }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
                }));
              };
            };
            
            request.onerror = () => {
              debugLog('IndexedDB error');
              resolve(new Response(JSON.stringify({
                status: 'error',
                message: 'Database error occurred'
              }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              }));
            };
          });
        })
    );
    return;
  }

  // For navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    debugLog(`Navigation request for: ${url.pathname}`);
    
    event.respondWith(
      // Strategy: Network first, then cache, fallback to offline page
      fetch(request)
        .then(networkResponse => {
          // Cache the network response for future offline use
          if (networkResponse.ok) {
            debugLog(`Caching navigation response for: ${url.pathname}`);
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, try to get from cache
          debugLog(`Network failed for ${url.pathname}, trying cache`);
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              // We have a cached version, serve it
              debugLog(`Serving from cache: ${url.pathname}`);
              return cachedResponse;
            }
            
            // No cached version, serve offline page
            debugLog(`No cached version of ${url.pathname}, serving offline page`);
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }
  
  // For API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // For static resources
  if (STATIC_RESOURCES.some(resource => url.pathname.endsWith(resource))) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Default strategy for everything else
  event.respondWith(networkFirst(request));
});

// Function to sync offline attendance records with the server
async function syncOfflineAttendance() {
  if (!navigator.onLine) {
    debugLog('Cannot sync attendance: Browser is offline');
    return {
      success: false,
      synced: 0,
      failed: 0,
      total: 0,
      message: 'Browser is offline',
      timestamp: new Date().toISOString()
    };
  }

  debugLog('Starting attendance sync process');
  
  try {
    // First, try to get a fresh CSRF token
    let currentCsrfToken = null;
    try {
      const mainPageResponse = await fetch('/');
      const pageText = await mainPageResponse.text();
      const csrfMatch = pageText.match(/<meta name="csrf-token" content="([^"]+)"/);
      if (csrfMatch && csrfMatch[1]) {
        currentCsrfToken = csrfMatch[1];
        debugLog(`Obtained fresh CSRF token: ${currentCsrfToken.substring(0, 5)}...`);
      }
    } catch (err) {
      debugLog(`Failed to obtain fresh CSRF token: ${err.message}`);
    }
    
    // Open the database using native IndexedDB API instead of openDB
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onerror = event => {
        debugLog(`Error opening database: ${event.target.error}`);
        reject(event.target.error);
      };
      
      request.onsuccess = event => {
        debugLog('Database opened successfully for sync');
        resolve(event.target.result);
      };
      
      request.onupgradeneeded = event => {
        const db = event.target.result;
        debugLog('Database upgrade needed - creating object stores for sync');
        
        if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
          db.createObjectStore(ATTENDANCE_STORE, { keyPath: 'timestamp' });
          debugLog('Attendance store created during sync');
        }
      };
    });
    
    // Get all offline attendance records
    const records = await new Promise((resolve, reject) => {
      const transaction = db.transaction([ATTENDANCE_STORE], 'readonly');
      const store = transaction.objectStore(ATTENDANCE_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        if (request.result && request.result.length > 0) {
          debugLog(`Found ${request.result.length} offline attendance records:`);
          // Log first record details for debugging
          const sample = request.result[0];
          debugLog(`Sample record - URL: ${sample.url}, Method: ${sample.method}`);
          debugLog(`Sample record headers: ${JSON.stringify(sample.headers || [])}`);
          debugLog(`Sample record body (first 100 chars): ${(sample.body || '').substring(0, 100)}...`);
        }
        resolve(request.result);
      };
      
      request.onerror = event => {
        debugLog(`Error getting records: ${event.target.error}`);
        reject(event.target.error);
      };
    });
    
    if (records.length === 0) {
      debugLog('No offline attendance records to sync');
      db.close();
      return {
        success: true,
        synced: 0,
        failed: 0,
        total: 0,
        message: 'No offline attendance records to sync',
        timestamp: new Date().toISOString()
      };
    }
    
    debugLog(`Found ${records.length} offline attendance records to sync`);
    
    // Track sync statistics
    const syncStats = {
      synced: 0,
      failed: 0,
      total: records.length,
      errors: []
    };
    
    // Process records in batches to avoid overwhelming the server
    const BATCH_SIZE = 5;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      let batchSuccess = true;
      
      // Process each record in the current batch
      for (const record of batch) {
        try {
          // Use the original URL and method from the stored record
          const url = record.url || '/api/attendance';
          // Original method - we'll try multiple methods
          const originalMethod = record.method || 'POST';
          
          // Extract headers from the stored record or use defaults
          let headers = { 'Content-Type': 'application/json' };
          if (record.headers && Array.isArray(record.headers)) {
            record.headers.forEach(([key, value]) => {
              headers[key] = value;
            });
          }
          
          // Update CSRF token if we have a fresh one
          if (currentCsrfToken && headers['X-CSRFToken']) {
            debugLog('Updating CSRF token for sync request');
            headers['X-CSRFToken'] = currentCsrfToken;
          }
          
          // Prepare the body to send
          let bodyToSend = record.body || JSON.stringify(record);
          
          // Check if this is an admin endpoint and transform data format if needed
          if ((url.includes('/admin/') || url.includes('/admin')) && bodyToSend) {
            try {
              const parsedBody = typeof bodyToSend === 'string' ? JSON.parse(bodyToSend) : bodyToSend;
              
              if (parsedBody.class_id && parsedBody.records) {
                // Construct admin-style payload
                const adminPayload = {
                  class_id: parsedBody.class_id,
                  date: parsedBody.date || new Date().toISOString().split('T')[0],
                  admin_id: parsedBody.admin_id || 'admin',
                  records: parsedBody.records
                };
                
                bodyToSend = JSON.stringify(adminPayload);
                debugLog('Transformed payload for admin endpoint');
              }
            } catch (parseError) {
              debugLog(`Error transforming payload: ${parseError.message}`);
            }
          }
          
          // Try different methods in order (PUT, PATCH, POST)
          const methodsToTry = ['PUT', 'PATCH', 'POST', 'GET'];
          // If the original method is in our list, try it first
          if (methodsToTry.includes(originalMethod)) {
            methodsToTry.splice(methodsToTry.indexOf(originalMethod), 1);
            methodsToTry.unshift(originalMethod);
          }
          
          let response;
          let succeeded = false;
          
          // Try each method
          for (const method of methodsToTry) {
            // Skip GET method if we have a body (GET requests shouldn't have a body)
            if (method === 'GET' && bodyToSend && bodyToSend.length > 0) continue;
            
            debugLog(`Syncing record to ${url} with method ${method}`);
            
            try {
              // For GET requests, don't include a body
              const requestOptions = {
                method: method,
                headers: headers
              };
              
              // Only add body for non-GET requests
              if (method !== 'GET') {
                requestOptions.body = bodyToSend;
              }
              
              response = await fetch(url, requestOptions);
              
              // Log the response status
              debugLog(`Sync response for ${url} (${method}): ${response.status} ${response.statusText}`);
              
              // If successful, mark as succeeded and break the loop
              if (response.ok) {
                succeeded = true;
                break;
              }
            } catch (fetchError) {
              debugLog(`Fetch error with ${method}: ${fetchError.message}`);
            }
          }
          
          // If no method worked, try alternative URLs
          if (!succeeded) {
            debugLog(`All methods failed for URL ${url}, trying alternatives...`);
            
            // Try different attendance API endpoints with different methods
            const alternativeUrls = [
              '/api/attendance/save',
              '/api/attendance/admin',
              '/api/attendance/batch',
              '/api/admin/attendance/save',
              '/api/admin/attendance',
              '/admin/api/attendance/save',
              '/admin/attendance/save',
              '/attendance/save',
              '/attendance/api/save'
            ].filter(altUrl => altUrl !== url);
            
            for (const altUrl of alternativeUrls) {
              // Try each method with each alternative URL
              for (const method of methodsToTry) {
                // Skip GET method if we have a body
                if (method === 'GET' && bodyToSend && bodyToSend.length > 0) continue;
                
                debugLog(`Trying alternative URL: ${altUrl} with method ${method}`);
                
                const altHeaders = { ...headers };
                // Ensure we're using the fresh CSRF token for each attempt
                if (currentCsrfToken && altHeaders['X-CSRFToken']) {
                  altHeaders['X-CSRFToken'] = currentCsrfToken;
                }
                
                // For admin-specific endpoints, we might need to adjust the format
                let altBodyToSend = bodyToSend;
                
                // If the URL seems to be an admin endpoint, try transforming the body format
                if ((altUrl.includes('/admin/') || altUrl.includes('/admin')) && altBodyToSend) {
                  try {
                    // Try to parse the body if it's a string
                    const parsedBody = typeof altBodyToSend === 'string' ? JSON.parse(altBodyToSend) : altBodyToSend;
                    
                    // Check if this is an admin attendance format and transform accordingly
                    if (parsedBody.class_id && parsedBody.records) {
                      // Construct admin-style payload
                      const adminPayload = {
                        class_id: parsedBody.class_id,
                        date: parsedBody.date || new Date().toISOString().split('T')[0],
                        admin_id: parsedBody.admin_id || 'admin',
                        records: parsedBody.records
                      };
                      
                      altBodyToSend = JSON.stringify(adminPayload);
                      debugLog(`Transformed payload for admin endpoint: ${altUrl}`);
                    }
                  } catch (parseError) {
                    debugLog(`Error transforming payload for ${altUrl}: ${parseError.message}`);
                  }
                }
                
                try {
                  // For GET requests, don't include a body
                  const requestOptions = {
                    method: method,
                    headers: altHeaders
                  };
                  
                  // Only add body for non-GET requests
                  if (method !== 'GET') {
                    requestOptions.body = altBodyToSend;
                  }
                  
                  const altResponse = await fetch(altUrl, requestOptions);
                  
                  debugLog(`Alternative sync response for ${altUrl} (${method}): ${altResponse.status} ${altResponse.statusText}`);
                  
                  if (altResponse.ok) {
                    response = altResponse;
                    succeeded = true;
                    debugLog(`Successfully synced with alternative URL: ${altUrl} using method ${method}`);
                    break;
                  }
                } catch (fetchError) {
                  debugLog(`Fetch error with ${altUrl} (${method}): ${fetchError.message}`);
                }
              }
              
              if (succeeded) break;
            }
          }
          
          if (succeeded) {
            // Remove the successfully synced record
            await new Promise((resolve, reject) => {
              const transaction = db.transaction([ATTENDANCE_STORE], 'readwrite');
              const store = transaction.objectStore(ATTENDANCE_STORE);
              const request = store.delete(record.timestamp);
              
              request.onsuccess = () => {
                debugLog(`Successfully synced and removed record: ${record.timestamp}`);
                syncStats.synced++;
                resolve();
              };
              
              request.onerror = event => {
                debugLog(`Error deleting record: ${event.target.error}`);
                reject(event.target.error);
              };
            });
          } else {
            batchSuccess = false;
            syncStats.failed++;
            
            // Try to get more detailed error information
            let errorText = '';
            try {
              const contentType = response?.headers?.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const errorJson = await response.json();
                errorText = JSON.stringify(errorJson);
                debugLog(`JSON error response: ${errorText}`);
              } else {
                errorText = await response.text();
                debugLog(`Text error response: ${errorText}`);
              }
            } catch (parseError) {
              errorText = `Failed to parse error response: ${parseError.message}`;
              debugLog(errorText);
            }
            
            debugLog(`Failed to sync record ${record.timestamp}: All methods and URLs failed`);
            
            // Store only the first 200 characters of the error for the report
            syncStats.errors.push({
              id: record.timestamp,
              url: url,
              method: originalMethod,
              status: response?.status,
              statusText: response?.statusText,
              message: errorText.substring(0, 200) + (errorText.length > 200 ? '...' : '')
            });
          }
        } catch (error) {
          batchSuccess = false;
          syncStats.failed++;
          debugLog(`Network error while syncing record ${record.timestamp}: ${error.message}`);
          syncStats.errors.push({
            id: record.timestamp,
            message: error.message
          });
        }
      }
      
      // If any record in the batch failed, pause briefly before continuing
      if (!batchSuccess) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Check if any records remain
    const remainingRecords = await new Promise((resolve, reject) => {
      const transaction = db.transaction([ATTENDANCE_STORE], 'readonly');
      const store = transaction.objectStore(ATTENDANCE_STORE);
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };
      
      countRequest.onerror = event => {
        debugLog(`Error getting count: ${event.target.error}`);
        reject(event.target.error);
      };
    });
    
    db.close();
    
    if (remainingRecords > 0) {
      debugLog(`Sync partially completed. ${remainingRecords} records still pending.`);
      return {
        success: syncStats.synced > 0,
        synced: syncStats.synced,
        failed: syncStats.failed,
        total: syncStats.total,
        pending: remainingRecords,
        errors: syncStats.errors,
        message: `Sync partially completed. ${syncStats.synced} synced, ${remainingRecords} still pending.`,
        timestamp: new Date().toISOString()
      };
    } else {
      debugLog('All attendance records successfully synced');
      return {
        success: true,
        synced: syncStats.synced,
        failed: syncStats.failed,
        total: syncStats.total,
        pending: 0,
        message: 'All attendance records successfully synced',
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    debugLog(`Error during attendance sync: ${error.message}`);
    return {
      success: false,
      synced: 0,
      failed: 0,
      total: 0,
      error: error.message,
      message: `Error during attendance sync: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Enhance the sync event listener to provide better feedback
self.addEventListener('sync', event => {
  debugLog('[ServiceWorker] Background sync event:', event.tag);
  
  if (event.tag === 'sync-attendance' || event.tag === 'sync-all') {
    event.waitUntil(
      syncOfflineAttendance()
        .then(results => {
          debugLog('[ServiceWorker] Background sync completed:', results);
          
          // Notify all clients about the sync results
          return self.clients.matchAll()
            .then(clients => {
              for (const client of clients) {
                client.postMessage({
                  type: 'SYNC_COMPLETED',
                  syncResults: results
                });
              }
            });
            })
            .catch(error => {
          debugLog('[ServiceWorker] Background sync failed:', error);
          
          // Notify all clients about the sync failure
          return self.clients.matchAll()
            .then(clients => {
              for (const client of clients) {
                client.postMessage({
                  type: 'SYNC_FAILED',
                  error: error.message
                });
              }
            });
        })
    );
  }
});

// Add new event listener for periodic sync if supported
self.addEventListener('periodicsync', event => {
  debugLog('[ServiceWorker] Periodic sync event:', event.tag);
  
  if (event.tag === 'periodic-attendance-sync') {
    event.waitUntil(
      syncOfflineAttendance()
        .then(results => {
          debugLog('[ServiceWorker] Periodic sync completed:', results);
        })
        .catch(error => {
          debugLog('[ServiceWorker] Periodic sync failed:', error);
        })
    );
  }
});

// Add a message handler to allow manual syncing from clients
self.addEventListener('message', event => {
  debugLog(`Message received: ${JSON.stringify(event.data)}`);
  
  if (event.data && event.data.type === 'SYNC_NOW') {
    debugLog('Manual sync requested by client');
    event.waitUntil(
      syncOfflineAttendance()
        .then(results => {
          // Respond directly to the client that initiated the sync
          event.source.postMessage({
            type: 'SYNC_COMPLETED',
            syncResults: results
          });
        })
        .catch(error => {
          // Respond with error to the client that initiated the sync
          event.source.postMessage({
            type: 'SYNC_FAILED',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        })
    );
  } else if (event.data && event.data.type === 'CHECK_PENDING_SYNC') {
    // Check if we have pending records to sync and report back to the client
    debugLog('Client requested pending sync count');
    event.waitUntil(
      (async () => {
        try {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('tdr-offline-db', 1);
            request.onerror = event => reject(event.target.error);
            request.onsuccess = event => resolve(event.target.result);
            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
                db.createObjectStore(ATTENDANCE_STORE, { keyPath: 'timestamp' });
              }
            };
          });
          
          if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
            event.source.postMessage({
              type: 'PENDING_SYNC_COUNT',
              count: 0
            });
            return;
          }
          
          const count = await new Promise((resolve, reject) => {
            const transaction = db.transaction([ATTENDANCE_STORE], 'readonly');
            const store = transaction.objectStore(ATTENDANCE_STORE);
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = event => reject(event.target.error);
          });
          
          event.source.postMessage({
            type: 'PENDING_SYNC_COUNT',
            count: count
          });
        } catch (error) {
          debugLog(`Error checking pending sync count: ${error.message}`);
          event.source.postMessage({
            type: 'PENDING_SYNC_COUNT',
            count: 0,
            error: error.message
          });
        }
      })()
    );
  }
});
