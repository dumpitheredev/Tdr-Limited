/**
 * Student Management Module
 * 
 * This module handles all functionality for the student management page including:
 * - Fetching and displaying students with pagination
 * - Filtering by status and search
 * - Student actions (view, edit, archive)
 * - Managing student statistics
 */

// ------------------- State Management -------------------
let state = {
    // Pagination
    page: 1,
    perPage: 5,
    totalItems: 0,
    
    // Filters
    searchTerm: '',
    statusFilter: '',
    
    // Data
    currentData: [],
    
    // Currently selected student
    currentEditingStudent: null
};

// ------------------- Core Functions -------------------

/**
 * Show a toast notification using Bootstrap 5
 * @param {string} message - The message to display
 * @param {string} type - The toast type (success, error, info, warning)
 */
function showToast(message, type = 'success') {
    try {
        // Handle case where parameters might be in different order (message, type) or (type, message)
        if (arguments.length >= 2 && typeof arguments[1] === 'string' && 
            ['success', 'error', 'info', 'warning', 'danger'].includes(arguments[1].toLowerCase())) {
            // Parameters are in the expected order (message, type)
        } else if (arguments.length >= 2 && typeof arguments[0] === 'string' && 
                  ['success', 'error', 'info', 'warning', 'danger'].includes(arguments[0].toLowerCase())) {
            // Parameters might be in reverse order (type, message)
            const temp = message;
            message = type;
            type = temp;
        }
        
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
        
        // Set the title based on type
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
        
        // Update toast content
        toastTitle.textContent = title;
        toastMessage.innerHTML = message;
        
        // Show the toast using Bootstrap 5
        const toast = new bootstrap.Toast(statusToast);
        toast.show();
    } catch (error) {
        console.error('Toast error:', error);
    }
}

/**
 * Clean up all modals in the document using Bootstrap 5
 */
function cleanupAllModals() {
    try {
        // Get all modal elements
        const modals = document.querySelectorAll('.modal');
        
        // Clean up all modal elements using Bootstrap 5 API
        modals.forEach(modal => {
            if (modal.id) {
                try {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) {
                        bsModal.hide();
                    }
                } catch (err) {
                    // Silent failure
                }
            }
        });
    } catch (error) {
        console.error('Error cleaning up modals:', error);
    }
}

/**
 * Initializes the student management page
 */
async function initStudentManagement() {
    // Already logged in the event listener
    // console.log('Student management page loaded');
    
    // Clean up any stray modals from previous sessions
    cleanupAllModals();
    
    // Check if the student-modal.js is properly loaded
    if (typeof window.showStudentModalView !== 'function') {
        console.warn('Student modal functionality not loaded');
    }
    
    // Ensure toast container exists
    ensureToastContainer();
    
    // Load initial student data
    await loadStudents();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initial UI updates
    updateStudentTable();
    updateCardStatistics();
    
    // console.log('Student management initialized successfully');
    
    return state.currentData;
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
 * Load students from the API with optional filters
 */
async function loadStudents() {
    try {
        // Build query params for filters
        const params = new URLSearchParams();
        if (state.statusFilter) params.append('status', state.statusFilter);
        if (state.searchTerm) params.append('search', state.searchTerm);
        
        const queryString = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`/api/users${queryString}`);
        
        if (!response.ok) throw new Error('Failed to fetch students');
        
        const rawData = await response.json();
        
        // Validate API response - ensure it's an array
        if (!Array.isArray(rawData)) {
            console.error('[loadStudents] API returned invalid data format:', rawData);
            throw new Error('Invalid response format from API');
        }
        
        // Make role filter case-insensitive
        state.currentData = rawData.filter(user => {
            // Check if user and user.role exist before accessing properties
            if (!user || typeof user !== 'object') {
                console.warn('[loadStudents] Skipping invalid user object:', user);
                return false;
            }
            
                const userRole = user.role || '';
                const isStudent = userRole.toLowerCase().includes('student');
                return isStudent;
        }).map(formatStudentData);
        
        state.totalItems = state.currentData.length;
        
        return state.currentData;
    } catch (error) {
        console.error('[loadStudents] Error:', error);
        showToast(`Failed to load students: ${error.message}`, 'error');
        return [];
    }
}

/**
 * Formats a student object for display in the UI
 * This is the core data normalization function used across the student management system
 */
