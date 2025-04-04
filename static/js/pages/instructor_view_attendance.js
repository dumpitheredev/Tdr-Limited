// Define utility functions
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getBadgeClass(status) {
    switch (status.toLowerCase()) {
        case 'present': return 'bg-success-subtle text-success';
        case 'absent': return 'bg-danger-subtle text-danger';
        case 'late': return 'bg-warning-subtle text-warning';
        default: return 'bg-secondary-subtle text-secondary';
    }
}

function getStatusDisplay(status) {
    const s = status.toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// UI update functions
function updateTable(records) {
    const tableBody = document.getElementById('instructor-tableBody');
        if (!tableBody) return;

    if (!records || records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No attendance records found</td></tr>';
        return;
    }

            let html = '';
    records.forEach(record => {
        const status = record.status ? record.status.toLowerCase() : 'unknown';
        const badgeClass = getBadgeClass(status);
        const statusDisplay = getStatusDisplay(status);
                
                html += `
                <tr>
            <td>${formatDateForDisplay(record.date)}</td>
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
            <td>
                <span class="badge ${badgeClass}">${statusDisplay}</span>
                    </td>
                    <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-link p-0" onclick="window.InstructorAttendance.viewAttendance('${record.id}')">
                        <i class="bi bi-eye" style="color: #191970;"></i>
                            </button>
                    <button class="btn btn-link p-0" onclick="window.InstructorAttendance.editAttendance('${record.id}')">
                        <i class="bi bi-pencil" style="color: #191970;"></i>
                            </button>
                    <button class="btn btn-link p-0" onclick="window.InstructorAttendance.archiveAttendance('${record.id}')">
                        <i class="bi bi-archive" style="color: #191970;"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            });
        
            tableBody.innerHTML = html;
}

function updatePagination(total, page, perPage) {
    const prevPageBtn = document.getElementById('instructor-prevPageBtn');
    const nextPageBtn = document.getElementById('instructor-nextPageBtn');
    const paginationInfo = document.getElementById('instructor-paginationInfo');
    
    if (!paginationInfo || !prevPageBtn || !nextPageBtn) return;
    
    // Store current page in data attribute
    paginationInfo.dataset.page = page;
        
        // Update pagination info text
    const start = total > 0 ? (page - 1) * perPage + 1 : 0;
    const end = Math.min(start + perPage - 1, total);
    paginationInfo.textContent = `${start}-${end} of ${total}`;

    // Enable/disable pagination buttons
    prevPageBtn.disabled = page <= 1;
    nextPageBtn.disabled = page >= Math.ceil(total / perPage);
}

function updateStats(stats) {
    if (!stats) return;
    
    const elements = {
        total: document.getElementById('instructor-totalRecords'),
        present: document.getElementById('instructor-presentCount'),
        absent: document.getElementById('instructor-absentCount'),
        late: document.getElementById('instructor-lateCount')
    };

    if (elements.total) elements.total.textContent = stats.total || '0';
    if (elements.present) elements.present.textContent = stats.present || '0';
    if (elements.absent) elements.absent.textContent = stats.absent || '0';
    if (elements.late) elements.late.textContent = stats.late || '0';
}

function showLoading() {
    const loadingIndicator = document.getElementById('instructor-loading-indicator');
    const tableContainer = document.getElementById('instructor-attendance-table');
    
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (tableContainer) tableContainer.style.display = 'none';
}

function hideLoading() {
    const loadingIndicator = document.getElementById('instructor-loading-indicator');
    const tableContainer = document.getElementById('instructor-attendance-table');
    
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
}

// Data functions
function buildApiUrl() {
    const params = new URLSearchParams();
    
    // Get current page from pagination info element
    const paginationInfo = document.getElementById('instructor-paginationInfo');
    const page = paginationInfo && paginationInfo.dataset.page ? paginationInfo.dataset.page : '1';
    
    // Get rows per page value
    const rowsPerPage = document.getElementById('instructor-rowsPerPageSelect');
    const perPage = rowsPerPage ? rowsPerPage.value : '10';
    
    // Add pagination parameters
    params.append('page', page);
    params.append('per_page', perPage);
    
    // Add filter parameters
    const classSelect = document.getElementById('instructor-classSelect');
    const studentSearch = document.getElementById('instructor-studentSearch');
    const dateStart = document.getElementById('instructor-dateRangeStart');
    const dateEnd = document.getElementById('instructor-dateRangeEnd');
    
    if (classSelect && classSelect.value) params.append('class_id', classSelect.value);
    if (studentSearch && studentSearch.value) params.append('student_name', studentSearch.value);
    if (dateStart && dateStart.value) params.append('date_start', dateStart.value);
    if (dateEnd && dateEnd.value) params.append('date_end', dateEnd.value);

    return `/api/attendance?${params.toString()}`;
}

function updateUrlWithFilters() {
    const searchParams = new URLSearchParams(window.location.search);
    
    // Get filter values
    const classSelect = document.getElementById('instructor-classSelect');
    const studentSearch = document.getElementById('instructor-studentSearch');
    const dateStart = document.getElementById('instructor-dateRangeStart');
    const dateEnd = document.getElementById('instructor-dateRangeEnd');
    const paginationInfo = document.getElementById('instructor-paginationInfo');
    const rowsPerPage = document.getElementById('instructor-rowsPerPageSelect');
    
    // Clear existing parameters
    searchParams.delete('class_id');
    searchParams.delete('student_name');
    searchParams.delete('date_start');
    searchParams.delete('date_end');
    searchParams.delete('page');
    searchParams.delete('per_page');
    
    // Add new parameters if they have values
    if (classSelect && classSelect.value) searchParams.set('class_id', classSelect.value);
    if (studentSearch && studentSearch.value) searchParams.set('student_name', studentSearch.value);
    if (dateStart && dateStart.value) searchParams.set('date_start', dateStart.value);
    if (dateEnd && dateEnd.value) searchParams.set('date_end', dateEnd.value);
    if (paginationInfo && paginationInfo.dataset.page) searchParams.set('page', paginationInfo.dataset.page);
    if (rowsPerPage && rowsPerPage.value) searchParams.set('per_page', rowsPerPage.value);
    
    // Update URL without refreshing page
    const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
}

// Main data loading function
function loadAttendanceData() {
    showLoading();
    updateUrlWithFilters();
    
    // Cache busting for fetch
    const fetchOptions = {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    };
    
    fetch(buildApiUrl(), fetchOptions)
        .then(response => {
            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
            return response.json();
        })
        .then(data => {
            updateTable(data.records);
            updatePagination(data.total, data.page, data.per_page);
            updateStats(data.stats);
            hideLoading();
        })
        .catch(error => {
            // Show user-friendly error message
            showToast('Failed to load attendance data', 'error');
            hideLoading();
        });
}

// Action functions
function viewAttendanceRecord(id) {
    fetch(`/api/attendance/${id}`)
        .then(response => response.json())
        .then(data => {
            const record = data.record;
            
            // Populate modal fields
            document.getElementById('attendanceDetailStudentName').textContent = record.student_name;
            document.getElementById('attendanceDetailClassName').textContent = record.class_name || record.class_id;
            document.getElementById('attendanceDetailDate').textContent = formatDateForDisplay(record.date);
            
            const statusElement = document.getElementById('attendanceDetailStatus');
            statusElement.textContent = getStatusDisplay(record.status);
            statusElement.className = `badge ${getBadgeClass(record.status)}`;
            
            document.getElementById('attendanceDetailComment').textContent = record.comment || 'No comment provided';
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('attendanceDetailModal'));
                modal.show();
        })
        .catch(error => {
            // Show user-friendly error message 
            showToast('Failed to fetch attendance details', 'error');
            hideModal();
        });
}

function editAttendanceRecord(id) {
    fetch(`/api/attendance/${id}`)
        .then(response => response.json())
        .then(data => {
            const record = data.record;
            
            // Populate form fields
            document.getElementById('editAttendanceId').value = record.id;
            document.getElementById('editStudentName').textContent = record.student_name;
            document.getElementById('editClassName').textContent = record.class_name || record.class_id;
            document.getElementById('editDate').textContent = formatDateForDisplay(record.date);
            
            // Set the status dropdown value
            const statusSelect = document.getElementById('editStatus');
            if (statusSelect) {
                statusSelect.value = record.status.toLowerCase();
            }
            
            document.getElementById('editComment').value = record.comment || '';
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('editAttendanceModal'));
                modal.show();
        })
        .catch(error => {
            // Show user-friendly error message
            showToast('Failed to fetch attendance details', 'error');
            hideModal();
        });
    }

function saveAttendanceChanges(form) {
    const recordId = document.getElementById('editAttendanceId').value;
        const status = document.getElementById('editStatus').value;
        const comment = document.getElementById('editComment').value;
        
    fetch(`/api/attendance/${recordId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
        body: JSON.stringify({ status, comment })
    })
    .then(response => response.json())
        .then(data => {
        if (data.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editAttendanceModal'));
            if (modal) modal.hide();
            
            // Refresh data
            loadAttendanceData();
            
            // Show success message
            showToast('Attendance record updated successfully', 'success');
        } else {
            throw new Error(data.message || 'Failed to update attendance');
        }
    })
    .catch(error => {
        // Show user-friendly error message
        showToast('Failed to update attendance', 'error');
    });
}

function showArchiveConfirmation(id) {
    fetch(`/api/attendance/${id}`)
        .then(response => response.json())
        .then(data => {
            const record = data.record;
            
            // Populate modal fields
            document.getElementById('archiveAttendanceId').value = record.id;
            document.getElementById('archiveStudentName').textContent = record.student_name;
            document.getElementById('archiveClassName').textContent = record.class_name || record.class_id;
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('archiveConfirmModal'));
            modal.show();
        })
        .catch(error => {
            // Show user-friendly error message
            showToast('Failed to fetch attendance details', 'error');
            hideModal();
        });
}

function archiveAttendanceRecord() {
    const recordId = document.getElementById('archiveAttendanceId').value;
    
    fetch(`/api/attendance/${recordId}/archive`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // Empty body but proper Content-Type
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.message || `Failed to archive attendance (${response.status})`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('archiveConfirmModal'));
            if (modal) modal.hide();
            
            // Refresh data
            loadAttendanceData();
            
            // Show success message
            showToast('Attendance record archived successfully', 'success');
        } else {
            throw new Error(data.message || 'Failed to archive attendance');
        }
    })
    .catch(error => {
        // Show user-friendly error message
        showToast('Failed to archive attendance', 'error');
        hideModal();
    });
}

