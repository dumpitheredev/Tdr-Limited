/**
 * Shared utility functions for attendance management
 * These functions can be used by both admin and instructor views
 */

// Create a namespace for attendance utilities to avoid conflicts
window.AttendanceUtils = window.AttendanceUtils || {};

// Format utility functions
window.AttendanceUtils.formatDate = function(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

window.AttendanceUtils.formatDateForDisplay = function(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

window.AttendanceUtils.getBadgeClass = function(status) {
    if (!status) return 'bg-secondary-subtle text-secondary';
    
    const statusLower = status.toString().toLowerCase().trim();

    
    // Handle more variations of status values with case insensitivity
    if (statusLower === 'present') {
        return 'bg-success-subtle text-success';
    } else if (statusLower === 'absent') {
        return 'bg-danger-subtle text-danger';
    } else if (statusLower === 'late' || 
               statusLower === 'tardy' || 
               statusLower.includes('late') || 
               statusLower.includes('delay')) {

        return 'bg-warning-subtle text-warning';
    } else {

        return 'bg-secondary-subtle text-secondary';
    }
}

window.AttendanceUtils.getStatusDisplay = function(status) {
    if (!status) return 'Unknown';
    
    const statusLower = status.toString().toLowerCase().trim();

    
    // Handle known status values with proper capitalization
    if (statusLower === 'present') {
        return 'Present';
    } else if (statusLower === 'absent') {
        return 'Absent';
    } else if (statusLower === 'late' || statusLower === 'tardy') {
        return 'Late';
    } else if (statusLower.includes('late') || statusLower.includes('delay')) {

        // Preserve custom late messages but capitalize first letter
        return status.charAt(0).toUpperCase() + status.slice(1);
    } else {
        // Default behavior for unknown status: capitalize first letter
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

// Helper function for API calls
window.AttendanceUtils.fetchWithErrorHandling = async function(url, options = {}) {
    try {
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        const response = await fetch(url, {
            ...options,
            credentials: 'same-origin', 
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'X-CSRFToken': csrfToken 
            }
        });
        
        if (!response.ok) {
            throw new Error(`Network response error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        // Silent error handling for API errors
        // Use the centralized notification system
        if (window.showError) {
            window.showError(`Error: ${error.message}`);
        } else {
            // Notification system not available
        }
        throw error;
    }
};

// Utility function to handle common debouncing logic
window.AttendanceUtils.debounce = function(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

// Add a showToast function for notifications
window.AttendanceUtils.showToast = function(message, type = 'info') {
    // Get the existing toast elements from toast_notification.html
    const toast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toast.querySelector('.toast-header i');
    
    if (!toast || !toastTitle || !toastMessage) {
        // Toast elements not found
        return;
    }
    
    // Set title and icon based on message type
    if (type === 'success') {
        toastTitle.textContent = 'Success';
        toastIcon.className = 'bi bi-check-circle-fill text-success me-2';
    } else if (type === 'error' || type === 'danger') {
        toastTitle.textContent = 'Error';
        toastIcon.className = 'bi bi-exclamation-triangle-fill text-danger me-2';
    } else if (type === 'warning') {
        toastTitle.textContent = 'Warning';
        toastIcon.className = 'bi bi-exclamation-circle-fill text-warning me-2';
    } else {
        toastTitle.textContent = 'Information';
        toastIcon.className = 'bi bi-info-circle-fill text-info me-2';
    }
    
    // Set message content
    toastMessage.textContent = message;
    
    // Show the toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
};