function formatStudentData(student) {
    if (!student) {
        console.warn('Attempted to format undefined or null student data');
        return {};
    }

    // Handle case where student might be nested in a data property
    const studentData = student.data || student;

    // Normalize profile image path
    let profileImg = studentData.profile_img || '/static/images/profile.png';
    if (profileImg && !profileImg.startsWith('/') && !profileImg.startsWith('http')) {
        profileImg = `/static/images/${profileImg}`;
    }

    // Normalize name fields
    let firstName = '';
    let lastName = '';
    let fullName = '';

    if (studentData.name) {
        // If we have a full name, use it and try to split for first/last
        fullName = studentData.name;
        const nameParts = fullName.split(' ');
        if (nameParts.length > 1) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
        } else {
            firstName = fullName;
        }
    } else if (studentData.first_name || studentData.last_name) {
        // If we have separate first/last name fields
        firstName = studentData.first_name || '';
        lastName = studentData.last_name || '';
        fullName = `${firstName} ${lastName}`.trim();
    }

    // Normalize status field
    let isActive = true;
    let status = 'Active';

    if (studentData.status) {
        status = studentData.status;
        isActive = status.toLowerCase() === 'active';
    } else if (studentData.is_active !== undefined) {
        isActive = !!studentData.is_active;
        status = isActive ? 'Active' : 'Inactive';
    }

    // Create a normalized student object with consistent field names
    return {
        ...studentData,
        id: studentData.id || studentData.user_id || '',
        user_id: studentData.user_id || studentData.id || '',
        email: studentData.email || '',
        role: studentData.role || 'Student',
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        is_active: isActive,
        status: status,
        profile_img: profileImg,
        company_data: studentData.company_data || {},
        // Add display-friendly attributes directly in the main formatter
        statusClass: status.toLowerCase() === 'active' ? 'text-success' : 'text-danger',
        joinDate: studentData.created_at ? new Date(studentData.created_at).toLocaleDateString() : 'Unknown'
    };
}

/**
 * Formats a student data object for the modal display
 * @deprecated Use formatStudentData directly as it now includes all modal display attributes
 */
function formatStudentForModal(student) {
    // Simply pass through to the main formatter for backward compatibility
    return formatStudentData(student);
}

/**
 * Setup all event listeners for the page
 */
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            state.searchTerm = this.value;
            state.page = 1;
            handleFiltersChanged();
        });
    }

    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            state.statusFilter = this.value;
            state.page = 1;
            handleFiltersChanged();
        });
    }

    // Rows per page
    const rowsPerPage = document.getElementById('rowsPerPage');
    if (rowsPerPage) {
        rowsPerPage.addEventListener('change', function() {
            state.perPage = parseInt(this.value);
            state.page = 1;
            updateStudentTable();
        });
    }

    // Pagination buttons
    const prevButton = document.getElementById('prevPage');
    if (prevButton) {
        prevButton.addEventListener('click', function() {
            if (state.page > 1) {
                state.page--;
                updateStudentTable();
            }
        });
    }

    const nextButton = document.getElementById('nextPage');
    if (nextButton) {
        nextButton.addEventListener('click', function() {
            const maxPage = Math.ceil(state.totalItems / state.perPage);
            if (state.page < maxPage) {
                state.page++;
                updateStudentTable();
            }
        });
    }
    
    // Set up event listeners for modal hidden events to clean up backdrops
    const editModal = document.getElementById('editStudentModal');
    if (editModal) {
        editModal.addEventListener('hidden.bs.modal', function() {
            setTimeout(() => cleanupModalBackdrop('editStudentModal'), 150);
        });
    }
    
    const archiveModal = document.getElementById('confirmArchiveModal');
    if (archiveModal) {
        archiveModal.addEventListener('hidden.bs.modal', function() {
            setTimeout(() => cleanupModalBackdrop('confirmArchiveModal'), 150);
        });
    }
    
    // Add keydown event to close modals on ESC key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            cleanupModalBackdrop();
        }
    });

    // Set up delegation for student action buttons (edit, view, archive)
    document.addEventListener('click', function(event) {
        // Find the clicked button, if any
        const actionButton = event.target.closest('button[onclick*="handleStudentAction"]');
        if (!actionButton) return;
        
        // Prevent the default onclick behavior
        event.preventDefault();
        
        // Stop propagation to prevent double execution
        event.stopPropagation();
        
        // Extract the action and ID from the onclick attribute
        const onclickAttr = actionButton.getAttribute('onclick') || '';
        const actionMatch = onclickAttr.match(/handleStudentAction\('([^']+)'/);
        const idMatch = onclickAttr.match(/,\s*['"]([^'"]+)['"]/);
        
        if (!actionMatch) return;
        
        const action = actionMatch[1];
        let studentId = null;
        
        // Try to get the ID from multiple sources
        if (idMatch && idMatch[1]) {
            // ID from onclick attribute
            studentId = idMatch[1];
        } else {
            // Try to get from table row
            const row = actionButton.closest('tr[data-user-id]');
            if (row) {
                studentId = row.getAttribute('data-user-id');
            }
        }
        
        // Only proceed if we have both action and ID
        if (action && studentId) {
            // Directly call the appropriate handler to avoid double execution
            switch(action) {
                case 'view':
                    handleViewStudent(studentId);
                    break;
                case 'edit':
                    handleEditStudent(studentId);
                    break;
                case 'archive':
                    handleArchiveStudent(studentId);
                    break;
                default:
                    // Unknown action - silently ignore
                    break;
            }
        }
    });

    // Export button dynamically update href
    updateExportButton();

    // Set up the show/hide of the custom reason field when "other" is selected
    const archiveReasonSelect = document.getElementById('archiveReason');
    const customReasonContainer = document.getElementById('customReasonContainer');
    
    if (archiveReasonSelect && customReasonContainer) {
        archiveReasonSelect.addEventListener('change', function() {
            if (this.value === 'other') {
                customReasonContainer.classList.remove('d-none');
            } else {
                customReasonContainer.classList.add('d-none');
            }
        });
    }
    
    // Add event listener for close buttons in modals to ensure proper cleanup
    document.querySelectorAll('.modal .btn-close, .modal .btn[data-bs-dismiss="modal"]').forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                setTimeout(() => cleanupModalBackdrop(modal.id), 150);
            }
        });
    });
}

