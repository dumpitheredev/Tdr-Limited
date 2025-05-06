// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Enrollment Management Page Loaded');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data via AJAX to ensure consistency
    loadInitialData();
    
    // Set up global modal handlers for better accessibility
    setupModalHandlers();
    
    // Ensure no orphaned inert attributes
    cleanupInertAttributes();
});

// Core utility functions
const utils = {
    // Show toast notification with consistent styling
    showToast: function(message, type = 'info', details = null) {
        // Use the existing toast from toast_notification.html
        const toast = document.getElementById('statusToast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = toast.querySelector('.toast-header i');
        
        if (!toast || !toastTitle || !toastMessage || !toastIcon) {
            console.error('Toast elements not found. Make sure toast_notification.html is included.');
            return null;
        }
        
        // Set the message
        toastMessage.innerHTML = message;
        
        // Add details for errors when available
        if (details && type === 'error') {
            console.error("Toast Error Details:", details);
            if (typeof details === 'string') {
                toastMessage.innerHTML += `<div class="mt-2 small text-danger">${details}</div>`;
            }
        }
        
        // Set title and icon based on type
        const toastTypes = {
            'success': {title: 'Success', icon: 'bi bi-check-circle-fill text-success me-2'},
            'error': {title: 'Error', icon: 'bi bi-exclamation-circle-fill text-danger me-2'},
            'warning': {title: 'Warning', icon: 'bi bi-exclamation-triangle-fill text-warning me-2'},
            'info': {title: 'Information', icon: 'bi bi-info-circle-fill text-info me-2'}
        };
        
        const typeConfig = toastTypes[type] || toastTypes.info;
        toastTitle.textContent = typeConfig.title;
        toastIcon.className = typeConfig.icon;
        
        // Show the toast with appropriate delay
        const bsToast = new bootstrap.Toast(toast, { delay: type === 'error' ? 5000 : 2500 });
        bsToast.show();
        
        return bsToast;
    },
    
    // Fetch API wrapper with consistent error handling and caching prevention
    fetchData: async function(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store',
            credentials: 'same-origin' // Include cookies for CSRF token
        };
        
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        
        // Add CSRF token to headers if it exists and this is a modifying request
        const isModifyingRequest = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || 'GET');
        
        // Create headers with CSRF token if needed
        const headers = {...defaultOptions.headers, ...options.headers};
        if (csrfToken && isModifyingRequest) {
            headers['X-CSRFToken'] = csrfToken;
        }
        
        // Merge defaults with provided options
        const mergedOptions = { 
            ...defaultOptions, 
            ...options,
            headers: headers
        };
        
        try {
            const response = await fetch(url, mergedOptions);
            
            if (!response.ok) {
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {
                    // If parsing fails, use status text
                    errorData = { message: response.statusText };
                }
                throw new Error(errorData.message || errorData.error || `Server error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            throw error;
        }
    },
    
    // Add cache busting parameter to URLs or URLSearchParams
    withCacheBuster: function(urlOrParams) {
        const isString = typeof urlOrParams === 'string';
        const params = isString ? new URLSearchParams(urlOrParams.includes('?') ? urlOrParams.split('?')[1] : '') : new URLSearchParams(urlOrParams);
        
        // Add cache busting parameter
        params.set('_', Date.now());
        
        // If original was a string URL, return a URL, otherwise return the params
        if (isString) {
            const baseUrl = urlOrParams.includes('?') ? urlOrParams.split('?')[0] : urlOrParams;
            return `${baseUrl}?${params.toString()}`;
        }
        
        return params;
    },
    
    // Safely restore focus to the body element
    restoreBodyFocus: function(delay = 50) {
        setTimeout(() => {
            if (document.body) {
                document.body.focus();
            }
        }, delay);
    },
    
    // Show a modal with proper accessibility handling
    showModal: function(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        // Set proper accessibility attributes
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal', 'true');
        
        // Set backdrop option (default to true)
        const backdrop = options.backdrop !== undefined ? options.backdrop : true;
        modal.setAttribute('data-bs-backdrop', backdrop.toString());
        
        // Set keyboard option (default to true)
        const keyboard = options.keyboard !== undefined ? options.keyboard : true;
        
        // Create a Bootstrap modal with proper options
        const bsModal = new bootstrap.Modal(modal, {
            backdrop: backdrop,
            keyboard: keyboard,
            focus: options.focus !== undefined ? options.focus : true
        });
        
        // Add standard event listeners for accessibility if not already added
        if (!modal.dataset.accessibilityHandlersAttached) {
            // Before showing the modal, add event listeners to handle accessibility properly
            modal.addEventListener('shown.bs.modal', function() {
                // Use aria-modal instead of aria-hidden for better accessibility
                this.setAttribute('aria-modal', 'true');
                this.removeAttribute('aria-hidden');
                
                // Focus the first focusable element in the modal
                if (options.focus !== false) {
                    setTimeout(() => {
                        const focusable = this.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                        if (focusable.length) {
                            focusable[0].focus();
                        }
                    }, 50);
                }
                
                // Run any custom show callback
                if (typeof options.onShown === 'function') {
                    options.onShown(this, bsModal);
                }
            });
            
            modal.addEventListener('hidden.bs.modal', function() {
                // Run cleanup after modal closes
                cleanupInertAttributes();
                
                // Move focus back to the body
                utils.restoreBodyFocus();
                
                // Run any custom hide callback
                if (typeof options.onHidden === 'function') {
                    options.onHidden(this, bsModal);
                }
            });
            
            // Mark the modal as having our handlers attached
            modal.dataset.accessibilityHandlersAttached = 'true';
        }
        
        // Show the modal
        bsModal.show();
        return bsModal;
    },
    
    // Hide a modal with proper cleanup
    hideModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (!bsModal) return false;
        
        // Move focus outside modal before hiding
        utils.restoreBodyFocus();
        
        // Hide the modal
        bsModal.hide();
        return true;
    },
    
    // Create a confirmation modal
    confirm: function(title, message, confirmCallback, options = {}) {
        const modalId = 'dynamicConfirmModal';
        let modal = document.getElementById(modalId);
        
        // Create modal if it doesn't exist
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-labelledby', `${modalId}Title`);
            
            modal.innerHTML = `
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="${modalId}Title"></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary confirm-button">Confirm</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
        
        // Set content
        modal.querySelector('.modal-title').textContent = title;
        modal.querySelector('.modal-body').textContent = message;
        
        // Get the confirm button and replace it to remove any existing event listeners
        const confirmButton = modal.querySelector('.confirm-button');
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Add confirm button color and text if provided
        if (options.confirmButtonText) {
            newConfirmButton.textContent = options.confirmButtonText;
        }
        
        if (options.confirmButtonColor) {
            newConfirmButton.className = newConfirmButton.className.replace(/btn-\w+/, `btn-${options.confirmButtonColor}`);
        }
        
        // Add event handler for confirmation
        newConfirmButton.addEventListener('click', () => {
            utils.hideModal(modalId);
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
        });
        
        // Show the modal
        utils.showModal(modalId);
    }
};

// Global utility to ensure all inert attributes are cleaned up
function cleanupInertAttributes() {
    // Emergency cleanup - traverse the entire DOM
    document.querySelectorAll('*').forEach(el => {
        // Remove inert attribute
        if (el.hasAttribute('inert')) {
            el.removeAttribute('inert');
        }
        
        // Remove tracking attribute
        if (el.hasAttribute('data-inert-by-modal')) {
            el.removeAttribute('data-inert-by-modal');
        }
        
        // Also remove aria-hidden from non-modal elements
        if (el.getAttribute('aria-hidden') === 'true' && 
            !el.classList.contains('modal') && 
            !el.classList.contains('offcanvas')) {
            el.removeAttribute('aria-hidden');
        }
    });
    
    // Ensure all modals use aria-modal instead of aria-hidden
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal.classList.contains('show')) {
            modal.setAttribute('aria-modal', 'true');
            modal.removeAttribute('aria-hidden');
        } else {
            modal.removeAttribute('aria-modal');
            modal.removeAttribute('aria-hidden');
        }
    });
    
    // Ensure main containers are fully interactive
    ['body', '.wrapper', '.container', '.container-fluid', 'main', '#content'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.pointerEvents = '';
            el.removeAttribute('inert');
            el.removeAttribute('aria-hidden');
        });
    });
    
    // Remove any orphaned backdrops when no modals are shown
    const modals = document.querySelectorAll('.modal.show');
    if (modals.length === 0) {
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.remove();
        });
    }
    
    // Ensure body is focusable
    if (!document.body.hasAttribute('tabindex')) {
        document.body.setAttribute('tabindex', '-1');
    }
}

