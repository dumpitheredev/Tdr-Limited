// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Enrollment Management Page Loaded');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data via AJAX to ensure consistency
    loadInitialData();
    
    // Set up global modal handlers for better accessibility
    setupGlobalModalHandlers();
    
    // Run emergency cleanup to ensure no orphaned inert attributes
    cleanupInertAttributes();
    
    // Also add event listener to the Enroll Students button inside the modal
    const modalEnrollBtn = document.querySelector('#addEnrolmentModal .btn-primary') || 
                          document.querySelector('#addEnrolmentModal button[type="submit"]');
    
    if (modalEnrollBtn) {
        modalEnrollBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent form submission
            handleEnrolment();
        });
        console.log('Added event listener to modal Enroll Students button');
    }
});

// Set up all event listeners
function setupEventListeners() {
    // Status filter change
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            applyFilters();
        });
    }
    
    // Search input - add debouncing for real-time search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Keep the Enter key functionality
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
        
        // Add debounced input event for real-time search as user types
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                applyFilters();
            }, 500); // 500ms delay to avoid excessive API calls
        });
    }
    
    // Search button
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            applyFilters();
        });
    }
    
    // Rows per page
    const rowsPerPage = document.getElementById('rowsPerPage');
    if (rowsPerPage) {
        rowsPerPage.addEventListener('change', function() {
            applyFilters();
        });
    }
    
    // Pagination prev/next
    const prevPageBtn = document.getElementById('prevPage');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            navigatePage('prev');
        });
    }
    
    const nextPageBtn = document.getElementById('nextPage');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            navigatePage('next');
        });
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
    
    // Load data when enrollment modal is shown
    const enrollmentModal = document.getElementById('addEnrolmentModal');
    if (enrollmentModal) {
        enrollmentModal.addEventListener('show.bs.modal', function() {
        loadUnenrolledStudents();
        loadClasses();
            
            // Set today's date as default for start date
            const startDateField = document.getElementById('startDate');
            if (startDateField) {
                const today = new Date();
                const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                startDateField.value = formattedDate;
            }
        });
    }
    
    // Student search in modal
    const studentSearchInput = document.getElementById('studentSearchInput');
    if (studentSearchInput) {
        studentSearchInput.addEventListener('input', filterStudents);
    }
    
    // Add manual hotkey for emergency cleanup (Alt+R)
    document.addEventListener('keydown', function(event) {
        if (event.altKey && event.key === 'r') {
            cleanupInertAttributes();
            showToast("Page reset complete - UI should be clickable now", "info");
        }
    });
}

// Load initial data
function loadInitialData() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = new URLSearchParams();
    
    // Get current filters from URL or use defaults
    params.set('status', urlParams.get('status') || '');
    params.set('search', urlParams.get('search') || '');
    params.set('per_page', urlParams.get('per_page') || '5');
    params.set('page', urlParams.get('page') || '1');
    
    // Always add cache buster
    params.set('_', Date.now());
    
    // Load data via AJAX
    fetchFilteredData(params);
}

// Apply filters and fetch data
function applyFilters(page = null) {
    // Get current filter values
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchInput').value.trim();
    const perPage = document.getElementById('rowsPerPage').value;
    
    // Get current page from URL or use provided page
    const urlParams = new URLSearchParams(window.location.search);
    const currentPage = page || urlParams.get('page') || 1;
    
    // Build query params
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    params.set('per_page', perPage);
    params.set('page', currentPage);
    
    // Add cache buster
    params.set('_', Date.now());
    
    // Fetch data with new filters
    fetchFilteredData(params);
    
    // Update URL for bookmarking
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
}