/**
 * Handle filters changed - reload data and update UI
 */
async function handleFiltersChanged() {
    console.log('[handleFiltersChanged] Filters changed, reloading data...');
    
    // Reset pagination to first page when filters change
    state.page = 1;
    
    // Store filters in state
    state.statusFilter = document.getElementById('statusFilter')?.value || '';
    state.searchTerm = document.getElementById('searchInput')?.value || '';
    
    // Reload data with new filters
    await loadStudents();
    
    // Update the interface
    updateStudentTable();
    updateCardStatistics();
    updateExportButton();
}

/**
 * Filter students based on criteria
 * @param {Array} students - Array of students to filter
 * @param {string} status - Status filter
 * @param {string} search - Search term
 * @returns {Array} Filtered students array
 */
function filterStudents(students, status, search) {
    // Use current data if no students provided
    const data = students || state.currentData;
    
    // Apply status filter
    let filtered = data;
    if (status) {
        filtered = filtered.filter(student => student.status === status);
    }
    
    // Apply search filter
    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(student => 
            (student.name?.toLowerCase().includes(searchLower) || 
             student.user_id?.toLowerCase().includes(searchLower) ||
             student.email?.toLowerCase().includes(searchLower))
        );
    }
    
    return filtered;
}

/**
 * Export students to CSV based on current filters
 * @param {string} status - Status filter
 * @param {string} search - Search query
 */
function exportStudentsToCSV(status, search) {
    console.log('[exportStudentsToCSV] Generating CSV data');
    
    // Show processing toast
    showToast('Generating CSV export...', 'info');
    
    // Function to convert text to CSV-safe format
    function escapeCSV(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/"/g, '""');
    }
    
    // Define headers for CSV
    const headers = ['ID', 'Name', 'Role', 'Status', 'Email'];
    
    // Get data to export - use filtered data 
    const data = state.currentData.map(student => {
        return [
            escapeCSV(student.id),
            escapeCSV(`${student.first_name} ${student.last_name}`),
            escapeCSV(student.role || 'Student'),
            escapeCSV(student.is_active ? 'Active' : 'Inactive'),
            escapeCSV(student.email),
        ];
    });
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    data.forEach(row => {
            csvContent += row.join(',') + '\n';
        });
        
        // Create download link
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
    
    // Create filename with current date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let filename = `students_export_${today}`;
    
    // Add filter info to filename if any filters are applied
    if (status) filename += `_status-${status}`;
    if (search) filename += `_search-${search}`;
    
    link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
    
    // Trigger download and cleanup
        link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Show success toast with details
        const recordCount = data.length;
        const filterInfo = [];
        if (status) filterInfo.push(`Status: ${status}`);
        if (search) filterInfo.push(`Search: ${search}`);
        
        const filterText = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';
        showToast(`Exported ${recordCount} student records${filterText}`, 'success');
    }, 100);
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
        let exportUrl = '/admin/export-students-to-csv?';
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
            exportStudentsToCSV(status, search);
            return false;
        };
    } catch (error) {
        console.error('Error updating export button:', error);
    }
}

// ------------------- UI Update Functions -------------------

/**
 * Update the student table with current data and filters
 */
