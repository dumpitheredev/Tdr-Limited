/**
 * Modal Helpers - Shared utility functions for modal management
 * 
 * This file contains common functions used across different modal implementations
 * to reduce code duplication and improve maintainability.
 */

/**
 * Clean up the modal backdrop to prevent it from persisting
 * @param {string} modalId - Optional ID of the modal element to clean up
 */
function cleanupModalBackdrop(modalId) {
    try {
        if (modalId) {
            // Only clean up specific modal
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                // Try to use Bootstrap's API first
                try {
                    const bsModal = bootstrap.Modal.getInstance(modalElement);
                    if (bsModal) {
                        bsModal.hide();
                    }
                } catch (err) {
                    // Not a problem if Bootstrap instance not found
                }
                
                // Find and remove only backdrops that belong to this modal
                const backdropForModal = document.querySelector(`.modal-backdrop[data-modal-id="${modalId}"]`);
                if (backdropForModal) {
                    backdropForModal.remove();
                }
            }
        } else {
            // Only remove "stray" backdrops - those that don't have a visible modal
            const visibleModals = Array.from(document.querySelectorAll('.modal.show'));
            if (visibleModals.length === 0) {
                // No visible modals, safe to remove all backdrops
                document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
                    backdrop.remove();
                });
                
                // Only reset body classes if no modals are visible
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('padding-right');
                document.body.style.removeProperty('overflow');
            }
        }
    } catch (error) {
        console.error('Error cleaning up modal backdrop:', error);
    }
}

/**
 * Initialize a modal with proper event handlers
 * @param {string} modalId - ID of the modal element
 * @param {Function} [onShow] - Callback function when modal is shown
 * @param {Function} [onHide] - Callback function when modal is hidden
 * @returns {Object|null} - Bootstrap modal instance or null if not found
 */
function initializeModal(modalId, onShow = null, onHide = null) {
    try {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.error(`Modal element not found: ${modalId}`);
            return null;
        }
        
        // Clean up any existing backdrops first
        cleanupModalBackdrop();
        
        // Try to get existing instance
        let modalInstance;
        try {
            modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (!modalInstance) {
                modalInstance = new bootstrap.Modal(modalElement);
            }
        } catch (err) {
            console.warn(`Could not get Bootstrap modal instance for ${modalId}, creating new one:`, err);
            modalInstance = new bootstrap.Modal(modalElement);
        }
        
        // Set up event handlers
        if (onShow) {
            modalElement.addEventListener('shown.bs.modal', onShow);
        }
        
        if (onHide) {
            modalElement.addEventListener('hidden.bs.modal', onHide);
        }
        
        // Always add cleanup on hide
        modalElement.addEventListener('hidden.bs.modal', () => {
            cleanupModalBackdrop(modalId);
        });
        
        return modalInstance;
    } catch (error) {
        console.error(`Error initializing modal ${modalId}:`, error);
        return null;
    }
}

/**
 * Show a modal with proper initialization and error handling
 * @param {string} modalId - ID of the modal element
 * @param {Function} [onShow] - Callback function when modal is shown
 * @param {Function} [onHide] - Callback function when modal is hidden
 * @returns {boolean} - Whether the modal was successfully shown
 */
function showModal(modalId, onShow = null, onHide = null) {
    try {
        const modalInstance = initializeModal(modalId, onShow, onHide);
        if (!modalInstance) {
            return false;
        }
        
        modalInstance.show();
        return true;
    } catch (error) {
        console.error(`Error showing modal ${modalId}:`, error);
        return false;
    }
}

/**
 * Hide a modal with proper cleanup
 * @param {string} modalId - ID of the modal element
 * @returns {boolean} - Whether the modal was successfully hidden
 */
function hideModal(modalId) {
    try {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.error(`Modal element not found: ${modalId}`);
            return false;
        }
        
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        } else {
            // Fallback if no Bootstrap instance
            modalElement.classList.remove('show');
            modalElement.style.display = 'none';
            modalElement.setAttribute('aria-hidden', 'true');
            modalElement.removeAttribute('aria-modal');
            
            // Clean up backdrop manually
            cleanupModalBackdrop(modalId);
        }
        
        return true;
    } catch (error) {
        console.error(`Error hiding modal ${modalId}:`, error);
        return false;
    }
}

/**
 * Promise-based function to load Flatpickr library
 * @returns {Promise} Promise that resolves when Flatpickr is loaded
 */
function loadFlatpickrLibrary() {
    return new Promise((resolve, reject) => {
        // Check if Flatpickr is already loaded
        if (typeof flatpickr === 'function') {
            resolve();
            return;
        }
        
        // Keep track of what needs to be loaded
        const resources = {
            script: false,
            css: false
        };
        
        // Function to check if everything is loaded
        function checkLoaded() {
            if (resources.script && resources.css && typeof flatpickr === 'function') {
                resolve();
            }
        }
        
        // Load Flatpickr CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
        cssLink.onload = function() {
            resources.css = true;
            checkLoaded();
        };
        cssLink.onerror = function(error) {
            reject(new Error('Failed to load Flatpickr CSS'));
        };
        document.head.appendChild(cssLink);
        
        // Load Flatpickr JS
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
        script.onload = function() {
            resources.script = true;
            checkLoaded();
        };
        script.onerror = function(error) {
            reject(new Error('Failed to load Flatpickr script'));
        };
        document.head.appendChild(script);
        
        // Set a timeout to reject the promise if loading takes too long
        setTimeout(() => {
            if (!(resources.script && resources.css)) {
                reject(new Error('Timed out loading Flatpickr'));
            }
        }, 10000); // 10 second timeout
    });
}

