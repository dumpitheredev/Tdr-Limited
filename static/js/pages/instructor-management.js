/**
 * Instructor Management Module
 * 
 * This module handles all functionality for the instructor management page including:
 * - Fetching and displaying instructors with pagination
 * - Filtering by status and search
 * - Instructor actions (view, edit, archive)
 * - Managing instructor statistics
 */

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in milliseconds
 * @returns {Function} - The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// State management for instructor data
const state = {
    allData: [],            // All instructor data
    filteredData: [],       // Filtered instructor data
    currentPage: 1,         // Current page for pagination
    rowsPerPage: 5,         // Number of rows per page (default from HTML)
    totalPages: 1,          // Total pages based on filtered data
    currentInstructor: null // Currently selected instructor (for modals)
};

// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
    console.log('Instructor management page loaded'); // Added log
});

// ------------------- Core Functions -------------------

/**
 * Show a toast notification using the toast_notification.html component
 * @param {string} message - The message to display
 * @param {string} type - The toast type (success, error, info, warning)
 */
function showToast(message, type = 'success') {
    try {
        // Use the toast_notification.html component
        const statusToast = document.getElementById('statusToast');
        if (!statusToast) {
            console.error('Toast element not found');
            return;
        }
        
        // Get the title and message elements
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toastTitle || !toastMessage) {
            console.error('Toast elements not found');
            return;
        }
        
        // Set the title based on type (without adding an icon - the template already has one)
        let title = 'Information';
        
        if (type === 'success') {
            title = 'Success';
            // Update the existing icon to match the type
            const iconElement = statusToast.querySelector('.toast-header i');
            if (iconElement) {
                iconElement.className = 'bi bi-check-circle-fill text-success me-2';
            }
        } else if (type === 'error' || type === 'danger') {
            title = 'Error';
            const iconElement = statusToast.querySelector('.toast-header i');
            if (iconElement) {
                iconElement.className = 'bi bi-exclamation-circle-fill text-danger me-2';
            }
        } else if (type === 'warning') {
            title = 'Warning';
            const iconElement = statusToast.querySelector('.toast-header i');
            if (iconElement) {
                iconElement.className = 'bi bi-exclamation-triangle-fill text-warning me-2';
            }
        } else { // info
            const iconElement = statusToast.querySelector('.toast-header i');
            if (iconElement) {
                iconElement.className = 'bi bi-info-circle-fill text-info me-2';
            }
        }
        
        // Update toast content - just set the title text without adding another icon
        toastTitle.textContent = title;
        toastMessage.innerHTML = message;
        
        // Show the toast
        const toast = new bootstrap.Toast(statusToast);
        toast.show();
    } catch (error) {
        console.error('Toast error:', error);
    }
}

/**
 * Clean up all modals and their backdrops in the document
 * This is a more thorough cleanup function that handles all modals
 */
function cleanupAllModals() {
    try {
        // Get all modal elements
        const modals = document.querySelectorAll('.modal');
        
        // Remove all backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
        });
        
        // Ensure body classes are removed
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');
        
        // Clean up all modal elements
        modals.forEach(modal => {
            const modalId = modal.id;
            if (modalId) {
                try {
                    // First try to hide it using Bootstrap's API
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) {
                        bsModal.hide();
                    }
                } catch (err) {
                    // Silent failure, no logging needed
                }
                
                // Clean up the modal element manually
                modal.classList.remove('show');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
                modal.removeAttribute('aria-modal');
                modal.removeAttribute('role');
            }
        });
        } catch (error) {
        console.error('Error cleaning up modals');
    }
}

/**
 * Initialize the instructor management page
 */
function initInstructorManagement() {
    // Get initial rows per page from select element
    const rowsPerPageSelect = document.getElementById('rowsPerPage');
    if (rowsPerPageSelect) {
        const initialRowsPerPage = parseInt(rowsPerPageSelect.value, 10);
        if (!isNaN(initialRowsPerPage) && initialRowsPerPage > 0) {
            state.rowsPerPage = initialRowsPerPage;
        }
        
        // Try to load saved preference
        try {
            const savedPerPage = localStorage.getItem('instructorManagement.rowsPerPage');
            if (savedPerPage) {
                const perPage = parseInt(savedPerPage, 10);
                if (!isNaN(perPage) && perPage > 0) {
                    state.rowsPerPage = perPage;
                    rowsPerPageSelect.value = perPage.toString();
                }
            }
        } catch (e) {
            // Silently ignore localStorage errors
        }
    }
    
    // Initial data load
    fetchAndUpdateData(true);
    
    // Set up event listeners
    setupEventListeners();

    console.log('Instructor management initialized successfully'); // Added log
}

/**
 * Ensure toast container exists for notifications
 */
function ensureToastContainer() {
    // Check if we already have a toast container
    let toastContainer = document.getElementById('toastContainer');
    
    // If not, create one
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
}

/**
 * Fetch and update instructor data
 * @param {boolean} showLoading - Whether to show loading indicator
 */
