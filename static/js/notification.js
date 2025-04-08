/**
 * Unified Notification System
 * Combines functionality from utils.js and notification-utils.js
 */

// Global notification manager instance
let notificationManager = null;

/**
 * Create or get the notification manager instance
 * @param {Object} [options] - Configuration options
 * @returns {NotificationManager} - The notification manager instance
 */
function getNotificationManager(options = {}) {
    if (!notificationManager) {
        notificationManager = new NotificationManager(options);
    }
    return notificationManager;
}

/**
 * Show a toast notification (compatibility with previous showToast)
 * @param {string} title - The toast title
 * @param {string} message - The message to display
 * @param {string} type - The toast type (success, error, info, warning)
 * @returns {Object} - The toast instance
 */
function showToast(title, message, type = 'success') {
    const manager = getNotificationManager({
        useBootstrapToasts: true
    });
    
    return manager.showBootstrapToast(title, message, {
        type: type
    });
}

/**
 * NotificationManager - Utility for managing notifications
 */
class NotificationManager {
    /**
     * Constructor
     * @param {Object} [options] - Configuration options
     * @param {string} [options.containerSelector='#notification-container'] - CSS selector for notification container
     * @param {number} [options.defaultDuration=5000] - Default duration in milliseconds
     * @param {boolean} [options.appendToBody=true] - Whether to append container to body if not found
     * @param {boolean} [options.useBootstrapToasts=false] - Whether to use Bootstrap toasts or custom notifications
     */
    constructor(options = {}) {
        this.options = {
            containerSelector: '#notification-container',
            defaultDuration: 5000,
            appendToBody: true,
            useBootstrapToasts: false,
            ...options
        };
        
        this.notificationCounter = 0;
        this.initialize();
    }
    
    /**
     * Initialize the notification container
     */
    initialize() {
        // Initialize custom notification container
        this.container = document.querySelector(this.options.containerSelector);
        
        // Create container if it doesn't exist and appendToBody is true
        if (!this.container && this.options.appendToBody) {
            this.container = document.createElement('div');
            this.container.id = this.options.containerSelector.replace('#', '');
            this.container.classList.add('notification-container');
            document.body.appendChild(this.container);
            
            // Add styles if not already added
            if (!document.getElementById('notification-styles')) {
                const style = document.createElement('style');
                style.id = 'notification-styles';
                style.textContent = `
                    .notification-container {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 9999;
                        max-width: 350px;
                    }
                    .notification {
                        padding: 12px 15px;
                        margin-bottom: 10px;
                        border-radius: 4px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                        transition: all 0.3s ease;
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    .notification.show {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    .notification.success {
                        background-color: #d4edda;
                        color: #155724;
                        border-left: 5px solid #28a745;
                    }
                    .notification.error {
                        background-color: #f8d7da;
                        color: #721c24;
                        border-left: 5px solid #dc3545;
                    }
                    .notification.warning {
                        background-color: #fff3cd;
                        color: #856404;
                        border-left: 5px solid #ffc107;
                    }
                    .notification.info {
                        background-color: #d1ecf1;
                        color: #0c5460;
                        border-left: 5px solid #17a2b8;
                    }
                    .notification-title {
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .notification-content {
                        margin: 0;
                    }
                    .notification-close {
                        float: right;
                        cursor: pointer;
                        font-weight: bold;
                        margin-left: 10px;
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        // Initialize Bootstrap toast container if needed
        if (this.options.useBootstrapToasts) {
            this.toastContainer = document.getElementById('toastContainer');
            if (!this.toastContainer) {
                this.toastContainer = document.createElement('div');
                this.toastContainer.id = 'toastContainer';
                this.toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
                this.toastContainer.style.zIndex = 9999;
                document.body.appendChild(this.toastContainer);
            }
        }
    }
    
    /**
     * Show a Bootstrap toast notification
     * @param {string} title - The toast title
     * @param {string} message - The message to display
     * @param {Object} [options] - Notification options
     * @param {string} [options.type='success'] - Notification type (success, error, warning, info)
     * @param {number} [options.duration=5000] - Duration in milliseconds
     * @returns {Object} - The Bootstrap toast instance
     */
    showBootstrapToast(title, message, options = {}) {
        const type = options.type || 'success';
        const duration = options.duration || this.options.defaultDuration;
        
        // Create the toast element
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        // Set appropriate icon and color based on type
        let iconClass;
        switch (type.toLowerCase()) {
            case 'error':
                iconClass = 'bi-exclamation-triangle-fill text-danger';
                break;
            case 'warning':
                iconClass = 'bi-exclamation-circle-fill text-warning';
                break;
            case 'info':
                iconClass = 'bi-info-circle-fill text-info';
                break;
            case 'success':
            default:
                iconClass = 'bi-check-circle-fill text-success';
                break;
        }
        
        // Create toast content
        toast.innerHTML = `
            <div class="toast-header">
                <i class="bi ${iconClass} me-2"></i>
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        // Add toast to container
        this.toastContainer.appendChild(toast);
        
        // Initialize and show the toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: duration
        });
        
        bsToast.show();
        
        // Remove toast after it's hidden
        toast.addEventListener('hidden.bs.toast', function () {
            toast.remove();
        });
        
        return bsToast;
    }
    