// Set up global modal handlers for better reliability
function setupModalHandlers() {
    // Listen for all modal show events 
    document.addEventListener('show.bs.modal', function(event) {
        const modal = event.target;
        
        // Ensure our cleanup mechanism is attached
        if (!modal.dataset.cleanupAttached) {
            modal.addEventListener('hidden.bs.modal', function() {
                cleanupInertAttributes();
                setTimeout(() => document.body.focus(), 50);
            });
            
            modal.dataset.cleanupAttached = 'true';
        }
        
        // Use proper accessibility attributes
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal', 'true');
    });
    
    // Global handler for any modal being hidden (safety net)
    document.addEventListener('hidden.bs.modal', function() {
        setTimeout(() => {
            cleanupInertAttributes();
            document.body.focus();
        }, 100);
    });
    
    // Handle escape key presses
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            setTimeout(() => {
                const modalBackdrops = document.querySelectorAll('.modal-backdrop');
                if (modalBackdrops.length === 0) {
                    cleanupInertAttributes();
                }
            }, 300);
        }
        
        // Add manual hotkey for emergency cleanup (Alt+R)
        if (event.altKey && event.key === 'r') {
            cleanupInertAttributes();
            utils.showToast("Page reset complete - UI should be clickable now", "info");
        }
    });
    
    // Periodic safety check
    setInterval(function() {
        const visibleModals = document.querySelectorAll('.modal.show');
        const inertElements = document.querySelectorAll('[inert],[data-inert-by-modal]');
        
        if (visibleModals.length === 0 && inertElements.length > 0) {
            cleanupInertAttributes();
        }
    }, 2000);
}

// Set up all event listeners
function setupEventListeners() {
    // Status filter change
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Keep Enter key functionality
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
        
        // Add debounced input event
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 500);
        });
    }
    
    // Search button
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', applyFilters);
    }
    
    // Rows per page
    const rowsPerPage = document.getElementById('rowsPerPage');
    if (rowsPerPage) {
        rowsPerPage.addEventListener('change', applyFilters);
    }
    
    // Pagination controls
    const prevPageBtn = document.getElementById('prevPage');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => navigatePage('prev'));
    }
    
    const nextPageBtn = document.getElementById('nextPage');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => navigatePage('next'));
    }
    
    // Export CSV button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportEnrollmentsCSV);
    }
    
    // Add new enrollment button
    const enrollStudentsBtn = document.getElementById('addNewEnrolmentBtn') || document.getElementById('enrollStudentsBtn');
    if (enrollStudentsBtn) {
        enrollStudentsBtn.addEventListener('click', handleEnrolment);
    }
    
    // Setup enrollment modal events
    setupEnrollmentModalListeners();
    
    // Also add event listener to the Enroll Students button inside the modal
    const modalEnrollBtn = document.querySelector('#addEnrolmentModal .btn-primary') || 
                          document.querySelector('#addEnrolmentModal button[type="submit"]');
    
    if (modalEnrollBtn) {
        modalEnrollBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleEnrolment();
        });
    }
}

// Set up enrollment modal listeners
function setupEnrollmentModalListeners() {
    // Load data when enrollment modal is shown
    const enrollmentModal = document.getElementById('addEnrolmentModal');
    if (enrollmentModal) {
        // Use both Bootstrap's event and a direct handler to ensure it works
        enrollmentModal.addEventListener('show.bs.modal', function() {
            console.log('Enrollment modal is being shown - loading data');
            loadUnenrolledStudents();
            loadClasses();
            
            // Set today's date as default for start date
            const startDateField = document.getElementById('startDate');
            if (startDateField) {
                const today = new Date();
                const formattedDate = today.toISOString().split('T')[0];
                startDateField.value = formattedDate;
            }
        });
        
        // Add a direct click handler to the button that opens the modal
        const addEnrollmentBtn = document.querySelector('button[data-bs-target="#addEnrolmentModal"]');
        if (addEnrollmentBtn) {
            addEnrollmentBtn.addEventListener('click', function() {
                console.log('Add Enrollment button clicked - ensuring classes are loaded');
                // Give a small delay to ensure modal is in DOM
                setTimeout(() => {
                    loadUnenrolledStudents();
                    loadClasses();
                }, 100);
            });
        }
    }
    
    // Student search in modal
    const studentSearchInput = document.getElementById('studentSearchInput');
    if (studentSearchInput) {
        studentSearchInput.addEventListener('input', filterStudents);
    }
}

// Load initial data
function loadInitialData() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = new URLSearchParams();
    
    // Get current filters from URL or use defaults
    const statusValue = urlParams.get('status') || '';
    params.set('status', statusValue);
    params.set('search', urlParams.get('search') || '');
    params.set('per_page', urlParams.get('per_page') || '5');
    params.set('page', urlParams.get('page') || '1');
    
    // Synchronize UI filters with URL parameters
    synchronizeUIFilters(urlParams);
    
    // Add cache buster and fetch data
    fetchFilteredData(utils.withCacheBuster(params));
}

// Apply filters and fetch data
function applyFilters(page = null) {
    // Get current filter values
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchInput').value.trim();
    const perPage = document.getElementById('rowsPerPage').value;
    
    // Get current page from URL or use provided page
    const urlParams = new URLSearchParams(window.location.search);
    
    // Make sure page is a number, not an event object
    let currentPage = urlParams.get('page') || 1;
    if (page !== null) {
        // Check if page is an event object (which has preventDefault method)
        if (page && typeof page === 'object' && typeof page.preventDefault === 'function') {
            // It's an event object, ignore it and use the URL parameter or default
        } else if (!isNaN(parseInt(page))) {
            // It's a valid page number
            currentPage = parseInt(page);
        }
    }
    
    // Build query params
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    params.set('per_page', perPage);
    params.set('page', currentPage);
    
    // Fetch data with new filters (cache buster added automatically)
    fetchFilteredData(utils.withCacheBuster(params));
    
    // Update URL for bookmarking (without the cache buster)
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
}