function fetchAndUpdateData(showLoading = false) {
    if (showLoading) {
        showLoadingIndicator();
    }
    
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    fetch(`/api/instructors?_t=${timestamp}`)
        .then(response => {
            if (!response.ok) {
                // Get detailed error message from response
                return response.json().then(errorData => {
                    console.error('Error response:', errorData);
                    throw new Error(errorData.error || `Failed to update instructor status: ${response.status}`);
                }).catch(err => {
                    // If we can't parse the JSON, just throw with status code
                    throw new Error(`Failed to update instructor status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Handle different API response formats with robust type checking
            let instructorData = [];
            
            // Check if data is an array
            if (Array.isArray(data)) {

                instructorData = data;
            } 
            // Check if data has an instructors property that is an array
            else if (data && typeof data === 'object') {
                if (Array.isArray(data.instructors)) {

                    instructorData = data.instructors;
                } else if (data.data && Array.isArray(data.data)) {

                    instructorData = data.data;
                } else if (data.results && Array.isArray(data.results)) {

                    instructorData = data.results;
                } else {
                    console.error('Could not find instructors array in response:', data);
                    showToast('Error: Unexpected data format from server', 'error');
                }
            } else {
                console.error('Invalid data format:', data);
                showToast('Error: Invalid data format from server', 'error');
            }
            

            // Filter out instructors based on status or flags returned by the API
            const filteredApiData = instructorData.filter(instructor => {
                const instructorId = instructor.id || instructor.user_id;
                
                // Check API fields for archived status
                const isArchivedByAPI = 
                    instructor.is_archived === true || 
                    instructor.archived === true ||
                    (instructor.status && instructor.status.toLowerCase() === 'archived'); 

                if (isArchivedByAPI) {
                }
                return !isArchivedByAPI; // Keep only those NOT marked as archived by API
            });

            
            // --- Update State ---
            // Directly assign the filtered data to state.allData
            state.allData = filteredApiData;

            // Reset pagination
            state.currentPage = 1;

            // Apply secondary filters (search, status) which reads state.allData
            applyFilters();

            hideLoadingIndicator();
        })
        .catch(error => {
            console.error('Error fetching instructors:', error);
            showToast('Failed to load instructors', 'error');
            hideLoadingIndicator();
        });
}

/**
 * Formats an instructor object for display in the UI
 */
function formatInstructorData(instructor) {
    if (!instructor) return {};
    
    // Handle different name field formats
    let fullName = 'Unknown';
    
    if (instructor.name) {
        // If instructor has a name field, use it
        fullName = instructor.name;
    } else if (instructor.first_name && instructor.last_name) {
        // If instructor has first_name and last_name fields, combine them
        fullName = `${instructor.first_name} ${instructor.last_name}`.trim();
    } else if (instructor.firstName && instructor.lastName) {
        // Alternative field naming
        fullName = `${instructor.firstName} ${instructor.lastName}`.trim();
    } else if (instructor.first_name) {
        // Only first name available
        fullName = instructor.first_name.trim();
    } else if (instructor.last_name) {
        // Only last name available
        fullName = instructor.last_name.trim();
    }
    
    // Handle different status field formats
    let status = 'Unknown';
    if (instructor.status) {
        status = instructor.status;
    } else if (typeof instructor.is_active !== 'undefined') {
        status = instructor.is_active ? 'Active' : 'Inactive';
    } else if (typeof instructor.active !== 'undefined') {
        status = instructor.active ? 'Active' : 'Inactive';
    }
    
    return {
        id: instructor.id || instructor.user_id || '',
        user_id: instructor.id || instructor.user_id || '',
        name: fullName,
        email: instructor.email || '',
        status: status,
        profile_img: instructor.profile_img || null,
        department: instructor.department || '',
        specialization: instructor.specialization || '',
        created_at: instructor.created_at || '',
        qualification: instructor.qualification || '',
        classes_taught: instructor.classes_taught || [],
        role: instructor.role || 'Instructor',
        // Store original name fields for reference
        first_name: instructor.first_name || instructor.firstName || '',
        last_name: instructor.last_name || instructor.lastName || ''
    };
}

/**
 * Formats an instructor data object for the modal display
 */
function formatInstructorForModal(instructor) {
    if (!instructor) return {};
    
    const formattedData = formatInstructorData(instructor);
    
    // Add additional display-friendly attributes
    formattedData.statusClass = formattedData.status.toLowerCase() === 'active' ? 'text-success' : 'text-danger';
    formattedData.joinDate = formattedData.created_at ? new Date(formattedData.created_at).toLocaleDateString() : 'Unknown';
    
    // Format the image path for display
    if (formattedData.profile_img) {
        if (!formattedData.profile_img.startsWith('/') && !formattedData.profile_img.startsWith('http')) {
            formattedData.profile_img = `/static/images/${formattedData.profile_img}`;
        }
    } else {
        formattedData.profile_img = '/static/images/profile.png';
    }
    
    return formattedData;
}

/**
 * Handle filters changed - reload data and update UI
 */
async function handleFiltersChanged() {
    await fetchAndUpdateData();
    updateExportButton();
}

/**
 * Setup event listeners for the page
 */
function setupEventListeners() {
    // Search input - only attach once
    const searchInput = document.getElementById('searchInput');
    if (searchInput && !searchInput._hasSearchListener) {
        searchInput.addEventListener('input', debounce(function() {
            applyFilters();
        }, 300));
        // Mark that we've attached this listener
        searchInput._hasSearchListener = true;
    }
    
    // Status filter - only attach once
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter && !statusFilter._hasChangeListener) {
        statusFilter.addEventListener('change', function() {
            applyFilters();
        });
        // Mark that we've attached this listener
        statusFilter._hasChangeListener = true;
    }
    
    // Pagination controls
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (state.currentPage > 1) {
                state.currentPage--;
                updateTable();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                updateTable();
            }
        });
    }

    // Export to CSV button - check multiple possible IDs
    const exportBtn = document.getElementById('exportCSV') || document.getElementById('exportCsv');
    if (exportBtn) {
        exportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const status = statusFilter?.value || '';
            const search = searchInput?.value || '';
            exportInstructorsToCSV(status, search);
        });
    } else {
        console.warn('Export CSV button not found');
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            fetchAndUpdateData(true);
        });
    }
    
    // Add instructor button
    const addInstructorBtn = document.getElementById('addInstructorBtn');
    if (addInstructorBtn) {
        addInstructorBtn.addEventListener('click', function() {
            const addInstructorModal = new bootstrap.Modal(document.getElementById('addInstructorModal'));
            addInstructorModal.show();
        });
    }
    
    // Setup global event delegation for instructor actions
    if (!document._hasActionListeners) {
        document.addEventListener('click', function(event) {
            // Find the closest button if a child was clicked
            const button = event.target.closest('button[onclick*="handleInstructorAction"]');
            if (!button) return;
            
            // Prevent default and stop propagation to avoid double execution
            event.preventDefault();
            event.stopPropagation();
            
            // Extract action and instructorId from onclick attribute
            const onclickAttr = button.getAttribute('onclick') || '';
            const actionMatch = onclickAttr.match(/handleInstructorAction\(['"]([^'"]+)['"]/);
            const idMatch = onclickAttr.match(/,\s*['"]([^'"]+)['"]/);
            
            if (!actionMatch || !idMatch) return;
            
            const action = actionMatch[1];
            const instructorId = idMatch[1];
            
            // Execute the action
            handleInstructorAction(action, instructorId);
        });
        
        document._hasActionListeners = true;
    }
    
    // Setup modal event listeners for proper cleanup if not already done
    if (!document._hasModalCleanupListeners) {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('hidden.bs.modal', function() {
                cleanupModalBackdrop(modal.id);
            });
        });
        document._hasModalCleanupListeners = true;
    }
}

/**
 * Save instructor status changes
 * This function is called from the onclick attribute in the edit modal
 */
function saveInstructorStatus() {
    try {
        // Get the instructor ID from the modal
        const instructorId = document.getElementById('editInstructorId').value;
        
        if (!instructorId) {
            showToast('Error: Instructor ID not found', 'error');
            return;
        }
        
        // Get form values
        const statusSelect = document.getElementById('instructorStatusSelect');
        const status = statusSelect ? statusSelect.value : '';
        
        // Convert status to boolean - API expects a boolean value for is_active
        const isActive = status === 'Active';
        
        // Create the data object to send - the API endpoint only expects is_active
        const updateData = {
            is_active: isActive
        };
        
        // Show loading state on the save button
        const saveButton = document.querySelector('#editInstructorModal .modal-footer .btn-primary');
        const originalButtonText = saveButton ? saveButton.innerHTML : 'Save Changes';
        
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }
        
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        
        if (!csrfToken) {
            console.warn('CSRF token not found. Request may fail.');
            showToast('Warning: CSRF token not found. Please refresh the page and try again.', 'warning');
        }
        
        // Debug logging
        console.log(`Updating instructor ${instructorId} status to ${status} (is_active: ${isActive})`);
        console.log('Request data:', JSON.stringify(updateData));
        
        // Send the update request
        fetch(`/api/users/${instructorId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || ''
            },
            body: JSON.stringify(updateData),
            credentials: 'same-origin' // Include cookies for authentication
        })
        .then(response => {
            // Log the response status
            console.log(`Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                // Try to get detailed error information
                return response.json()
                    .then(errorData => {
                        console.error('Error details:', errorData);
                        throw new Error(errorData.error || `Failed to update status (${response.status})`);
                    })
                    .catch(jsonError => {
                        // If we can't parse the JSON, use the status text
                        console.error('Error parsing error response:', jsonError);
                        throw new Error(`Server error: ${response.statusText || response.status}`);
                    });
            }
            
            return response.json();
        })
        .then(data => {
            console.log('Success response:', data);
            
            // Hide the modal
            const modal = document.getElementById('editInstructorModal');
            if (modal) {
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) {
                    modalInstance.hide();
                    // Clean up backdrop
                    setTimeout(() => {
                        const backdrop = document.querySelector('.modal-backdrop');
                        if (backdrop) backdrop.remove();
                        document.body.classList.remove('modal-open');
                        document.body.style.removeProperty('padding-right');
                    }, 150);
                }
            }
            
            // Show success message
            showToast('Instructor status updated successfully', 'success');
            
            // Refresh the table to show updated data
            setTimeout(() => {
                fetchAndUpdateData(false);
            }, 500);
        })
        .catch(error => {
            console.error('Error updating instructor status:', error);
            showToast(`Failed to update status: ${error.message}`, 'error');
        })
        .finally(() => {
            // Restore the button state
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = originalButtonText;
            }
        });
    } catch (error) {
        console.error('Error in saveInstructorStatus:', error);
        showToast('An error occurred while saving changes', 'error');
    }
}

/**
 * Ensure modal backdrop is removed
 * This uses the global cleanupModalBackdrop function from instructor-modal.js if available
 * @param {string} modalId - The ID of the modal element (without #)
 */
function cleanupModalBackdrop(modalId) {
    // Try to use the global function if available
    const globalCleanupFn = window.cleanupModalBackdrop;
    if (typeof globalCleanupFn === 'function' && globalCleanupFn !== cleanupModalBackdrop) {
        globalCleanupFn(modalId);
                    return;
                }

    try {
        // Remove all modal backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
        });
        
        // Reset body classes and styles
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');
        
        // If modalId is provided, clean up that specific modal
        if (modalId) {
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                // Reset modal state
                modalElement.classList.remove('show');
                modalElement.style.display = 'none';
                modalElement.setAttribute('aria-hidden', 'true');
                modalElement.removeAttribute('aria-modal');
                modalElement.removeAttribute('role');
            }
        }
    } catch (error) {
        console.error('Error cleaning up modal backdrop:', error);
    }
}

// ------------------- UI Update Functions -------------------

/**
 * Setup action buttons for instructors in the table
 * This is a wrapper function that will be called during initialization
 */
function setupInstructorActionButtons() {
    // Initial setup of action buttons
    addInstructorActionListeners();
    
    // Setup event delegation on the table for future buttons
    const instructorTable = document.getElementById('instructorTable');
    if (instructorTable) {
        instructorTable.addEventListener('click', function(e) {
            // Find the closest button if a child was clicked
            const button = e.target.closest('button');
            if (!button) return;
            
            // Handle different button types
            if (button.classList.contains('view-instructor')) {
                e.preventDefault();
                const instructorId = button.getAttribute('data-id');
                if (instructorId) {
                    handleViewInstructor(instructorId);
                }
            } else if (button.classList.contains('edit-instructor')) {
                e.preventDefault();
                const instructorId = button.getAttribute('data-id');
                if (instructorId) {
                    handleEditInstructor(instructorId);
                }
            } else if (button.classList.contains('archive-instructor')) {
                e.preventDefault();
                const instructorId = button.getAttribute('data-id');
                if (instructorId) {
                    handleArchiveInstructor(instructorId);
                }
            }
        });
    }
}

/**
 * Update the instructor table with the current data
 */
function updateTable() {
    const tableBody = document.querySelector('#instructorTable tbody');
    if (!tableBody) return;
    
    // Calculate pagination
    const startIndex = (state.currentPage - 1) * state.rowsPerPage;
    const endIndex = Math.min(startIndex + state.rowsPerPage, state.filteredData.length);
    const currentPageData = state.filteredData.slice(startIndex, endIndex);
    
    // Clear the table
    tableBody.innerHTML = '';
    
    // Check if we have data
    if (currentPageData.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `
            <td colspan="4" class="text-center py-5">
                <div class="text-muted">
                    <i class="bi bi-inbox fs-2"></i>
                    <p class="mt-2">No instructors found</p>
                </div>
            </td>
        `;
        tableBody.appendChild(noDataRow);
        return;
    }
    
    // Add rows
    currentPageData.forEach(instructor => {
        // Get available data with fallbacks
        const instructorId = instructor.id || instructor.user_id || '';
        const name = instructor.name || instructor.full_name || `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || 'N/A';
        const role = instructor.role || 'Instructor';
        const status = instructor.status || 'Unknown';
        const profileImg = instructor.profile_img || 'profile.png';
        
        // Create the row
        const row = document.createElement('tr');
        row.setAttribute('data-user-id', instructorId);
        row.setAttribute('data-user-role', role);
        row.setAttribute('data-email', instructor.email || '');
        row.setAttribute('data-department', instructor.department || '');
        row.setAttribute('data-specialization', instructor.specialization || '');
        
        // Set the row content
        row.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <img src="/static/images/${profileImg}" 
                         class="rounded-circle me-3" 
                         width="40" 
                         height="40"
                         alt="${name}">
                                    <div>
                        <div class="fw-medium">${name}</div>
                        <div class="text-muted small">${instructorId}</div>
                                    </div>
                                </div>
            </td>
            <td class="align-middle">${role}</td>
            <td class="align-middle">
                <span class="badge ${
                    status.toLowerCase() === 'active' ? 'bg-success-subtle text-success' : 
                    'bg-danger-subtle text-danger'
                }">
                    ${status}
                </span>
            </td>
            <td class="align-middle text-end">
                <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-link p-0 edit-instructor" onclick="handleInstructorAction('edit', '${instructorId}')">
                        <i class="bi bi-pencil" style="color: #191970;"></i>
                    </button>
                    <button class="btn btn-link p-0 view-instructor" onclick="handleInstructorAction('view', '${instructorId}')">
                        <i class="bi bi-eye" style="color: #191970;"></i>
                    </button>
                    <button class="btn btn-link p-0 archive-instructor" onclick="handleInstructorAction('archive', '${instructorId}')">
                        <i class="bi bi-archive" style="color: #191970;"></i>
                    </button>
                            </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update pagination info
    updatePagination();
}

/**
 * Update card statistics based on filtered data
 */
function updateCardStatistics() {
    try {
        // Calculate counts
        const totalInstructors = state.allData.length;
        const activeInstructors = state.allData.filter(instructor => instructor.status?.toLowerCase() === 'active').length;
        const inactiveInstructors = state.allData.filter(instructor => instructor.status?.toLowerCase() === 'inactive').length;

        // Find the statistics elements by looking for data-count attributes
        const totalElement = document.querySelector('[data-count="total"]');
        const activeElement = document.querySelector('[data-count="active"]');
        const inactiveElement = document.querySelector('[data-count="inactive"]');
        
        // Update elements if they exist
        if (totalElement) totalElement.textContent = totalInstructors;
        if (activeElement) activeElement.textContent = activeInstructors;
        if (inactiveElement) inactiveElement.textContent = inactiveInstructors;
        
                } catch (error) {
        // Silent error handling
        console.error('Error updating statistics:', error);
    }
}

// ------------------- Instructor Action Handlers -------------------

/**
 * Global handler for instructor actions (view, edit, archive)
 */
window.handleInstructorAction = function(action, instructorId) {
    // If this function is called from an onclick attribute with pattern onClick="handleInstructorAction('action')"
    if (typeof instructorId === 'undefined' && typeof event !== 'undefined') {
        // Extract ID from the clicked button or its parent row
        const button = event.target.closest('button');
        if (button) {
            // Get the instructor ID from button's onclick attribute or its parent row
            const onclickAttr = button.getAttribute('onclick') || '';
            const match = onclickAttr.match(/,\s*['"]([^'"]+)['"]/); // Extract ID from second parameter
            
            if (match && match[1]) {
                instructorId = match[1];
            } else {
                // Try to get from the row data attribute
                const row = button.closest('tr[data-user-id]');
                if (row) {
                    instructorId = row.getAttribute('data-user-id');
                }
            }
        }
    }
    
    // Validate instructor ID - make sure it's not the action name
    if (!instructorId || instructorId === action) {
        showToast('Invalid instructor ID', 'error');
        return;
    }
    
    // Dispatch to appropriate handler based on action
    switch (action) {
        case 'view':
            handleViewInstructor(instructorId);
            break;
            case 'edit':
            handleEditInstructor(instructorId);
            break;
        case 'archive':
            handleArchiveInstructor(instructorId);
            break;
        default:
            // Unknown action - silently ignore
            break;
    }
};

/**
 * Handles viewing an instructor - loads data and shows view modal
 */
async function handleViewInstructor(instructorId) {
    try {
        if (!instructorId) {
            showToast('Invalid instructor ID', 'error');
            return;
        }

        // Try finding instructor in current data first for immediate display
        const cachedInstructor = state.allData.find(instructor => 
            (instructor.user_id && instructor.user_id.toString() === instructorId.toString()) || 
            (instructor.id && instructor.id.toString() === instructorId.toString())
        );
        
        let modalShown = false;
        
        if (cachedInstructor) {
            // Format the instructor data for the modal
            const formattedData = formatInstructorForModal(cachedInstructor);
            
            // Call the global instructor modal function
            if (typeof window.showInstructorModalView === 'function') {
                window.showInstructorModalView(formattedData);
                modalShown = true;
            } else {
                console.error('Instructor modal function unavailable');
            }
        }
        
        // Then fetch fresh data from API
        try {
            const response = await fetch(`/api/users/${instructorId}`);
            
            if (!response.ok) {
                // Get detailed error message from response
                return response.json().then(errorData => {
                    console.error('Error response:', errorData);
                    throw new Error(errorData.error || `Failed to fetch instructor details: ${response.status}`);
                }).catch(err => {
                    // If we can't parse the JSON, just throw with status code
                    throw new Error(`Failed to fetch instructor details: ${response.status}`);
                });
            }
            
            const instructorData = await response.json();
            
            // Format the instructor data for the modal
            const formattedData = formatInstructorForModal(instructorData);
            
            // Call the global instructor modal function
            if (typeof window.showInstructorModalView === 'function') {
                window.showInstructorModalView(formattedData);
            } else {
                console.error('Instructor modal function unavailable');
                if (!modalShown) {
                    showToast('Error: Unable to display instructor details', 'error');
                }
            }
                } catch (error) {
            console.error('Error fetching instructor data');
            // Only show error if we didn't already show the modal with cached data
            if (!modalShown) {
                showToast('Error: Unable to display instructor details', 'error');
            }
        }
    } catch (error) {
        console.error('Error in handleViewInstructor');
        showToast('Error loading instructor data', 'error');
    }
}

/**
 * Handles editing an instructor - loads data and shows edit modal
 */
async function handleEditInstructor(instructorId) {
    try {
        if (!instructorId) {
            showToast('Invalid instructor ID', 'error');
            return;
        }

        // Get the edit modal element
        const modal = document.getElementById('editInstructorModal');
        if (!modal) {
            showToast('Error: Edit modal not found', 'error');
            return;
        }
        
        // Store the instructor ID on the modal element for later reference
        modal.setAttribute('data-instructor-id', instructorId);
        
        // Flag to track if modal has been shown
        let modalShown = false;
        
        // Get the instructor from current data first for immediate display
        const cachedInstructor = state.allData.find(instructor => 
            (instructor.user_id && instructor.user_id.toString() === instructorId.toString()) || 
            (instructor.id && instructor.id.toString() === instructorId.toString())
        );
        
        if (cachedInstructor) {
            state.currentInstructor = formatInstructorForModal(cachedInstructor);
            populateEditForm(state.currentInstructor);
            
            // Show the modal
            try {
                const editModal = new bootstrap.Modal(modal);
                    editModal.show();
                modalShown = true;
                } catch (error) {
                console.error('Error showing modal');
                try {
                    $(modal).modal('show');
                    modalShown = true;
                } catch (e) {
                    console.error('Error showing modal');
                }
            }
        }
        
        // Fetch fresh data from API to update the form
        try {
            const response = await fetch(`/api/users/${instructorId}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const apiData = await response.json();
            
            // Format data for modal
            state.currentInstructor = formatInstructorForModal(apiData);
            
            // Update form with fresh data
            populateEditForm(state.currentInstructor);
            
            // If modal wasn't shown from cached data, show it now
            if (!modalShown) {
                try {
                    const editModal = new bootstrap.Modal(modal);
                    editModal.show();
                    modalShown = true;
                } catch (error) {
                    console.error('Error showing modal');
                    try {
                        $(modal).modal('show');
                        modalShown = true;
                    } catch (e) {
                        console.error('Error showing modal');
                        showToast('Error: Unable to show edit modal', 'error');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching instructor data');
            // If we already showed modal with cached data, just log the error
            // Otherwise show an error toast
            if (!modalShown) {
                showToast('Error loading instructor data', 'error');
            } else {
                showToast('Warning: Using cached data. Could not refresh from server.', 'warning');
            }
        }
    } catch (error) {
        console.error('Error in handleEditInstructor');
        showToast('Error loading instructor data for editing', 'error');
    }
}

/**
 * Populates the edit form with instructor data
 */
function populateEditForm(instructorData) {
    if (!instructorData) {
        console.error('Missing instructor data');
        return;
    }
    
    // Set instructor data in the form
    const nameElement = document.getElementById('editInstructorName');
    if (nameElement) nameElement.textContent = instructorData.name || 'Unknown';
    
    const idInput = document.getElementById('editInstructorId');
    if (idInput) idInput.value = instructorData.user_id || instructorData.id || '';
    
    const idDisplay = document.getElementById('editInstructorIdDisplay');
    if (idDisplay) idDisplay.textContent = instructorData.user_id || instructorData.id || '';
    
    // Display instructor profile image if available
    const profileImage = document.getElementById('editInstructorImage');
    if (profileImage) {
        profileImage.src = instructorData.profile_img || '/static/images/profile.png';
        profileImage.onerror = function() {
            this.src = '/static/images/profile.png';
        };
    }
    
    // Set status dropdown
    const statusSelect = document.getElementById('instructorStatusSelect');
    if (statusSelect) {
        // Determine status
        const currentStatus = instructorData.status || (instructorData.is_active ? 'Active' : 'Inactive') || 'Active';
        
        // Find the appropriate option
        for (let i = 0; i < statusSelect.options.length; i++) {
            if (statusSelect.options[i].value.toLowerCase() === currentStatus.toLowerCase()) {
                statusSelect.selectedIndex = i;
                break;
            }
        }
    }
}

/**
 * Handles archiving an instructor
 */
function handleArchiveInstructor(instructorId) {
    // Find instructor in current data
    const instructor = state.allData.find(instructor => 
        instructor.user_id === instructorId || instructor.id === instructorId
    );
    
    if (!instructor) {
        showToast('Instructor not found', 'error');
        return;
    }
    
    // Clean up any existing modals first
    cleanupModalBackdrop();
    
    // Ensure the modal exists
    const modal = document.getElementById('confirmArchiveModal');
    if (!modal) {
        showToast('Unable to display archive confirmation', 'error');
        return;
    }
    
    // Populate confirmation modal with null checks
    const idInput = document.getElementById('archiveInstructorId');
    if (idInput) {
        idInput.value = instructorId;
    }
    
    const nameElement = document.getElementById('archiveInstructorName');
    if (nameElement) {
        nameElement.textContent = instructor.name;
    }
    
    const idDisplay = document.getElementById('archiveInstructorIdDisplay');
    if (idDisplay) {
        idDisplay.textContent = instructorId;
    }
    
    // Show confirmation modal
    const confirmModal = new bootstrap.Modal(modal);
    confirmModal.show();
}

/**
 * Completely removes an instructor from all local data and updates UI
 * @param {string} instructorId - The ID of the instructor to remove
 */
function removeInstructorFromData(instructorId) {
    if (!instructorId) return false;
    
    let removed = false;
    
    // Check all data arrays to ensure complete removal
    
    // 1. Remove from allData array
    const instructorIndex = state.allData.findIndex(instructor => 
        (instructor.user_id && instructor.user_id.toString() === instructorId.toString()) || 
        (instructor.id && instructor.id.toString() === instructorId.toString())
    );
    
    if (instructorIndex !== -1) {
        state.allData.splice(instructorIndex, 1);
        removed = true;
    }
    
    // 2. Remove from filteredData array if it exists
    const filteredIndex = state.filteredData.findIndex(instructor => 
        (instructor.user_id && instructor.user_id.toString() === instructorId.toString()) || 
        (instructor.id && instructor.id.toString() === instructorId.toString())
    );
    
    if (filteredIndex !== -1) {
        state.filteredData.splice(filteredIndex, 1);
        removed = true;
    }
    
    // 3. Make sure any other possible arrays are also updated
    // Check if there are any other arrays that might contain this instructor
    if (state.displayData && Array.isArray(state.displayData)) {
        const displayIndex = state.displayData.findIndex(instructor => 
            (instructor.user_id && instructor.user_id.toString() === instructorId.toString()) || 
            (instructor.id && instructor.id.toString() === instructorId.toString())
        );
        
        if (displayIndex !== -1) {
            state.displayData.splice(displayIndex, 1);
            removed = true;
        }
    }
    
    if (removed) {
        // Update UI elements after data change
        updateTable();
        updateCardStatistics();
        
        // Also directly remove table row for immediate feedback (without waiting for table update)
        const row = document.querySelector(`tr[data-user-id="${instructorId}"]`);
        if (!row) {
            // Try with alternative attribute
            const rows = document.querySelectorAll('tr');
            for (const r of rows) {
                if (r.getAttribute('data-instructor-id') === instructorId) {
                    r.remove();
                break;
        }
            }
        } else {
            row.remove();
        }
    }
    
    return removed;
}

/**
 * Archives an instructor (called from confirmation modal)
 */
function archiveInstructor() {
    // Get the instructor ID from the modal
    const instructorId = document.getElementById('archiveInstructorId').value;
    const instructorName = document.getElementById('archiveInstructorName').textContent;
    
    // Get the archive reason
    const reasonSelect = document.getElementById('archiveReason');
    const customReasonInput = document.getElementById('customReason');
    
    if (!reasonSelect || !reasonSelect.value) {
        showToast('Please select an archive reason', 'error');
        return;
    }
    
    // Determine the final reason text
    let archiveReason = reasonSelect.value;
    if (archiveReason === 'other' && customReasonInput) {
        if (!customReasonInput.value.trim()) {
            showToast('Please specify a custom reason', 'error');
            customReasonInput.focus();
            return;
        }
        archiveReason = customReasonInput.value.trim();
    }
    
    // Disable archive button to prevent multiple submissions
    const archiveBtn = document.getElementById('confirmArchiveBtn');
    if (archiveBtn) {
        archiveBtn.disabled = true;
        archiveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
    }
    
    // Save reference to the modal first for cleanup later
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmArchiveModal'));
    
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    if (!csrfToken) {
        console.warn('CSRF token not found. Archive request may fail.');
        // Show warning toast
        showToast('Warning: CSRF token not found. Please refresh the page and try again.', 'warning');
    }
    
    // Send the archive request
    fetch(`/api/users/${instructorId}/archive`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken || ''
        },
        body: JSON.stringify({
            reason: archiveReason,
            name: instructorName,
            // Add explicit archived flag for clarity
            archived: true,
            status: 'Archived',
            is_archived: true
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || `Failed to archive instructor (${response.status})`);
            });
        }
        return response.json();
    })
    .then(data => {
        // Hide the modal with proper cleanup
        if (modal) {
            modal.hide();
            setTimeout(() => cleanupModalBackdrop('confirmArchiveModal'), 150);
        }
        
        // Create a custom success message with archive link
        const successMessage = `
            <div>Instructor ${instructorName} has been archived successfully</div>
            <div class="mt-2">
                <a href="/admin/archive-view?type=instructor" class="btn btn-sm btn-outline-primary" 
                   style="color: #191970; background-color: transparent; border-color: #191970; transition: all 0.3s ease;" 
                   onmouseover="this.style.backgroundColor='rgba(25, 25, 112, 0.1)';" 
                   onmouseout="this.style.backgroundColor='transparent';" 
                   onmousedown="this.style.backgroundColor='#191970'; this.style.color='white';" 
                   onmouseup="this.style.backgroundColor='rgba(25, 25, 112, 0.1)'; this.style.color='#191970';">
                    <i class="bi bi-box-arrow-right me-1"></i>View in Archives
                </a>
            </div>
        `;
        
        // Show the toast with HTML content
        const statusToast = document.getElementById('statusToast');
        if (statusToast) {
            // Update the icon to success
            const iconElement = statusToast.querySelector('.toast-header i');
            if (iconElement) {
                iconElement.className = 'bi bi-check-circle-fill text-success me-2';
            }
            
            // Set the title
            const toastTitle = document.getElementById('toastTitle');
            if (toastTitle) {
                toastTitle.textContent = 'Success';
            }
            
            // Set the message with HTML content including the link
            const toastMessage = document.getElementById('toastMessage');
            if (toastMessage) {
                toastMessage.innerHTML = successMessage;
            }
            
            // Show the toast
            const toast = new bootstrap.Toast(statusToast);
            toast.show();
        } else {
            // Fallback to regular toast if element not found
            showToast(`Instructor ${instructorName} has been archived successfully`, 'success');
            console.warn('Toast element not found for custom archive link');
        }
        
        // First, directly remove the row from the table
        const row = document.querySelector(`tr[data-user-id="${instructorId}"]`);
        if (row) {
            row.remove();
        }
        
        // Remove instructor from all data arrays
        removeInstructorFromData(instructorId);
        
        // Refresh data from server after a short delay to ensure consistency
        setTimeout(() => {
            fetchAndUpdateData(false);
        }, 500);
    })
    .catch(error => {
        console.error('Error archiving instructor:', error);
        showToast(`Failed to archive instructor: ${error.message}`, 'error');
    })
    .finally(() => {
        // Re-enable archive button
        if (archiveBtn) {
            archiveBtn.disabled = false;
            archiveBtn.innerHTML = 'Archive Instructor';
        }
        
        // Reset form fields
        if (reasonSelect) reasonSelect.value = '';
        if (customReasonInput) customReasonInput.value = '';
        
        // Hide custom reason field
        const customReasonContainer = document.getElementById('customReasonContainer');
        if (customReasonContainer) {
            customReasonContainer.classList.add('d-none');
            }
        });
    }

// Make functions globally available
window.handleInstructorAction = handleInstructorAction;
window.archiveInstructor = archiveInstructor;

// Initialize on page load
document.addEventListener('DOMContentLoaded', initInstructorManagement);

function setupRowEventListeners() {
    // Set up view instructor event
    document.querySelectorAll('.view-instructor').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const row = this.closest('tr');
            const instructorId = row.dataset.instructorId;
            if (instructorId) {
                viewInstructor(instructorId);
            }
        });
    });

    // Set up edit instructor event
    document.querySelectorAll('.edit-instructor').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const row = this.closest('tr');
            const instructorId = row.dataset.instructorId;
            if (instructorId) {
                editInstructor(instructorId);
            }
        });
    });

    // Set up archive instructor event
    document.querySelectorAll('.archive-instructor').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const row = this.closest('tr');
            const instructorId = row.dataset.instructorId;
            if (instructorId) {
                archiveInstructorAction(instructorId);
            }
        });
    });
}

function updatePagination() {
    const paginationInfo = document.getElementById('paginationInfo');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const rowsPerPageSelect = document.getElementById('rowsPerPage');
    
    // Calculate total pages and current range
    const totalItems = state.filteredData.length;
    const totalPages = Math.ceil(totalItems / state.rowsPerPage);
    
    // Update page buttons state
    if (prevPageBtn) {
        prevPageBtn.disabled = state.currentPage <= 1;
        prevPageBtn.classList.toggle('disabled', state.currentPage <= 1);
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = state.currentPage >= totalPages;
        nextPageBtn.classList.toggle('disabled', state.currentPage >= totalPages);
    }
    
    // Update pagination info text
    if (paginationInfo) {
        if (totalItems === 0) {
            paginationInfo.textContent = 'No items';
        } else {
            const startItem = (state.currentPage - 1) * state.rowsPerPage + 1;
            const endItem = Math.min(startItem + state.rowsPerPage - 1, totalItems);
            paginationInfo.textContent = `${startItem}-${endItem} of ${totalItems}`;
        }
    }
    
    // Set up rows per page selector if not already done
    if (rowsPerPageSelect && !rowsPerPageSelect._initialized) {
        rowsPerPageSelect.value = state.rowsPerPage.toString();
        
        rowsPerPageSelect.addEventListener('change', function() {
            const newPerPage = parseInt(this.value, 10);
            if (!isNaN(newPerPage) && newPerPage > 0) {
                state.rowsPerPage = newPerPage;
                state.currentPage = 1; // Reset to first page when changing items per page
                
                // Save preference in localStorage if available
                try {
                    localStorage.setItem('instructorManagement.rowsPerPage', newPerPage);
                } catch (e) {
                    // Silently ignore localStorage errors
                }
                
                updateTable();
            }
        });
        
        // Load preference from localStorage if available
        try {
            const savedPerPage = localStorage.getItem('instructorManagement.rowsPerPage');
            if (savedPerPage) {
                const perPage = parseInt(savedPerPage, 10);
                if (!isNaN(perPage) && perPage > 0) {
                    state.rowsPerPage = perPage;
                    rowsPerPageSelect.value = perPage.toString();
                }
            }
        } catch (e) {
            // Silently ignore localStorage errors
        }
        
        rowsPerPageSelect._initialized = true;
    }
}

/**
 * Display loading indicator when fetching instructors
 */
function showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'table-row';
    }
    
    // Disable controls while loading
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    const exportBtn = document.getElementById('exportCSV');
    
    if (statusFilter) statusFilter.disabled = true;
    if (searchInput) searchInput.disabled = true;
    if (exportBtn) exportBtn.disabled = true;
}

/**
 * Hide loading indicator when finished loading instructors
 */
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    
    // Re-enable controls after loading
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    const exportBtn = document.getElementById('exportCSV');
    
    if (statusFilter) statusFilter.disabled = false;
    if (searchInput) searchInput.disabled = false;
    if (exportBtn) exportBtn.disabled = false;
}

/**
 * Update statistics function - wrapper for updateCardStatistics
 */
function updateStats() {
    updateCardStatistics();
}

/**
 * View instructor function - wrapper for handleViewInstructor
 */
function viewInstructor(instructorId) {
    handleViewInstructor(instructorId);
}

/**
 * Edit instructor function - wrapper for handleEditInstructor
 */
function editInstructor(instructorId) {
    handleEditInstructor(instructorId);
}

/**
 * Archive instructor function - wrapper for handleArchiveInstructor
 */
function archiveInstructorAction(instructorId) {
    handleArchiveInstructor(instructorId);
}

/**
 * Apply filters to the instructor data
 */
function applyFilters() {

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    
    const searchTerm = searchInput?.value?.trim().toLowerCase() || '';
    const statusValue = statusFilter?.value || '';
     
    state.filteredData = state.allData.filter(instructor => {
        // Status filter
        const statusMatch = !statusValue || 
            (instructor.status?.toLowerCase() === statusValue.toLowerCase());
        
        // Search filter - check all common properties
        const searchMatch = !searchTerm || 
            (instructor.name?.toLowerCase()?.includes(searchTerm)) || 
            (instructor.full_name?.toLowerCase()?.includes(searchTerm)) || 
            (instructor.first_name?.toLowerCase()?.includes(searchTerm)) || 
            (instructor.last_name?.toLowerCase()?.includes(searchTerm)) || 
            (instructor.email?.toLowerCase()?.includes(searchTerm)) || 
            (instructor.department?.toLowerCase()?.includes(searchTerm)) || 
            (instructor.id?.toString().toLowerCase()?.includes(searchTerm)) ||
            (instructor.user_id?.toString().toLowerCase()?.includes(searchTerm));
        
        return statusMatch && searchMatch;
    });
    
    // Reset to first page when filters change
    state.currentPage = 1;
    
    // Calculate total pages
    state.totalPages = Math.ceil(state.filteredData.length / state.rowsPerPage);
    
    // Update the table with filtered data
    updateTable();
    updateStats();
}

/**
 * Add event listeners to instructor action buttons in the table
 */
function addInstructorActionListeners() {
    // This function is now deprecated - event handling is done through delegation
    // Keep empty function to avoid breaking existing code that calls it
}

/**
 * Save changes made in the edit instructor modal
 */
function saveInstructorChanges() {
    try {
        // Get the instructor ID from the modal
        const modal = document.getElementById('editInstructorModal');
        const instructorId = modal.getAttribute('data-instructor-id');
        
        if (!instructorId) {
            showToast('Error: Instructor ID not found', 'error');
            return;
        }
        
        // Get form values
        const statusSelect = document.getElementById('instructorStatusSelect');
        const status = statusSelect ? statusSelect.value : '';
        
        // Optional fields - get if they exist
        const departmentInput = document.getElementById('instructorDepartment');
        const roleInput = document.getElementById('instructorRole');
        const specializationInput = document.getElementById('instructorSpecialization');
        
        // Create the data object to send
        const updateData = {
            status: status
        };
        
        // Add optional fields if they exist
        if (departmentInput) updateData.department = departmentInput.value.trim();
        if (roleInput) updateData.role = roleInput.value.trim();
        if (specializationInput) updateData.specialization = specializationInput.value.trim();
        
        // Show loading state on the save button
        const saveButton = document.getElementById('saveInstructorChanges');
        const originalButtonText = saveButton ? saveButton.innerHTML : 'Save Changes';
        
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }
        
        // Send the update request
        fetch(`/api/users/${instructorId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
            body: JSON.stringify(updateData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || 'Failed to update instructor');
                });
            }
            return response.json();
        })
        .then(data => {
            // Hide the modal
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
            
            // Show success message
            showToast('Instructor updated successfully', 'success');
            
            // Update the instructor in the data
            updateInstructorInData(instructorId, updateData);
            
            // Refresh the table
            applyFilters();
        })
        .catch(error => {
            console.error('Error updating instructor:', error);
            showToast(`Failed to update instructor: ${error.message}`, 'error');
        })
        .finally(() => {
            // Restore the button state
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = originalButtonText;
            }
        });
    } catch (error) {
        console.error('Error in saveInstructorChanges:', error);
        showToast('An error occurred while saving changes', 'error');
    }
}

/**
 * Update instructor in the data array after edit
 * @param {string} instructorId - The ID of the instructor to update
 * @param {Object} updateData - The data used to update the instructor
 */
function updateInstructorInData(instructorId, updateData) {
    // Find the instructor in the data
    const instructor = state.allData.find(instructor => 
        instructor.user_id === instructorId || instructor.id === instructorId
    );
    
    // If found, update the properties
    if (instructor) {
        Object.assign(instructor, updateData);
    }
}

/**
 * Filter instructors based on criteria
 * @param {Array} instructors - Array of instructors to filter
 * @param {string} status - Status filter
 * @param {string} search - Search term
 * @returns {Array} Filtered instructors array
 */
function filterInstructors(instructors, status, search) {
    // Use current data if no instructors provided
    const data = instructors || state.allData;
    
    // Apply status filter
    let filtered = data;
    if (status) {
        filtered = filtered.filter(instructor => instructor.status === status);
    }
    
    // Apply search filter
    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(instructor => 
            (instructor.name?.toLowerCase().includes(searchLower) || 
             instructor.user_id?.toLowerCase().includes(searchLower))
        );
    }
    
    return filtered;
}

/**
 * Export instructors to CSV based on current filters
 * @param {string} status - Status filter
 * @param {string} search - Search query
 */
function exportInstructorsToCSV(status, search) {
    try {
        // Get the export button and show loading state
        const exportButton = document.getElementById('exportCSV');
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exporting...';
        }
        
        // Show processing toast
        showToast('Preparing export, please wait...', 'info');
        
        // Use the data that's already loaded in state
        let instructorData = [...state.allData];
        
        // Apply filters if provided
        if (status) {
            instructorData = instructorData.filter(instructor => 
                instructor.status?.toLowerCase() === status.toLowerCase());
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            instructorData = instructorData.filter(instructor => 
                (instructor.name?.toLowerCase().includes(searchLower) || 
                 instructor.id?.toString().toLowerCase().includes(searchLower) || 
                 instructor.email?.toLowerCase().includes(searchLower)));
        }
        
        if (instructorData.length === 0) {
            showToast('No instructors to export', 'warning');
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.innerHTML = 'Export CSV';
            }
            return;
        }
        
        // Define CSV headers
        const headers = ['ID', 'Name', 'Department', 'Status', 'Email', 'Specialization'];
        
        // Helper function to escape CSV fields properly
        const escapeCSV = (field) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };
        
        // Convert data to CSV format
        let csvContent = headers.join(',') + '\n';
        
        // Log the data for debugging
        console.log('Exporting instructor data:', instructorData);
        
        // Process each instructor
        instructorData.forEach(instructor => {
            // Log each instructor for debugging
            console.log('Processing instructor:', instructor);
            
            // Create the CSV row using data from state
            const row = [
                escapeCSV(instructor.id || instructor.user_id || ''),
                escapeCSV(instructor.name || `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || ''),
                escapeCSV(instructor.department || ''),
                escapeCSV(instructor.status || ''),
                escapeCSV(instructor.email || ''),
                escapeCSV(instructor.specialization || '')
            ];
            
            // Log the CSV row for debugging
            console.log('CSV row:', row);
            
            csvContent += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `instructors_export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success toast
        showToast(`Exported ${instructorData.length} instructors to CSV`, 'success');
        
        // Reset export button
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = 'Export CSV';
        }
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast('Failed to export instructors to CSV: ' + error.message, 'error');
        
        // Reset export button
        const exportButton = document.getElementById('exportCSV');
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = 'Export CSV';
        }
    }
}

/**
 * Update the export button's href based on current filters
 */
function updateExportButton() {
    try {
        const exportButton = document.getElementById('exportCSV');
        if (!exportButton) return;
        
        // Get current filters
        const status = document.getElementById('statusFilter')?.value || '';
        const search = document.getElementById('searchInput')?.value || '';
        
        // Construct the export URL with query parameters
        let exportUrl = '/admin/export-instructors-to-csv?';
        const params = [];
        
        if (status) {
            params.push(`status=${encodeURIComponent(status)}`);
        }
        
        if (search) {
            params.push(`search=${encodeURIComponent(search)}`);
        }
        
        exportUrl += params.join('&');
        
        // Update the button href
        exportButton.setAttribute('href', exportUrl);
        
        // Add click handler for client-side CSV export
        exportButton.onclick = function(e) {
            e.preventDefault();
            exportInstructorsToCSV(status, search);
            return false;
        };
    } catch (error) {
        console.error('Error updating export button:', error);
    }
} 