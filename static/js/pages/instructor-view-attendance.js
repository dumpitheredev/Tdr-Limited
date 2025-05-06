/**
 * Instructor View Attendance
 * 
 * This script handles the instructor view attendance page functionality.
 * It allows instructors to view, filter, and manage attendance records for their classes.
 */

// Use the shared utility functions from attendance-utils.js if available
// Otherwise implement fallbacks

// Custom logging function
function appLog(message, type = 'info') {
    // Only log errors, other logs are handled directly
    if (type === 'error') {
        console.log('Instructor view attendance: ' + message);
    }
}

// Track loading state
let isLoading = false;
let statsInitialized = false;

// Show toast notification
function showToast(message, type = 'success', title = null, isHtml = false) {
    // Try to use the global toast utility if available
    if (window.AttendanceUtils && window.AttendanceUtils.showToast) {
        window.AttendanceUtils.showToast(message, type, title, isHtml);
        return;
    }
    
    // Fallback to manual toast implementation
    const toast = document.getElementById('statusToast');
    if (!toast) return;
    
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastHeader = toast.querySelector('.toast-header i');
    
    // Set toast content
    if (toastTitle) {
        toastTitle.textContent = title || type.charAt(0).toUpperCase() + type.slice(1);
    }
    
    if (toastMessage) {
        if (isHtml) {
            toastMessage.innerHTML = message;
        } else {
            toastMessage.textContent = message;
        }
    }
    
    // Set appropriate icon and color
    if (toastHeader) {
        toastHeader.className = '';
        
        if (type === 'success') {
            toastHeader.className = 'bi bi-check-circle-fill text-success me-2';
        } else if (type === 'error') {
            toastHeader.className = 'bi bi-x-circle-fill text-danger me-2';
        } else if (type === 'warning') {
            toastHeader.className = 'bi bi-exclamation-circle-fill text-warning me-2';
        } else {
            toastHeader.className = 'bi bi-info-circle-fill text-info me-2';
        }
    }
    
    // Show the toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Update the table with the fetched data
function updateTable(records) {
    // Find the table container and make it visible
    const tableContainer = document.getElementById('instructor-attendance-table');
    if (tableContainer) {
        tableContainer.style.display = 'block';
    }
    
    // Find the table body - it might not have an ID in the template
    const tableBody = document.querySelector('#instructor-attendance-table tbody') || 
                      document.getElementById('instructor-tableBody');
    
    if (!tableBody) {
        console.error('Table body element not found');
        showToast('Error: Table body element not found', 'error');
        return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // If no records, show a message
    if (!records || records.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `
            <td colspan="5" class="text-center py-4">
                <div class="alert alert-info mb-0">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>No attendance records found</strong>
                    <p class="mb-0 mt-2">Try adjusting your filters or date range to see more results.</p>
                </div>
            </td>
        `;
        tableBody.appendChild(noDataRow);
        return;
    }

    // Render attendance records
    
    // Render records
    records.forEach(record => {
        const row = document.createElement('tr');
        const status = record.status ? record.status.toLowerCase() : 'unknown';
        
        // Use utility functions if available, otherwise implement inline
        const badgeClass = window.AttendanceUtils && window.AttendanceUtils.getBadgeClass ? 
            window.AttendanceUtils.getBadgeClass(status) : 
            getStatusBadgeClass(status);
            
        const statusDisplay = window.AttendanceUtils && window.AttendanceUtils.getStatusDisplay ? 
            window.AttendanceUtils.getStatusDisplay(status) : 
            status.charAt(0).toUpperCase() + status.slice(1);
        
        const formattedDate = window.AttendanceUtils && window.AttendanceUtils.formatDateForDisplay ? 
            window.AttendanceUtils.formatDateForDisplay(record.date) : 
            formatDate(record.date);
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>
                <div class="d-flex align-items-center">
                    <img src="/static/images/${record.student_profile_img || 'profile.png'}" 
                         alt="Profile" class="rounded-circle me-2" width="35" height="35">
                    <div>
                        <h6 class="mb-0">${record.student_name}</h6>
                        <small class="text-muted"> ${record.student_id || 'N/A'}</small>
                    </div>
                </div>
            </td>
            <td>${record.class_name}</td>
            <td><span class="badge ${badgeClass}">${statusDisplay}</span></td>
            <td>
                <div class="d-flex">
                    <a href="javascript:void(0)" class="me-2" onclick="InstructorAttendance.editAttendance('${record.id}')" title="Edit Record">
                        <i class="bi bi-pencil" style="color: #191970;"></i>
                    </a>
                    <a href="javascript:void(0)" class="me-2" onclick="InstructorAttendance.viewAttendance('${record.id}')" title="View Details">
                        <i class="bi bi-eye" style="color: #191970;"></i>
                    </a>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Hide the loading indicator
    const loadingIndicator = document.getElementById('instructor-loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Helper function to get badge class for status
function getStatusBadgeClass(status) {
    switch (status.toLowerCase()) {
        case 'present':
            return 'bg-success-subtle text-success';
        case 'absent':
            return 'bg-danger-subtle text-danger';
        case 'late':
            return 'bg-warning-subtle text-warning';
        default:
            return 'bg-secondary-subtle text-secondary';
    }
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Show loading state
function showLoading() {
    isLoading = true;
    
    const loadingIndicator = document.getElementById('instructor-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    
    const tableContainer = document.getElementById('instructor-table-container');
    if (tableContainer) tableContainer.classList.add('loading');
}

// Hide loading state
function hideLoading() {
    isLoading = false;
    
    const loadingIndicator = document.getElementById('instructor-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    const tableContainer = document.getElementById('instructor-table-container');
    if (tableContainer) tableContainer.classList.remove('loading');
}

// Build URL with all current filters
function buildApiUrl() {
    // Base URL for instructor attendance API
    let url = '/instructor/api/attendance?';
    
    // Get filter values
    const classSelect = document.getElementById('instructor-classSelect');
    const studentSearch = document.getElementById('instructor-studentSearch');
    const dateRangeStart = document.getElementById('instructor-dateRangeStart');
    const dateRangeEnd = document.getElementById('instructor-dateRangeEnd');
    
    // Get pagination info
    const paginationInfo = document.getElementById('instructor-paginationInfo');
    const rowsPerPageSelect = document.getElementById('instructor-rowsPerPageSelect');
    
    // Get page from pagination info or default to 1
    const page = paginationInfo ? (paginationInfo.dataset.page || 1) : 1;
    
    // Get per_page from rows per page select or default to 25 (matching the template default)
    const perPage = rowsPerPageSelect ? rowsPerPageSelect.value : 25;
    
    // Add pagination to URL
    url += `page=${page}&per_page=${perPage}&`;
    
    // Add filters to URL
    if (classSelect && classSelect.value) {
        url += `class_id=${encodeURIComponent(classSelect.value)}&`;
    }
    
    if (studentSearch && studentSearch.value) {
        url += `student_name=${encodeURIComponent(studentSearch.value)}&`;
    }
    
    if (dateRangeStart && dateRangeStart.value) {
        url += `date_start=${encodeURIComponent(dateRangeStart.value)}&`;
    }
    
    if (dateRangeEnd && dateRangeEnd.value) {
        url += `date_end=${encodeURIComponent(dateRangeEnd.value)}&`;
    }
    
    return url;
}

// Load attendance data
function loadAttendanceData() {
    if (isLoading) return;
    
    showLoading();
    
    // Build URL with filters
    const url = buildApiUrl();
    
    // Fetch data
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Process received data
            
            // Check if we have the expected data structure
            if (!data || typeof data !== 'object') {
                console.error('Unexpected data format received');
                showToast('Received invalid data format from server', 'error');
                hideLoading();
                return;
            }
            
            // Update the table with the fetched data
            if (Array.isArray(data.records)) {
                updateTable(data.records);
            } else if (Array.isArray(data)) {
                // Handle case where the API might return an array directly
                console.log(`Updating table with ${data.length} records (direct array)`);
                updateTable(data);
            } else {
                console.log('No records found in response');
                updateTable([]);
            }
            
            // Update pagination if available
            if (data.pagination) {
                updatePagination(
                    data.pagination.total || 0,
                    data.pagination.page || 1,
                    data.pagination.per_page || 10
                );
            }
            
            // Update stats if available and not yet initialized
            if (data.stats && !statsInitialized) {
                updateStats(data.stats);
                statsInitialized = true;
            }
            
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading attendance data:', error);
            showToast('Failed to load attendance data. Please try again.', 'error');
            hideLoading();
        });
}

// Update pagination info and buttons
function updatePagination(total, page, perPage) {
    const paginationInfo = document.getElementById('instructor-paginationInfo');
    if (!paginationInfo) return;
    
    // Calculate pagination values
    const start = (page - 1) * perPage + 1;
    const end = Math.min(start + perPage - 1, total);
    
    // Update pagination text
    paginationInfo.textContent = `${start}-${end} of ${total}`;
    paginationInfo.dataset.page = page;
    paginationInfo.dataset.perPage = perPage;
    paginationInfo.dataset.total = total;
    
    // Update button states
    const prevPageBtn = document.getElementById('instructor-prevPageBtn');
    const nextPageBtn = document.getElementById('instructor-nextPageBtn');
    
    if (prevPageBtn) prevPageBtn.disabled = page <= 1;
    if (nextPageBtn) nextPageBtn.disabled = end >= total;
    
    // Update rows per page select to match current value
    const rowsPerPageSelect = document.getElementById('instructor-rowsPerPageSelect');
    if (rowsPerPageSelect && rowsPerPageSelect.value != perPage) {
        // Find matching option or default to closest value
        const options = Array.from(rowsPerPageSelect.options);
        const matchingOption = options.find(option => parseInt(option.value) === perPage);
        
        if (matchingOption) {
            rowsPerPageSelect.value = matchingOption.value;
        } else {
            // Find closest value
            let closestOption = options[0];
            let closestDiff = Math.abs(parseInt(closestOption.value) - perPage);
            
            options.forEach(option => {
                const diff = Math.abs(parseInt(option.value) - perPage);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestOption = option;
                }
            });
            
            rowsPerPageSelect.value = closestOption.value;
        }
    }
}

// Update statistics cards
function updateStats(stats) {
    // Update attendance statistics
    // Update total count - using the correct ID from the template
    const totalElement = document.getElementById('instructor-totalRecords');
    if (totalElement) {

        totalElement.textContent = stats.total || 0;
    } else {
        console.warn('Element instructor-totalRecords not found');
    }
    
    // Update present count
    const presentElement = document.getElementById('instructor-presentCount');
    if (presentElement) {

        presentElement.textContent = stats.present || 0;
    } else {
        console.warn('Element instructor-presentCount not found');
    }
    
    // Update absent count
    const absentElement = document.getElementById('instructor-absentCount');
    if (absentElement) {

        absentElement.textContent = stats.absent || 0;
    } else {
        console.warn('Element instructor-absentCount not found');
    }
    
    // Update late count
    const lateElement = document.getElementById('instructor-lateCount');
    if (lateElement) {

        lateElement.textContent = stats.late || 0;
    } else {
        console.warn('Element instructor-lateCount not found');
    }
    
    // Other count is optional
    const otherElement = document.getElementById('instructor-otherCount');
    if (otherElement && 'other' in stats) {
        otherElement.textContent = stats.other || 0;
    }
    
    // Calculate percentages if total > 0
    if (stats.total > 0) {
        const presentPercent = Math.round((stats.present / stats.total) * 100) || 0;
        const absentPercent = Math.round((stats.absent / stats.total) * 100) || 0;
        const latePercent = Math.round((stats.late / stats.total) * 100) || 0;
        const otherPercent = 'other' in stats ? Math.round((stats.other / stats.total) * 100) || 0 : 0;
        
        // Update percentage displays if they exist
        const presentPercentElement = document.getElementById('instructor-presentPercent');
        if (presentPercentElement) presentPercentElement.textContent = `${presentPercent}%`;
        
        const absentPercentElement = document.getElementById('instructor-absentPercent');
        if (absentPercentElement) absentPercentElement.textContent = `${absentPercent}%`;
        
        const latePercentElement = document.getElementById('instructor-latePercent');
        if (latePercentElement) latePercentElement.textContent = `${latePercent}%`;
        
        const otherPercentElement = document.getElementById('instructor-otherPercent');
        if (otherPercentElement) otherPercentElement.textContent = `${otherPercent}%`;
    }
}

// View attendance record details
function viewAttendanceRecord(id) {
    if (!id) return;
    
    // Show loading state
    const modal = document.getElementById('attendanceDetailModal');
    if (!modal) {
        console.error('Attendance detail modal not found');
        return;
    }
    
    // Reset modal content
    const dateElement = document.getElementById('attendanceDetailDate');
    const studentNameElement = document.getElementById('attendanceDetailStudentName');
    const classNameElement = document.getElementById('attendanceDetailClassName');
    const statusElement = document.getElementById('attendanceDetailStatus');
    const commentElement = document.getElementById('attendanceDetailComment');
    
    // Check if all elements exist
    if (!dateElement || !studentNameElement || !classNameElement || !statusElement || !commentElement) {
        console.error('One or more attendance detail elements not found', {
            dateElement, studentNameElement, classNameElement, statusElement, commentElement
        });
        showToast('Error: Modal elements not found', 'error');
        return;
    }
    
    // Reset modal content
    dateElement.textContent = '-';
    studentNameElement.textContent = '-';
    classNameElement.textContent = '-';
    statusElement.textContent = '-';
    statusElement.className = 'badge';
    commentElement.textContent = '-';
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Fetch record details from the new API endpoint
    fetch(`/instructor/api/attendance/${id}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Update modal content
            document.getElementById('attendanceDetailDate').textContent = 
                data.date || 'N/A';
                
            document.getElementById('attendanceDetailStudentName').textContent = 
                data.student_name || 'N/A';
                
            document.getElementById('attendanceDetailClassName').textContent = 
                data.class_name || 'N/A';
            
            const status = data.status ? data.status.toLowerCase() : 'unknown';
            
            if (statusElement) {
                statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                
                // Set badge class based on status
                if (status === 'present') {
                    statusElement.className = 'badge bg-success-subtle text-success';
                } else if (status === 'absent') {
                    statusElement.className = 'badge bg-danger-subtle text-danger';
                } else if (status === 'late') {
                    statusElement.className = 'badge bg-warning-subtle text-warning';
                } else {
                    statusElement.className = 'badge bg-secondary-subtle text-secondary';
                }
            }
            
            // Process comment to separate attendance comment from archive notes
            if (commentElement) {
                let commentText = data.comment || '';
                
                // If the comment contains archive notes (indicated by 'ARCHIVED' keyword),
                // only show the original comment part
                if (commentText.includes('ARCHIVED')) {
                    // Try to extract just the original comment before any archive notes
                    const archiveIndex = commentText.indexOf('ARCHIVED');
                    if (archiveIndex > 0) {
                        // Check if there's actual content before the archive note
                        const originalComment = commentText.substring(0, archiveIndex).trim();
                        commentText = originalComment || 'No comment provided';
                    } else {
                        commentText = 'No comment provided';
                    }
                }
                
                commentElement.textContent = commentText || 'No comment provided';
            }
        })
        .catch(error => {
            console.error('Error loading attendance record details:', error);
            showToast('Failed to load record details. Please try again.', 'error');
        });
}

// Edit attendance record
function editAttendanceRecord(id) {
    if (!id) return;
    
    // Show loading state
    const modal = document.getElementById('editAttendanceModal');
    if (!modal) return;
    
    // Reset form
    const form = document.getElementById('editAttendanceForm');
    if (form) form.reset();
    
    // Clear validation errors
    const invalidFields = form.querySelectorAll('.is-invalid');
    invalidFields.forEach(field => field.classList.remove('is-invalid'));
    
    // Set record ID
    document.getElementById('editAttendanceId').value = id;
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Fetch record details from the new API endpoint
    fetch(`/instructor/api/attendance/${id}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Populate form fields
            const editDateElement = document.getElementById('editDate');
            const editStudentNameElement = document.getElementById('editStudentName');
            const editClassNameElement = document.getElementById('editClassName');
            
            // Check if elements exist and update them
            if (editDateElement) {
                if (editDateElement.tagName.toLowerCase() === 'input') {
                    editDateElement.value = data.date || '';
                } else {
                    editDateElement.textContent = data.date || '';
                }
            }
            
            if (editStudentNameElement) {
                if (editStudentNameElement.tagName.toLowerCase() === 'input') {
                    editStudentNameElement.value = data.student_name || '';
                } else {
                    editStudentNameElement.textContent = data.student_name || '';
                }
            }
            
            if (editClassNameElement) {
                if (editClassNameElement.tagName.toLowerCase() === 'input') {
                    editClassNameElement.value = data.class_name || '';
                } else {
                    editClassNameElement.textContent = data.class_name || '';
                }
            }
            
            const statusSelect = document.getElementById('editStatus');
            if (statusSelect) {
                // Find option with matching value (case-insensitive)
                const options = Array.from(statusSelect.options);
                const matchingOption = options.find(option => 
                    option.value.toLowerCase() === (data.status || '').toLowerCase()
                );
                
                if (matchingOption) {
                    statusSelect.value = matchingOption.value;
                } else {
                    statusSelect.value = ''; // Default to empty if no match
                }
            }
            
            // Process comment to separate attendance comment from archive notes
            const editCommentElement = document.getElementById('editComment');
            if (editCommentElement) {
                let commentText = data.comment || '';
                
                // If the comment contains archive notes (indicated by 'ARCHIVED' keyword),
                // only show the original comment part
                if (commentText.includes('ARCHIVED')) {
                    // Try to extract just the original comment before any archive notes
                    const archiveIndex = commentText.indexOf('ARCHIVED');
                    if (archiveIndex > 0) {
                        // Check if there's actual content before the archive note
                        const originalComment = commentText.substring(0, archiveIndex).trim();
                        commentText = originalComment || '';
                    } else {
                        commentText = '';
                    }
                }
                
                editCommentElement.value = commentText;
            }
        })
        .catch(error => {
            console.error('Error loading attendance record details:', error);
            showToast('Failed to load record details. Please try again.', 'error');
            
            // Hide the modal
            const bsModalInstance = bootstrap.Modal.getInstance(modal);
            if (bsModalInstance) bsModalInstance.hide();
        });
}

// Save attendance changes
function saveAttendanceChanges() {
    // Get form data
    const recordId = document.getElementById('editAttendanceId').value;
    const status = document.getElementById('editStatus').value;
    const comment = document.getElementById('editComment').value;
    
    // Validate form
    let isValid = true;
    
    if (!status) {
        document.getElementById('editStatus').classList.add('is-invalid');
        isValid = false;
    } else {
        document.getElementById('editStatus').classList.remove('is-invalid');
    }
    
    // Validate comment - prevent empty, whitespace-only, or single-character comments
    const commentElement = document.getElementById('editComment');
    const trimmedComment = comment.trim();
    
    // Check if comment is empty, just whitespace, just a period, or other minimal input
    if (!trimmedComment || trimmedComment === '.' || trimmedComment.length < 2) {
        if (commentElement) {
            commentElement.classList.add('is-invalid');
            
            // Add or update validation message
            let feedbackElement = commentElement.nextElementSibling;
            if (!feedbackElement || !feedbackElement.classList.contains('invalid-feedback')) {
                feedbackElement = document.createElement('div');
                feedbackElement.className = 'invalid-feedback';
                commentElement.parentNode.insertBefore(feedbackElement, commentElement.nextSibling);
            }
            
            // Set appropriate error message based on the input
            if (!trimmedComment) {
                feedbackElement.textContent = 'Please provide a meaningful comment. Spaces alone are not allowed.';
            } else if (trimmedComment === '.') {
                feedbackElement.textContent = 'A single period is not a valid comment. Please provide a meaningful comment.';
            } else {
                feedbackElement.textContent = 'Comment is too short. Please provide a more descriptive comment.';
            }
        }
        isValid = false;
    } else {
        if (commentElement) {
            commentElement.classList.remove('is-invalid');
        }
    }
    
    if (!isValid) return;
    
    // Show loading state
    const saveBtn = document.getElementById('saveAttendanceBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    }
    
    // Prepare data for API
    const data = {
        status: status,
        comment: comment
    };
    
    // Get CSRF token
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    // Send update request to the new API endpoint
    fetch(`/instructor/api/attendance/${recordId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken || ''
        },
        body: JSON.stringify(data)
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Show success message
            showToast('Attendance record updated successfully', 'success');
            
            // Hide the modal
            const modal = document.getElementById('editAttendanceModal');
            const bsModalInstance = bootstrap.Modal.getInstance(modal);
            if (bsModalInstance) bsModalInstance.hide();
            
            // Reload data to reflect changes
            loadAttendanceData();
        })
        .catch(error => {
            console.error('Error updating attendance record:', error);
            showToast('Failed to update record. Please try again.', 'error');
        })
        .finally(() => {
            // Reset button state
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save Changes';
            }
        });
}

// Export to CSV
function exportToCsv() {
    // Show loading toast
    showToast('Preparing export, please wait...', 'info');
    
    // Get current filter values for export
    const classId = document.getElementById('instructor-classSelect')?.value || '';
    const studentName = document.getElementById('instructor-studentSearch')?.value || '';
    const dateStart = document.getElementById('instructor-dateRangeStart')?.value || '';
    const dateEnd = document.getElementById('instructor-dateRangeEnd')?.value || '';
    
    // Build export URL with current filters
    let exportUrl = '/instructor/export-attendance?format=csv';
    if (classId) exportUrl += `&class_id=${encodeURIComponent(classId)}`;
    if (studentName) exportUrl += `&student_name=${encodeURIComponent(studentName)}`;
    if (dateStart) exportUrl += `&date_start=${encodeURIComponent(dateStart)}`;
    if (dateEnd) exportUrl += `&date_end=${encodeURIComponent(dateEnd)}`;
            
    // Navigate to export URL
    window.location.href = exportUrl;
}

// Create the instructor attendance module
const InstructorAttendance = {
    // Initialize the module
    init() {
        console.log('Instructor View Attendance initialized successfully');
                
        // Initialize date pickers if flatpickr is available
        if (window.flatpickr) {
            const dateConfig = {
                altInput: true,
                altFormat: "F j, Y",
                dateFormat: "Y-m-d",
                maxDate: "today"
            };
            
            flatpickr('#instructor-dateRangeStart', dateConfig);
            flatpickr('#instructor-dateRangeEnd', dateConfig);
        }
        
        // Filter form submission
        const filterForm = document.getElementById('instructor-filterForm');
        if (filterForm) {
            // Add submit event listener
            filterForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Reset pagination to page 1 when filtering
                const paginationInfo = document.getElementById('instructor-paginationInfo');
                if (paginationInfo) {
                    paginationInfo.dataset.page = 1;
                }
                
                // Load data with filters
                loadAttendanceData();
            });
            
            // Add input event listeners to automatically apply filters when values change
            const classSelect = document.getElementById('instructor-classSelect');
            const studentSearch = document.getElementById('instructor-studentSearch');
            const dateRangeStart = document.getElementById('instructor-dateRangeStart');
            const dateRangeEnd = document.getElementById('instructor-dateRangeEnd');
            
            // Function to handle filter changes
            const handleFilterChange = function() {
                // Reset pagination to page 1
                const paginationInfo = document.getElementById('instructor-paginationInfo');
                if (paginationInfo) paginationInfo.dataset.page = 1;
                
                // Load data with new filter
                loadAttendanceData();
            };
            
            // Add event listeners to all filter inputs
            if (classSelect) {
                classSelect.addEventListener('change', handleFilterChange);
            }
            
            if (studentSearch) {
                // Use input event with debounce for text search
                let searchTimeout;
                studentSearch.addEventListener('input', function() {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(handleFilterChange, 500); // 500ms debounce
                });
            }
            
            if (dateRangeStart) {
                dateRangeStart.addEventListener('change', handleFilterChange);
            }
            
            if (dateRangeEnd) {
                dateRangeEnd.addEventListener('change', handleFilterChange);
            }
        }
        
        // Clear filters button
        const clearFiltersBtn = document.getElementById('instructor-clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', function() {
                const filterForm = document.getElementById('instructor-filterForm');
                if (filterForm) {
                    // Reset all form inputs
                    filterForm.reset();
                    
                    // Reset date pickers if using flatpickr
                    const dateRangeStart = document.getElementById('instructor-dateRangeStart');
                    const dateRangeEnd = document.getElementById('instructor-dateRangeEnd');
                    
                    if (dateRangeStart && dateRangeStart._flatpickr) {
                        dateRangeStart._flatpickr.clear();
                    }
                    
                    if (dateRangeEnd && dateRangeEnd._flatpickr) {
                        dateRangeEnd._flatpickr.clear();
                    }
                    
                    // Reset pagination to page 1
                    const paginationInfo = document.getElementById('instructor-paginationInfo');
                    if (paginationInfo) {
                        paginationInfo.dataset.page = 1;
                    }
                    
                    // Reload data with cleared filters
                    loadAttendanceData();
                }
            });
        }
        
        // Export button
        const exportBtn = document.getElementById('instructor-exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportToCsv);
        }
        
        // Pagination buttons
        const prevPageBtn = document.getElementById('instructor-prevPageBtn');
        const nextPageBtn = document.getElementById('instructor-nextPageBtn');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function() {
                const paginationInfo = document.getElementById('instructor-paginationInfo');
                if (!paginationInfo) return;
                
                const currentPage = parseInt(paginationInfo.dataset.page || '1');
                if (currentPage > 1) {
                    paginationInfo.dataset.page = currentPage - 1;
                    loadAttendanceData();
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function() {
                const paginationInfo = document.getElementById('instructor-paginationInfo');
                if (!paginationInfo) return;
                
                const currentPage = parseInt(paginationInfo.dataset.page || '1');
                const total = parseInt(paginationInfo.dataset.total || '0');
                const perPage = parseInt(paginationInfo.dataset.perPage || '10');
                
                if (currentPage * perPage < total) {
                    paginationInfo.dataset.page = currentPage + 1;
                    loadAttendanceData();
                }
            });
        }
        
        // Rows per page select
        const rowsPerPageSelect = document.getElementById('instructor-rowsPerPageSelect');
        if (rowsPerPageSelect) {
            rowsPerPageSelect.addEventListener('change', function() {
                const paginationInfo = document.getElementById('instructor-paginationInfo');
                if (!paginationInfo) return;
                
                // Reset to page 1 when changing rows per page
                paginationInfo.dataset.page = 1;
                paginationInfo.dataset.perPage = this.value;
                
                // Reload data with new pagination settings
                loadAttendanceData();
            });
        }
        
        // Edit form submit handler
        const editForm = document.getElementById('editAttendanceForm');
        if (editForm) {
            editForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveAttendanceChanges();
            });
        }
        
        // Initial data load
        loadAttendanceData();
    },
    
    // Public methods for window event handlers
    viewAttendance(id) {
        viewAttendanceRecord(id);
    },
    
    editAttendance(id) {
        editAttendanceRecord(id);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('View Attendance page loaded');
    // Check if we're on the instructor view attendance page
    if (document.getElementById('instructor-tableBody')) {
        window.InstructorAttendance = InstructorAttendance;
        InstructorAttendance.init();
    }
});