// Fetch data from server
async function fetchFilteredData(params) {
    try {
        // Show loading indicator
        const tableBody = document.getElementById('enrolmentTableBody');
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        
        // Fetch data using our utility
        const data = await utils.fetchData(`/admin/enrollment-management/data?${params.toString()}`);
        
        // Update UI with new data
        updateTable(data.enrollments);
        updatePagination(data.pagination);
        
        // Notify other components that data has been loaded
        document.dispatchEvent(new CustomEvent('enrollmentDataLoaded', { 
            detail: data 
        }));
    } catch (error) {
        utils.showToast('Error loading enrollment data', 'error', error.message);
    }
}

// Update the enrollment table with data
function updateTable(enrollments) {
    const tableBody = document.getElementById('enrolmentTableBody');
    tableBody.innerHTML = '';
    
    if (!enrollments || enrollments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No enrollment records found</td></tr>';
        return;
    }
    
    enrollments.forEach(enrollment => {
        // Determine status class for badge
        const statusClass = enrollment.student.status === 'Active' 
            ? 'bg-success-subtle text-success'
            : enrollment.student.status === 'Inactive' 
                ? 'bg-danger-subtle text-danger' 
                : 'bg-warning-subtle text-warning';
                
        // Get active class count
        const classesCount = enrollment.active_class_count || 0;
        
        // Create table row
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <img src="/static/images/${enrollment.student.profile_img || 'profile.png'}" 
                         class="rounded-circle me-3" 
                         width="40" 
                         height="40"
                         alt="${enrollment.student.name}">
                    <div>
                        <div class="fw-medium">${enrollment.student.name}</div>
                        <div class="text-muted small">${enrollment.student.user_id}</div>
                    </div>
                </div>
            </td>
            <td>${classesCount}</td>
            <td>${enrollment.enrollment_date}</td>
            <td>
                <span class="badge ${statusClass}">
                    ${enrollment.student.status}
                </span>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-link text-muted" 
                        onclick="viewEnrolment('${enrollment.student.user_id}')">
                        <i class="bi bi-eye" style="color: #191970;"></i>
                </button>
                <button class="btn btn-sm btn-link text-muted" 
                        onclick="editEnrolment('${enrollment.student.user_id}')">
                        <i class="bi bi-pencil" style="color: #191970;"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Update pagination controls and info
function updatePagination(pagination) {
    // Update pagination buttons
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.disabled = pagination.current_page <= 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = pagination.end_idx >= pagination.total;
    }
    
    // Update pagination info text
    const paginationInfo = document.getElementById('paginationInfo') || document.querySelector('.pagination-info');
    if (paginationInfo) {
        paginationInfo.textContent = `${pagination.start_idx + 1}-${pagination.end_idx} of ${pagination.total}`;
    }
    
    // Update status filter visual indicators
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        // Add visual indicator for the Active filter
        if (statusFilter.value === 'Active') {
            statusFilter.classList.add('showing-all-students');
        } else {
            statusFilter.classList.remove('showing-all-students');
        }
    }
}

// Navigate to prev/next page
function navigatePage(direction) {
    const urlParams = new URLSearchParams(window.location.search);
    let currentPage = parseInt(urlParams.get('page') || 1);
    
    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    } else if (direction === 'next') {
        currentPage++;
    }
    
    // Apply filters with updated page number
    applyFilters(currentPage);
}

