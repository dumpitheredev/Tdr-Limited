/**
 * TDR Offline Module
 * Handles offline functionality for the TDR Attendance System
 */

// Global offline manager
window.OfflineManager = (() => {
    // Private variables
    let isOnline = navigator.onLine;
    let pendingSync = false;
    let listeners = [];

    // DOM Elements to update
    let statusIndicator = null;
    let offlineIndicators = [];

    // Initialize offline manager
    function init() {
        console.log('Initializing Offline Manager');
        
        // Set up event listeners for online/offline events
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOnlineStatus);
        
        // Set up service worker message listener
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        }
        
        // Find any offline status indicators in the page
        findOfflineIndicators();
        
        // Check if we have pending offline data
        checkPendingData();
        
        // Initial update
        updateUI();
    }

    // Handle online/offline status changes
    function handleOnlineStatus() {
        const wasOnline = isOnline;
        isOnline = navigator.onLine;
        
        console.log(`Connection status changed: ${isOnline ? 'online' : 'offline'}`);
        
        // Update UI
        updateUI();
        
        // If we just came online and have pending data, trigger sync
        if (isOnline && !wasOnline && pendingSync) {
            // Add a small delay to ensure network is stable
            setTimeout(() => {
                console.log('Auto-syncing offline data after coming online');
                triggerSync();
            }, 2000);
        }
        
        // Notify listeners
        notifyListeners({
            type: isOnline ? 'online' : 'offline',
            timestamp: new Date().toISOString()
        });
    }

    // Handle messages from the service worker
    function handleServiceWorkerMessage(event) {
        const message = event.data;
        
        console.log('Received message from service worker:', message);
        
        if (message.type === 'syncComplete') {
            console.log('Sync completed successfully');
            pendingSync = false;
            showSyncNotification('Sync Complete', 'All offline data has been synchronized.', 'success');
            updateUI();
        } else if (message.type === 'syncFailed') {
            console.log('Sync failed:', message.error);
            showSyncNotification('Sync Failed', 'Failed to synchronize offline data. Will try again later.', 'error');
        } else if (message.type === 'cacheCleared') {
            console.log('Cache cleared successfully');
            showSyncNotification('Cache Cleared', 'Application cache has been cleared.', 'info');
        } else if (message.type === 'syncResult') {
            console.log('Sync result received:', message.data);
            // Update UI based on sync results
            if (message.data.success) {
                if (message.data.failedCount > 0) {
                    showSyncNotification(
                        'Sync Partially Complete', 
                        `Synced ${message.data.syncedCount} records. Failed to sync ${message.data.failedCount} records.`, 
                        'warning'
                    );
                } else {
                    showSyncNotification(
                        'Sync Complete', 
                        `Successfully synced ${message.data.syncedCount} attendance records.`, 
                        'success'
                    );
                    pendingSync = false;
                }
            } else {
                showSyncNotification(
                    'Sync Failed', 
                    message.data.message || 'Failed to synchronize offline data.', 
                    'error'
                );
            }
            
            // Always recheck for pending data after a sync attempt
            checkPendingData();
            updateUI();
        }
        
        // Notify listeners
        notifyListeners(message);
    }

    // Find offline indicators in the page
    function findOfflineIndicators() {
        // Look for elements with data-offline-indicator attribute
        offlineIndicators = document.querySelectorAll('[data-offline-indicator]');
        
        // Look for the main status indicator
        statusIndicator = document.getElementById('offline-status');
    }

    // Update UI based on online/offline status
    function updateUI() {
        // Update any offline indicators
        offlineIndicators.forEach(indicator => {
            if (isOnline) {
                indicator.classList.add('d-none');
            } else {
                indicator.classList.remove('d-none');
            }
        });
        
        // Update main status indicator if it exists
        if (statusIndicator) {
            if (isOnline) {
                statusIndicator.classList.remove('bg-danger');
                statusIndicator.classList.add('bg-success');
                statusIndicator.innerHTML = '<i class="bi bi-wifi me-2"></i>Online';
            } else {
                statusIndicator.classList.remove('bg-success');
                statusIndicator.classList.add('bg-danger');
                statusIndicator.innerHTML = '<i class="bi bi-wifi-off me-2"></i>Offline';
            }
        }
        
        // Add/remove offline class to body
        if (isOnline) {
            document.body.classList.remove('is-offline');
        } else {
            document.body.classList.add('is-offline');
        }
    }

    // Check if we have pending data to sync
    function checkPendingData() {
        checkServiceWorkerDB();
        checkAppDB();
    }

    // Check the service worker's IndexedDB for pending records
    function checkServiceWorkerDB() {
        // Check IndexedDB for pending attendance records
        const dbName = 'tdr-offline-db';
        const dbVersion = 1;
        const storeName = 'offline-attendance';
        
        try {
            const request = indexedDB.open(dbName, dbVersion);
            
            request.onsuccess = event => {
                const db = event.target.result;
                
                // Check if the store exists
                if (!db.objectStoreNames.contains(storeName)) {
                    return;
                }
                
                // Check if there are records in the store
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const countRequest = store.count();
                
                countRequest.onsuccess = () => {
                    const count = countRequest.result;
                    
                    if (count > 0) {
                        console.log(`Found ${count} pending records in service worker DB`);
                        pendingSync = true;
                        
                        // Show notification if we're online
                        if (isOnline) {
                            showSyncNotification(
                                'Offline Data Available',
                                `${count} attendance records saved offline. Click to sync now.`,
                                'warning',
                                triggerSync
                            );
                        }
                    }
                    
                    db.close();
                };
            };
            
            request.onerror = () => {
                console.error('Failed to check service worker DB');
            };
        } catch (error) {
            console.error('Error checking service worker DB:', error);
        }
    }

    // Check the app's IndexedDB for pending records
    function checkAppDB() {
        // Check app's IndexedDB for pending attendance records
        const dbName = 'tdr-attendance-db';
        const storeName = 'offlineAttendance';
        
        try {
            const request = indexedDB.open(dbName);
            
            request.onsuccess = event => {
                const db = event.target.result;
                
                // Check if the store exists
                if (!db.objectStoreNames.contains(storeName)) {
                    return;
                }
                
                // Check if there are records in the store
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const countRequest = store.count();
                
                countRequest.onsuccess = () => {
                    const count = countRequest.result;
                    
                    if (count > 0) {
                        console.log(`Found ${count} pending records in app DB`);
                        pendingSync = true;
                        
                        // Show notification if we're online
                        if (isOnline) {
                            showSyncNotification(
                                'Offline Data Available',
                                `${count} attendance records saved offline. Click to sync now.`,
                                'warning',
                                triggerSync
                            );
                        }
                    }
                    
                    db.close();
                };
            };
            
            request.onerror = () => {
                console.error('Failed to check app DB');
            };
        } catch (error) {
            console.error('Error checking app DB:', error);
        }
    }

    // Trigger sync of offline data
    function triggerSync() {
        if (!isOnline) {
            showSyncNotification('Cannot Sync', 'You are offline. Data will sync automatically when you reconnect.', 'warning');
            return;
        }
        
        if (!pendingSync) {
            console.log('No data to sync');
            return;
        }
        
        console.log('Triggering sync of offline data');
        showSyncNotification('Syncing', 'Synchronizing offline attendance data...', 'info');
        
        // Try service worker sync first
        let serviceWorkerSyncAttempted = false;
        
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            serviceWorkerSyncAttempted = true;
            navigator.serviceWorker.controller.postMessage('sync');
            
            // Also try to register background sync in case it works
            try {
                if ('serviceWorker' in navigator && 'SyncManager' in window) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.sync.register('sync-attendance')
                            .then(() => {
                                console.log('Background sync registered during manual sync');
                            })
                            .catch(error => {
                                console.log('Background sync registration failed during manual sync:', error);
                                // Continue with manual sync
                            });
                    });
                }
            } catch (error) {
                console.error('Error trying to register background sync:', error);
            }
        } else {
            console.warn('Service worker not available for sync');
        }
        
        // Also try to sync through the app's offline module if available
        if (window.OfflineDB && typeof window.OfflineDB.syncOfflineData === 'function') {
            window.OfflineDB.syncOfflineData()
                .then(result => {
                    console.log('App offline module sync result:', result);
                    if (result.success) {
                        if (!serviceWorkerSyncAttempted) {
                            // Only show notification if service worker didn't handle it
                            showSyncNotification('Sync Complete', `Successfully synced ${result.syncedCount} attendance records.`, 'success');
                        }
                        
                        // Check if we still have pending data
                        checkPendingData();
                    }
                })
                .catch(error => {
                    console.error('Error syncing through app module:', error);
                    if (!serviceWorkerSyncAttempted) {
                        showSyncNotification('Sync Error', 'Failed to sync some offline data. Will try again later.', 'error');
                    }
                });
        } else if (!serviceWorkerSyncAttempted) {
            showSyncNotification('Sync Failed', 'Offline sync module not available. Please reload the page.', 'error');
        }
    }

    // Show a sync notification
    function showSyncNotification(title, message, type = 'info', onClick = null) {
        // Use the app's toast notification system if available
        if (window.showToast) {
            window.showToast(title, message, type);
        } else {
            // Create a simple toast notification
            const toast = document.createElement('div');
            toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'primary'} border-0`;
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            toast.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">
                        <strong>${title}</strong>: ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            `;
            
            // Add click handler if provided
            if (onClick) {
                toast.addEventListener('click', onClick);
                toast.style.cursor = 'pointer';
            }
            
            // Find or create toast container
            let toastContainer = document.querySelector('.toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
                document.body.appendChild(toastContainer);
            }
            
            // Add toast to container
            toastContainer.appendChild(toast);
            
            // Initialize Bootstrap toast
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }

    // Register a listener for offline events
    function addEventListener(callback) {
        if (typeof callback === 'function') {
            listeners.push(callback);
        }
    }

    // Remove a listener
    function removeEventListener(callback) {
        listeners = listeners.filter(listener => listener !== callback);
    }

    // Notify all listeners
    function notifyListeners(event) {
        listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in offline event listener:', error);
            }
        });
    }

    // Clear all caches
    function clearCache() {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                action: 'clearCache'
            });
            return true;
        }
        return false;
    }

    // Return public API
    return {
        init,
        isOnline: () => isOnline,
        hasPendingSync: () => pendingSync,
        triggerSync,
        clearCache,
        addEventListener,
        removeEventListener
    };
})();

// Initialize offline manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.OfflineManager.init();
}); 