// Fetch data from server
async function fetchFilteredData(params) {
    try {
        // Show loading indicator
        const tableBody = document.getElementById('enrolmentTableBody');
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        
        // Fetch data with strong cache-busting
        const response = await fetch(`/admin/enrollment-management/data?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'If-Modified-Since': '0'
            },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update UI with new data
        updateTable(data.enrollments);
        updatePagination(data.pagination);
        
        // Notify other components that data has been loaded
        document.dispatchEvent(new CustomEvent('enrollmentDataLoaded', { 
            detail: data 
        }));
    } catch (error) {
        showToast('Error loading enrollment data', 'error');
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

// Update pagination controls
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
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) {
        paginationInfo.textContent = `${pagination.start_idx + 1}-${pagination.end_idx} of ${pagination.total}`;
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

// Show toast notification
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error('Toast container not found');
        return;
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Set toast content
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Initialize and show toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}

// Set up global modal handlers for better reliability
function setupGlobalModalHandlers() {
    // Listen for all modal show events 
    document.addEventListener('show.bs.modal', function(event) {
        // Get the modal that's about to be shown
        const modal = event.target;
        
        // Ensure the modal has our cleanup mechanism attached
        if (!modal.dataset.cleanupAttached) {
            modal.addEventListener('hidden.bs.modal', function() {
                cleanupInertAttributes();
                setTimeout(() => document.body.focus(), 50);
            });
            
            // Mark this modal as having our cleanup attached
            modal.dataset.cleanupAttached = 'true';
        }
        
        // Use inert instead of aria-hidden
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal', 'true');
    });
    
    // Global handler for any modal being hidden (as a safety net)
    document.addEventListener('hidden.bs.modal', function(event) {
        // Use setTimeout to ensure this runs after modal-specific handlers
        setTimeout(() => {
            cleanupInertAttributes();
            document.body.focus();
        }, 100);
    });
    
    // When escape key is pressed, clean up any orphaned inert attributes
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            // Give time for Bootstrap to close the modal
            setTimeout(() => {
                const modalBackdrops = document.querySelectorAll('.modal-backdrop');
                if (modalBackdrops.length === 0) {
                    cleanupInertAttributes();
                }
            }, 300);
        }
    });
    
    // Safety check that runs periodically to ensure UI stays interactive
    setInterval(function() {
        // Check if there are no visible modals but inert attributes remain
        const visibleModals = document.querySelectorAll('.modal.show');
        const inertElements = document.querySelectorAll('[inert],[data-inert-by-modal]');
        
        if (visibleModals.length === 0 && inertElements.length > 0) {
            cleanupInertAttributes();
        }
    }, 2000); // Check every 2 seconds
}

// Global function to ensure all inert attributes are cleaned up
function cleanupInertAttributes() {
    // Emergency cleanup - traverse the entire DOM
    document.querySelectorAll('*').forEach(el => {
        // Remove inert attribute
        if (el.hasAttribute('inert')) {
            el.removeAttribute('inert');
        }
        
        // Remove our custom tracking attribute
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
            
            // Ensure any buttons inside the modal don't have focus if the modal is closing
            if (document.activeElement && modal.contains(document.activeElement)) {
                document.body.focus();
            }
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
    
    // Remove any orphaned backdrops
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

// Load unenrolled students for the form
async function loadUnenrolledStudents() {
    try {
        const response = await fetch('/api/students/unenrolled');
        if (!response.ok) throw new Error('Failed to fetch students');
        const data = await response.json();

        const studentSelect = document.getElementById('studentSelect');
        if (!studentSelect) {
            return;
        }
        
        studentSelect.innerHTML = '';
        
        // Check various possible response formats
        let students = data.students || data || [];
        
        // Filter to only include actual students based on role - case insensitive
        students = students.filter(student => {
            const role = (student.role || '').toLowerCase();
            return role === 'student';
        });
        
        // Store students list for filtering
        window.allStudents = students;
        
        if (students.length === 0) {
            // Add a disabled option to show no students available
            const option = document.createElement('option');
            option.disabled = true;
            option.textContent = 'No students available';
            studentSelect.appendChild(option);
            return;
        }
        
        // Clear any previous search
        const searchInput = document.getElementById('studentSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        students.forEach((student) => {
            const option = document.createElement('option');
            option.value = student.id || student.user_id;
            // Handle different name formats
            const name = student.name || 
                         (student.first_name && student.last_name ? 
                          `${student.first_name} ${student.last_name}` : 
                          'Unknown');
            const id = student.id || student.user_id || '';
            option.textContent = `${name} (${id})`;
            studentSelect.appendChild(option);
        });
        
        // No Select2 initialization - use standard select
    } catch (error) {
        showToast('Error loading students: ' + error.message, 'error');
        
        // Add an error option
        const studentSelect = document.getElementById('studentSelect');
        if (studentSelect) {
            studentSelect.innerHTML = '';
                const option = document.createElement('option');
            option.disabled = true;
            option.textContent = 'Error loading students';
            studentSelect.appendChild(option);
        }
    }
}

// Load classes
async function loadClasses() {
    try {
        const response = await fetch('/api/classes');
        if (!response.ok) throw new Error('Failed to fetch classes');
        const classes = await response.json();

        const classCheckboxes = document.getElementById('classCheckboxes');
        if (!classCheckboxes) {
            return;
        }
        
        classCheckboxes.innerHTML = '';
        
        if (classes.length === 0) {
            classCheckboxes.innerHTML = '<div class="alert alert-info">No classes available</div>';
            return;
        }
        
        classes.forEach((cls) => {
            const classId = cls.class_id;
            
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
            label.innerHTML = `
                ${cls.name} (${cls.day}, ${cls.time})
                <div class="text-muted small">Instructor: ${cls.instructor}</div>
            `;
            
            div.appendChild(input);
            div.appendChild(label);
            classCheckboxes.appendChild(div);
        });
    } catch (error) {
        showToast('Error loading classes', 'error');
        
        const classCheckboxes = document.getElementById('classCheckboxes');
        if (classCheckboxes) {
            classCheckboxes.innerHTML = '<div class="alert alert-danger">Error loading classes</div>';
        }
    }
}

// Handle enrollment submission
async function handleEnrolment() {
    const studentSelect = document.getElementById('studentSelect');
    if (!studentSelect) {
        showToast('Error: Could not find student select element', 'error');
        return;
    }
    
    const selectedStudents = Array.from(studentSelect.selectedOptions).map(opt => opt.value);
    
    // Validate student selection
    if (selectedStudents.length === 0) {
        showToast('Please select at least one student', 'error');
        return;
    }
    
    // Validate class selection
    const classCheckboxes = document.querySelectorAll('#classCheckboxes input:checked');
    if (!classCheckboxes.length) {
        showToast('Please select at least one class', 'error');
        return;
    }
    
    const selectedClasses = Array.from(classCheckboxes).map(cb => cb.value);
                      
    if (selectedClasses.length === 0) {
        showToast('Please select at least one class', 'error');
        return;
    }

    const statusElement = document.getElementById('enrollmentStatus');
    const startDateElement = document.getElementById('startDate');

    // Prepare form data for submission
    const formData = {
        student_ids: selectedStudents,
        class_ids: selectedClasses,
        status: statusElement ? statusElement.value : 'Pending',
        start_date: startDateElement ? startDateElement.value : new Date().toISOString().split('T')[0]
    };
    
    // Show loading indicator
    showToast('Processing enrollments...', 'info');

    try {
        // Submit enrollment data to API
        const response = await fetch('/api/enrollments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(formData)
        });

        // Process API response
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Handle success case
            const createdCount = result.count || 0;
            const skippedCount = result.skipped || 0;
            
            let message = '';
            if (createdCount > 0) {
                message = `Successfully created ${createdCount} enrollment(s)`;
                if (skippedCount > 0) {
                    message += `, skipped ${skippedCount} duplicate(s)`;
                }
            } else if (skippedCount > 0) {
                message = `No new enrollments created - ${skippedCount} enrollment(s) already exist`;
                showToast(message, 'warning');
                return; // Don't close modal or reload
            }
            
            // Show success message and close modal
            showToast(message, 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('addEnrolmentModal'));
            if (modal) {
            modal.hide();
            }
            
            // Refresh data after a small delay
            setTimeout(() => {
                applyFilters();
            }, 500);
        } else {
            throw new Error(result.message || result.error || 'Failed to create enrollment');
        }
    } catch (error) {
        showToast('Error creating enrollment: ' + error.message, 'error');
    }
}

// View enrollment details
async function viewEnrolment(studentId) {
    try {
        // Clear any cached enrollment data 
        
        // Add a cache-busting parameter to ensure fresh data
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/students/${studentId}/enrollment?_=${timestamp}`);
        if (!response.ok) throw new Error('Failed to fetch enrollment details');
        
        const data = await response.json();
        
        // Check for required elements and set their content safely
        const studentIdElement = document.getElementById('studentId');
        if (studentIdElement) studentIdElement.textContent = data.student.user_id;
        
        const studentNameElement = document.getElementById('studentName');
        if (studentNameElement) studentNameElement.textContent = data.student.name;
        
        const studentCompanyElement = document.getElementById('studentCompany');
        if (studentCompanyElement) studentCompanyElement.textContent = data.company.name || 'Not Assigned';
        
        const studentCompanyIdElement = document.getElementById('studentCompanyId');
        if (studentCompanyIdElement) studentCompanyIdElement.textContent = data.company.company_id || 'N/A';
        
        const studentStatusElement = document.getElementById('studentStatus');
        if (studentStatusElement) {
            studentStatusElement.textContent = data.student.status;
            // Update student status badge
            if (data.student.status === 'Active') {
                studentStatusElement.className = 'badge bg-success-subtle text-success';
            } else {
                studentStatusElement.className = 'badge bg-danger-subtle text-danger';
            }
        }
        
        // Fix the profile image path
        const studentImageElement = document.getElementById('studentImage');
        if (studentImageElement) {
            const profileImg = data.student.profile_img || 'profile.png';
            studentImageElement.src = profileImg.startsWith('/static/') 
                ? profileImg 
                : `/static/images/${profileImg}`;
        }
        
        // Populate enrolled classes with real data
        const enrolledClassesDiv = document.getElementById('enrolledClasses');
        if (enrolledClassesDiv) {
            enrolledClassesDiv.innerHTML = '';
            
            if (data.classes && data.classes.length > 0) {
                // Sort classes - active enrollments first, then by name
                const sortedClasses = [...data.classes].sort((a, b) => {
                    // First sort by active status (active first)
                    if (a.is_active && !b.is_active) return -1;
                    if (!a.is_active && b.is_active) return 1;
                    // Then sort by name
                    return a.name.localeCompare(b.name);
                });
                
                // Group classes into Active and Historical
                let hasActiveClasses = false;
                let hasHistoricalClasses = false;
                
                // First, check if we have active and/or historical classes
                sortedClasses.forEach(cls => {
                    if (cls.is_active) {
                        hasActiveClasses = true;
                    } else {
                        hasHistoricalClasses = true;
                    }
                });
                
                // Add sections with headers if needed
                if (hasActiveClasses) {
                    // Add active classes section
                    const activeHeader = document.createElement('h6');
                    activeHeader.className = 'mb-2 mt-3';
                    activeHeader.textContent = 'Active Enrollments';
                    enrolledClassesDiv.appendChild(activeHeader);
                    
                    sortedClasses.filter(cls => cls.is_active).forEach(cls => {
                        appendClassCard(enrolledClassesDiv, cls);
                    });
                }
                
                if (hasHistoricalClasses) {
                    // Add historical classes section
                    const historyHeader = document.createElement('h6');
                    historyHeader.className = 'mb-2 mt-4';
                    historyHeader.textContent = 'Past Enrollments';
                    enrolledClassesDiv.appendChild(historyHeader);
                    
                    sortedClasses.filter(cls => !cls.is_active).forEach(cls => {
                        appendClassCard(enrolledClassesDiv, cls);
                    });
                }
            } else {
                enrolledClassesDiv.innerHTML = '<p class="text-muted">No classes enrolled</p>';
            }
        }
        
        // Create the edit button and add it to the modal footer instead of the class container
        const viewModalFooter = document.querySelector('#viewEnrollmentModal .modal-footer');
        if (viewModalFooter) {
            // Clear existing footer content
            viewModalFooter.innerHTML = '';
            
            // Set footer style to flex with space-between
            viewModalFooter.style.display = 'flex';
            viewModalFooter.style.justifyContent = 'space-between';
            
            // Add edit button at the left
            const editButton = document.createElement('button');
            editButton.className = 'btn btn-primary';
            editButton.style.backgroundColor = '#191970';
            editButton.innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Enrollments';
            
            // Set a custom event handler that properly manages focus
            editButton.addEventListener('click', () => {
                // Move focus outside modal before any action
                document.body.focus();
                
                // Close the view modal
                setTimeout(() => {
                    const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewEnrollmentModal'));
                    if (viewModal) {
                        viewModal.hide();
                        // Open the edit modal after a short delay
                        setTimeout(() => {
                            editEnrolment(studentId);
                        }, 300);
                    }
                }, 50);
            });
            
            // Remove default onclick handler to use our new one
            editButton.onclick = null;
            
            // Create a container for the left side
            const leftContainer = document.createElement('div');
            viewModalFooter.appendChild(leftContainer);
            leftContainer.appendChild(editButton);
            
            // Add the close button on the right
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'btn btn-secondary';
            closeButton.setAttribute('data-bs-dismiss', 'modal');
            closeButton.textContent = 'Close';
            
            // Create a container for the right side
            const rightContainer = document.createElement('div');
            viewModalFooter.appendChild(rightContainer);
            rightContainer.appendChild(closeButton);
        }
        
        // Helper function to create and append a class card
        function appendClassCard(container, cls) {
                    const classCard = document.createElement('div');
                    classCard.className = 'card mb-2';
                    
                    // Use class_id if available, fallback to id for backward compatibility
                    const classId = cls.class_id || cls.id;
                    
                    // Set different status badge based on enrollment status
                    let statusBadge = '';
                    
            if (cls.is_active && cls.enrollment_status === 'Active') {
                        statusBadge = `<span class="badge bg-success-subtle text-success">Active</span>`;
            } else if (cls.is_active && cls.enrollment_status === 'Pending') {
                        statusBadge = `<span class="badge bg-warning-subtle text-warning">Pending</span>`;
            } else if (!cls.is_active) {
                statusBadge = `<span class="badge bg-secondary-subtle text-secondary">Unenrolled</span>`;
                    } else {
                        statusBadge = `<span class="badge bg-secondary-subtle text-secondary">${cls.enrollment_status}</span>`;
                    }
            
            // Add enrollment and unenrollment dates if available
            let dateInfo = '';
            if (cls.enrollment_date) {
                dateInfo += `<p class="text-muted small mb-0">Enrolled: ${cls.enrollment_date}</p>`;
            }
            if (cls.unenrollment_date) {
                dateInfo += `<p class="text-muted small mb-0">Unenrolled: ${cls.unenrollment_date}</p>`;
                    }
                    
                    classCard.innerHTML = `
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="card-title mb-1">${cls.name}</h6>
                                    <p class="card-text text-muted small mb-1">${cls.schedule}</p>
                            <div class="d-flex align-items-center gap-2">
                                ${statusBadge}
                            </div>
                            ${dateInfo}
            </div>
                            </div>
        </div>
    `;
    
            container.appendChild(classCard);
        }
        
        // Show the modal with proper accessibility
        const viewModal = document.getElementById('viewEnrollmentModal');
        if (viewModal) {
            // Set proper accessibility attributes
            viewModal.removeAttribute('aria-hidden');
            viewModal.setAttribute('aria-modal', 'true');
            
            // Set data-bs-backdrop to true to allow clicking outside to close
            viewModal.setAttribute('data-bs-backdrop', 'true');
            
            // Create a Bootstrap modal with proper options
            const bsModal = new bootstrap.Modal(viewModal, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
            
            // Before showing the modal, add event listeners to handle accessibility properly
            viewModal.addEventListener('shown.bs.modal', function() {
                // Use aria-modal instead of aria-hidden for better accessibility
                this.setAttribute('aria-modal', 'true');
                this.removeAttribute('aria-hidden');
                
                // Focus the first focusable element in the modal
                setTimeout(() => {
                    const focusable = this.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    if (focusable.length) {
                        focusable[0].focus();
                    }
                }, 50);
            });
            
            viewModal.addEventListener('hidden.bs.modal', function() {
                // Run cleanup after modal closes
                cleanupInertAttributes();
                
                // Move focus back to the body
                setTimeout(() => document.body.focus(), 50);
            });
            
            bsModal.show();
        } else {
            throw new Error('View modal not found');
        }
    } catch (error) {
        showToast('Error loading enrollment details: ' + error.message, 'error');
    }
}

// Edit enrollment
async function editEnrolment(studentId) {
    try {
        // Fetch enrollment data from API
        const response = await fetch(`/api/students/${studentId}/enrollment`);
        if (!response.ok) throw new Error('Failed to fetch enrollment details');
        
        const data = await response.json();
        
        // Find the edit modal
        const editModal = document.getElementById('editEnrolmentModal');
        if (!editModal) {
            throw new Error('Edit modal not found');
        }
        
        // Find or create a modal footer element - moved outside the conditional blocks
        let modalFooter = editModal.querySelector('.modal-footer');
        
        // If no footer exists, create one
        if (!modalFooter) {
            modalFooter = document.createElement('div');
            modalFooter.className = 'modal-footer';
            const modalContent = editModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.appendChild(modalFooter);
            } else {
                // If no modal content, append to modal directly
                editModal.appendChild(modalFooter);
            }
        }
        
        // Set student info
        const studentIdElem = document.getElementById('editStudentId');
        if (studentIdElem) studentIdElem.textContent = data.student.user_id;
        
        const studentNameElem = document.getElementById('editStudentName');
        if (studentNameElem) studentNameElem.textContent = data.student.name;
        
        const studentCompanyElem = document.getElementById('editStudentCompany');
        if (studentCompanyElem) studentCompanyElem.textContent = `Company: ${data.company.name || 'Not Assigned'}`;
        
        const studentImageElem = document.getElementById('editStudentImage');
        if (studentImageElem) {
            const profileImg = data.student.profile_img || 'profile.png';
            studentImageElem.src = profileImg.startsWith('/static/') 
                ? profileImg 
                : `/static/images/${profileImg}`;
        }
        
        // Store student ID for reference
        editModal.dataset.studentId = studentId;
        
        // Populate the class container
        const classContainer = document.getElementById('editEnrolledClasses');
        if (!classContainer) {
            throw new Error('Class container not found');
        }
        
        // Clear the container
        classContainer.innerHTML = '';
        
        // Clear existing footer content
        modalFooter.innerHTML = '';
        
        // Filter out classes that have unenrollment_date (historical enrollments)
        const activeClasses = data.classes ? data.classes.filter(cls => !cls.unenrollment_date) : [];
        
        if (!activeClasses || activeClasses.length === 0) {
            classContainer.innerHTML = '<div class="alert alert-info">No active classes enrolled</div>';
            
            // Add a message to the footer
            const message = document.createElement('div');
            message.className = 'text-muted';
            message.textContent = 'No active enrollments to manage';
            modalFooter.appendChild(message);
        } else {
            // Create container to hold classes
            const classesWrapper = document.createElement('div');
            classesWrapper.id = 'editClassesForm';
            classContainer.appendChild(classesWrapper);
            
            // Add active classes only
            activeClasses.forEach(cls => {
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
                // Use explicit comparison to false to make sure undefined or null values default to checked
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
                classesWrapper.appendChild(classCard);
                
                // Add event listener for the toggle - Make sure this is consistent 
                toggleInput.addEventListener('change', function() {
                    const statusSelect = document.getElementById(`status-${classId}`);
                    const unenrollMsg = document.getElementById(`unenroll-msg-${classId}`);
                    const enrollmentKey = this.dataset.enrollmentKey;
                    
                    // Store toggle state for persistence
                    window.enrollmentToggleStates[enrollmentKey] = this.checked;
                    
                    if (this.checked) {
                        // Enable status selection when keeping enrolled
                        statusSelect.disabled = false;
                        unenrollMsg.classList.add('d-none');
                    } else {
                        // Disable status selection when not keeping enrolled
                        statusSelect.disabled = true;
                        unenrollMsg.classList.remove('d-none');
                    }
                });
            });
            
            // Add Save and Cancel buttons
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
                const success = await saveEnrollmentChanges(studentId);
                
                // If changes were successful, the modal is auto-closed in the saveEnrollmentChanges function
                // Otherwise the modal stays open so user can try again
            });
        }
        
        // Show the edit modal
        // Apply proper accessibility attributes
        editModal.removeAttribute('aria-hidden');
        editModal.setAttribute('aria-modal', 'true');
        
        // Create bootstrap modal instance and show
        const bsModal = new bootstrap.Modal(editModal, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // Add event listeners for proper accessibility
        editModal.addEventListener('shown.bs.modal', function() {
            // Make sure we're using aria-modal instead of aria-hidden
            this.setAttribute('aria-modal', 'true');
            this.removeAttribute('aria-hidden');
            
            // Set focus to the first interactive element
            setTimeout(() => {
                const focusable = this.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focusable.length) {
                    focusable[0].focus();
                }
            }, 50);
        });
        
        editModal.addEventListener('hidden.bs.modal', function() {
            // Clean up after closing
            cleanupInertAttributes();
            
            // Reset focus to the body
            setTimeout(() => document.body.focus(), 50);
        });
        
        bsModal.show();
        
    } catch (error) {
        showToast('Error loading enrollment data: ' + error.message, 'error');
    }
}

