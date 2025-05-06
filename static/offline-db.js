/**
 * Utility functions for offline database operations using IndexedDB
 */

// Control console output with this function (globally accessible)
function dbLog(message, type = 'info') {
    // Only log errors, initialization logs are suppressed
    if (type === 'error') {
        console.log('OfflineDB error: ' + message);
    }
    // Initialization is silent
}

// Only define OfflineDB if it doesn't already exist
window.OfflineDB = window.OfflineDB || (function() {
    const DB_NAME = 'tdr-offline-db';
    const DB_VERSION = 1;
    const ATTENDANCE_STORE = 'offline-attendance';
    const CACHE_STORE = 'offline-cache';
    let db = null;
    
    // Track offline status for sync purposes
    let wasOffline = !navigator.onLine;
    
    // Initialize periodic connectivity check
    setInterval(() => {
        if (navigator.onLine && wasOffline) {
            // We need to use the returned object's method since this runs before the return
            setTimeout(() => {
                if (window.OfflineDB && typeof window.OfflineDB.syncAttendanceRecords === 'function') {
                    window.OfflineDB.syncAttendanceRecords();
                }
            }, 1000);
        }
        
        wasOffline = !navigator.onLine;
    }, 30000); // Check every 30 seconds

    // Add online event listener to perform sync
    window.addEventListener('online', () => {
        // We need to use the returned object's method since this runs before the return
        setTimeout(() => {
            if (window.OfflineDB && typeof window.OfflineDB.syncAttendanceRecords === 'function') {
                window.OfflineDB.syncAttendanceRecords();
            }
        }, 1000);
    });

    /**
     * Private function to open the database
     */
    function openDatabase() {
        return new Promise((resolve, reject) => {
            // Force close any existing connection
            if (db) {
                try {
                    db.close();
                    db = null;
                } catch (err) {
                    // Silent error
                }
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = event => {
                dbLog('Error opening database', 'error');
                // Show toast notification if available
                if (window.AttendanceUtils && window.AttendanceUtils.showToast) {
                    window.AttendanceUtils.showToast(
                        'Failed to open offline database: ' + event.target.error.message,
                        'error'
                    );
                }
                reject(event.target.error);
            };

            request.onsuccess = event => {
                db = event.target.result;
                
                // Set up error handler for the database connection
                db.onerror = event => {
                    dbLog('Database error', 'error');
                };
                
                resolve(db);
            };

            request.onupgradeneeded = event => {
                const db = event.target.result;

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
                    const store = db.createObjectStore(ATTENDANCE_STORE, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains(CACHE_STORE)) {
                    const store = db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    
    /**
     * Save attendance record to IndexedDB for offline use
     * @param {Object} record - The attendance record to save
     * @returns {Promise} Promise that resolves when the record is saved
     */
    async function saveAttendanceRecord(record) {
        try {
            const db = await openDatabase();
            return new Promise((resolve, reject) => {
                // Make sure we're using the correct store name
                const transaction = db.transaction([ATTENDANCE_STORE], 'readwrite');
                const store = transaction.objectStore(ATTENDANCE_STORE);
                
                // Prepare the API request information
                let url = record.url || '/api/attendance';
                let method = record.method || 'POST';
                let headers = [];
                
                // Add timestamp as the keyPath
                const timestamp = new Date().toISOString();
                
                // Get the CSRF token
                try {
                    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
                    if (csrfMeta) {
                        const token = csrfMeta.getAttribute('content');
                        if (token) {
                            // Add to headers array
                            headers.push(['X-CSRFToken', token]);
                            headers.push(['Content-Type', 'application/json']);
                        } else {
                            dbLog('CSRF token meta tag found but content is empty', 'error');
                            // Try to show a notification
                            showNotification('Security token is missing. Please refresh the page.', 'warning');
                        }
                    } else {
                        dbLog('CSRF token meta tag not found in the document', 'error');
                        // Try to show a notification
                        showNotification('Security token not found. Please refresh the page.', 'warning');
                    }
                } catch (error) {
                    dbLog('Error getting CSRF token', 'error');
                }
                
                // Check if we need to transform the record into a specific format
                let body = '';
                let recordUrl = url;

                if (typeof record.body === 'string') {
                    // Already serialized
                    body = record.body;
                } else if (record.data && record.data.class_id) {
                    // This is the format used by instructor-mark-attendance-new.js
                    body = JSON.stringify(record.data);
                    // Make sure we use the correct API endpoint
                    recordUrl = '/api/attendance/save';
                } else if (record.attendanceData || record.classId) {
                    // Legacy attendance format - create API payload
                    const data = {
                        class_id: record.classId,
                        attendance_data: record.attendanceData || [],
                        date: record.date
                    };
                    
                    // If using the older format, convert it
                    if (record.studentId && !data.attendance_data.length) {
                        data.attendance_data = [{
                            student_id: record.studentId,
                            status: record.status,
                            notes: record.notes || ''
                        }];
                    }
                    
                    body = JSON.stringify(data);
                } else {
                    // Assume it's a JSON object
                    body = JSON.stringify(record);
                }
                
                // Create record to save
                const recordToSave = {
                    timestamp,
                    url: recordUrl,
                    method,
                    headers,
                    body,
                    synced: false,
                    createdAt: new Date().getTime()
                };
                
                const request = store.add(recordToSave);
                
                request.onsuccess = event => {
                    const timestamp = recordToSave.timestamp;
                    
                    // Check pending count
                    checkPendingCount().then(count => {
                        showNotification(
                            `Attendance record saved offline. ${count} record(s) will sync when online.`,
                            'success'
                        );
                    });
                    
                    resolve(timestamp);
                };
                
                request.onerror = event => {
                    dbLog('Error saving attendance record', 'error');
                    showNotification(
                            'Failed to save attendance record offline: ' + event.target.error.message,
                            'error'
                        );
                    reject(event.target.error);
                };
            });
        } catch (error) {
            dbLog('Failed to save attendance record', 'error');
            showNotification(
                    'Failed to save attendance record: ' + error.message,
                    'error'
                );
            throw error;
        }
    }
    
    /**
     * Get all pending attendance records
     * @returns {Promise} Promise that resolves with an array of pending records
     */
    async function getPendingAttendanceRecords() {
        try {
            const db = await openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([ATTENDANCE_STORE], 'readonly');
                const store = transaction.objectStore(ATTENDANCE_STORE);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = event => {
                    dbLog('Error getting pending records', 'error');
                    reject(event.target.error);
                };
                
                transaction.oncomplete = () => {
                    db.close();
                };
            });
        } catch (error) {
            dbLog('Failed to get pending records', 'error');
            throw error;
        }
    }
    
    /**
     * Delete a pending attendance record
     * @param {number} id - The ID of the record to delete
     * @returns {Promise} Promise that resolves when the record is deleted
     */
    async function deletePendingRecord(id) {
        try {
            const db = await openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([ATTENDANCE_STORE], 'readwrite');
                const store = transaction.objectStore(ATTENDANCE_STORE);
                const request = store.delete(id);
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = event => {
                    dbLog('Error deleting record', 'error');
                    reject(event.target.error);
                };
                
                transaction.oncomplete = () => {
                    db.close();
                };
            });
        } catch (error) {
            dbLog('Failed to delete record', 'error');
            throw error;
        }
    }
    
    /**
     * Cache data for offline use
     * @param {string} key - The key to store the data under
     * @param {any} data - The data to cache
     * @returns {Promise} Promise that resolves when the data is cached
     */
    async function cacheData(key, data) {
        try {
            const db = await openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([CACHE_STORE], 'readwrite');
                const store = transaction.objectStore(CACHE_STORE);
                
                const request = store.put({
                    key,
                    data,
                    timestamp: new Date().toISOString()
                });
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = event => {
                    dbLog('Error caching data', 'error');
                    reject(event.target.error);
                };
                
                transaction.oncomplete = () => {
                    db.close();
                };
            });
        } catch (error) {
            dbLog('Failed to cache data', 'error');
            throw error;
        }
    }
    
    /**
     * Get cached data
     * @param {string} key - The key of the cached data
     * @returns {Promise} Promise that resolves with the cached data
     */
    async function getCachedData(key) {
        try {
            const db = await openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([CACHE_STORE], 'readonly');
                const store = transaction.objectStore(CACHE_STORE);
                const request = store.get(key);
                
                request.onsuccess = () => {
                    resolve(request.result ? request.result.data : null);
                };
                
                request.onerror = event => {
                    dbLog('Error getting cached data', 'error');
                    reject(event.target.error);
                };
                
                transaction.oncomplete = () => {
                    db.close();
                };
            });
        } catch (error) {
            dbLog('Failed to get cached data', 'error');
            return null;
        }
    }
    
    /**
     * Sync all pending attendance records with the server
     * @returns {Promise} Promise that resolves when all records are synced
     */
    async function syncAttendanceRecords() {
        if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
            showNotification('Service worker not available. Please refresh the page.', 'error');
            dbLog('Service worker not available for sync', 'error');
            return false;
        }
        
        try {
            // Check if we have background sync capability
            if ('sync' in navigator.serviceWorker) {
                try {
                    await navigator.serviceWorker.ready;
                    await navigator.serviceWorker.sync.register('sync-attendance');
                    showNotification('Synchronization scheduled', 'info');
                    return true;
                } catch (error) {
                    dbLog('Failed to register background sync', 'error');
                    // Fall back to message-based sync
                }
            }
            
            // If background sync is not available or fails, use message-based sync
            return new Promise((resolve, reject) => {
                const messageChannel = new MessageChannel();
                let syncTimeout;
                
                // Set up message handler for response
                messageChannel.port1.onmessage = (event) => {
                    clearTimeout(syncTimeout);
                    
                    if (event.data.type === 'SYNC_COMPLETED') {
                        const results = event.data.syncResults;
                        
                        if (results.total === 0) {
                            showNotification('No pending records to sync', 'info');
                        } else if (results.synced === results.total) {
                            showNotification(`Successfully synced ${results.synced} attendance records`, 'success');
                        } else if (results.synced > 0) {
                            showNotification(`Synced ${results.synced} of ${results.total} records. ${results.failed} failed.`, 'warning');
                        } else {
                            showNotification(`Failed to sync ${results.failed} attendance records`, 'error');
                        }
                        
                        resolve(results.synced > 0);
                    } else if (event.data.type === 'SYNC_FAILED') {
                        dbLog('Sync failed', 'error');
                        showNotification(`Sync failed: ${event.data.error}`, 'error');
                        resolve(false);
                    }
                };
                
                // Set a timeout in case the service worker doesn't respond
                syncTimeout = setTimeout(() => {
                    showNotification('Sync request timed out. Please try again.', 'error');
                    resolve(false);
                }, 30000); // 30 seconds timeout
                
                // Send the sync message to the service worker
                navigator.serviceWorker.controller.postMessage(
                    { type: 'SYNC_NOW' },
                    [messageChannel.port2]
                );
            });
        } catch (error) {
            dbLog('Error initiating sync', 'error');
            showNotification(`Failed to start sync: ${error.message}`, 'error');
            return false;
        }
    }
    
    /**
     * Register for background sync if supported
     * @returns {Promise} Promise that resolves when registration completes
     */
    function registerBackgroundSync() {
        return new Promise((resolve) => {
            // Only try if we have the required APIs
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
                // Check if we're on HTTPS or localhost (required for background sync)
                const isSecureContext = window.isSecureContext || 
                    location.hostname === 'localhost' || 
                    location.hostname === '127.0.0.1';
                
                if (!isSecureContext) {
                    // Resolve without error - this is expected on HTTP
                    return resolve({ 
                        success: false, 
                        message: 'Background sync requires HTTPS',
                        fallback: true
                    });
                }
                
            navigator.serviceWorker.ready
                .then(registration => {
                    return registration.sync.register('sync-attendance');
                })
                .then(() => {
                        resolve({ success: true });
                })
                .catch(error => {
                        // Don't treat this as fatal
                        resolve({ 
                            success: false, 
                            message: error.message,
                            fallback: true
                        });
                    });
            } else {
                // Resolve without error - this is expected in some browsers
                resolve({ 
                    success: false, 
                    message: 'Background sync not supported',
                    fallback: true
                });
        }
        });
    }
    
    /**
     * Check if the browser is online
     * @returns {boolean} True if online, false otherwise
     */
    function isOnline() {
        return navigator.onLine;
    }
    
    /**
     * Add online/offline event listeners
     * @param {Function} onlineCallback - Function to call when online
     * @param {Function} offlineCallback - Function to call when offline
     */
    function addConnectivityListeners(onlineCallback, offlineCallback) {
        window.addEventListener('online', () => {
            if (typeof onlineCallback === 'function') {
                onlineCallback();
            }
            
            // Try to sync pending records when we come back online
            syncAttendanceRecords()
                .then(result => {
                    if (result) {
                        try {
                            if (window.AttendanceUtils && window.AttendanceUtils.showToast) {
                                window.AttendanceUtils.showToast(
                                    'Synchronization completed successfully',
                                    'success'
                                );
                            }
                        } catch (error) {
                            dbLog('Error showing toast', 'error');
                        }
                    }
                })
                .catch(error => {
                    dbLog('Error syncing records', 'error');
                });
        });
        
        window.addEventListener('offline', () => {
            if (typeof offlineCallback === 'function') {
                offlineCallback();
            }
            
            // Show offline notification
            try {
                if (window.AttendanceUtils && window.AttendanceUtils.showToast) {
                    window.AttendanceUtils.showToast(
                        'You are offline. Changes will be saved locally and synced when you reconnect.',
                        'warning'
                    );
                }
            } catch (error) {
                dbLog('Error showing toast', 'error');
            }
        });
    }
    
    /**
     * Check the number of pending attendance records
     * @returns {Promise<number>} Promise that resolves with the count of pending records
     */
    async function checkPendingCount() {
        // First try to get the count from the service worker
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
                return new Promise((resolve) => {
                    const messageChannel = new MessageChannel();
                    let timeoutId;
                    
                    // Set up message handler for response
                    messageChannel.port1.onmessage = (event) => {
                        clearTimeout(timeoutId);
                        if (event.data && event.data.type === 'PENDING_SYNC_COUNT') {
                            resolve(event.data.count);
                        } else {
                            // Fallback to local count if unexpected response
                            getPendingCount().then(resolve);
                        }
                    };
                    
                    // Set a timeout in case the service worker doesn't respond
                    timeoutId = setTimeout(() => {
                        dbLog('Timeout waiting for service worker response', 'error');
                        getPendingCount().then(resolve);
                    }, 3000);
                    
                    // Send the check pending count message to the service worker
                    navigator.serviceWorker.controller.postMessage(
                        { type: 'CHECK_PENDING_SYNC' },
                        [messageChannel.port2]
                    );
                });
            } catch (error) {
                dbLog('Error checking pending count with SW', 'error');
                return getPendingCount();
            }
        } else {
            // Fallback to local count if service worker not available
            return getPendingCount();
        }
    }
    
    /**
     * Get the count of pending records from IndexedDB directly
     * @returns {Promise<number>} Promise that resolves with the count
     */
    async function getPendingCount() {
        try {
            const db = await openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([ATTENDANCE_STORE], 'readonly');
                const store = transaction.objectStore(ATTENDANCE_STORE);
                const countRequest = store.count();
                
                countRequest.onsuccess = () => {
                    resolve(countRequest.result);
                };
                
                countRequest.onerror = event => {
                    dbLog('Error getting record count', 'error');
                    reject(event.target.error);
                };
                
                transaction.oncomplete = () => {
                    db.close();
                };
            });
        } catch (error) {
            dbLog('Failed to get record count', 'error');
            return 0;
        }
    }
    
    // Public API
    return {
        saveAttendanceRecord,
        getPendingAttendanceRecords,
        syncAttendanceRecords,
        cacheData,
        getCachedData,
        registerBackgroundSync,
        isOnline,
        addConnectivityListeners,
        openDatabase,  // Expose the openDatabase function
        checkPendingCount // Expose the checkPendingCount function
    };
})();

