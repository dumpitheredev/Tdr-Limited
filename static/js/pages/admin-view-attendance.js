// Use the shared utility functions from attendance-utils.js
// Access functions directly from window.AttendanceUtils

// Custom logging function to control output
function appLog(message, type = 'info') {
    // Only log important messages and initialization confirmations
    if (type === 'init' || type === 'error') {
        console.log('Admin view attendance' + (type === 'init' ? ' initialized successfully' : ': ' + message));
    }
}

// Track whether we're currently fetching data and if stats have been initialized
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
            toastMessage.innerHTML = message; // Use innerHTML for HTML content
        } else {
            toastMessage.textContent = message; // Use textContent for plain text
        }
    }
    
    // Set appropriate icon and color
    if (toastHeader) {
        toastHeader.className = ''; // Clear existing classes
        
        // Add appropriate icon class
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
    const tableBody = document.getElementById('admin-tableBody');
    if (!tableBody) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // If no records, show a message
    if (!records || records.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `
            <td colspan="6" class="text-center py-4">
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

    // Render records
    records.forEach(record => {
        const row = document.createElement('tr');
        const status = record.status ? record.status.toLowerCase() : 'unknown';
        const badgeClass = window.AttendanceUtils.getBadgeClass(status);
        const statusDisplay = window.AttendanceUtils.getStatusDisplay(status);
        
        row.innerHTML = `
            <td>${window.AttendanceUtils.formatDateForDisplay(record.date)}</td>
            <td>
                <div class="d-flex align-items-center">
                <img src="/static/images/${record.student_profile_img || 'profile.png'}" 
                         alt="Profile" class="rounded-circle me-2" width="35" height="35">
                    <div>
                        <h6 class="mb-0">${record.student_name}</h6>
                        <small class="text-muted">${record.student_id}</small>
                    </div>
                </div>
            </td>
            <td>${record.class_name || record.class_id}</td>
            <td>${record.instructor_name || 'N/A'}</td>
            <td>
                <span class="badge ${badgeClass}">${statusDisplay}</span>
            </td>
            <td>
                <div class="d-flex">
                    <a href="javascript:void(0)" class="me-2" onclick="window.AdminAttendance.editAttendance('${record.id}')" title="Edit Record">
                        <i class="bi bi-pencil" style="color: #191970;"></i>
                    </a>
                    <a href="javascript:void(0)" class="me-2" onclick="window.AdminAttendance.viewAttendance('${record.id}')" title="View Details">
                        <i class="bi bi-eye" style="color: #191970;"></i>
                    </a>
                    <a href="javascript:void(0)" onclick="window.AdminAttendance.archiveAttendance('${record.id}')" title="Archive Record">
                        <i class="bi bi-archive" style="color: #191970;"></i>
                    </a>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add a lazy loading row if needed
    if (records.length >= 50) {
        appendLazyLoadingRow();
    }
}

// Function to append a lazy loading row at the bottom of the table
function appendLazyLoadingRow() {
    const tableBody = document.getElementById('admin-tableBody');
    if (!tableBody) return;
    
    const loadingRow = document.createElement('tr');
    loadingRow.id = 'admin-lazyLoadingRow';
    loadingRow.innerHTML = `
        <td colspan="6" class="text-center py-3">
            <div class="d-flex justify-content-center align-items-center">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span>Loading more records...</span>
            </div>
        </td>
    `;
    
    tableBody.appendChild(loadingRow);
}

// Update pagination info and buttons
function updatePagination(total, page, perPage) {
    const paginationInfo = document.getElementById('admin-paginationInfo');
    const prevBtn = document.getElementById('admin-prevPageBtn');
    const nextBtn = document.getElementById('admin-nextPageBtn');
    
    if (paginationInfo) {
        const start = (page - 1) * perPage + 1;
        const end = Math.min(page * perPage, total);
        paginationInfo.textContent = `${start}-${end} of ${total}`;
        paginationInfo.dataset.page = page;
    }
    
    if (prevBtn) {
        prevBtn.disabled = page <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = page * perPage >= total;
    }
}

// Update statistics cards
function updateStats(stats) {
    // Only update stats if they haven't been initialized yet or if this is not a lazy loading update
    if (!statsInitialized) {
        const totalRecords = document.getElementById('admin-totalRecords');
        const presentCount = document.getElementById('admin-presentCount');
        const absentCount = document.getElementById('admin-absentCount');
        const lateCount = document.getElementById('admin-lateCount');
        
        if (totalRecords) totalRecords.textContent = stats.total || 0;
        if (presentCount) presentCount.textContent = stats.present || 0;
        if (absentCount) absentCount.textContent = stats.absent || 0;
        if (lateCount) lateCount.textContent = stats.late || 0;
        
        // Mark stats as initialized to prevent updates during lazy loading
        statsInitialized = true;
    }
}

// Show loading state
function showLoading() {
    isLoading = true;
    
    const loadingIndicator = document.getElementById('admin-loading-indicator');
    const attendanceTable = document.getElementById('admin-attendance-table');
    
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (attendanceTable) attendanceTable.style.display = 'none';
    
    // Disable filter controls
    const filterControls = document.querySelectorAll('#admin-filterForm select, #admin-filterForm input, #admin-filterForm button');
    filterControls.forEach(control => {
        control.disabled = true;
    });
}

// Hide loading state
function hideLoading() {
    const loadingIndicator = document.getElementById('admin-loading-indicator');
    const attendanceTable = document.getElementById('admin-attendance-table');
    
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (attendanceTable) attendanceTable.style.display = 'block';
    
    // Enable filter controls
    const filterControls = document.querySelectorAll('#admin-filterForm select, #admin-filterForm input, #admin-filterForm button');
    filterControls.forEach(control => {
        control.disabled = false;
    });
    
    isLoading = false;
}

// Build API URL with all current filters
function buildApiUrl() {
    // Get base API URL - use the attendance report endpoint
    const apiUrl = new URL('/api/attendance/report', window.location.origin);
    
    // Add student search filter
    const studentSearch = document.getElementById('admin-studentSearch');
    if (studentSearch && studentSearch.value.trim()) {
        apiUrl.searchParams.append('student', studentSearch.value.trim());
    }
    
    // Add class filter
    const classSelect = document.getElementById('admin-classSelect');
    if (classSelect && classSelect.value) {
        apiUrl.searchParams.append('class_id', classSelect.value);
    }
    
    // Add instructor filter
    const instructorSelect = document.getElementById('admin-instructorSelect');
    if (instructorSelect && instructorSelect.value) {
        apiUrl.searchParams.append('instructor_id', instructorSelect.value);
    }
    
    // Add status filter
    const statusSelect = document.getElementById('admin-statusSelect');
    if (statusSelect && statusSelect.value) {
        apiUrl.searchParams.append('status', statusSelect.value);
    }
    
    // Add date range filters
    const startDate = document.getElementById('admin-dateRangeStart');
    if (startDate && startDate.value) {
        apiUrl.searchParams.append('start_date', startDate.value);
    }
    
    const endDate = document.getElementById('admin-dateRangeEnd');
    if (endDate && endDate.value) {
        apiUrl.searchParams.append('end_date', endDate.value);
    }
    
    // Add pagination parameters
    const paginationInfo = document.getElementById('admin-paginationInfo');
    const rowsPerPage = document.getElementById('admin-rowsPerPageSelect');
    
    if (paginationInfo && paginationInfo.dataset.page) {
        apiUrl.searchParams.append('page', paginationInfo.dataset.page);
    }
    
    if (rowsPerPage && rowsPerPage.value) {
        apiUrl.searchParams.append('per_page', rowsPerPage.value);
    }
    
    return apiUrl.toString();
}

// Main data loading function
async function loadAttendanceData(forceRefresh = false) {
    if (isLoading) return;
    
    // Reset stats initialization flag if this is not a lazy loading request
    if (forceRefresh) {
        statsInitialized = false;
    }
    
    // Show loading indicator
    showLoading();
    
    try {
        // Build API URL with all current filters
        const apiUrl = buildApiUrl();
        
        // Fetch data from API
        const response = await fetch(apiUrl);
        
        // Check for non-OK response
        if (!response.ok) {
            appLog(`API error: ${response.status} ${response.statusText}`, 'error');
            console.error('API error details:', { status: response.status, statusText: response.statusText });
            
            // Try to read the error response body
            try {
                const errorData = await response.text();
                console.error('API error response body:', errorData);
            } catch (readError) {
                console.error('Could not read error response body:', readError);
            }
            
            // Clear table and show error
            updateTable([]);
            
            // Show toast notification
            showToast(`Error loading attendance records: ${response.statusText}`, 'error');
            return;
        }
        
        // Parse response data
        const data = await response.json();
        
        // Log initialization message on first successful load
        if (!window.adminViewAttendanceInitialized) {
            appLog('', 'init');
            window.adminViewAttendanceInitialized = true;
        }
        
        // Check for error in response data
        if (data.error) {
            appLog(`API returned error: ${data.error}`, 'error');
            
            // Clear table and show error
            updateTable([]);
            
            // Show toast notification
            showToast(`Error loading attendance records: ${data.error}`, 'error');
            return;
        }
        
        // Update table with the data
        const records = data.records || [];
        updateTable(records);
        
        // Update pagination
        if (data.pagination) {
            updatePagination(
                data.pagination.total || 0,
                data.pagination.page || 1,
                data.pagination.per_page || 50
            );
        }
        
        // Update stats
        if (data.stats) {
            updateStats(data.stats);
        }
    } catch (error) {
        appLog(`Error fetching attendance data: ${error.message}`, 'error');
        
        // Update table with empty data
        updateTable([]);
        
        // Show toast notification
        showToast('Error loading attendance records. Please try again later.', 'error');
    } finally {
        // Hide loading indicator
        hideLoading();
    }
}

// View attendance record details
function viewAttendanceRecord(id) {
    // Get the record details modal
    const modal = document.getElementById('attendanceDetailModal');
    if (!modal) return;
    
    // Show the modal first
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Fetch record details from API
    fetch(`/api/attendance/report/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Populate modal with record details
            const record = data;
            if (!record) {
                throw new Error('No record data received');
            }
            
            // Update modal fields
            document.getElementById('attendanceDetailStudentName').textContent = record.student_name || '-';
            document.getElementById('attendanceDetailClassName').textContent = record.class_name || '-';
            document.getElementById('attendanceDetailInstructorName').textContent = record.instructor_name || '-';
            document.getElementById('attendanceDetailDate').textContent = window.AttendanceUtils.formatDateForDisplay(record.date) || '-';
            
            // Set status badge
            const statusBadge = document.getElementById('attendanceDetailStatus');
            if (statusBadge) {
                const status = record.status ? record.status.toLowerCase() : 'unknown';
                const badgeClass = window.AttendanceUtils.getBadgeClass(status);
                const statusDisplay = window.AttendanceUtils.getStatusDisplay(status);
                
                statusBadge.className = `badge ${badgeClass}`;
                statusBadge.textContent = statusDisplay;
            }
            
            // Set comment
            document.getElementById('attendanceDetailComment').textContent = record.comment || 'No comments';
        })
        .catch(error => {
            console.error('Error fetching attendance record:', error);
            
            // Show error in modal
            modal.querySelector('.modal-body').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong>Error:</strong> ${error.message || 'Failed to load attendance record'}
                </div>
            `;
            
            // Show toast notification
            showToast(`Error loading record: ${error.message}`, 'error');
        });
}

