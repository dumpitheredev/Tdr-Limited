/**
 * Notification Service - Centralized utility for displaying toast notifications
 * Uses the toast_notification.html component
 */

// Main notification function
function showToast(message, type = 'info', title = null, duration = 3000) {
    // Get toast elements from toast_notification.html
    const toastElement = document.getElementById('statusToast');
    const toastTitleElement = document.getElementById('toastTitle');
    const toastMessageElement = document.getElementById('toastMessage');
    const toastHeaderIcon = toastElement?.querySelector('.toast-header i');

    if (!toastElement || !toastTitleElement || !toastMessageElement || !toastHeaderIcon) {
        console.error('Toast notification elements not found. Make sure toast_notification.html is included in the page.');
        return;
    }

    // Set the message
    toastMessageElement.textContent = message;

    // Reset all classes
    toastHeaderIcon.classList.remove(
        'text-success', 'text-danger', 'text-warning', 'text-info',
        'bi-check-circle-fill', 'bi-x-circle-fill', 'bi-exclamation-triangle-fill', 'bi-info-circle-fill'
    );

    // Configure based on notification type
        switch (type.toLowerCase()) {
        case 'success':
            toastTitleElement.textContent = title || 'Success';
            toastHeaderIcon.classList.add('text-success', 'bi-check-circle-fill');
            break;
            case 'error':
            toastTitleElement.textContent = title || 'Error';
            toastHeaderIcon.classList.add('text-danger', 'bi-x-circle-fill');
                break;
            case 'warning':
            toastTitleElement.textContent = title || 'Warning';
            toastHeaderIcon.classList.add('text-warning', 'bi-exclamation-triangle-fill');
                break;
            case 'info':
            default:
            toastTitleElement.textContent = title || 'Information';
            toastHeaderIcon.classList.add('text-info', 'bi-info-circle-fill');
                break;
        }
        
    // Show the toast using Bootstrap
    const toast = new bootstrap.Toast(toastElement, { delay: duration });
    toast.show();
    
    return toast; // Return the toast instance in case caller needs to manipulate it
}

// Alternative for showing notifications in specific scenarios
function showNotification(options) {
    const defaultOptions = {
        message: '',
        type: 'info',
        title: null,
        duration: 3000,
        position: 'top-right', // For future expansion if needed
        onClose: null         // For future expansion if needed
    };
    
    const settings = { ...defaultOptions, ...options };
    
    return showToast(settings.message, settings.type, settings.title, settings.duration);
}

// Shorthand methods for common notification types
function showSuccess(message, title = 'Success', duration = 3000) {
    return showToast(message, 'success', title, duration);
}

function showError(message, title = 'Error', duration = 5000) {
    return showToast(message, 'error', title, duration);
}

function showWarning(message, title = 'Warning', duration = 4000) {
    return showToast(message, 'warning', title, duration);
}

function showInfo(message, title = 'Information', duration = 3000) {
    return showToast(message, 'info', title, duration);
}

// API Response notification helper
function showApiResponse(response, successMessage = 'Operation completed successfully') {
    if (response.success) {
        showSuccess(response.message || successMessage);
    } else {
        showError(response.message || 'An error occurred. Please try again.');
    }
}

/**
 * @deprecated Use the standalone notification functions instead
 * NotificationManager class for backward compatibility with existing code
 */
class NotificationManager {
    constructor(options = {}) {
        console.warn('NotificationManager is deprecated. Please use the standalone notification functions instead.');
        // No need for actual initialization, as we're just forwarding to the global functions
    }

    success(message, title = 'Success', duration = 3000) {
        return showSuccess(message, title, duration);
    }

    error(message, title = 'Error', duration = 5000) {
        return showError(message, title, duration);
    }

    warning(message, title = 'Warning', duration = 4000) {
        return showWarning(message, title, duration);
    }

    info(message, title = 'Information', duration = 3000) {
        return showInfo(message, title, duration);
    }

    show(message, options = {}) {
        return showNotification({
            message,
            ...options
            });
        }
    }
    
    /**
 * @deprecated Use the standalone notification functions instead
 * Function to get or create the notification manager
 */
function getNotificationManager(options = {}) {
    console.warn('getNotificationManager is deprecated. Please use the standalone notification functions instead.');
    return new NotificationManager(options);
}

// Export all functions to make them globally available
window.showToast = showToast;
window.showNotification = showNotification;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.showApiResponse = showApiResponse;
window.NotificationManager = NotificationManager;
window.getNotificationManager = getNotificationManager; 

// Register with utils.js if the registration function exists
if (typeof window.registerNotificationToast === 'function') {
    window.registerNotificationToast(showToast);
}

// For module-based imports 
// This export statement is removed because it's not compatible with regular script loading 