function updateStudentTable() {
    // Updating student table
    
    // Get table element
    const tableBody = document.querySelector('#studentTable tbody');
    if (!tableBody) {
        return;
    }
    
    // Remove loading indicator if present
    const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
    }
    
    // Update pagination controls
    updatePaginationControls();
    
    // Calculate slice of data to display
    const startIndex = (state.page - 1) * state.perPage;
    const endIndex = Math.min(startIndex + state.perPage, state.totalItems);
    const displayData = state.currentData.slice(startIndex, endIndex);
    
    // If no data, show message
    if (displayData.length === 0) {
        let emptyMessage = 'No students found';
        
        // Customize message based on filters
        if (state.statusFilter || state.searchTerm) {
            emptyMessage = 'No students match your filters';
            if (state.searchTerm) {
                emptyMessage += ` for "${state.searchTerm}"`;
            }
            if (state.statusFilter) {
                emptyMessage += ` with status "${state.statusFilter}"`;
            }
        }
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <i class="bi bi-search text-muted fs-1 mb-2"></i>
                        <p class="text-muted mb-2">${emptyMessage}</p>
                        ${(state.statusFilter || state.searchTerm) ? 
                            `<button class="btn btn-sm btn-outline-secondary" onclick="resetFilters()">
                                <i class="bi bi-x-circle me-1"></i>Clear Filters
                            </button>` : 
                            ''}
                            </div>
                        </td>
                    </tr>
                `;
        return;
    }
    
    // Build rows for each student
    let tableContent = '';
    for (const student of displayData) {
        tableContent += createStudentRow(student);
    }
    
    // Update table content
    tableBody.innerHTML = tableContent;
    
    // Add event listeners to action buttons
    addTableEventListeners();
}

/**
 * Reset all filters and reload data
 */
function resetFilters() {
    console.log('[resetFilters] Resetting all filters');
    
    // Reset state
    state.page = 1;
    state.statusFilter = '';
    state.searchTerm = '';
    
    // Reset UI
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    
    if (statusFilter) statusFilter.value = '';
    if (searchInput) searchInput.value = '';
    
    // Reload data and update UI
    loadStudents().then(() => {
        updateStudentTable();
        updateCardStatistics();
        updateExportButton();
    });
}

/**
 * Update card statistics based on filtered data
 */
function updateCardStatistics() {
    try {
        // Calculate counts
        const totalStudents = state.currentData.length;
        const activeStudents = state.currentData.filter(student => student.status === 'Active').length;
        const inactiveStudents = state.currentData.filter(student => student.status === 'Inactive').length;

        // Update DOM elements with null checks
        const totalElement = document.querySelector('[data-count="total"]');
        const activeElement = document.querySelector('[data-count="active"]');
        const inactiveElement = document.querySelector('[data-count="inactive"]');
        
        // Check if elements exist
        if (!totalElement || !activeElement || !inactiveElement) {
            return;
        }
        
        // Update elements
        totalElement.textContent = totalStudents;
        activeElement.textContent = activeStudents;
        inactiveElement.textContent = inactiveStudents;
    } catch (error) {
        // Silent error handling
        console.error('Error updating statistics:', error);
    }
}

/**
 * Update pagination controls based on current state
 */
function updatePaginationControls() {
    // Update pagination info
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        if (state.totalItems === 0) {
            paginationInfo.textContent = '0 items';
        } else {
            const startIndex = (state.page - 1) * state.perPage;
            const endIndex = Math.min(startIndex + state.perPage, state.totalItems);
            paginationInfo.textContent = `${startIndex + 1}-${endIndex} of ${state.totalItems}`;
        }
    }

    // Update pagination buttons
    const prevButton = document.getElementById('prevPage');
    if (prevButton) {
        prevButton.disabled = state.page <= 1;
    }

    const nextButton = document.getElementById('nextPage');
    if (nextButton) {
        const startIndex = (state.page - 1) * state.perPage;
        const endIndex = Math.min(startIndex + state.perPage, state.totalItems);
        nextButton.disabled = endIndex >= state.totalItems;
    }
}

// ------------------- Student Action Handlers -------------------

/**
 * Global handler for student actions (view, edit, archive)
 */
window.handleStudentAction = function(action, studentId) {
    // If this function is called from an onclick attribute with pattern onClick="handleStudentAction('action')"
    if (typeof studentId === 'undefined' && typeof event !== 'undefined') {
        // Extract ID from the clicked button or its parent row
        const button = event.target.closest('button');
        if (button) {
            // Get the student ID from button's onclick attribute or its parent row
            const onclickAttr = button.getAttribute('onclick') || '';
            const idMatch = onclickAttr.match(/,\s*['"]([^'"]+)['"]/); // Extract ID from second parameter
            
            if (idMatch && idMatch[1]) {
                studentId = idMatch[1];
            } else {
                // Try to get from the row data attribute
                const row = button.closest('tr[data-user-id]');
                if (row) {
                    studentId = row.getAttribute('data-user-id');
                }
            }
        }
    }
    
    // Validate student ID - make sure it's not the action name
    if (!studentId || studentId === action) {
        showToast('Invalid student ID', 'error');
        return;
    }
    
    // Dispatch to appropriate handler based on action
    switch (action) {
        case 'view':
            handleViewStudent(studentId);
            break;
        case 'edit':
            handleEditStudent(studentId);
            break;
        case 'archive':
            handleArchiveStudent(studentId);
            break;
        default:
            // Unknown action - silently ignore
            break;
    }
};

/**
 * Handles viewing a student - loads data and shows view modal
 */
async function handleViewStudent(studentId) {
    try {
        if (!studentId) {
            showToast('Invalid student ID', 'error');
            return;
        }

        // Try finding student in current data first for immediate display
        const cachedStudent = state.currentData.find(student => 
            (student.user_id && student.user_id.toString() === studentId.toString()) || 
            (student.id && student.id.toString() === studentId.toString())
        );
        
        let modalShown = false;
        
        if (cachedStudent) {
            // Format the student data for the modal
            const formattedData = formatStudentForModal(cachedStudent);
            
            // Call the global student modal function only if we don't plan to show fresh data
            // We'll show the modal with cached data only if the API request fails
            if (typeof window.showStudentModalView !== 'function') {
                console.error('Student modal function unavailable');
            } else {
                // Just set modalShown to true, we'll show the modal with fresh data
                modalShown = true;
            }
        }
        
        // Then fetch fresh data from API
        try {
            const response = await fetch(`/api/users/${studentId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch student details: ${response.status}`);
            }
            
            const studentData = await response.json();
            
            // Format the student data for the modal
            const formattedData = formatStudentForModal(studentData);
            
            // Call the global student modal function with fresh data
            if (typeof window.showStudentModalView === 'function') {
                window.showStudentModalView(formattedData);
                modalShown = true;
            } else {
                console.error('Student modal function unavailable');
                showToast('Error: Unable to display student details', 'error');
            }
        } catch (error) {
            console.error('Error fetching student data');
            
            // If we haven't shown the modal yet, show it with cached data as fallback
            if (!modalShown && typeof window.showStudentModalView === 'function' && cachedStudent) {
                const fallbackData = formatStudentForModal(cachedStudent);
                window.showStudentModalView(fallbackData);
                showToast('Using cached student data. Some information may be outdated.', 'warning');
            } else if (!modalShown) {
                showToast('Error: Unable to display student details', 'error');
            }
        }
    } catch (error) {
        console.error('Error in handleViewStudent');
        showToast('Error loading student data', 'error');
    }
}

/**
 * Handles editing a student - loads data and shows edit modal
 */
async function handleEditStudent(studentId) {
    try {
        if (!studentId) {
            showToast('Invalid student ID. Please try again.', 'error');
            return;
        }
        
        // Get and prepare the modal
        const modal = document.getElementById('editStudentModal');
        if (!modal) {
            showToast('Error: Edit modal not found', 'error');
            return;
        }
        
        // Store the student ID on the modal for later reference
        modal.setAttribute('data-student-id', studentId);
        
        // Prepare the form
        const form = document.getElementById('editStudentForm');
        if (form) {
            form.classList.add('loading');
            form.classList.remove('populated');
        }
        
        // Get student data (try API first, then cache)
        let studentData = await getStudentData(studentId);
        
        // If we have student data, populate the form and show the modal
        if (studentData) {
            // Set as current editing student
            state.currentEditingStudent = studentData;
            
            // Populate the form with the student data
            populateEditForm(studentData);
            
            // Show the modal
            showModal(modal);
        } else {
            showToast('Error: Student data not found', 'error');
        }
    } catch (error) {
        console.error('Error in handleEditStudent:', error);
        showToast(`Error loading student data: ${error.message}`, 'error');
    } finally {
        // Re-enable form regardless of outcome
        const form = document.getElementById('editStudentForm');
        if (form) {
            form.classList.remove('loading');
        }
    }
}

/**
 * Get student data from API or cache
 * @param {string} studentId - The ID of the student to get
 * @returns {Object|null} - The student data or null if not found
 */
async function getStudentData(studentId) {
    try {
        // Try API first
        console.log(`Fetching student data for ID: ${studentId}`);
        const response = await fetch(`/api/users/${studentId}`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const apiData = await response.json();
        console.log('API returned student data:', apiData);
        
        // Format and return the data
        return formatStudentData(apiData);
    } catch (apiError) {
        console.warn('Error fetching student data from API:', apiError);
        
        // Fall back to cached data
        const cachedStudent = state.currentData.find(student => 
            (student.user_id && student.user_id.toString() === studentId.toString()) || 
            (student.id && student.id.toString() === studentId.toString())
        );
        
        if (cachedStudent) {
            console.log('Using cached student data:', cachedStudent);
            showToast('Using cached data. Could not refresh from server.', 'warning');
            return formatStudentData(cachedStudent);
        }
        
        // No data found
        return null;
    }
}

/**
 * Show a modal using Bootstrap 5
 * @param {HTMLElement} modal - The modal element to show
 * @returns {boolean} - Whether the modal was successfully shown
 */
function showModal(modal) {
    if (!modal) return false;
    
    try {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        return true;
    } catch (error) {
        console.error('Error showing modal:', error);
        showToast('Error: Unable to show modal', 'error');
        return false;
    }
}

/**
 * Populates the edit form with student data
 * @param {Object} studentData - Normalized student data object
 */
function populateEditForm(studentData) {
    if (!studentData) {
        console.error('Missing student data');
        return;
    }
    
    // Get all form elements at once to reduce DOM queries
    const elements = {
        name: document.getElementById('editStudentName'),
        id: document.getElementById('editStudentId'),
        status: document.getElementById('studentStatusSelect'),
        image: document.getElementById('editStudentImage'),
        form: document.getElementById('editStudentForm')
    };
    
    // Set student name
    if (elements.name) {
        elements.name.textContent = studentData.name || 'Unknown Student';
    }
    
    // Set student ID
    if (elements.id) {
        elements.id.textContent = studentData.user_id || 'ID not available';
    }
    
    // Set status dropdown
    if (elements.status) {
        populateStatusDropdown(elements.status, studentData.status || 'Active');
    }
    
    // Set student image
    if (elements.image) {
        elements.image.src = studentData.profile_img || '/static/images/profile.png';
        elements.image.alt = studentData.name || 'Student';
        
        // Add error handler for image loading failures
        elements.image.onerror = function() {
            this.src = '/static/images/profile.png';
            this.onerror = null; // Prevent infinite loop
        };
    }
    
    // Update form state
    if (elements.form) {
        elements.form.classList.remove('loading');
        elements.form.classList.add('populated');
    }
}

/**
 * Populates a status dropdown with the appropriate options and selects the current value
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {string} currentStatus - The current status value to select
 */
function populateStatusDropdown(selectElement, currentStatus) {
    if (!selectElement) return;
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Define standard statuses
    const statuses = ['Active', 'Inactive'];
    
    // Add standard options
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        selectElement.appendChild(option);
    });
    
    // Add custom status if needed
    if (currentStatus && !statuses.includes(currentStatus)) {
        const customOption = document.createElement('option');
        customOption.value = currentStatus;
        customOption.textContent = currentStatus;
        selectElement.appendChild(customOption);
    }
    
    // Set the current value
    selectElement.value = currentStatus;
    
    // If the value wasn't set correctly, use case-insensitive matching as fallback
    if (selectElement.value !== currentStatus) {
        for (let i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].value.toLowerCase() === currentStatus.toLowerCase()) {
                selectElement.selectedIndex = i;
                break;
            }
        }
    }
}

/**
 * Handles archiving a student
 */
function handleArchiveStudent(studentId) {
    try {
    if (!studentId) {
            const error = new Error('Invalid student ID');
            console.error('[handleArchiveStudent] Error:', error);
            showToast('Cannot archive student: Invalid ID', 'error');
        return;
    }

        // Find student in state data
        const student = state.currentData.find(s => s.id === studentId);
    if (!student) {
            const error = new Error(`Student with ID ${studentId} not found in current data`);
            console.error('[handleArchiveStudent] Error:', error);
            showToast('Cannot archive student: Student not found', 'error');
        return;
    }
    
        // Set the archive UI fields
        document.getElementById('archiveStudentId').value = studentId;
        document.getElementById('archiveStudentName').textContent = `${student.first_name} ${student.last_name}`;
        document.getElementById('archiveStudentIdDisplay').textContent = studentId;
        
        // Reset the reason dropdown and custom field
        const reasonSelect = document.getElementById('archiveReason');
        if (reasonSelect) reasonSelect.value = '';
        
        const customReasonContainer = document.getElementById('customReasonContainer');
        if (customReasonContainer) customReasonContainer.classList.add('d-none');
        
        const customReason = document.getElementById('customReason');
        if (customReason) customReason.value = '';
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('confirmArchiveModal'));
        modal.show();
    } catch (error) {
        console.error('[handleArchiveStudent] Error:', error);
        showToast(`Error preparing archive operation: ${error.message}`, 'error');
    }
}

/**
 * Archives a student (called from confirmation modal)
 */
function archiveStudent() {
    // Get the student ID from the modal
    const studentId = document.getElementById('archiveStudentId').value;
    const studentName = document.getElementById('archiveStudentName').textContent;
    
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
    
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    if (!csrfToken) {
        console.warn('CSRF token not found. Archive request may fail.');
        showToast('Warning: CSRF token not found. Please refresh the page and try again.', 'warning');
    }
    
    // Send the archive request
    fetch(`/api/users/${studentId}/archive`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken || ''
        },
        credentials: 'same-origin', // Include cookies for authentication
        body: JSON.stringify({
            reason: archiveReason,
            name: studentName,
            // Add explicit archived flag for clarity
            archived: true,
            status: 'Archived',
            is_archived: true
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || 'Failed to archive student');
            });
        }
        return response.json();
    })
    .then(data => {
        // Hide the modal - with proper cleanup
        const modal = bootstrap.Modal.getInstance(document.getElementById('confirmArchiveModal'));
        if (modal) {
            modal.hide();
            // Clean up backdrop and modal state
            setTimeout(() => {
                cleanupModalBackdrop('confirmArchiveModal');
            }, 150);
        }
        
        // Create a custom success message with archive link
        const successMessage = `
            <div>Student ${studentName} has been archived successfully</div>
            <div class="mt-2">
                <a href="/admin/archive-view?type=student" class="btn btn-sm btn-outline-primary" 
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
            showToast(`Student ${studentName} has been archived successfully`, 'success');
        }
        
        // Remove from the table
        removeStudentFromTable(studentId);
        
        // Update statistics
        loadStudents().then(() => {
            updateCardStatistics();
            updateStudentTable();
        });
    })
    .catch(error => {
        console.error('Error archiving student');
        showToast(`Failed to archive student: ${error.message}`, 'error');
    })
    .finally(() => {
        // Re-enable archive button
        if (archiveBtn) {
            archiveBtn.disabled = false;
            archiveBtn.innerHTML = 'Archive Student';
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

/**
 * Remove a student from the table after archiving
 */
function removeStudentFromTable(studentId) {
    if (!studentId) return;
    
    // Find the student in the current data and remove it
    const studentIndex = state.currentData.findIndex(student => 
        (student.user_id && student.user_id.toString() === studentId.toString()) || 
        (student.id && student.id.toString() === studentId.toString())
    );
    
    if (studentIndex !== -1) {
        state.currentData.splice(studentIndex, 1);
        state.totalItems--;
        
        // Update the table to reflect the change
        updateStudentTable();
    }
    
    // Also try to remove the row directly from the DOM for immediate feedback
    try {
        const studentRow = document.querySelector(`tr[data-user-id="${studentId}"]`);
        if (studentRow) {
            studentRow.remove();
        }
    } catch (error) {
        // Silent failure, the updateStudentTable call above will handle it
        console.error('Error removing row from DOM');
    }
}

/**
 * Save student status (called from edit modal)
 */
window.saveStudentStatus = async function() {
    // Get UI elements
    const elements = {
        saveButton: document.querySelector('#editStudentModal .btn-primary'),
        modal: document.getElementById('editStudentModal'),
        statusSelect: document.getElementById('studentStatusSelect')
    };
    
    try {
        // Show processing indicator
        if (elements.saveButton) {
            elements.saveButton.disabled = true;
            elements.saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }
        
        // Validate required elements
        if (!elements.modal) throw new Error('Modal element not found');
        if (!elements.statusSelect) throw new Error('Status select element not found');
        
        // Get and validate student ID and status
        const studentId = elements.modal.getAttribute('data-student-id');
        if (!studentId) throw new Error('Student ID not found');
        
        const newStatus = elements.statusSelect.value;
        if (!newStatus) throw new Error('No status selected');
        
        console.log(`Updating student ${studentId} status to ${newStatus}`);
        
        // Get CSRF token
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!csrfToken) console.warn('CSRF token not found, request may fail');
        
        // Make the API request
        const result = await updateStudentStatus(studentId, newStatus, csrfToken);
        
        // Update local data
        updateLocalStudentData(studentId, newStatus);
        
        // Close the modal
        hideModal(elements.modal);
        
        // Update UI
        updateStudentTable();
        updateCardStatistics();
        
        // Show success message
        showToast('Student status updated successfully', 'success');
        
        return result;
    } catch (error) {
        console.error('Error saving student status:', error);
        showToast(`Failed to update student status: ${error.message}`, 'error');
        return null;
    } finally {
        // Re-enable save button
        if (elements.saveButton) {
            elements.saveButton.disabled = false;
            elements.saveButton.innerHTML = 'Save Changes';
        }
    }
};

/**
 * Update student status via API
 * @param {string} studentId - The ID of the student to update
 * @param {string} newStatus - The new status to set (Active/Inactive)
 * @param {string} csrfToken - CSRF token for security
 * @returns {Object} - The API response
 */
async function updateStudentStatus(studentId, newStatus, csrfToken) {
    try {
        // Show processing toast
        showToast('Updating student status...', 'info');
        
        // Convert status string to boolean is_active value
        const isActive = newStatus.toLowerCase() === 'active';
        
        // Prepare the request with the correct payload format
        const requestOptions = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || ''
            },
            body: JSON.stringify({ 
                is_active: isActive,
                status: newStatus // Include for backward compatibility
            }),
            credentials: 'same-origin'
        };
        
        // Log the request for debugging
        console.log(`Sending ${requestOptions.method} request to /api/users/${studentId}/status with payload:`, 
            JSON.parse(requestOptions.body));
        
        // Make the API request
        const response = await fetch(`/api/users/${studentId}/status`, requestOptions);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Status update failed with status ${response.status}:`, errorText);
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error in updateStudentStatus:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Update student status in local data
 * @param {string} studentId - The ID of the student to update
 * @param {string} newStatus - The new status to set
 */
function updateLocalStudentData(studentId, newStatus) {
    const studentIndex = state.currentData.findIndex(student => 
        (student.user_id && student.user_id.toString() === studentId.toString()) || 
        (student.id && student.id.toString() === studentId.toString())
    );
    
    if (studentIndex !== -1) {
        // Update the status in the current data
        state.currentData[studentIndex].status = newStatus;
        state.currentData[studentIndex].is_active = newStatus.toLowerCase() === 'active';
    }
}

/**
 * Hide a modal using Bootstrap 5
 * @param {HTMLElement} modal - The modal element to hide
 */
function hideModal(modal) {
    if (!modal) return;
    
    try {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
            bsModal.hide();
        }
    } catch (error) {
        console.error('Error hiding modal:', error);
    }
}

/**
 * Ensure modal backdrop is removed
 * @param {string} modalId - The ID of the modal element (without #)
 */
function cleanupModalBackdrop(modalId) {
    try {
        if (modalId) {
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                const bsModal = bootstrap.Modal.getInstance(modalElement);
                if (bsModal) {
                    bsModal.hide();
                }
            }
        }
    } catch (error) {
        console.error('Error cleaning up modal backdrop:', error);
    }
}

// Make functions globally available
window.handleStudentAction = handleStudentAction;
window.archiveStudent = archiveStudent;

// Always use our cleanupModalBackdrop function
window.cleanupModalBackdrop = cleanupModalBackdrop;

// Initialize on page load only if not already initialized
document.addEventListener('DOMContentLoaded', function() {
    // Check if already initialized
    if (!document.body.getAttribute('data-student-management-initialized')) {
        console.log('Student management page loaded');
        initStudentManagement();
        document.body.setAttribute('data-student-management-initialized', 'true');
    }
});

/**
 * Create a table row for a student
 * @param {Object} student - Student data object
 * @returns {string} HTML for the table row
 */
function createStudentRow(student) {
    const studentId = student.id || '';
    
    // Ensure profile image path is absolute
    let profileImg = student.profile_img || '/static/images/profile.png';
    // If the path doesn't start with a slash or http, make it absolute
    if (profileImg && !profileImg.startsWith('/') && !profileImg.startsWith('http')) {
        profileImg = `/static/images/${profileImg}`;
    }
    
    const firstName = student.first_name || '';
    const lastName = student.last_name || '';
    const studentName = `${firstName} ${lastName}`.trim() || 'Unnamed Student';
    const studentRole = student.role || 'Student';
    const isActive = student.is_active ?? true;
    const studentStatus = isActive ? 'Active' : 'Inactive';
    const statusClass = isActive ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';

    return `
        <tr data-user-role="${studentRole}" data-user-id="${studentId}">
            <td>
                <div class="d-flex align-items-center">
                    <img src="${profileImg}" 
                    class="rounded-circle me-3" 
                    width="40" 
                    height="40"
                    alt="${studentName}"
                    onerror="this.src='/static/images/profile.png'">
                    <div>
                        <div class="fw-medium">${studentName}</div>
                        <div class="text-muted small">${studentId}</div>
                    </div>
                </div>
            </td>
            <td class="align-middle">${studentRole}</td>
            <td class="align-middle">
                <span class="badge ${statusClass}">
                    ${studentStatus}
                </span>
            </td>
            <td class="align-middle text-end">
                <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-link p-0" onclick="handleEditStudent('${studentId}')">
                        <i class="bi bi-pencil" style="color: #191970;"></i>
                    </button>
                    <button class="btn btn-link p-0" onclick="handleViewStudent('${studentId}')">
                        <i class="bi bi-eye" style="color: #191970;"></i>
                    </button>
                    <button class="btn btn-link p-0" onclick="handleArchiveStudent('${studentId}')">
                        <i class="bi bi-archive" style="color: #191970;"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Adds event listeners to the student table
 */
function addTableEventListeners() {
    // Find all action buttons and add event listeners
    const studentTable = document.getElementById('studentTable');
    if (!studentTable) return;
    
    // Table event listeners initialized
}