// Make the module available globally
window.OfflineDB = OfflineDB;

// Initialize the database immediately when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Force IndexedDB initialization
    try {
        // Check for IndexedDB support
        if (!window.indexedDB) {
            dbLog('Browser does not support IndexedDB', 'error');
            // Show toast notification if available
            if (window.AttendanceUtils && window.AttendanceUtils.showToast) {
                window.AttendanceUtils.showToast(
                    'Your browser does not support offline functionality. Please use a modern browser.',
                    'error'
                );
            }
            return;
        }
        
        // Initialize database
        if (typeof OfflineDB.openDatabase === 'function') {
            // Open the database to ensure it's created
            OfflineDB.openDatabase().then(() => {
                dbLog('', 'init');
                // Show toast notification if available
                if (window.AttendanceUtils && window.AttendanceUtils.showToast) {
                    window.AttendanceUtils.showToast(
                        'Offline database initialized. You can now work offline.',
                        'success'
                    );
                }
            }).catch(error => {
                dbLog('Failed to initialize database', 'error');
                // Show toast notification if available
                if (window.AttendanceUtils && window.AttendanceUtils.showToast) {
                    window.AttendanceUtils.showToast(
                        'Failed to initialize offline database. Some features may not work.',
                        'error'
                    );
                }
            });
        } else {
            // Try to initialize by calling another function that uses the database
            OfflineDB.getPendingAttendanceRecords().then(() => {
                dbLog('', 'init');
            }).catch(error => {
                dbLog('Failed to initialize database', 'error');
            });
        }
    } catch (error) {
        dbLog('Error during initialization', 'error');
    }
});