// Edit attendance record
function editAttendanceRecord(id) {
    // Get the edit modal
    const modal = document.getElementById('editAttendanceModal');
    if (!modal) return;
    
    // Reset form and clear validation errors
    const form = document.getElementById('editAttendanceForm');
    if (form) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }
    
    // Set the record ID in the form
    const recordIdInput = document.getElementById('editAttendanceId');
    if (recordIdInput) {
        recordIdInput.value = id;
    }
    
    // Show loading state in modal
    modal.querySelector('.modal-body').innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Loading attendance record...</p>
        </div>
    `;
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Fetch record details from API
    fetch(`/api/attendance/report/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Populate form with record details
            const record = data;
            if (!record) {
                throw new Error('No record data received');
            }
            
            // Restore the original form content
            modal.querySelector('.modal-body').innerHTML = `
                <input type="hidden" id="editAttendanceId" value="${id}">
                <div class="mb-3">
                    <label class="form-label">Student</label>
                    <p class="form-control-plaintext" id="editStudentName">${record.student_name || '-'}</p>
                </div>
                <div class="mb-3">
                    <label class="form-label">Class</label>
                    <p class="form-control-plaintext" id="editClassName">${record.class_name || '-'}</p>
                </div>
                <div class="mb-3">
                    <label class="form-label">Instructor</label>
                    <p class="form-control-plaintext" id="editInstructorName">${record.instructor_name || '-'}</p>
                </div>
                <div class="mb-3">
                    <label class="form-label">Date</label>
                    <p class="form-control-plaintext" id="editDate">${window.AttendanceUtils.formatDateForDisplay(record.date) || '-'}</p>
                </div>
                <div class="mb-3">
                    <label for="editStatus" class="form-label">Status</label>
                    <select class="form-select" id="editStatus" required>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label for="editComment" class="form-label">Comment <span class="text-danger">*</span></label>
                    <textarea class="form-control" id="editComment" rows="3" required>${record.comment || ''}</textarea>
                    <div class="form-text text-danger">
                        <i class="bi bi-info-circle"></i> You must provide a comment when editing attendance records to explain the reason for the change.
                    </div>
                </div>
            `;
            
            // Set the current status in the dropdown
            const statusSelect = document.getElementById('editStatus');
            if (statusSelect && record.status) {
                const options = statusSelect.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value.toLowerCase() === record.status.toLowerCase()) {
                        statusSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error fetching attendance record:', error);
            
            // Show error in modal
            modal.querySelector('.modal-body').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong>Error:</strong> ${error.message || 'Failed to load attendance record'}
                </div>
            `;
            
            // Show toast notification
            showToast(`Error loading record: ${error.message}`, 'error');
        });
}

// Save attendance changes
function saveAttendanceChanges() {
    // Get form data
    const form = document.getElementById('editAttendanceForm');
    if (!form) return;
    
    // Get record ID
    const recordId = document.getElementById('editAttendanceId').value;
    if (!recordId) {
        console.error('No record ID found');
        return;
    }
    
    // Get status and comment
    const status = document.getElementById('editStatus').value;
    const comment = document.getElementById('editComment').value;
    
    // Validate comment - prevent empty, whitespace-only, or single-character comments
    const commentElement = document.getElementById('editComment');
    const trimmedComment = comment.trim();
    let isValid = true;
    
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
    
    // Show loading state in button
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Saving...';
    }
    
    // Send update to API
    fetch(`/api/attendance/report/${recordId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content || ''
        },
        body: JSON.stringify({
            status: status,
            comment: comment
        }),
        credentials: 'same-origin'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Hide the modal
        const modal = document.getElementById('editAttendanceModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
        
        // Show success message
        showToast('Attendance record updated successfully', 'success');
        
        // Reload data
        loadAttendanceData(true);
    })
    .catch(error => {
        console.error('Error updating attendance record:', error);
        
        // Show error notification
        showToast(`Error updating record: ${error.message}`, 'error');
    })
    .finally(() => {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Save Changes';
        }
    });
}