    /**
     * Show a custom notification
     * @param {string} message - Notification message
     * @param {Object} [options] - Notification options
     * @param {string} [options.type='info'] - Notification type (success, error, warning, info)
     * @param {string} [options.title] - Notification title
     * @param {number} [options.duration] - Duration in milliseconds
     * @param {boolean} [options.dismissible=true] - Whether notification is dismissible
     * @returns {Element} - Notification element
     */
    show(message, options = {}) {
        // If set to use Bootstrap toasts, redirect to that method
        if (this.options.useBootstrapToasts) {
            return this.showBootstrapToast(options.title || 'Notification', message, options);
        }
        
        if (!this.container) {
            console.error('Notification container not found');
            return null;
        }
        
        const id = `notification-${++this.notificationCounter}`;
        const type = options.type || 'info';
        const duration = options.duration || this.options.defaultDuration;
        const dismissible = options.dismissible !== undefined ? options.dismissible : true;

        // Create notification element
        const notification = document.createElement('div');
        notification.id = id;
        notification.classList.add('notification', type);
        
        // Add close button if dismissible
        let closeButton = '';
        if (dismissible) {
            closeButton = '<span class="notification-close">&times;</span>';
        }
        
        // Add title if provided
        let titleHtml = '';
        if (options.title) {
            titleHtml = `<div class="notification-title">${options.title}</div>`;
        }
        
        // Set notification content
        notification.innerHTML = `
            ${closeButton}
            ${titleHtml}
            <p class="notification-content">${message}</p>
        `;
        
        // Add event listener to close button
        if (dismissible) {
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => {
                this.dismiss(notification);
            });
        }
        
        // Add to container
        this.container.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }

        return notification;
    }
    
    /**
     * Show a success notification
     * @param {string} message - Notification message
     * @param {Object} [options] - Notification options
     * @returns {Element} - Notification element
     */
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }
    
    /**
     * Show an error notification
     * @param {string} message - Notification message
     * @param {Object} [options] - Notification options
     * @returns {Element} - Notification element
     */
    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error' });
    }
    
    /**
     * Show a warning notification
     * @param {string} message - Notification message
     * @param {Object} [options] - Notification options
     * @returns {Element} - Notification element
     */
    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning' });
    }
    
    /**
     * Show an info notification
     * @param {string} message - Notification message
     * @param {Object} [options] - Notification options
     * @returns {Element} - Notification element
     */
    info(message, options = {}) {
        return this.show(message, { ...options, type: 'info' });
    }
    
    /**
     * Dismiss a notification
     * @param {Element|string} notification - Notification element or ID
     */
    dismiss(notification) {
        // If notification is a string (ID), find the element
        if (typeof notification === 'string') {
            notification = document.getElementById(notification);
        }
        
        if (!notification) return;
        
        // Animate out
        notification.classList.remove('show');
        
        // Remove after animation
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    /**
     * Dismiss all notifications
     */
    dismissAll() {
        // Clear custom notifications
        if (this.container) {
            const notifications = this.container.querySelectorAll('.notification');
            notifications.forEach(notification => {
                this.dismiss(notification);
            });
        }
        
        // Clear Bootstrap toasts
        if (this.toastContainer) {
            const toasts = this.toastContainer.querySelectorAll('.toast');
            toasts.forEach(toast => {
                const bsToast = bootstrap.Toast.getInstance(toast);
                if (bsToast) {
                    bsToast.hide();
                } else {
                    toast.remove();
                }
            });
        }
    }
    
    /**
     * Create a notification for API errors
     * @param {Error} error - Error object
     * @param {string} [defaultMessage='An error occurred'] - Default message if error doesn't have one
     */
    handleApiError(error, defaultMessage = 'An error occurred') {
        let message = defaultMessage;
        
        // Try to extract error message
        if (error.data && error.data.message) {
            message = error.data.message;
        } else if (error.message) {
            message = error.message;
        }
        
        this.error(message, {
            title: 'Error',
            duration: 5000
        });
    }
}

// Make functions available globally
window.showToast = showToast;
window.NotificationManager = NotificationManager;
window.getNotificationManager = getNotificationManager; 