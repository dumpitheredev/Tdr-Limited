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
 * Show a toast notification using the global notification system
 * @param {string} message - The message to display
 * @param {string} type - The toast type (success, error, info, warning)
 */
function showToast(message, type = 'success') {
    try {
        // Always use the global notification system if available
        if (typeof window.getNotificationManager === 'function') {
            const manager = window.getNotificationManager({
                useBootstrapToasts: true
            });
            
            const title = type.charAt(0).toUpperCase() + type.slice(1);
            manager.showBootstrapToast(title, message, {
                type: type
            });
            return;
        }
        
        // Second option: use the global showToast if it's different from this one
        if (typeof window.showToast === 'function') {
            const title = type.charAt(0).toUpperCase() + type.slice(1);
            window.showToast(title, message, type);
            return;
        }
        
        // Last resort: use toast_notification.html component if available
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
        let icon = '<i class="bi bi-info-circle-fill text-info me-2"></i>';
        
        if (type === 'success') {
            title = 'Success';
            icon = '<i class="bi bi-check-circle-fill text-success me-2"></i>';
        } else if (type === 'error' || type === 'danger') {
            title = 'Error';
            icon = '<i class="bi bi-exclamation-circle-fill text-danger me-2"></i>';
        } else if (type === 'warning') {
            title = 'Warning';
            icon = '<i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>';
        }
        
        // Update toast content
        toastTitle.innerHTML = icon + title;
        toastMessage.innerHTML = message;
        
        // Show the toast
        const toast = new bootstrap.Toast(statusToast);
        toast.show();
    } catch (error) {
        console.error('Toast error');
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
 * Initializes the student management page
 */
async function initStudentManagement() {
    try {
        console.log('student management page loaded');
        
        // Clean up any stray modals from previous sessions
        cleanupAllModals();
        
        // Check if the student-modal.js is properly loaded
        if (typeof window.showStudentModalView !== 'function') {
            console.error('Required dependency not loaded');
            showToast('Warning: Student modal functionality may not work correctly. Please refresh the page.', 'warning');
        }
        
        // Ensure toast container exists
        ensureToastContainer();
        
        // Load initial student data
        await loadStudents();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initial render
        updateTable();
        updateCardStatistics();
        
        console.log('student management initialized successfully');
    } catch (error) {
        console.error('Error initializing student management');
        showToast('Failed to initialize student management', 'error');
    }
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
        
        const data = await response.json();
        
        // Make role filter case-insensitive
        state.currentData = Array.isArray(data) 
            ? data.filter(user => {
                // Check if user has role property and it includes 'student' case-insensitive
                const userRole = user.role || '';
                const isStudent = userRole.toLowerCase().includes('student');
                return isStudent;
              }).map(formatStudentData) 
            : [];
        
        state.totalItems = state.currentData.length;
        
        return state.currentData;
    } catch (error) {
        showToast('Failed to load students', 'error');
        return [];
    }
}

/**
 * Formats a student object for display in the UI
 */
function formatStudentData(student) {
    if (!student) return {};
    
    return {
        id: student.id || student.user_id || '',
        user_id: student.id || student.user_id || '',
        name: student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown',
        email: student.email || '',
        status: student.status || (student.is_active ? 'Active' : 'Inactive') || 'Unknown',
        profile_img: student.profile_img || null,
        grade: student.grade || '',
        section: student.section || '',
        created_at: student.created_at || '',
    };
}

/**
 * Formats a student data object for the modal display
 */
function formatStudentForModal(student) {
    if (!student) return {};
    
    const formattedData = formatStudentData(student);
    
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
            updateTable();
        });
    }

    // Pagination buttons
    const prevButton = document.getElementById('prevPage');
    if (prevButton) {
        prevButton.addEventListener('click', function() {
            if (state.page > 1) {
                state.page--;
                updateTable();
            }
        });
    }

    const nextButton = document.getElementById('nextPage');
    if (nextButton) {
        nextButton.addEventListener('click', function() {
            const maxPage = Math.ceil(state.totalItems / state.perPage);
            if (state.page < maxPage) {
                state.page++;
                updateTable();
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
    await loadStudents();
    updateTable();
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
    try {
        // Use current data with filters applied
        const filteredData = filterStudents(state.currentData, status, search);
        
        if (filteredData.length === 0) {
            showToast('No students to export', 'warning');
            return;
        }
        
        // Define CSV headers
        const headers = ['ID', 'Name', 'Role', 'Status', 'Email', 'Phone'];
        
        // Convert data to CSV format
        let csvContent = headers.join(',') + '\n';
        
        filteredData.forEach(student => {
            const row = [
                student.user_id || '',
                student.name || '',
                student.role || '',
                student.status || '',
                student.email || '',
                student.phone || ''
            ].map(cell => `"${String(cell || '').replace(/"/g, '""')}"`); // Escape quotes in CSV
            
            csvContent += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `students_export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success toast
        showToast(`Exported ${filteredData.length} students to CSV`, 'success');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast('Failed to export students to CSV', 'error');
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
function updateTable() {
    try {
        // Apply pagination
        const startIndex = (state.page - 1) * state.perPage;
        const endIndex = Math.min(startIndex + state.perPage, state.totalItems);
        const paginatedData = state.currentData.slice(startIndex, endIndex);

        // Find the table element
        const table = document.getElementById('studentTable');
        if (!table) {
            // Look for any table on the page as fallback
            const tables = document.getElementsByTagName('table');
            if (tables.length === 0) {
                return;
            }
        }

        // Find the tbody element
        const tbody = table ? table.querySelector('tbody') : document.querySelector('tbody');
        if (!tbody) {
            return;
        }
     
        // Update table content based on data
        if (paginatedData.length === 0) {
            tbody.innerHTML = `
                <tr>
                <td colspan="4" class="text-center py-5">
                    <div class="text-muted">
                        <i class="bi bi-inbox fs-2"></i>
                        <p class="mt-2">No students found</p>
                    </div>
                </td>
            </tr>
        `;
        } else {
            // Generate table rows
            tbody.innerHTML = paginatedData.map(student => {
                // Ensure we have a valid student ID, using either id or user_id property
                const studentId = student.user_id || student.id || '';
                
                return `
            <tr data-user-role="${student.role || ''}" data-user-id="${studentId}">
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="/static/images/${student.profile_img || 'profile.png'}" 
                            class="rounded-circle me-3" 
                            width="40" 
                            height="40"
                            alt="${student.name || 'Student'}">
                            <div>
                            <div class="fw-medium">${student.name || 'Unnamed Student'}</div>
                            <div class="text-muted small">${studentId}</div>
                            </div>
                        </div>
                    </td>
                <td class="align-middle">${student.role || 'Student'}</td>
                <td class="align-middle">
                        <span class="badge ${
                            student.status === 'Active' ? 'bg-success-subtle text-success' : 
                            'bg-danger-subtle text-danger'
                        }">
                            ${student.status || 'Unknown'}
                        </span>
                    </td>
                <td class="align-middle text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link p-0" onclick="handleStudentAction('edit', '${studentId}')">
                                <i class="bi bi-pencil" style="color: #191970;"></i>
                            </button>
                        <button class="btn btn-link p-0" onclick="handleStudentAction('view', '${studentId}')">
                                <i class="bi bi-eye" style="color: #191970;"></i>
                            </button>
                        <button class="btn btn-link p-0" onclick="handleStudentAction('archive', '${studentId}')">
                                <i class="bi bi-archive" style="color: #191970;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            }).join('');
        }

        // Update pagination info
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            if (state.totalItems === 0) {
                paginationInfo.textContent = '0 items';
            } else {
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
            nextButton.disabled = endIndex >= state.totalItems;
        }
    } catch (error) {
        // Silent error handling
        console.error('Error updating table:', error);
    }
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
            
            // Call the global student modal function
            if (typeof window.showStudentModalView === 'function') {
                window.showStudentModalView(formattedData);
                modalShown = true;
            } else {
                console.error('Student modal function unavailable');
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
            
            // Call the global student modal function
            if (typeof window.showStudentModalView === 'function') {
                window.showStudentModalView(formattedData);
            } else {
                console.error('Student modal function unavailable');
                if (!modalShown) {
                    showToast('Error: Unable to display student details', 'error');
                }
            }
        } catch (error) {
            console.error('Error fetching student data');
            // Only show error if we didn't already show the modal with cached data
            if (!modalShown) {
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
            showToast('Invalid student ID', 'error');
            return;
        }

        // Disable form while loading data
        const form = document.getElementById('editStudentForm');
        if (form) {
            form.classList.add('loading');
        }
        
        // Get the edit modal element
        const modal = document.getElementById('editStudentModal');
        if (!modal) {
            showToast('Error: Edit modal not found', 'error');
            return;
        }
        
        // Store the student ID on the modal element for later reference
        modal.setAttribute('data-student-id', studentId);
        
        // Flag to track if modal has been shown
        let modalShown = false;
        
        // Get the student from current data first for immediate display
        const cachedStudent = state.currentData.find(student => 
            (student.user_id && student.user_id.toString() === studentId.toString()) || 
            (student.id && student.id.toString() === studentId.toString())
        );
        
        if (cachedStudent) {
            state.currentEditingStudent = formatStudentForModal(cachedStudent);
            populateEditForm(state.currentEditingStudent);
            
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
            const response = await fetch(`/api/users/${studentId}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const apiData = await response.json();
            
            // Format data for modal
            state.currentEditingStudent = formatStudentForModal(apiData);
            
            // Update form with fresh data
            populateEditForm(state.currentEditingStudent);
            
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
            console.error('Error fetching student data');
            // If we already showed modal with cached data, just log the error
            // Otherwise show an error toast
            if (!modalShown) {
                showToast('Error loading student data', 'error');
            } else {
                showToast('Warning: Using cached data. Could not refresh from server.', 'warning');
            }
        }
    } catch (error) {
        console.error('Error in handleEditStudent');
        showToast('Error loading student data for editing', 'error');
    } finally {
        // Re-enable form regardless of outcome
        const form = document.getElementById('editStudentForm');
        if (form) {
            form.classList.remove('loading');
        }
    }
}

/**
 * Populates the edit form with student data
 */
function populateEditForm(studentData) {
    if (!studentData) {
        console.error('Missing student data');
        return;
    }
    
    // Set values in the form based on edit_student_modal.html component
    const nameElement = document.getElementById('editStudentName');
    if (nameElement) {
        const fullName = studentData.name || `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim();
        nameElement.textContent = fullName || 'Unknown Student';
    }
    
    const idElement = document.getElementById('editStudentId');
    if (idElement) {
        const studentId = studentData.user_id || studentData.id || '';
        idElement.textContent = studentId || 'ID not available';
    }
    
    // Set status dropdown
    const statusSelect = document.getElementById('studentStatusSelect');
    if (statusSelect) {
        // Determine status from various possible fields
        let currentStatus = 'Active'; // Default to active
        
        if (studentData.status) {
            currentStatus = studentData.status;
        } else if (studentData.is_active !== undefined) {
            currentStatus = studentData.is_active ? 'Active' : 'Inactive';
        }
        
        // Try to find matching option
        let optionFound = false;
        
        // Look through options and select the matching one
        for (let i = 0; i < statusSelect.options.length; i++) {
            if (statusSelect.options[i].value.toLowerCase() === currentStatus.toLowerCase()) {
                statusSelect.selectedIndex = i;
                optionFound = true;
                break;
            }
        }
        
        // If no match was found, see if we can add a new option
        if (!optionFound) {
            // Create and add a new option
            const newOption = document.createElement('option');
            newOption.value = currentStatus;
            newOption.textContent = currentStatus;
            statusSelect.appendChild(newOption);
            
            // Set it as selected
            statusSelect.value = currentStatus;
        }
    }
    
    // Set student image
    const studentImage = document.getElementById('editStudentImage');
    if (studentImage) {
        // Default image path
        let imagePath = '/static/images/profile.png';
        
        // Use student image if available
        if (studentData.profile_img) {
            if (studentData.profile_img.startsWith('/')) {
                imagePath = studentData.profile_img;
            } else if (studentData.profile_img.startsWith('http')) {
                imagePath = studentData.profile_img;
            } else {
                imagePath = `/static/images/${studentData.profile_img}`;
            }
        }
        
        // Set the image source and alt text
        studentImage.src = imagePath;
        studentImage.alt = studentData.name || 'Student';
        
        // Add error handler to fallback to default if image fails to load
        studentImage.onerror = function() {
            this.src = '/static/images/profile.png';
            this.onerror = null; // Prevent infinite loop
        };
    }
    
    // Show that form is populated and ready
    const form = document.getElementById('editStudentForm');
    if (form) {
        form.classList.remove('loading');
        form.classList.add('populated');
    }
}

/**
 * Handles archiving a student
 */
function handleArchiveStudent(studentId) {
    if (!studentId) {
        showToast('Invalid student ID', 'error');
        return;
    }

    // Find student in current data
    const student = state.currentData.find(student => 
        (student.user_id && student.user_id.toString() === studentId.toString()) || 
        (student.id && student.id.toString() === studentId.toString())
    );
    
    if (!student) {
        showToast('Student not found', 'error');
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
    const idInput = document.getElementById('archiveStudentId');
    if (idInput) {
        idInput.value = studentId;
    }
    
    const nameElement = document.getElementById('archiveStudentName');
    if (nameElement) {
        nameElement.textContent = student.name || 'Unknown Student';
    }
    
    const idDisplay = document.getElementById('archiveStudentIdDisplay');
    if (idDisplay) {
        idDisplay.textContent = studentId;
    }
    
    // Show confirmation modal
    try {
        const confirmModal = new bootstrap.Modal(modal);
        confirmModal.show();
    } catch (error) {
        console.error('Error showing modal');
        showToast('Could not display archive confirmation', 'error');
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
    
    
    // Send the archive request
    fetch(`/api/users/${studentId}/archive`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            reason: archiveReason,
            name: studentName
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
        
        // Show success message with strong styling
        showToast(`Student ${studentName} has been archived successfully`, 'success');
        
        // Try to add link to archives in the toast
        try {
            setTimeout(() => {
                const toastElement = document.querySelector('#toastContainer .toast:last-child .toast-body');
                if (toastElement) {
                    const archiveLink = document.createElement('div');
                    archiveLink.className = 'mt-2';
                    archiveLink.innerHTML = '<a href="/admin/archive-view?type=student" class="btn btn-sm btn-outline-secondary">View in Student Archives</a>';
                    toastElement.appendChild(archiveLink);
                }
            }, 100);
        } catch (error) {
            console.error('Error adding archive link');
        }
        
        // Remove from the table
        removeStudentFromTable(studentId);
        
        // Update statistics
        loadStudents().then(() => {
            updateCardStatistics();
            updateTable();
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
        updateTable();
    }
    
    // Also try to remove the row directly from the DOM for immediate feedback
    try {
        const studentRow = document.querySelector(`tr[data-user-id="${studentId}"]`);
        if (studentRow) {
            studentRow.remove();
        }
    } catch (error) {
        // Silent failure, the updateTable call above will handle it
        console.error('Error removing row from DOM');
    }
}

/**
 * Save student status (called from edit modal)
 */
window.saveStudentStatus = async function() {
    try {
        // Show processing indicator
        const saveButton = document.querySelector('#editStudentModal .btn-primary');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }
        
        // Get the modal element to extract the student ID
        const modal = document.getElementById('editStudentModal');
        if (!modal) {
            showToast('Error: Cannot find edit modal', 'error');
            return;
        }
        
        // Find the student ID - first try data attribute on modal
        let studentId = modal.getAttribute('data-student-id');
        
        // Try from the state
        if (!studentId && state.currentEditingStudent) {
            studentId = state.currentEditingStudent.user_id || state.currentEditingStudent.id;
        }
        
        // Try from the form element
        if (!studentId) {
            const idElement = document.getElementById('editStudentId');
            if (idElement && idElement.textContent) {
                studentId = idElement.textContent.trim();
            }
        }
        
        // Validate the student ID
        if (!studentId) {
            showToast('Cannot update student: ID not found', 'error');
            return;
        }
        
        // Get the new status
        const statusSelect = document.getElementById('studentStatusSelect');
        if (!statusSelect) {
            throw new Error('Status select not found');
        }
        
        const newStatus = statusSelect.value;
        const isActive = newStatus === 'Active';
        
        // Send status update to API
        const response = await fetch(`/api/users/${studentId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                status: newStatus,
                is_active: isActive
            })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `API returned ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Update in local data if student exists in current data
        const studentIndex = state.currentData.findIndex(student => 
            (student.user_id && student.user_id.toString() === studentId.toString()) || 
            (student.id && student.id.toString() === studentId.toString())
        );
        
        if (studentIndex !== -1) {
            state.currentData[studentIndex].status = newStatus;
            state.currentData[studentIndex].is_active = isActive;
        }
        
        // Close modal with proper cleanup
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editStudentModal'));
        if (editModal) {
            editModal.hide();
            // Clean up backdrop and modal state
            setTimeout(() => {
                cleanupModalBackdrop('editStudentModal');
            }, 150);
        }
        
        // Update UI
        updateTable();
        updateCardStatistics();
        
        // Show success message
        showToast(`Student status updated to ${newStatus}`, 'success');
        
        // Return result for testing or chaining
        return result;
    } catch (error) {
        showToast(`Failed to update student status: ${error.message}`, 'error');
    } finally {
        // Re-enable save button
        const saveButton = document.querySelector('#editStudentModal .btn-primary');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = 'Save Changes';
        }
    }
};

/**
 * Ensure modal backdrop is removed
 * This uses the global cleanupModalBackdrop function from student-modal.js if available
 * @param {string} modalId - The ID of the modal element (without #)
 */
function cleanupModalBackdrop(modalId) {
    // Use the global function if it exists (from student-modal.js)
    // But only if it's not this same function to prevent infinite recursion
    if (typeof window.cleanupModalBackdrop === 'function' && 
        window.cleanupModalBackdrop !== cleanupModalBackdrop) {
        window.cleanupModalBackdrop(modalId);
        return;
    }

    // Fallback implementation
    try {
        // Remove any lingering backdrop
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        
        // Ensure body classes are removed
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');
        
        // If modalId is provided, ensure the modal element is properly cleaned up
        if (modalId) {
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                modalElement.classList.remove('show');
                modalElement.style.display = 'none';
                modalElement.setAttribute('aria-hidden', 'true');
                modalElement.removeAttribute('aria-modal');
                modalElement.removeAttribute('role');
            }
        }
    } catch (error) {
        console.error('Error cleaning up modal backdrop');
    }
}

// Make functions globally available
window.handleStudentAction = handleStudentAction;
window.archiveStudent = archiveStudent;

// Only assign our cleanupModalBackdrop to window if there isn't one from student-modal.js
if (typeof window.cleanupModalBackdrop !== 'function') {
    window.cleanupModalBackdrop = cleanupModalBackdrop;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initStudentManagement);