// Load unenrolled students for the form
async function loadUnenrolledStudents() {
    try {
        const data = await utils.fetchData('/api/students/unenrolled');

        const studentCheckboxes = document.getElementById('studentCheckboxes');
        if (!studentCheckboxes) {
            console.error('Student checkboxes container not found');
            return;
        }
        
        // Show loading indicator
        studentCheckboxes.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading students...</p></div>';
        
        // Process students data from various possible response formats
        let students = data.students || data || [];
        
        // Filter to only include students based on role (case insensitive)
        students = students.filter(student => 
            (student.role || '').toLowerCase() === 'student'
        );
        
        // Store students list for filtering
        window.allStudents = students;
        
        // Clear the container
        studentCheckboxes.innerHTML = '';
        
        if (students.length === 0) {
            // Show no students available message
            studentCheckboxes.innerHTML = '<div class="alert alert-info">No students available</div>';
            return;
        }
        
        // Clear any previous search
        const searchInput = document.getElementById('studentSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Add each student as a checkbox
        students.forEach((student) => {
            const studentId = student.id || student.user_id;
            
            // Handle different name formats
            const name = student.name || 
                         (student.first_name && student.last_name ? 
                          `${student.first_name} ${student.last_name}` : 
                          'Unknown');
            const id = studentId || '';
            
            const div = document.createElement('div');
            div.className = 'form-check mb-2';
            
            const input = document.createElement('input');
            input.className = 'form-check-input';
            input.type = 'checkbox';
            input.value = studentId;
            input.id = `student${studentId}`;
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `student${studentId}`;
            label.innerHTML = `
                ${name} <span class="text-muted">(${id})</span>
            `;
            
            div.appendChild(input);
            div.appendChild(label);
            studentCheckboxes.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading students:', error);
        
        // Use centralized notification system if available
        if (typeof showError === 'function') {
            showError('Failed to load students. Please try again.', 'Error');
        } else {
            utils.showToast('Error loading students: ' + error.message, 'error');
        }
        
        const studentCheckboxes = document.getElementById('studentCheckboxes');
        if (studentCheckboxes) {
            studentCheckboxes.innerHTML = '<div class="alert alert-danger">Error loading students</div>';
        }
    }
}

// Load classes
async function loadClasses() {
    try {
        console.log('Loading classes...');
        const classCheckboxes = document.getElementById('classCheckboxes');
        if (!classCheckboxes) {
            console.error('Class checkboxes container not found');
            return;
        }
        
        // Show loading indicator
        classCheckboxes.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading classes...</p></div>';
        
        // Fetch classes from the API
        const response = await fetch('/api/classes');
        if (!response.ok) {
            throw new Error(`Failed to fetch classes: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('Classes API response:', responseData);
        
        // Extract classes array from the response
        const classes = responseData.classes || [];
        
        // Clear the container
        classCheckboxes.innerHTML = '';
        
        if (!classes.length) {
            classCheckboxes.innerHTML = '<div class="alert alert-info">No classes available</div>';
            return;
        }
        
        console.log(`Found ${classes.length} classes to display`);
        
        // Log the first class to see its structure
        if (classes.length > 0) {
            console.log('Sample class object:', classes[0]);
        }
        
        // Add each class as a checkbox option
        classes.forEach((cls) => {
            const classId = cls.class_id || cls.id;
            
            const div = document.createElement('div');
            div.className = 'form-check mb-2';
            
            const input = document.createElement('input');
            input.className = 'form-check-input';
            input.type = 'checkbox';
            input.value = classId;
            input.id = `class${classId}`;
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `class${classId}`;
            
            // Map the API response properties to our display format
            const className = cls.name || 'Unnamed Class';
            
            // Get day information from dayOfWeek property
            const dayInfo = cls.dayOfWeek || cls.day || 'Day not specified';
            
            // Format time from startTime and endTime properties
            let timeInfo = 'Time not specified';
            if (cls.startTime && cls.endTime) {
                timeInfo = `${cls.startTime} - ${cls.endTime}`;
            } else if (cls.time) {
                timeInfo = cls.time;
            }
            
            // Get instructor from instructorName property
            const instructorInfo = cls.instructorName || cls.instructor || 'No instructor assigned';
            
            label.innerHTML = `
                ${className} (${dayInfo}, ${timeInfo})
                <div class="text-muted small">Instructor: ${instructorInfo}</div>
            `;
            
            div.appendChild(input);
            div.appendChild(label);
            classCheckboxes.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading classes:', error);
        
        // Use the centralized notification system
        if (typeof showError === 'function') {
            showError('Failed to load classes. Please try again.', 'Error');
        }
        
        const classCheckboxes = document.getElementById('classCheckboxes');
        if (classCheckboxes) {
            classCheckboxes.innerHTML = '<div class="alert alert-danger">Error loading classes</div>';
        }
    }
}

// Handle enrollment submission
async function handleEnrolment() {
    // Get form elements
    const studentCheckboxes = document.querySelectorAll('#studentCheckboxes input[type="checkbox"]:checked');
    const statusElement = document.getElementById('enrollmentStatus');
    const startDateElement = document.getElementById('startDate');
    
    if (!studentCheckboxes) {
        // Use centralized notification system if available
        if (typeof showError === 'function') {
            showError('Could not find student checkboxes', 'Error');
        } else {
            utils.showToast('Error: Could not find student checkboxes', 'error');
        }
        return;
    }
    
    // Get selected values
    const selectedStudents = Array.from(studentCheckboxes).map(checkbox => checkbox.value);
    
    // Validate student selection
    if (selectedStudents.length === 0) {
        // Use centralized notification system if available
        if (typeof showWarning === 'function') {
            showWarning('Please select at least one student', 'Validation Error');
        } else {
            utils.showToast('Please select at least one student', 'error');
        }
        return;
    }
    
    // Validate class selection
    const classCheckboxes = document.querySelectorAll('#classCheckboxes input:checked');
    const selectedClasses = Array.from(classCheckboxes).map(cb => cb.value);
                      
    if (selectedClasses.length === 0) {
        // Use centralized notification system if available
        if (typeof showWarning === 'function') {
            showWarning('Please select at least one class', 'Validation Error');
        } else {
            utils.showToast('Please select at least one class', 'error');
        }
        return;
    }

    // Prepare form data for submission
    const formData = {
        student_ids: selectedStudents,
        class_ids: selectedClasses,
        status: statusElement ? statusElement.value : 'Pending',
        start_date: startDateElement ? startDateElement.value : new Date().toISOString().split('T')[0]
    };
    
    // Show loading indicator
    utils.showToast('Processing enrollments...', 'info');

    try {
        // Submit enrollment data to API
        const result = await utils.fetchData('/api/enrollments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

            // Handle success case
            const createdCount = result.count || 0;
            const skippedCount = result.skipped || 0;
            
            let message = '';
            if (createdCount > 0) {
                message = `Successfully created ${createdCount} enrollment(s)`;
                if (skippedCount > 0) {
                    message += `, skipped ${skippedCount} duplicate(s)`;
            }
            
            // Show success message and close modal
            utils.showToast(message, 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('addEnrolmentModal'));
            if (modal) {
            modal.hide();
            }
            
            // Refresh data after a small delay
            setTimeout(applyFilters, 500);
        } else if (skippedCount > 0) {
            message = `No new enrollments created - ${skippedCount} enrollment(s) already exist`;
            utils.showToast(message, 'warning');
        }
    } catch (error) {
        utils.showToast('Error creating enrollment: ' + error.message, 'error');
    }
}

// View enrollment details
async function viewEnrolment(studentId) {
    try {
        // Fetch data with cache busting
        const data = await utils.fetchData(utils.withCacheBuster(`/api/students/${studentId}/enrollment`));
        
        // Directly update critical elements
        const studentIdElement = document.getElementById('studentId');
        const studentNameElement = document.getElementById('studentName');
        const studentImageElement = document.getElementById('studentImage');
        const studentStatusElement = document.getElementById('studentStatus');
        const studentCompanyElement = document.getElementById('studentCompany');
        const studentCompanyIdElement = document.getElementById('studentCompanyId');
        
        // Set text content for elements if they exist
        if (studentIdElement) studentIdElement.textContent = data.student.user_id;
        if (studentNameElement) studentNameElement.textContent = data.student.name;
        if (studentCompanyElement) studentCompanyElement.textContent = data.company.name || 'Not Assigned';
        if (studentCompanyIdElement) studentCompanyIdElement.textContent = data.company.company_id || 'N/A';
        
        // Set status with appropriate styling
        if (studentStatusElement) {
            studentStatusElement.textContent = data.student.status;
            studentStatusElement.className = data.student.status === 'Active' 
                ? 'badge bg-success-subtle text-success'
                : 'badge bg-danger-subtle text-danger';
        }
        
        // Handle student image with special care
        if (studentImageElement) {
            // Ensure default image path as fallback
            let imagePath = '/static/images/profile.png';
            
            // Use student image if available
            if (data.student.profile_img) {
                // Check various path formats
                if (data.student.profile_img.startsWith('/')) {
                    // Absolute path starting with /
                    imagePath = data.student.profile_img;
                } else if (data.student.profile_img.startsWith('http')) {
                    // Full URL
                    imagePath = data.student.profile_img;
                } else {
                    // Relative path, add prefix
                    imagePath = `/static/images/${data.student.profile_img}`;
                }
            }
            
            // Apply the image path
            studentImageElement.src = imagePath;
            
            // Ensure image is visible and properly styled
            studentImageElement.style.display = 'block';
            studentImageElement.style.width = '80px';
            studentImageElement.style.height = '80px';
            studentImageElement.style.objectFit = 'cover';
            studentImageElement.classList.add('rounded-circle');
            studentImageElement.classList.add('me-3');
            studentImageElement.alt = data.student.name || 'Student';
        }
        
        // Populate enrolled classes
        populateEnrolledClasses(data);
        
        // Create the edit button in the modal footer
        updateViewModalFooter(studentId);
        
        // Show the modal with proper accessibility
        utils.showModal('viewEnrollmentModal');
    } catch (error) {
        utils.showToast('Error loading enrollment details: ' + error.message, 'error');
    }
}

// Update student info in modal
function updateModalStudentInfo(mode, data) {
    const prefix = mode === 'edit' ? 'edit' : '';
    
    // Update text fields
    const elements = {
        'StudentId': data.student.user_id,
        'StudentName': data.student.name,
        'StudentCompany': mode === 'edit' ? 
            `Company: ${data.company.name || 'Not Assigned'}` : 
            data.company.name || 'Not Assigned',
        'StudentStatus': data.student.status
    };
    
    // Update each element if it exists
    Object.entries(elements).forEach(([key, value]) => {
        const element = document.getElementById(`${prefix}${key}`);
        if (element) element.textContent = value;
    });
    
    // Handle company ID separately if needed
    const companyIdElement = document.getElementById('studentCompanyId');
    if (companyIdElement && mode !== 'edit') {
        companyIdElement.textContent = data.company.company_id || 'N/A';
    }
    
    // Update student status badge if exists
    const statusElement = document.getElementById(`${prefix}StudentStatus`);
    if (statusElement && mode !== 'edit') {
            if (data.student.status === 'Active') {
            statusElement.className = 'badge bg-success-subtle text-success';
            } else {
            statusElement.className = 'badge bg-danger-subtle text-danger';
            }
        }
        
    // Fix the profile image path and display
    const studentImageElement = document.getElementById(`${prefix}StudentImage`);
        if (studentImageElement) {
        // Default to profile.png if no image specified
        let profileImg = 'profile.png';
        
        // If student has a profile image, use it
        if (data.student.profile_img) {
            profileImg = data.student.profile_img;
            // Make sure the path is correct
            if (!profileImg.startsWith('/static/') && !profileImg.startsWith('http')) {
                profileImg = `/static/images/${profileImg}`;
            }
        } else {
            // Use default image path
            profileImg = '/static/images/profile.png';
        }
        
        // Set the image source
        studentImageElement.src = profileImg;
        
        // Make sure the image is visible and properly sized
        studentImageElement.style.display = 'block';
        studentImageElement.classList.add('rounded-circle');
        
        // Set alt text for accessibility
        studentImageElement.alt = data.student.name || 'Student Image';
    }
}

// Populate enrolled classes in the view modal
function populateEnrolledClasses(data) {
    const enrollmentContainer = document.getElementById('studentEnrollments');
    if (!enrollmentContainer) {
        console.error("Element with ID 'studentEnrollments' not found in the modal.");
        return;
    }
    
    console.log("Enrollment data:", data);
    
    // Clear previous content
    enrollmentContainer.innerHTML = '';
    
    // Check for enrollment data from different possible sources
    const allEnrollments = data.classes || data.enrollments || [];
    const activeEnrollments = data.active_enrollments || allEnrollments.filter(e => e.is_active);
    const pastEnrollments = data.historical_enrollments || allEnrollments.filter(e => !e.is_active || e.unenrollment_date);
    
    console.log(`Found ${activeEnrollments.length} active enrollments and ${pastEnrollments.length} past enrollments`);
    
    if (allEnrollments.length === 0) {
        enrollmentContainer.innerHTML = '<p class="text-muted">No classes enrolled</p>';
        return;
    }
    
    // Sort enrollments by name
    const sortEnrollments = (enrolls) => {
        return [...enrolls].sort((a, b) => {
            const nameA = a.class_name || a.name || (a.class ? a.class.name : '');
            const nameB = b.class_name || b.name || (b.class ? b.class.name : '');
            return nameA.localeCompare(nameB);
        });
    };
    
    // Add Active Enrollments section
    if (activeEnrollments.length > 0) {
                    const activeHeader = document.createElement('h6');
                    activeHeader.textContent = 'Active Enrollments';
        activeHeader.className = 'mt-3 mb-2';
        enrollmentContainer.appendChild(activeHeader);
                    
        sortEnrollments(activeEnrollments).forEach(enrollment => {
            appendClassCard(enrollmentContainer, enrollment);
                    });
                }
                
    // Add Past Enrollments section
    if (pastEnrollments.length > 0) {
                    const historyHeader = document.createElement('h6');
                    historyHeader.textContent = 'Past Enrollments';
        historyHeader.className = 'mt-4 mb-2';
        enrollmentContainer.appendChild(historyHeader);
                    
        sortEnrollments(pastEnrollments).forEach(enrollment => {
            appendClassCard(enrollmentContainer, enrollment);
                    });
    }
}

// Create and append a class card
        function appendClassCard(container, cls) {
    // Create card container
    const card = document.createElement('div');
    card.className = 'card mb-2';
    
    // Get class info from different possible locations in the data structure
    const className = cls.class_name || cls.name || (cls.class ? cls.class.name : 'Unknown Class');
    
    // Get schedule from different possible locations
    let schedule = cls.schedule;
    if (!schedule) {
        const dayOfWeek = cls.day_of_week || cls.day || (cls.class ? cls.class.day_of_week : '');
        const startTime = cls.start_time || (cls.class ? cls.class.start_time : '');
        const endTime = cls.end_time || (cls.class ? cls.class.end_time : '');
        
        if (dayOfWeek && (startTime || endTime)) {
            schedule = `${dayOfWeek}, ${startTime || ''} - ${endTime || ''}`;
                    } else {
            schedule = 'Schedule not available';
        }
    }
    
    // Get status
    let status = cls.enrollment_status || cls.status || 'Unknown';
    let isActive = cls.is_active;
    
    // If unenrollment_date exists, it's definitely not active and should show as "Unenrolled"
            if (cls.unenrollment_date) {
        isActive = false;
        status = "Unenrolled";
    }
    
    // Create status badge with appropriate color
    let badgeClass = '';
    if (status.toLowerCase() === 'active') {
        badgeClass = 'bg-success-subtle text-success';
    } else if (status.toLowerCase() === 'pending') {
        badgeClass = 'bg-warning-subtle text-warning';
    } else if (status.toLowerCase() === 'completed') {
        badgeClass = 'bg-info-subtle text-info';
    } else if (status.toLowerCase() === 'unenrolled') {
        badgeClass = 'bg-secondary-subtle text-secondary';
    } else if (status.toLowerCase() === 'dropped') {
        badgeClass = 'bg-danger-subtle text-danger';
    }
    
    // Get instructor name
    const instructor = cls.instructor_name || cls.instructor || (cls.class ? cls.class.instructor_name : 'Not assigned');
    
    // Create the card content
    const cardContent = `
                        <div class="card-body p-3">
            <h6 class="card-title mb-1">${className}</h6>
            <p class="card-text text-muted small mb-1">${schedule}</p>
            <div class="d-flex justify-content-between align-items-center mt-2">
                <span class="badge ${badgeClass}">${status}</span>
                <span class="text-muted small">${instructor ? `<i class="bi bi-person-circle me-1"></i>${instructor}` : ''}</span>
                            </div>
            ${cls.enrollment_date ? `<p class="text-muted small mb-0">Enrolled: ${cls.enrollment_date}</p>` : ''}
            ${cls.unenrollment_date ? `<p class="text-muted small mb-0">Unenrolled: ${cls.unenrollment_date}</p>` : ''}
        </div>
    `;
    
    card.innerHTML = cardContent;
    container.appendChild(card);
        }
        
// Update view modal footer
function updateViewModalFooter(studentId) {
    const viewModalFooter = document.querySelector('#viewEnrollmentModal .modal-footer');
    if (!viewModalFooter) return;
    
    // Clear existing footer content
    viewModalFooter.innerHTML = '';
    
    // Set footer style to flex with space-between
    viewModalFooter.style.display = 'flex';
    viewModalFooter.style.justifyContent = 'space-between';
    
    // Add edit button at the left
    const leftContainer = document.createElement('div');
    viewModalFooter.appendChild(leftContainer);
    
    const editButton = document.createElement('button');
    editButton.className = 'btn btn-primary';
    editButton.style.backgroundColor = '#191970';
    editButton.innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Enrollments';
    
    // Set a custom event handler that properly manages focus
    editButton.addEventListener('click', () => {
        // Move focus outside modal before any action
        utils.restoreBodyFocus();
        
        // Close the view modal and then open edit modal
        utils.hideModal('viewEnrollmentModal');
        
        // Open the edit modal after a short delay
        setTimeout(() => editEnrolment(studentId), 300);
    });
    
    leftContainer.appendChild(editButton);
    
    // Add the close button on the right
    const rightContainer = document.createElement('div');
    viewModalFooter.appendChild(rightContainer);
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn btn-secondary';
    closeButton.setAttribute('data-bs-dismiss', 'modal');
    closeButton.textContent = 'Close';
    
    rightContainer.appendChild(closeButton);
}

// Edit enrollment
async function editEnrolment(studentId) {
    try {
        // Fetch enrollment data with cache busting
        const data = await utils.fetchData(utils.withCacheBuster(`/api/students/${studentId}/enrollment`));
        
        // Find the edit modal
        const editModal = document.getElementById('editEnrolmentModal');
        if (!editModal) {
            throw new Error('Edit modal not found');
        }
        
        // Find or create a modal footer element
        let modalFooter = editModal.querySelector('.modal-footer');
        if (!modalFooter) {
            modalFooter = document.createElement('div');
            modalFooter.className = 'modal-footer';
            const modalContent = editModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.appendChild(modalFooter);
            } else {
                editModal.appendChild(modalFooter);
            }
        }
        
        // Set student info
        updateModalStudentInfo('edit', data);
        
        // Store student ID for reference
        editModal.dataset.studentId = studentId;
        
        // Populate the class container
        populateEditClassContainer(data, studentId);
        
        // Show the edit modal
        utils.showModal('editEnrolmentModal');
    } catch (error) {
        utils.showToast('Error loading enrollment data: ' + error.message, 'error');
    }
}

// Populate edit class container
function populateEditClassContainer(data, studentId) {
    const classContainer = document.getElementById('editEnrolledClasses');
    if (!classContainer) return;
        
        // Clear the container
        classContainer.innerHTML = '';
        
        // Clear existing footer content
    const modalFooter = document.querySelector('#editEnrolmentModal .modal-footer');
    if (modalFooter) modalFooter.innerHTML = '';
        
        // Filter out classes that have unenrollment_date (historical enrollments)
        const activeClasses = data.classes ? data.classes.filter(cls => !cls.unenrollment_date) : [];
        
        if (!activeClasses || activeClasses.length === 0) {
            classContainer.innerHTML = '<div class="alert alert-info">No active classes enrolled</div>';
            
            // Add a message to the footer
        if (modalFooter) {
            const message = document.createElement('div');
            message.className = 'text-muted';
            message.textContent = 'No active enrollments to manage';
            modalFooter.appendChild(message);
        }
        return;
    }
    
            // Create container to hold classes
            const classesWrapper = document.createElement('div');
            classesWrapper.id = 'editClassesForm';
            classContainer.appendChild(classesWrapper);
            
            // Add active classes only
            activeClasses.forEach(cls => {
        appendEditClassCard(classesWrapper, cls, studentId);
    });
    
    // Add Save and Cancel buttons
    if (modalFooter) {
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'btn btn-secondary';
        cancelButton.setAttribute('data-bs-dismiss', 'modal');
        cancelButton.textContent = 'Cancel';
        modalFooter.appendChild(cancelButton);

        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'btn btn-primary';
        saveButton.style.backgroundColor = '#191970';
        saveButton.style.borderColor = '#191970';
        saveButton.textContent = 'Save Changes';
        modalFooter.appendChild(saveButton);

        // Add event handling for the save button
        saveButton.addEventListener('click', async function() {
            // First move focus outside the modal to prevent accessibility issues
            document.body.focus();
            
            // Then process the enrollment changes
            await saveEnrollmentChanges(studentId);
        });
    }
}

// Create and append an editable class card
function appendEditClassCard(container, cls, studentId) {
                const classId = cls.class_id || cls.id;
                const status = cls.enrollment_status || 'Pending';
                
                // Create unique identifier for this enrollment
                const enrollmentKey = `${studentId}-${classId}`;
                
                const classCard = document.createElement('div');
                classCard.className = 'card mb-3';
                classCard.dataset.classId = classId;
                classCard.dataset.originalStatus = status; // Store original status for comparison
                
                const cardBody = document.createElement('div');
                cardBody.className = 'card-body';
                
                // Class header with name and toggle
                const headerDiv = document.createElement('div');
                headerDiv.className = 'd-flex justify-content-between align-items-center mb-2';
                
                // Class name
                const classTitle = document.createElement('h6');
                classTitle.className = 'card-title mb-0';
                classTitle.textContent = cls.name;
                headerDiv.appendChild(classTitle);
                
                // Keep enrolled toggle
                const toggleDiv = document.createElement('div');
                toggleDiv.className = 'form-check form-switch';
                
                const toggleInput = document.createElement('input');
                toggleInput.className = 'form-check-input';
                toggleInput.type = 'checkbox';
                toggleInput.id = `keep-class-${classId}`;
                
                // Initialize storage for this enrollment if not exists
                if (!window.enrollmentToggleStates) {
                    window.enrollmentToggleStates = {};
                }
                
                // Check if we have a saved state for this toggle, otherwise default to checked
                toggleInput.checked = window.enrollmentToggleStates[enrollmentKey] !== false;
                
                toggleInput.dataset.classId = classId;
                toggleInput.dataset.enrollmentKey = enrollmentKey;
                
                const toggleLabel = document.createElement('label');
                toggleLabel.className = 'form-check-label';
                toggleLabel.htmlFor = `keep-class-${classId}`;
                toggleLabel.textContent = 'Keep Enrolled';
                
                toggleDiv.appendChild(toggleInput);
                toggleDiv.appendChild(toggleLabel);
                headerDiv.appendChild(toggleDiv);
                
                cardBody.appendChild(headerDiv);
                
                // Class schedule
                const scheduleText = document.createElement('p');
                scheduleText.className = 'text-muted small mb-3';
                scheduleText.textContent = cls.schedule || 'Schedule information not available';
                cardBody.appendChild(scheduleText);
                
                // Status section
                const statusSection = document.createElement('div');
                statusSection.id = `status-section-${classId}`;
                cardBody.appendChild(statusSection);
                
                // Status selector
                const statusGroup = document.createElement('div');
                statusGroup.className = 'form-group';
                statusSection.appendChild(statusGroup);
                
                const statusLabel = document.createElement('label');
                statusLabel.className = 'form-label';
                statusLabel.textContent = 'Status';
                statusGroup.appendChild(statusLabel);
                
                const statusSelect = document.createElement('select');
                statusSelect.className = 'form-select form-select-sm';
                statusSelect.id = `status-${classId}`;
                statusSelect.dataset.classId = classId;
                
                // Set disabled state based on toggle state
                if (window.enrollmentToggleStates[enrollmentKey] === false) {
                    statusSelect.disabled = true;
                }
                
                const pendingOption = document.createElement('option');
                pendingOption.value = 'Pending';
                pendingOption.textContent = 'Pending';
                pendingOption.selected = status === 'Pending';
                statusSelect.appendChild(pendingOption);
                
                const activeOption = document.createElement('option');
                activeOption.value = 'Active';
                activeOption.textContent = 'Active';
                activeOption.selected = status === 'Active';
                statusSelect.appendChild(activeOption);
                
                statusGroup.appendChild(statusSelect);
                
                // Unenrollment message (hidden by default)
                const unenrollMessage = document.createElement('div');
                unenrollMessage.className = 'alert alert-danger mt-2';
                unenrollMessage.id = `unenroll-msg-${classId}`;
                unenrollMessage.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i>Student will be removed from this class`;
                
                // Show/hide the message based on the toggle state
                if (window.enrollmentToggleStates[enrollmentKey] === false) {
                    unenrollMessage.classList.remove('d-none');
                } else {
                    unenrollMessage.classList.add('d-none');
                }
                
                statusSection.appendChild(unenrollMessage);
                
                classCard.appendChild(cardBody);
    container.appendChild(classCard);
                
    // Add event listener for the toggle
                toggleInput.addEventListener('change', function() {
                    const statusSelect = document.getElementById(`status-${classId}`);
                    const unenrollMsg = document.getElementById(`unenroll-msg-${classId}`);
                    const enrollmentKey = this.dataset.enrollmentKey;
                    
                    // Store toggle state for persistence
                    window.enrollmentToggleStates[enrollmentKey] = this.checked;
                    
                    if (this.checked) {
                        // Enable status selection when keeping enrolled
            if (statusSelect) statusSelect.disabled = false;
            if (unenrollMsg) unenrollMsg.classList.add('d-none');
                    } else {
                        // Disable status selection when not keeping enrolled
            if (statusSelect) statusSelect.disabled = true;
            if (unenrollMsg) unenrollMsg.classList.remove('d-none');
        }
    });
}

// Save enrollment changes
async function saveEnrollmentChanges(studentId) {
    // Get the edit form and all enrolled classes
    const editForm = document.getElementById('editClassesForm');
    if (!editForm) {
        utils.showToast('Error: Could not find edit form', 'error');
        return false;
        }
        
        // Show loading toast
    utils.showToast('Saving changes...', 'info');
        
    // Get all class cards in the form
    const classCards = editForm.querySelectorAll('.card');
    let hasChanges = false;
    let processedCount = 0;
        let errorCount = 0;
        
    // Track which enrollment toggles we've already processed
    const processedEnrollments = new Set();
    
    // Process each class card
        for (const card of classCards) {
        try {
            const classId = card.dataset.classId;
            if (!classId) continue;
            
            const enrollmentKey = `${studentId}-${classId}`;
            
            // Skip if we've already processed this enrollment
            if (processedEnrollments.has(enrollmentKey)) {
                continue;
            }
            
            // Get toggle and status
            const toggleInput = card.querySelector(`input[data-class-id="${classId}"]`);
            const statusSelect = card.querySelector(`select[data-class-id="${classId}"]`);
            
            // Skip if the necessary elements are not found
            if (!toggleInput) continue;
            
            // Store original values for comparison
            const originalStatus = card.dataset.originalStatus || 'Pending';
            const keepEnrolled = toggleInput.checked;
            const newStatus = statusSelect ? statusSelect.value : originalStatus;
            
            // Check if any changes are needed
            if (!keepEnrolled) {
                // Unenroll the student
                await processUnenrollment(studentId, classId, processedEnrollments);
                processedCount++;
                hasChanges = true;
            } else if (newStatus !== originalStatus) {
                // Update enrollment status
                await processStatusUpdate(studentId, classId, newStatus, processedEnrollments);
                processedCount++;
                hasChanges = true;
            }
        } catch (error) {
            errorCount++;
            // Skip individual errors and continue processing other cards
            console.error(`Error processing card: ${error.message}`);
        }
    }
    
    // Show result toast
    if (hasChanges) {
        if (errorCount > 0) {
            utils.showToast(`Saved ${processedCount} changes with ${errorCount} errors`, 'warning');
        } else {
            utils.showToast(`Successfully saved changes to ${processedCount} enrollments`, 'success');
        }
        
        // Close the modal after processing
        utils.hideModal('editEnrolmentModal');
        
        // Refresh data after a small delay
        setTimeout(() => refreshAfterChanges(studentId), 500);
    } else {
        utils.showToast('No changes to save', 'info');
    }

    return hasChanges;
}

// Process student unenrollment
async function processUnenrollment(studentId, classId, processedEnrollments) {
    try {
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

        // Use utils.fetchData for consistent error handling and CSRF token inclusion
        await utils.fetchData(`/api/enrollments/${studentId}/${classId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || ''
            },
            credentials: 'same-origin' // Include cookies for authentication
        });

        // If we get here, the request was successful
        processedEnrollments.add(`${studentId}-${classId}`);
        return true;
    } catch (error) {
        // Don't count "not found" as an error
        if (error.message && error.message.includes('not found')) {
            return true;
        }

        // Show error toast and propagate the error
        utils.showToast(`Error unenrolling from class ${classId}: ${error.message}`, 'error');
        throw error;
    }
}

// Process enrollment status update
async function processStatusUpdate(studentId, classId, newStatus, processedEnrollments) {
    try {
        await utils.fetchData('/api/enrollments/approve', {
                            method: 'POST',
                            headers: {
                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                student_id: studentId,
                            class_id: classId,
                            status: newStatus
                            })
                        });
                        
                        // Add to processed set
        processedEnrollments.add(`${studentId}-${classId}`);
        return true;
                } catch (error) {
        utils.showToast(`Error updating status for class ${classId}: ${error.message}`, 'error');
        throw error;
    }
}

// Refresh data after enrollment changes
function refreshAfterChanges(studentId) {
    // Get current URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // Create a new params object with current filters
    const params = new URLSearchParams();
    params.set('status', urlParams.get('status') || '');
    params.set('search', urlParams.get('search') || '');
    params.set('per_page', urlParams.get('per_page') || '5');
    params.set('page', urlParams.get('page') || '1');
    
    // Add cache buster to prevent caching
    const freshParams = utils.withCacheBuster(params);
    
    // If we're looking at a single student, refresh that view
    if (studentId) {
        // Check if view modal is visible and refresh it
        const viewModal = document.getElementById('viewEnrollmentModal');
        if (viewModal && viewModal.classList.contains('show')) {
            viewEnrolment(studentId);
        }
    }
    
    // Force a full refresh to ensure all counts are updated
    fetchFilteredData(freshParams);
}

// Approve enrollment
async function approveEnrollment(studentId, classId) {
    try {
        utils.showToast('Processing approval...', 'info');
        
        await utils.fetchData('/api/enrollments/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                student_id: studentId,
                class_id: classId
            })
        });

            // Get the current modal instance and hide it first
        const viewModalVisible = utils.hideModal('viewEnrollmentModal');
                
        if (viewModalVisible) {
                // Wait for modal to finish hiding transition
                setTimeout(() => {
                utils.showToast('Enrollment approved successfully', 'success');
                refreshAfterChanges(studentId);
                }, 300);
            } else {
            utils.showToast('Enrollment approved successfully', 'success');
            refreshAfterChanges(studentId);
        }
    } catch (error) {
        utils.showToast('Error approving enrollment: ' + error.message, 'error');
    }
}

// Show unenroll confirmation modal
function showUnenrollConfirmation(studentId, classId, studentName, className) {
    utils.confirm(
        'Confirm Unenrollment',
        `Are you sure you want to unenroll ${studentName} from ${className}?`,
        () => performUnenrollment(studentId, classId),
        { 
            confirmButtonText: 'Unenroll',
            confirmButtonColor: 'danger'
        }
    );
}

// Perform the unenrollment
async function performUnenrollment(studentId, classId) {
    try {
        // Show loading toast
        utils.showToast('Processing unenrollment...', 'info');
        
        // Use utils.fetchData for consistent error handling and CSRF token inclusion
        await utils.fetchData(`/api/enrollments/${studentId}/${classId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Show success toast
        utils.showToast('Student successfully unenrolled', 'success');
        
        // Give backend time to process the change
        setTimeout(() => refreshAfterChanges(studentId), 1000);
    } catch (error) {
        utils.showToast('Error unenrolling student: ' + error.message, 'error');
    }
}

// Entry point for unenrolling a student
function unenrollStudent(studentId, classId, studentName = '', className = '') {
    // If student name or class name is not provided, try to get them from the DOM
    if (!studentName) {
        studentName = document.getElementById(`studentName_${studentId}`)?.textContent || 'Student';
    }
    if (!className) {
        className = document.getElementById(`className_${classId}`)?.textContent || 'Class';
    }
    
    // Show the confirmation modal
    showUnenrollConfirmation(studentId, classId, studentName, className);
}

// Filter students in dropdown based on search input
function filterStudents() {
    const searchInput = document.getElementById('studentSearchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const studentSelect = document.getElementById('studentSelect');
    
    if (!studentSelect) return;
    
    // If search is empty, show all options
    if (!searchTerm) {
        Array.from(studentSelect.options).forEach(option => {
            option.style.display = '';
        });
        return;
    }
    
    // Match by name or ID
    let matchFound = false;
    Array.from(studentSelect.options).forEach(option => {
        const text = option.textContent.toLowerCase();
        const value = option.value.toLowerCase();
        
        if (text.includes(searchTerm) || value.includes(searchTerm)) {
            option.style.display = '';
            matchFound = true;
        } else {
            option.style.display = 'none';
        }
    });
    
    // Show a message if no matches found
    if (!matchFound && studentSelect.options.length > 0) {
        // Check if we already have a "no matches" option
        const existingNoMatchOption = Array.from(studentSelect.options).find(
            opt => opt.classList.contains('no-match-option')
        );
        
        if (!existingNoMatchOption) {
            const noMatchOption = document.createElement('option');
            noMatchOption.disabled = true;
            noMatchOption.textContent = `No students match "${searchTerm}"`;
            noMatchOption.classList.add('no-match-option');
            noMatchOption.style.fontStyle = 'italic';
            noMatchOption.style.color = '#6c757d';
            studentSelect.appendChild(noMatchOption);
        } else {
            existingNoMatchOption.textContent = `No students match "${searchTerm}"`;
            existingNoMatchOption.style.display = '';
        }
        } else {
        // Remove any "no matches" option if we have matches
        const noMatchOption = Array.from(studentSelect.options).find(
            opt => opt.classList.contains('no-match-option')
        );
        if (noMatchOption) {
            noMatchOption.style.display = 'none';
        }
    }
}

function updatePaginationInfo(pagination) {
    const paginationInfo = document.querySelector('.pagination-info');
    if (paginationInfo) {
        paginationInfo.textContent = `${pagination.start_idx + 1}-${pagination.end_idx} of ${pagination.total}`;
    }
    
    // Get current status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        // Add visual indicator for the Active filter
        if (statusFilter.value === 'Active') {
            statusFilter.classList.add('showing-all-students');
        } else {
            statusFilter.classList.remove('showing-all-students');
        }
    }
}

// Function to export enrollments to CSV
async function exportEnrollmentsCSV() {
    // Show a loading indicator on the button
    const exportBtn = document.getElementById('exportBtn');
    const originalBtnContent = exportBtn ? exportBtn.innerHTML : '';
    
    try {
        if (exportBtn) {
            exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Exporting...';
            exportBtn.disabled = true;
        }
        
        // Get current filters
        const status = document.getElementById('statusFilter')?.value || '';
        const search = document.getElementById('searchInput')?.value || '';
        
        // Build the URL with query parameters and cache busting
        let url = '/api/enrollments/export-csv';
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (search) params.append('search', search);
        
        // Use cache busting utility
        const finalUrl = utils.withCacheBuster(params.toString() ? `${url}?${params.toString()}` : url);
        
        // Use fetch API to get the CSV data
        const response = await fetch(finalUrl);
        
        if (!response.ok) {
            throw new Error(`Export failed with status: ${response.status}`);
        }
        
        // Get the blob from the response
        const blob = await response.blob();
        
        // Create a download link and trigger it
        const downloadUrl = window.URL.createObjectURL(blob);
        const filename = `enrollment-data-${new Date().toISOString().split('T')[0]}.csv`;
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(link);
        
        // Use the centralized notification system if available
        if (typeof showSuccess === 'function') {
            showSuccess('Enrollment data exported successfully', 'Success');
        }
    } catch (error) {
        // Use the centralized notification system if available
        if (typeof showError === 'function') {
            showError('Failed to export CSV: ' + error.message, 'Error');
        }
    } finally {
        // Restore button state
        if (exportBtn) {
            exportBtn.innerHTML = originalBtnContent || '<i class="bi bi-arrow-up-right me-2"></i>Export CSV';
            exportBtn.disabled = false;
        }
    }
}

// Make functions available globally for HTML onclick attributes if needed
// Synchronize UI filters with URL parameters
function synchronizeUIFilters(urlParams) {
    // Set status filter value from URL
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        const statusValue = urlParams.get('status') || '';
        statusFilter.value = statusValue;
        
        // Add visual indicator for the Active filter
        if (statusValue === 'Active') {
            statusFilter.classList.add('showing-all-students');
        } else {
            statusFilter.classList.remove('showing-all-students');
        }
    }
    
    // Set search input value from URL
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = urlParams.get('search') || '';
    }
    
    // Set rows per page value from URL
    const rowsPerPage = document.getElementById('rowsPerPage');
    if (rowsPerPage) {
        rowsPerPage.value = urlParams.get('per_page') || '5';
    }
}

// Make functions available globally for HTML onclick attributes if needed
window.viewEnrolment = viewEnrolment;
window.editEnrolment = editEnrolment;
window.approveEnrollment = approveEnrollment;
window.unenrollStudent = unenrollStudent;
window.exportEnrollmentsCSV = exportEnrollmentsCSV;