// Save enrollment changes
async function saveEnrollmentChanges(studentId) {
    // Get the edit form and all enrolled classes
    const editForm = document.getElementById('editClassesForm');
    if (!editForm) {
        showToast('Error: Could not find edit form', 'error');
        return false;
        }
        
        // Show loading toast
        showToast('Saving changes...', 'info');
        
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
            
            console.log(`Processing class ${classId}: keepEnrolled=${keepEnrolled}, originalStatus=${originalStatus}, newStatus=${newStatus}`);
            
            // Check if any changes are needed
            if (!keepEnrolled) {
                // Unenroll the student (soft delete with unenrollment_date)
                try {
                    const response = await fetch(`/api/enrollments/${studentId}/${classId}`, {
                        method: 'DELETE',
                        headers: {
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    // If successful or 404 (already unenrolled), count as processed
                    if (response.ok || response.status === 404) {
                        processedCount++;
                        hasChanges = true;
                        
                        // Add to processed set
                        processedEnrollments.add(enrollmentKey);
                    } else {
                        // Only count as error if it's not a 404
                        errorCount++;
                        
                        let errorData;
                        try {
                            errorData = await response.json();
                        } catch (e) {
                            errorData = { error: 'Failed to parse server response' };
                        }
                        
                        throw new Error(errorData.message || errorData.error || 'Failed to unenroll student');
                    }
                } catch (error) {
                    if (!error.message.includes('not found')) {
                        showToast(`Error unenrolling from class ${classId}: ${error.message}`, 'error');
                    }
                    // Don't count "not found" as an error
                }
            } else if (newStatus !== originalStatus) {
                // Update enrollment status
                console.log(`Updating status for class ${classId} from ${originalStatus} to ${newStatus}`);
                try {
                        const response = await fetch('/api/enrollments/approve', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache'
                            },
                            body: JSON.stringify({
                                student_id: studentId,
                            class_id: classId,
                            status: newStatus
                            })
                        });
                        
                        if (response.ok) {
                        processedCount++;
                        hasChanges = true;
                        
                        // Add to processed set
                        processedEnrollments.add(enrollmentKey);
                                } else {
                                    errorCount++;
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to update enrollment status');
                                }
                } catch (error) {
                    showToast(`Error updating status for class ${classId}: ${error.message}`, 'error');
                        }
                    }
                } catch (error) {
            // Skip individual errors and continue processing other cards
            console.error(`Error processing card: ${error.message}`);
            continue;
        }
    }
    
    // Show result toast
    if (hasChanges) {
        if (errorCount > 0) {
            showToast(`Saved ${processedCount} changes with ${errorCount} errors`, 'warning');
                    } else {
            showToast(`Successfully saved changes to ${processedCount} enrollments`, 'success');
        }
        
        // Close the modal after processing
        const editModal = document.getElementById('editEnrolmentModal');
        if (editModal) {
            const bsModal = bootstrap.Modal.getInstance(editModal);
            if (bsModal) {
                bsModal.hide();
                
                // Ensure we reload with fresh data by adding cache busting parameter
                const freshParams = new URLSearchParams(window.location.search);
                freshParams.set('_', Date.now());
                
                // Refresh data after a small delay
                setTimeout(() => {
                    // If we're looking at a single student, refresh that view
                    const studentId = editModal.dataset.studentId;
                    if (studentId) {
                        // Check if view modal is visible and refresh it
                        const viewModal = document.getElementById('viewEnrollmentModal');
                        if (viewModal && viewModal.classList.contains('show')) {
                            viewEnrolment(studentId);
                        }
                    }
                    
                    // Force a full refresh to ensure all counts are updated
                    fetchFilteredData(freshParams);
                }, 500);
            }
        }
        } else {
        showToast('No changes to save', 'info');
    }
    
    return hasChanges;
}