// Show archive confirmation
function showArchiveConfirmation(recordId) {
    // Get the archive confirmation modal
    const modal = document.getElementById('archiveConfirmModal');
    if (!modal) return;
    
    // Show the modal first
    const archiveModal = new bootstrap.Modal(modal);
    archiveModal.show();
    
    // Fetch record details from API
    fetch(`/api/attendance/report/${recordId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(record => {
            // Update the fields in the existing modal
            document.getElementById('archiveStudentName').textContent = record.student_name || '-';
            document.getElementById('archiveClassName').textContent = record.class_name || '-';
            
            // Store the record ID in the hidden input
            document.getElementById('archiveAttendanceId').value = recordId;
            
            // Reset the form fields
            document.getElementById('archiveReason').value = '';
            document.getElementById('archiveComment').value = '';
            
            // Set up the confirm button to call the archive function
            const confirmBtn = document.getElementById('confirmArchiveBtn');
            if (confirmBtn) {
                // Remove any existing event listeners
                const newBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
                
                // Add new event listener
                newBtn.addEventListener('click', function() {
                    archiveAttendanceRecord(recordId);
                });
            }
        })
        .catch(error => {
            console.error('Error fetching attendance record:', error);
            
            // Show error in modal
            const modalBody = document.querySelector('#archiveConfirmModal .modal-body');
            if (modalBody) {
                // Show error message but preserve the structure
                const errorAlert = document.createElement('div');
                errorAlert.className = 'alert alert-danger mb-3';
                errorAlert.innerHTML = `
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong>Error:</strong> ${error.message || 'Failed to load attendance record'}
                `;
                
                // Insert at the top of the modal body
                modalBody.insertBefore(errorAlert, modalBody.firstChild);
            }
        });
}

// Archive attendance record
function archiveAttendanceRecord(recordId) {
    // Get reason and comment from the modal
    const reason = document.getElementById('archiveReason').value;
    const comment = document.getElementById('archiveComment').value;
    
    // Get student name and class name from the modal
    const studentName = document.getElementById('archiveStudentName').textContent;
    const className = document.getElementById('archiveClassName').textContent;
    
    // Validate reason
    if (!reason) {
        showToast('Please select a reason for archiving', 'warning');
        return;
    }
    
    // Show loading state in button
    const confirmBtn = document.getElementById('confirmArchiveBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Archiving...';
    }
    
    // Send archive request to API
    fetch(`/api/attendance/report/${recordId}/archive`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content || ''
        },
        body: JSON.stringify({
            reason: reason,
            comment: comment
        }),
        credentials: 'same-origin'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Hide the modal
        const modal = document.getElementById('archiveConfirmModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
        
        // Create a custom success message with archive link
        const successMessage = `
            <div>Attendance "${studentName}" "${className}" archived successfully</div>
            <div class="mt-2">
                <a href="/admin/archive-view?type=attendance" class="btn btn-sm btn-outline-primary" 
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
            const titleElement = statusToast.querySelector('.toast-header strong');
            if (titleElement) {
                titleElement.textContent = 'Success';
            }
            
            // Set the message with HTML content
            const toastMessage = document.getElementById('toastMessage');
            if (toastMessage) {
                toastMessage.innerHTML = successMessage;
            }
            
            // Show the toast
            const toast = new bootstrap.Toast(statusToast);
            toast.show();
        } else {
            // Fallback to simple toast
            showToast(`Attendance "${studentName}" "${className}" archived successfully`, 'success');
        }
        
        // Reload data
        loadAttendanceData(true);
    })
    .catch(error => {
        console.error('Error archiving attendance record:', error);
        
        // Show error notification
        showToast(`Error archiving record: ${error.message}`, 'error');
    })
    .finally(() => {
        // Reset button state
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Archive';
        }
    });
}