function initializeDefaultFilters() {
    // If no dates are set, initialize with last 30 days
    const dateStart = document.getElementById('instructor-dateRangeStart');
    const dateEnd = document.getElementById('instructor-dateRangeEnd');
    
    if (dateStart && !dateStart.value) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        dateStart.value = formatDate(thirtyDaysAgo);
    }
    
    if (dateEnd && !dateEnd.value) {
        const today = new Date();
        dateEnd.value = formatDate(today);
    }
}

// Add export CSV functionality
function exportToCsv() {
    // Show a notification that export is being prepared
    showToast('Preparing CSV export...', 'info');
    
    const params = new URLSearchParams();
    
    // Get filter values from the form
    const classSelect = document.getElementById('instructor-classSelect');
    const studentSearch = document.getElementById('instructor-studentSearch');
    const dateStart = document.getElementById('instructor-dateRangeStart');
    const dateEnd = document.getElementById('instructor-dateRangeEnd');
    
    // Add filter parameters
    if (classSelect && classSelect.value) 
        params.append('class_id', classSelect.value);
    if (studentSearch && studentSearch.value) 
        params.append('student_name', studentSearch.value);
    if (dateStart && dateStart.value) 
        params.append('date_start', dateStart.value);
    if (dateEnd && dateEnd.value) 
        params.append('date_end', dateEnd.value);
    
    // Add instructor specific parameters
    params.append('instructor', 'true');
    params.append('export', 'csv');
    
    const exportUrl = `/api/attendance/export?${params.toString()}`;
    
    try {
        const link = document.createElement('a');
        link.href = exportUrl;
        link.setAttribute('download', 'instructor_attendance_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success notification
        showToast('CSV export started', 'success');
    } catch (error) {
        // Show error notification if export fails
        showToast('Failed to export CSV. Please try again.', 'error');
    }
}

// Debounce function for search input
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function showToast(message, type = 'info') {
    // Use the existing toast notification from toast_notification.html
    const statusToast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = statusToast.querySelector('.toast-header i');
    
    if (!statusToast || !toastTitle || !toastMessage || !toastIcon) {
        // Use fallback if toast elements not found
        createCustomToast(message, type);
        return;
    }
    
    // Set appropriate title and icon based on notification type
    if (type === 'error') {
        toastTitle.textContent = 'Error';
        toastIcon.className = 'bi bi-exclamation-circle-fill text-danger me-2';
    } else if (type === 'success') {
        toastTitle.textContent = 'Success';
        toastIcon.className = 'bi bi-check-circle-fill text-success me-2';
    } else {
        toastTitle.textContent = 'Info';
        toastIcon.className = 'bi bi-info-circle-fill text-primary me-2';
    }
    
    // Set the message content
    toastMessage.textContent = message;
    
    // Show the toast using Bootstrap
    const toast = new bootstrap.Toast(statusToast);
    toast.show();
}

// Fallback toast function
function createCustomToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 3000 });
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}