// Show toast notifications
function showToast(message, type = 'success', details = null) {
    // Get the existing toast component
    const toast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toast.querySelector('.toast-header i');
    
    // Set the message and title
    toastMessage.innerHTML = message;
    
    // If details are provided, add them for debugging (in development only)
    if (details && type === 'error') {
        console.error("Toast Error Details:", details);
        // Only show technical details in error messages when needed
        if (typeof details === 'string') {
            toastMessage.innerHTML += `<div class="mt-2 small text-danger">${details}</div>`;
        }
    }
    
    // Set title and icon based on type
    switch(type) {
        case 'success':
            toastTitle.textContent = 'Success';
            toastIcon.className = 'bi bi-check-circle-fill text-success me-2';
            break;
        case 'error':
            toastTitle.textContent = 'Error';
            toastIcon.className = 'bi bi-exclamation-circle-fill text-danger me-2';
            break;
        case 'warning':
            toastTitle.textContent = 'Warning';
            toastIcon.className = 'bi bi-exclamation-triangle-fill text-warning me-2';
            break;
        case 'info':
            toastTitle.textContent = 'Information';
            toastIcon.className = 'bi bi-info-circle-fill text-info me-2';
            break;
    }
    
    // Show the toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Approve enrollment
async function approveEnrollment(studentId, classId) {
    try {
        showToast('Processing approval...', 'info');
        
        const response = await fetch('/api/enrollments/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                student_id: studentId,
                class_id: classId
            })
        });

        const responseData = await response.json();

        if (response.ok) {
            // Get the current modal instance and hide it first
            const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewEnrollmentModal'));
            if (viewModal) {
                viewModal.hide();
                
                // Wait for modal to finish hiding transition
                setTimeout(() => {
                    showToast('Enrollment approved successfully', 'success');
                    
                    // Create params with cache busting
                    const freshParams = new URLSearchParams(window.location.search);
                    freshParams.set('_', Date.now());
                    
                    // Force complete refresh with fresh data
                    setTimeout(() => {
                        fetchFilteredData(freshParams);
                    }, 500);
                }, 300);
            } else {
                showToast('Enrollment approved successfully', 'success');
                
                // Create params with cache busting
                const freshParams = new URLSearchParams(window.location.search);
                freshParams.set('_', Date.now());
                
                // Force complete refresh with fresh data
                setTimeout(() => {
                    fetchFilteredData(freshParams);
                }, 500);
            }
        } else {
            throw new Error(responseData.message || 'Failed to approve enrollment');
        }
    } catch (error) {
        showToast('Error approving enrollment: ' + error.message, 'error');
    }
}