/**
 * Initialize date pickers for filtering
 * @param {string} startDateId - ID of the start date input element
 * @param {string} endDateId - ID of the end date input element
 * @param {Function} [onChange] - Callback function when dates change
 * @returns {Object|null} - Object with flatpickr instances or null if initialization failed
 */
function initializeDatePickers(startDateId, endDateId, onChange = null) {
    try {
        const startDateInput = document.getElementById(startDateId);
        const endDateInput = document.getElementById(endDateId);
        
        if (!startDateInput || !endDateInput) {
            console.error(`Date inputs not found: ${startDateId} or ${endDateId}`);
            return null;
        }
        
        // Check if flatpickr is available
        if (typeof flatpickr !== 'function') {
            // Remove console log about Flatpickr library not loaded
            
            // Use native date inputs as fallback initially
            startDateInput.type = 'date';
            endDateInput.type = 'date';
            
            // Try to load flatpickr dynamically
            loadFlatpickrLibrary().then(() => {
                // Once loaded, initialize flatpickr
                if (typeof flatpickr === 'function') {
                    const pickers = initializeFlatpickrInstances(startDateInput, endDateInput, onChange);
                    return pickers;
                }
            }).catch(error => {
                console.error('Failed to load Flatpickr dynamically:', error);
                // Ensure native date inputs are set up
                if (onChange) {
                    startDateInput.addEventListener('change', onChange);
                    endDateInput.addEventListener('change', onChange);
                }
            });
            
            return null;
        }
        
        return initializeFlatpickrInstances(startDateInput, endDateInput, onChange);
    } catch (error) {
        console.error('Error initializing date pickers:', error);
        return null;
    }
}

/**
 * Initialize Flatpickr instances for date inputs
 * @param {HTMLElement} startDateInput - Start date input element
 * @param {HTMLElement} endDateInput - End date input element
 * @param {Function} [onChange] - Callback function when dates change
 * @returns {Object} - Object with flatpickr instances
 */
function initializeFlatpickrInstances(startDateInput, endDateInput, onChange = null) {
    // Initialize start date picker
    const startDatePicker = flatpickr(startDateInput, {
        dateFormat: 'Y-m-d',
        maxDate: 'today',
        onChange: (selectedDates) => {
            // Update end date min when start date changes
            if (selectedDates[0]) {
                endDatePicker.set('minDate', selectedDates[0]);
            }
            
            if (onChange) {
                onChange(selectedDates);
            }
        }
    });
    
    // Initialize end date picker
    const endDatePicker = flatpickr(endDateInput, {
        dateFormat: 'Y-m-d',
        maxDate: 'today',
        onChange: (selectedDates) => {
            // Update start date max when end date changes
            if (selectedDates[0]) {
                startDatePicker.set('maxDate', selectedDates[0]);
            }
            
            if (onChange) {
                onChange(selectedDates);
            }
        }
    });
    
    return {
        startDatePicker,
        endDatePicker
    };
}

/**
 * Format a date string to a more readable format
 * @param {string} dateString - Date string in any valid format
 * @param {string} [format='medium'] - Format type: 'short', 'medium', 'long', or 'full'
 * @returns {string} - Formatted date string
 */
function formatDate(dateString, format = 'medium') {
    try {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString; // Return original if invalid
        }
        
        switch (format) {
            case 'short':
                return date.toLocaleDateString();
            case 'long':
                return date.toLocaleDateString(undefined, { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            case 'full':
                return date.toLocaleDateString(undefined, { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            case 'medium':
            default:
                return date.toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
        }
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString; // Return original on error
    }
}

/**
 * Create a status badge with appropriate styling
 * @param {string} status - Status text ('active', 'inactive', etc.)
 * @param {string} [type='default'] - Type of entity for custom styling
 * @returns {string} - HTML string for the badge
 */
function createStatusBadge(status, type = 'default') {
    if (!status) return '';
    
    const statusLower = status.toLowerCase();
    let badgeClass = '';
    
    // Determine badge class based on status
    if (statusLower.includes('active') || statusLower.includes('present')) {
        badgeClass = 'bg-success-subtle text-success';
    } else if (statusLower.includes('inactive') || statusLower.includes('absent')) {
        badgeClass = 'bg-danger-subtle text-danger';
    } else if (statusLower.includes('late') || statusLower.includes('pending')) {
        badgeClass = 'bg-warning-subtle text-warning';
    } else {
        badgeClass = 'bg-secondary-subtle text-secondary';
    }
    
    // Custom styling for specific entity types
    if (type === 'student' && statusLower.includes('active')) {
        badgeClass = 'bg-primary-subtle text-primary';
    } else if (type === 'admin' && statusLower.includes('active')) {
        badgeClass = 'bg-info-subtle text-info';
    }
    
    return `<span class="badge ${badgeClass}">${status}</span>`;
}

// Make functions available globally
window.ModalHelpers = {
    cleanupModalBackdrop,
    initializeModal,
    showModal,
    hideModal,
    initializeDatePickers,
    loadFlatpickrLibrary,
    formatDate,
    createStatusBadge
};