// Create the instructor attendance module
const InstructorAttendance = {
    init: function() {
        // Initialize date filters with default values if needed
        initializeDefaultFilters();
        
        // Setup form event handlers
        const filterForm = document.getElementById('instructor-filterForm');
        if (filterForm) {
            filterForm.addEventListener('submit', function(e) {
                e.preventDefault();
                loadAttendanceData();
            });
        }
        
        // Find and attach event listener to export CSV button
        const exportCsvBtn = document.getElementById('instructor-exportCsvBtn') || 
                           document.querySelector('button[aria-label="Export CSV"]') ||
                           document.querySelector('button[data-action="export"]');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', exportToCsv);
        }
        
        // Class select change handler
        const classSelect = document.getElementById('instructor-classSelect');
        if (classSelect) {
            classSelect.addEventListener('change', function() {
                loadAttendanceData();
            });
        }
        
        // Student search input handler with debounce
        const studentSearch = document.getElementById('instructor-studentSearch');
        if (studentSearch) {
            studentSearch.addEventListener('input', debounce(function() {
                loadAttendanceData();
            }, 500));
        }
        
        // Date range handlers
        const dateInputs = ['instructor-dateRangeStart', 'instructor-dateRangeEnd'];
        dateInputs.forEach(id => {
            const dateInput = document.getElementById(id);
            if (dateInput) {
                dateInput.addEventListener('change', function() {
                    loadAttendanceData();
                });
            }
        });
        
        // Rows per page handler
        const rowsPerPage = document.getElementById('instructor-rowsPerPageSelect');
        if (rowsPerPage) {
            rowsPerPage.addEventListener('change', function() {
                loadAttendanceData();
            });
        }
        
        // Pagination handlers
        const prevPageBtn = document.getElementById('instructor-prevPageBtn');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function() {
                const paginationInfo = document.getElementById('instructor-paginationInfo');
                const currentPage = parseInt(paginationInfo.dataset.page || '1');
                
                if (currentPage > 1) {
                    paginationInfo.dataset.page = currentPage - 1;
                    loadAttendanceData();
                }
            });
        }
        
        const nextPageBtn = document.getElementById('instructor-nextPageBtn');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function() {
                const paginationInfo = document.getElementById('instructor-paginationInfo');
                const currentPage = parseInt(paginationInfo.dataset.page || '1');
                
                paginationInfo.dataset.page = currentPage + 1;
                loadAttendanceData();
            });
        }
        
        // Clear filters button
        const clearFiltersBtn = document.getElementById('instructor-clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', function() {
                const filterForm = document.getElementById('instructor-filterForm');
                if (filterForm) {
                    filterForm.reset();
                    initializeDefaultFilters();
                    loadAttendanceData();
                }
            });
        }
        
        // Edit form submit handler
        const editForm = document.getElementById('editAttendanceForm');
        if (editForm) {
            editForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveAttendanceChanges(this);
            });
        }
        
        // Archive confirmation button
        const confirmArchiveBtn = document.getElementById('confirmArchiveBtn');
        if (confirmArchiveBtn) {
            confirmArchiveBtn.addEventListener('click', function() {
                archiveAttendanceRecord();
            });
        }
        
        // Initial data load
    loadAttendanceData();
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
    // Only initialize if we're on the instructor attendance page
    if (document.getElementById('instructor-tableBody')) {
        InstructorAttendance.init();
        
        // Make the module available globally for event handlers
        window.InstructorAttendance = InstructorAttendance;
    }
});