// Show unenroll confirmation modal
function showUnenrollConfirmation(studentId, classId, studentName, className) {
    // Set the student and class information in the modal
    document.getElementById('unenrollStudentName').textContent = studentName;
    document.getElementById('unenrollClassName').textContent = className;
    
    // Get the modal element and create a Bootstrap modal instance
    const modal = document.getElementById('unenrollConfirmModal');
    
    // Remove aria-hidden for accessibility
    modal.removeAttribute('aria-hidden');
    
    // Create bootstrap modal instance
    const confirmModal = new bootstrap.Modal(modal);

    // Before showing the modal, add event listeners to handle accessibility properly
    modal.addEventListener('shown.bs.modal', function() {
        // Use aria-modal instead of aria-hidden for better accessibility
        this.setAttribute('aria-modal', 'true');
        this.removeAttribute('aria-hidden');
        
        // Focus the first focusable element in the modal
        setTimeout(() => {
            const focusable = this.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length) {
                focusable[0].focus();
            }
        }, 50);
    });

    modal.addEventListener('hidden.bs.modal', function() {
        // Run cleanup after modal closes
        cleanupInertAttributes();
        
        // Move focus back to the body
        setTimeout(() => document.body.focus(), 50);
    });

    // Set up the confirm button click handler
    const confirmBtn = document.getElementById('confirmUnenrollBtn');

    // Remove any existing event listeners to prevent duplicates
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    // Add the click event listener to the new button
    newConfirmBtn.addEventListener('click', async () => {
        // Move focus outside modal before hiding
        document.body.focus();
        
        // Hide the modal
        confirmModal.hide();

        // Call the function to perform the unenrollment
        await performUnenrollment(studentId, classId);
    });

    // Show the modal
    confirmModal.show();
}