// Helper function to show notifications
function showNotification(message, type = 'info') {
    // Only log errors - not every notification
    if (type === 'error') {
        dbLog(message, 'error');
    }
    
    // Use AttendanceUtils.showToast if available
    if (window.AttendanceUtils && window.AttendanceUtils.showToast) {
        window.AttendanceUtils.showToast(message, type);
    } else if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        // Fallback to alert for critical errors
        if (type === 'error') {
            alert(message);
        }
    }
}

// Add event listener for sync messages from service worker
navigator.serviceWorker.addEventListener('message', (event) => {
    if (!event.data || !event.data.type) return;
    
    switch (event.data.type) {
        case 'SYNC_COMPLETED':
            const results = event.data.syncResults || { 
                total: 0, 
                synced: 0, 
                failed: 0,
                success: false,
                message: 'Unknown sync result'
            };
            
            if (results.total === 0) {
                showNotification('No pending records to sync', 'info');
            } else if (results.success && results.synced === results.total) {
                showNotification(`Successfully synced ${results.synced} attendance records`, 'success');
            } else if (results.synced > 0) {
                showNotification(`Synced ${results.synced} of ${results.total} records. ${results.failed} failed.`, 'warning');
                // Show a more detailed error if available
                if (results.errors && results.errors.length > 0) {
                    if (results.errors[0].message) {
                        showNotification(`Error: ${results.errors[0].message}`, 'error');
                    }
                }
            } else {
                showNotification(`Failed to sync attendance records: ${results.message || 'Unknown error'}`, 'error');
                // Show a more detailed error if available
                if (results.errors && results.errors.length > 0) {
                    if (results.errors[0].message) {
                        showNotification(`Error: ${results.errors[0].message}`, 'error');
                    }
                }
            }
            break;
            
        case 'SYNC_FAILED':
            showNotification(`Sync failed: ${event.data.error}`, 'error');
            break;
            
        case 'PENDING_SYNC_COUNT':
            // This is handled directly by the checkPendingCount function
            break;
    }
});