// Initialize default filters
function initializeDefaultFilters() {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    // Set date inputs
    const startDateInput = document.getElementById('admin-dateRangeStart');
    const endDateInput = document.getElementById('admin-dateRangeEnd');
    
    if (startDateInput) startDateInput.value = formatDate(thirtyDaysAgo);
    if (endDateInput) endDateInput.value = formatDate(today);
}

// Export to CSV
async function exportToCsv() {
    const exportBtn = document.getElementById('admin-exportCsvBtn');
    
    try {
        // Show toast notification
        showToast('Preparing CSV export...', 'info');
        
        // Get all attendance data without pagination
        // Convert the string URL to a URL object
        const apiUrl = new URL(buildApiUrl(), window.location.origin);
        
        // Add parameter to get all records without pagination
        apiUrl.searchParams.set('per_page', '1000');
        // Remove any page parameter to get all records
        apiUrl.searchParams.delete('page');
        
        // Show loading state
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Exporting...';
        }
        
        // Fetch the attendance data
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            let errorMessage = `Export failed with status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // Fallback to default error message
            }
            throw new Error(errorMessage);
        }
        
        // Parse the JSON response
        const data = await response.json();
        
        // Define CSV headers
        const headers = [
            'Class Name',
            'Class ID',
            'Student Name',
            'Student ID',
            'Date',
            'Status',
            'Instructor Name',
            'Comments'
        ];
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        // Add each record as a row
        if (data.records && Array.isArray(data.records)) {
            data.records.forEach(record => {
                // Escape fields that might contain commas
                const escapeCsvField = (field) => {
                    if (field === null || field === undefined) return '';
                    const str = String(field);
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return '"' + str.replace(/"/g, '""') + '"';
                    }
                    return str;
                };
                
                const row = [
                    escapeCsvField(record.class_name),
                    escapeCsvField(record.class_id),
                    escapeCsvField(record.student_name),
                    escapeCsvField(record.student_id),
                    escapeCsvField(record.date),
                    escapeCsvField(record.status),
                    escapeCsvField(record.instructor_name),
                    escapeCsvField(record.comment)
                ];
                
                csvContent += row.join(',') + '\n';
            });
        }
        
        // Generate filename with current date
        const filename = `attendance_records_${new Date().toISOString().slice(0, 10)}.csv`;
        
        // Create a blob with the CSV content
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        
        // Create a temporary link and trigger the download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show success notification
        showToast(`CSV exported successfully as ${filename}`, 'success');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast(`Failed to export data: ${error.message}`, 'error');
    } finally {
        // Reset button state
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i class="bi bi-arrow-up-right me-1"></i> Export CSV';
        }
    }
}

// Create the admin attendance module
const AdminAttendance = {
    init: function() {
        // Initialize date filters with default values
        initializeDefaultFilters();
        
        // Export CSV button
        const exportCsvBtn = document.getElementById('admin-exportCsvBtn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', function() {
                // Disable the button to prevent multiple clicks
                exportCsvBtn.disabled = true;
                exportCsvBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Exporting...';
                
                // Call the export function
                exportToCsv();
                
                // Re-enable the button after a delay
                setTimeout(() => {
                    exportCsvBtn.disabled = false;
                    exportCsvBtn.innerHTML = '<i class="bi bi-arrow-up-right me-1"></i> Export CSV';
                }, 2000);
            });
        }
        
        // Attach event listeners to filter controls
        const selectFilters = ['admin-classSelect', 'admin-instructorSelect', 'admin-statusSelect'];
        selectFilters.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.addEventListener('change', function() {
                    loadAttendanceData(true);
                });
            }
        });
        
        // Student search input handler with debounce
        const studentSearch = document.getElementById('admin-studentSearch');
        if (studentSearch) {
            studentSearch.addEventListener('input', function() {
                // Use debounce if available, otherwise use setTimeout
                if (window.AttendanceUtils && window.AttendanceUtils.debounce) {
                    window.AttendanceUtils.debounce(loadAttendanceData, 500)(true);
                } else {
                    // Simple debounce implementation
                    clearTimeout(this.searchTimeout);
                    this.searchTimeout = setTimeout(() => {
                        loadAttendanceData(true);
                    }, 500);
                }
            });
        }
        
        // Date range handlers
        const dateInputs = ['admin-dateRangeStart', 'admin-dateRangeEnd'];
        dateInputs.forEach(id => {
            const dateInput = document.getElementById(id);
            if (dateInput) {
                dateInput.addEventListener('change', function() {
                    loadAttendanceData(true);
                });
            }
        });
        
        // Rows per page handler
        const rowsPerPage = document.getElementById('admin-rowsPerPageSelect');
        if (rowsPerPage) {
            rowsPerPage.addEventListener('change', function() {
                // Reset to page 1 when changing rows per page
                const paginationInfo = document.getElementById('admin-paginationInfo');
                if (paginationInfo) {
                    paginationInfo.dataset.page = 1;
                }
                loadAttendanceData(true);
            });
        }
        
        // Pagination handlers
        const prevPageBtn = document.getElementById('admin-prevPageBtn');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function() {
                const paginationInfo = document.getElementById('admin-paginationInfo');
                if (!paginationInfo) return;
                
                const currentPage = parseInt(paginationInfo.dataset.page || '1');
                if (currentPage > 1) {
                    paginationInfo.dataset.page = currentPage - 1;
                    loadAttendanceData(false);  // Don't reset stats on pagination
                }
            });
        }
        
        const nextPageBtn = document.getElementById('admin-nextPageBtn');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function() {
                const paginationInfo = document.getElementById('admin-paginationInfo');
                if (!paginationInfo) return;
                
                const currentPage = parseInt(paginationInfo.dataset.page || '1');
                paginationInfo.dataset.page = currentPage + 1;
                loadAttendanceData(false);  // Don't reset stats on pagination
            });
        }
        
        // Clear filters button
        const clearFiltersBtn = document.getElementById('admin-clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', function() {
                const filterForm = document.getElementById('admin-filterForm');
                if (filterForm) {
                    filterForm.reset();
                    initializeDefaultFilters();
                    
                    // Reset pagination to page 1
                    const paginationInfo = document.getElementById('admin-paginationInfo');
                    if (paginationInfo) {
                        paginationInfo.dataset.page = 1;
                    }
                    
                    loadAttendanceData(true);
                }
            });
        }
        
        // Edit form submit handler
        const editForm = document.getElementById('editAttendanceForm');
        if (editForm) {
            editForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveAttendanceChanges();
            });
            
            // Add event listener to clear validation error when user types in comment field
            const commentField = document.getElementById('editComment');
            if (commentField) {
                commentField.addEventListener('input', function() {
                    this.classList.remove('is-invalid');
                });
            }
        }
        
        // Archive confirmation button
        const confirmArchiveBtn = document.getElementById('confirmArchiveBtn');
        if (confirmArchiveBtn) {
            confirmArchiveBtn.addEventListener('click', archiveAttendanceRecord);
        }
        
        // Lazy loading implementation - detect when user scrolls to bottom of table
        const tableContainer = document.querySelector('.table-responsive');
        if (tableContainer) {
            tableContainer.addEventListener('scroll', function() {
                // Check if we're at the bottom of the table
                if (this.scrollHeight - this.scrollTop <= this.clientHeight + 100) {
                    // Check if we're already loading or if there's no lazy loading row
                    if (isLoading || !document.getElementById('admin-lazyLoadingRow')) return;
                    
                    // Get current page and increment
                    const paginationInfo = document.getElementById('admin-paginationInfo');
                    if (!paginationInfo) return;
                    
                    const currentPage = parseInt(paginationInfo.dataset.page || '1');
                    paginationInfo.dataset.page = currentPage + 1;
                    
                    // Load next page without resetting stats
                    loadAttendanceData(false);
                }
            });
        }
        
        // Initial data load
        loadAttendanceData(true);
    },
    
    // Public methods for window event handlers
    viewAttendance: function(id) {
        viewAttendanceRecord(id);
    },
    
    editAttendance: function(id) {
        editAttendanceRecord(id);
    },
    
    archiveAttendance: function(id) {
        showArchiveConfirmation(id);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the admin view attendance page
    if (document.getElementById('admin-tableBody')) {
        window.AdminAttendance = AdminAttendance;
        AdminAttendance.init();
    }
});