// Perform the actual unenrollment
async function performUnenrollment(studentId, classId) {
    try {
        // Show loading toast
        showToast('Processing unenrollment...', 'info');
        
        // Use DELETE method for unenrollment with no body
        const response = await fetch(`/api/enrollments/${studentId}/${classId}`, {
            method: 'DELETE',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        // Get the result
        let result;
        try {
            result = await response.json();
        } catch (e) {
            result = { error: 'Failed to parse server response' };
        }

        if (!response.ok) {
            throw new Error(result.message || result.error || 'Failed to unenroll student');
        }
        
        // Show success toast
        showToast('Student successfully unenrolled', 'success');
        
        // Create fresh params with cache busting
        const freshParams = new URLSearchParams(window.location.search);
        freshParams.set('_', Date.now());
        
        // Check if a view modal is open, and if so, refresh it
        const viewModal = document.getElementById('viewEnrollmentModal');
        if (viewModal && viewModal.classList.contains('show')) {
            // Refresh the enrollment data in the view modal with a delay to ensure backend processing is complete
            setTimeout(() => {
                viewEnrolment(studentId);
            }, 1000);
        }
        
        // Always refresh the main enrollment table with fresh data
        setTimeout(() => {
            fetchFilteredData(freshParams);
        }, 1000);
    } catch (error) {
        showToast('Error unenrolling student: ' + error.message, 'error');
    }
}

// Unenroll student
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
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Update the status filter dropdown if needed
    const statusFilterElement = document.getElementById('statusFilter');
    if (statusFilterElement) {
        // Add visual indicator that we're showing all students for Active filter
        if (statusFilter === 'Active') {
            statusFilterElement.classList.add('showing-all-students');
        } else {
            statusFilterElement.classList.remove('showing-all-students');
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
        
        // Build the URL with query parameters
        let url = '/api/enrollments/export-csv';
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (search) params.append('search', search);
        
        // Add query params if any exist
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        // Use fetch API to get the CSV data
        const response = await fetch(url);
        
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
        
        showToast('CSV file downloaded successfully', 'success');
    } catch (error) {
        showToast('Failed to export CSV: ' + error.message, 'error');
    } finally {
        // Restore button state
        if (exportBtn) {
            exportBtn.innerHTML = originalBtnContent || '<i class="bi bi-arrow-up-right me-2"></i>Export CSV';
            exportBtn.disabled = false;
        }
    }
}

