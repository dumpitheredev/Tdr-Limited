// This function is maintained for backward compatibility
// It will be removed in future versions

// Create a local variable to store a reference to the notification.js showToast function
// This will be initialized when it becomes available
let notificationShowToast = null;

// Function that will be called after notification.js is loaded to register its function
function registerNotificationToast(func) {
    notificationShowToast = func;
}

function showToast(title, message, type = 'success', delay = 3000) {
    console.warn('This showToast function is deprecated. Please use functions from notification.js instead.');
    
    // Use the stored reference if available
    if (notificationShowToast) {
        return notificationShowToast(message, type, title, delay);
    } else {
        console.error('Notification system not available');
    }
}

// Export the registration function
window.registerNotificationToast = registerNotificationToast; 