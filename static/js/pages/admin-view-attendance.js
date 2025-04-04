// Utility functions
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

// Table update
function updateTable(records) {
    const tableBody = document.getElementById('admin-tableBody');
    if (!tableBody) return;

    if (!records || records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No attendance records found</td></tr>';
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
            <td>${record.instructor_name || ''}</td>
            <td>
                <span class="badge ${badgeClass}">${statusDisplay}</span>
            </td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-link p-0" onclick="window.AdminAttendance.viewAttendance('${record.id}')">
                        <i class="bi bi-eye" style="color: #191970;"></i>
                    </button>
                    <button class="btn btn-link p-0" onclick="window.AdminAttendance.editAttendance('${record.id}')">
                        <i class="bi bi-pencil" style="color: #191970;"></i>
                    </button>
                    <button class="btn btn-link p-0" onclick="window.AdminAttendance.archiveAttendance('${record.id}')">
                        <i class="bi bi-archive" style="color: #191970;"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    });
    
    tableBody.innerHTML = html;
}

// Track whether we're currently fetching data
let isLoading = false;

function showLoading(fullPageLoading = true) {
    isLoading = true;
    
    const loadingIndicator = document.getElementById('admin-loading-indicator');
    const tableContainer = document.getElementById('admin-attendance-table');
    const tableBody = document.getElementById('admin-tableBody');
    
    if (fullPageLoading) {
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
        if (tableContainer) tableContainer.style.display = 'none';
    } else {
        if (tableBody) {
            let overlay = document.getElementById('table-loading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'table-loading-overlay';
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.right = '0';
                overlay.style.bottom = '0';
                overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
                overlay.style.display = 'flex';
                overlay.style.justifyContent = 'center';
                overlay.style.alignItems = 'center';
                overlay.style.zIndex = '10';
                
                const spinner = document.createElement('div');
                spinner.className = 'spinner-border text-primary';
                spinner.style.width = '2rem';
                spinner.style.height = '2rem';
                spinner.setAttribute('role', 'status');
                
                const span = document.createElement('span');
                span.className = 'visually-hidden';
                span.textContent = 'Loading...';
                
                spinner.appendChild(span);
                overlay.appendChild(spinner);
                
                const tableParent = tableBody.closest('.table-responsive');
                if (tableParent) {
                    tableParent.style.position = 'relative';
                    tableParent.appendChild(overlay);
                }
            }
            
            overlay.style.display = 'flex';
        }
    }
    
    const paginationControls = document.querySelectorAll('.pagination button, select[id$="rowsPerPageSelect"]');
    paginationControls.forEach(control => {
        control.disabled = true;
    });
}

function hideLoading(fullPageLoading = true) {
    isLoading = false;
    
    const loadingIndicator = document.getElementById('admin-loading-indicator');
    const tableContainer = document.getElementById('admin-attendance-table');
    const tableBody = document.getElementById('admin-tableBody');
    
    if (fullPageLoading) {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
    } else {
        const overlay = document.getElementById('table-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    const paginationControls = document.querySelectorAll('.pagination button, select[id$="rowsPerPageSelect"]');
    paginationControls.forEach(control => {
        if (control.id === 'admin-prevPageBtn' || control.id === 'prev-page-btn') {
            const paginationInfo = document.querySelector('.pagination-info') || 
                                  document.getElementById('admin-paginationInfo');
            if (paginationInfo) {
                const page = parseInt(paginationInfo.dataset.page || '1');
                control.disabled = page <= 1;
            } else {
                control.disabled = false;
            }
        } else if (control.id === 'admin-nextPageBtn' || control.id === 'next-page-btn') {
            const paginationInfo = document.querySelector('.pagination-info') || 
                                  document.getElementById('admin-paginationInfo');
            if (paginationInfo) {
                const page = parseInt(paginationInfo.dataset.page || '1');
                const total = parseInt(paginationInfo.dataset.total || '0');
                const perPage = parseInt(document.getElementById('admin-rowsPerPageSelect')?.value || '5');
                control.disabled = page >= Math.ceil(total / perPage);
            } else {
                control.disabled = false;
            }
        } else {
            control.disabled = false;
        }
    });
}

function updatePagination(total, page, perPage) {
    const paginationDisplay = document.querySelector('.pagination-info') || 
                              document.getElementById('admin-paginationInfo');
    
    const prevBtn = document.querySelector('.prev-page-btn') || 
                    document.getElementById('admin-prevPageBtn');
    
    const nextBtn = document.querySelector('.next-page-btn') || 
                    document.getElementById('admin-nextPageBtn');
    
    if (!paginationDisplay) return;
    
    page = parseInt(page) || 1;
    
    paginationDisplay.dataset.page = page.toString();
    paginationDisplay.dataset.total = total.toString();
    
    const start = total > 0 ? (page - 1) * perPage + 1 : 0;
    const end = Math.min(start + perPage - 1, total);
    
    paginationDisplay.textContent = `${start}-${end} of ${total}`;
    
    if (prevBtn) {
        prevBtn.disabled = page <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = page >= Math.ceil(total / perPage);
    }
}

function updateStats(stats) {
    if (!stats) return;
    
    const elements = {
        total: document.getElementById('admin-totalRecords'),
        present: document.getElementById('admin-presentCount'),
        absent: document.getElementById('admin-absentCount'),
        late: document.getElementById('admin-lateCount')
    };

    // Handle different naming conventions in the stats object
    const totalCount = stats.totalRecords !== undefined ? stats.totalRecords : 
                      (stats.total !== undefined ? stats.total : 0);
                      
    const presentCount = stats.presentCount !== undefined ? stats.presentCount : 
                        (stats.present !== undefined ? stats.present : 0);
                        
    const absentCount = stats.absentCount !== undefined ? stats.absentCount : 
                       (stats.absent !== undefined ? stats.absent : 0);
                       
    const lateCount = stats.lateCount !== undefined ? stats.lateCount : 
                     (stats.late !== undefined ? stats.late : 0);

    // Update the DOM elements with the counts
    if (elements.total) elements.total.textContent = totalCount;
    if (elements.present) elements.present.textContent = presentCount;
    if (elements.absent) elements.absent.textContent = absentCount;
    if (elements.late) elements.late.textContent = lateCount;
}

// Data functions
function buildApiUrl() {
    const params = new URLSearchParams();
    
    const paginationInfo = document.querySelector('.pagination-info') || 
                          document.getElementById('admin-paginationInfo');
    const page = paginationInfo && paginationInfo.dataset.page ? parseInt(paginationInfo.dataset.page) : 1;
    
    const rowsPerPage = document.querySelector('select[name="rows_per_page"]') || 
                        document.getElementById('admin-rowsPerPageSelect');
    const perPage = rowsPerPage ? rowsPerPage.value : '5'; 
    
    params.append('page', page.toString());
    params.append('per_page', perPage);
    
    const classSelect = document.querySelector('select[name="class_id"]') || 
                       document.getElementById('admin-classSelect');
    const instructorSelect = document.querySelector('select[name="instructor_id"]') || 
                            document.getElementById('admin-instructorSelect');
    const statusSelect = document.querySelector('select[name="status"]') || 
                         document.getElementById('admin-statusSelect');
    const studentSearch = document.querySelector('input[name="student_name"]') || 
                          document.getElementById('admin-studentSearch');
    const dateStart = document.querySelector('input[name="date_start"]') || 
                      document.getElementById('admin-dateRangeStart');
    const dateEnd = document.querySelector('input[name="date_end"]') || 
                    document.getElementById('admin-dateRangeEnd');
    
    if (classSelect && classSelect.value && classSelect.value !== 'All Classes') 
        params.append('class_id', classSelect.value);
    if (instructorSelect && instructorSelect.value && instructorSelect.value !== 'All Instructors') 
        params.append('instructor_id', instructorSelect.value);
    if (statusSelect && statusSelect.value && statusSelect.value !== 'All Statuses') 
        params.append('status', statusSelect.value);
    if (studentSearch && studentSearch.value) 
        params.append('student_name', studentSearch.value);
    if (dateStart && dateStart.value) 
        params.append('date_start', dateStart.value);
    if (dateEnd && dateEnd.value) 
        params.append('date_end', dateEnd.value);
    
    params.append('admin', 'true');
    
    // Always exclude archived records in the main attendance view
    params.append('exclude_archived', 'true');

    return `/api/attendance?${params.toString()}`;
}

function updateUrlWithFilters() {
    const searchParams = new URLSearchParams(window.location.search);
    
    const classSelect = document.getElementById('admin-classSelect');
    const instructorSelect = document.getElementById('admin-instructorSelect');
    const statusSelect = document.getElementById('admin-statusSelect');
    const studentSearch = document.getElementById('admin-studentSearch');
    const dateStart = document.getElementById('admin-dateRangeStart');
    const dateEnd = document.getElementById('admin-dateRangeEnd');
    const paginationInfo = document.getElementById('admin-paginationInfo');
    const rowsPerPage = document.getElementById('admin-rowsPerPageSelect');
    
    searchParams.delete('class_id');
    searchParams.delete('instructor_id');
    searchParams.delete('status');
    searchParams.delete('student_name');
    searchParams.delete('date_start');
    searchParams.delete('date_end');
    searchParams.delete('page');
    searchParams.delete('per_page');
    
    if (classSelect && classSelect.value) searchParams.set('class_id', classSelect.value);
    if (instructorSelect && instructorSelect.value) searchParams.set('instructor_id', instructorSelect.value);
    if (statusSelect && statusSelect.value) searchParams.set('status', statusSelect.value);
    if (studentSearch && studentSearch.value) searchParams.set('student_name', studentSearch.value);
    if (dateStart && dateStart.value) searchParams.set('date_start', dateStart.value);
    if (dateEnd && dateEnd.value) searchParams.set('date_end', dateEnd.value);
    if (paginationInfo && paginationInfo.dataset.page) searchParams.set('page', paginationInfo.dataset.page);
    if (rowsPerPage && rowsPerPage.value) searchParams.set('per_page', rowsPerPage.value);
    
    const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
}

// Main data loading function
function loadAttendanceData(isPaginationChange = false) {
    if (isPaginationChange) {
        setTimeout(() => {
            _loadAttendanceData(isPaginationChange);
        }, 100);
    } else {
        _loadAttendanceData(isPaginationChange);
    }
}

// The actual data loading implementation
function _loadAttendanceData(isPaginationChange = false) {
    showLoading(!isPaginationChange);
    updateUrlWithFilters();
    
    const fetchOptions = {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    };
    
    fetch(buildApiUrl(), fetchOptions)
        .then(response => {
            if (!response.ok) {
                if (response.status === 500) {
                    throw new Error('Server error: The server encountered an issue processing the request.');
                } else if (response.status === 404) {
                    throw new Error('Resource not found: The requested data could not be found.');
                } else {
                    throw new Error(`Network response was not ok: ${response.status}`);
                }
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.records) {
                updateTable([]);
                updatePagination(0, 1, 5);
                updateStats({ total: 0, present: 0, absent: 0, late: 0 });
                hideLoading(!isPaginationChange);
                showToast('No attendance data available', 'info');
                return;
            }
            
            const total = data.total_records || 0;
            const page = data.pagination ? (data.pagination.page || 1) : 1;
            const perPage = data.pagination ? (data.pagination.per_page || 5) : 5;
            
            updateTable(data.records);
            updatePagination(total, page, perPage);
            updateStats(data.stats || { total: 0, present: 0, absent: 0, late: 0 });
            hideLoading(!isPaginationChange);
        })
        .catch(error => {
            const tableBody = document.getElementById('admin-tableBody');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
            }
            hideLoading(!isPaginationChange);
            showToast('Error loading attendance data: ' + error.message, 'error');
        });
}

// Action functions
function viewAttendanceRecord(id) {
    if (!id) {
        showToast('Invalid attendance record ID', 'error');
        return;
    }
    
    // First try to get data from the current table
    const existingRecord = findRowById(id);
    
    // If we have the record in the current table, use it without making an API call
    if (existingRecord) {
        // Find all the required elements in the view modal
        const elements = {
            studentName: document.getElementById('attendanceDetailStudentName'),
            className: document.getElementById('attendanceDetailClassName'),
            instructorName: document.getElementById('attendanceDetailInstructorName'),
            date: document.getElementById('attendanceDetailDate'),
            status: document.getElementById('attendanceDetailStatus'),
            comment: document.getElementById('attendanceDetailComment')
        };
        
        if (!elements.studentName || !elements.className || !elements.instructorName || 
            !elements.date || !elements.status || !elements.comment) {
            showToast('Modal elements not found in the DOM', 'error');
            return;
        }
        
        // Populate the modal with data from the table
        elements.studentName.textContent = existingRecord.student_name;
        elements.className.textContent = existingRecord.class_name;
        elements.instructorName.textContent = existingRecord.instructor_name || '';
        
        // Find date from the row cells
        const cells = existingRecord.element.querySelectorAll('td');
        const dateText = cells.length > 0 ? cells[0].textContent.trim() : '';
        elements.date.textContent = dateText;
        
        // Use the status from our cached data
        const status = existingRecord.status.toLowerCase();
        elements.status.textContent = getStatusDisplay(status);
        elements.status.className = `badge ${getBadgeClass(status)}`;
        
        // For comments, we need to check if there's any comment in the row,
        // but since this might not be visible in the table, we'll check API for this
        fetch(`/api/attendance/${id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data && data.record && data.record.comment) {
                elements.comment.textContent = data.record.comment;
            } else {
                elements.comment.textContent = 'No comment provided';
            }
        })
        .catch(() => {
            elements.comment.textContent = 'No comment provided';
        });
        
        // Show the modal
        const modalElement = document.getElementById('attendanceDetailModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
        return;
    }
    
    // If we don't have the record in the table, fetch it from the API
    fetch(`/api/attendance?id=${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load attendance details (${response.status})`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.records || data.records.length === 0) {
                throw new Error('Attendance record not found');
            }
            
            const record = data.records[0];
            
            const elements = {
                studentName: document.getElementById('attendanceDetailStudentName'),
                className: document.getElementById('attendanceDetailClassName'),
                instructorName: document.getElementById('attendanceDetailInstructorName'),
                date: document.getElementById('attendanceDetailDate'),
                status: document.getElementById('attendanceDetailStatus'),
                comment: document.getElementById('attendanceDetailComment')
            };
            
            if (!elements.studentName || !elements.className || !elements.instructorName || 
                !elements.date || !elements.status || !elements.comment) {
                throw new Error('Modal elements not found in the DOM');
            }
            
            elements.studentName.textContent = record.student_name;
            elements.className.textContent = record.class_name || record.class_id;
            elements.instructorName.textContent = record.instructor_name || '';
            elements.date.textContent = formatDateForDisplay(record.date);
            
            elements.status.textContent = getStatusDisplay(record.status);
            elements.status.className = `badge ${getBadgeClass(record.status)}`;
            
            elements.comment.textContent = record.comment || 'No comment provided';
            
            const modalElement = document.getElementById('attendanceDetailModal');
            if (!modalElement) {
                throw new Error('Modal element not found');
            }
            
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        })
        .catch(error => {
            showToast(`Error: ${error.message}`, 'error');
        });
}

function findRowById(id) {
    // First try to find the row
    const tableBody = document.getElementById('admin-tableBody');
    if (!tableBody) return null;
    
    const rows = tableBody.querySelectorAll('tr');
    let targetRow = null;
    
    for (let i = 0; i < rows.length; i++) {
        const actionButtons = rows[i].querySelectorAll(`button, a`);
        for (let button of actionButtons) {
            if (button.getAttribute('onclick') && button.getAttribute('onclick').includes(id)) {
                targetRow = rows[i];
                break;
            }
        }
        if (targetRow) break;
    }
    
    if (!targetRow) return null;
    
    // Extract the record data from the row
    try {
        const cells = targetRow.querySelectorAll('td');
        if (cells.length < 5) return null;
        
        const studentCell = cells[1];
        const classCell = cells[2];
        const instructorCell = cells[3];
        const statusCell = cells[4];
        
        // Get student name from the cell content
        const studentName = studentCell.querySelector('div.d-flex strong') 
            ? studentCell.querySelector('div.d-flex strong').textContent.trim()
            : studentCell.textContent.trim();
        
        // Get class name
        const className = classCell.textContent.trim();
        
        // Get instructor name
        const instructorName = instructorCell.textContent.trim();
        
        // Get status
        const status = statusCell.querySelector('.badge') 
            ? statusCell.querySelector('.badge').textContent.trim()
            : statusCell.textContent.trim();
        
        return {
            id: id,
            element: targetRow,
            student_name: studentName,
            class_name: className,
            instructor_name: instructorName,
            status: status
        };
    } catch (e) {
    return null;
    }
}

function updateRowWithRecord(record) {
    const existingRecord = findRowById(record.id);
    if (!existingRecord) {
        return false;
    }
    
    const status = record.status ? record.status.toLowerCase() : 'unknown';
    const badgeClass = getBadgeClass(status);
    const statusDisplay = getStatusDisplay(status);
    
    const cells = existingRecord.element.querySelectorAll('td');
    if (cells.length >= 5) {
        cells[0].textContent = formatDateForDisplay(record.date);
        
        const statusBadge = cells[4].querySelector('.badge');
        if (statusBadge) {
            statusBadge.textContent = statusDisplay;
            statusBadge.className = `badge ${badgeClass}`;
        }
    }
    
    return true;
}

function removeRowById(id) {
    const record = findRowById(id);
    if (!record) {
        return false;
    }
    
    const tableBody = document.getElementById('admin-tableBody');
    if (!tableBody) return false;
    
    tableBody.removeChild(record.element);
    
    if (tableBody.children.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No attendance records found</td></tr>';
    }
    
    return true;
}

function editAttendanceRecord(id) {
    if (!id) {
        showToast('Invalid attendance record ID', 'error');
        return;
    }
    
    // showToast('Loading attendance details...', 'info');
    
    fetch(`/api/attendance/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to load attendance details (${response.status})`);
        }
        return response.json();
    })
    .then(data => {
        if (!data || !data.record) {
            throw new Error('Attendance record not found');
        }
        
        const record = data.record;
        
        const elements = {
            id: document.getElementById('editAttendanceId'),
            studentName: document.getElementById('editStudentName'),
            className: document.getElementById('editClassName'),
            instructorName: document.getElementById('editInstructorName'),
            date: document.getElementById('editDate'),
            status: document.getElementById('editStatus'),
            comment: document.getElementById('editComment')
        };
        
        if (!elements.id || !elements.studentName || !elements.className || !elements.instructorName || 
            !elements.date || !elements.status || !elements.comment) {
            throw new Error('Modal elements not found in the DOM');
        }
        
        elements.id.value = record.id;
        elements.studentName.textContent = record.student_name;
        elements.className.textContent = record.class_name || record.class_id;
        elements.instructorName.textContent = record.instructor_name || '';
        elements.date.textContent = formatDateForDisplay(record.date);
        
        if (record.status) {
            elements.status.value = record.status.toLowerCase();
        }
        
        elements.comment.value = record.comment || '';
        
        const modalElement = document.getElementById('editAttendanceModal');
        if (!modalElement) {
            throw new Error('Modal element not found');
        }
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    })
    .catch(error => {
        showToast(`Error: ${error.message}`, 'error');
    });
}

function saveAttendanceChanges() {
    const idElement = document.getElementById('editAttendanceId');
    const statusElement = document.getElementById('editStatus');
    const commentElement = document.getElementById('editComment');
    
    if (!idElement || !statusElement) {
        showToast('Cannot find form elements', 'error');
        return;
    }
    
    const recordId = idElement.value;
    const newStatus = statusElement.value.toLowerCase();
    const comment = commentElement ? commentElement.value : '';
    
    if (!recordId) {
        showToast('Missing record ID', 'error');
        return;
    }
    
    // Get the current record and store its status before updating
    const existingRecord = findRowById(recordId);
    const oldStatus = existingRecord ? existingRecord.status.toLowerCase() : '';
    
    // Show loading state
    const submitBtn = document.querySelector('#editAttendanceForm button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    
    showToast('Saving changes...', 'info');
    
    fetch(`/api/attendance/${recordId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            status: newStatus, 
            comment,
            admin: true
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned error (${response.status})`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.success) {
            throw new Error(data.message || 'Failed to update attendance');
        }
        
        // Hide the edit modal
        const modalElement = document.getElementById('editAttendanceModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
        
        // Find the row in the table and update it directly
        if (existingRecord) {
            // Find the status cell (5th column)
            const cells = existingRecord.element.querySelectorAll('td');
            if (cells.length >= 5) {
                const statusCell = cells[4];
                const badgeClass = getBadgeClass(newStatus);
                const statusDisplay = getStatusDisplay(newStatus);
                
                // Update the badge
                const statusBadge = statusCell.querySelector('.badge');
                if (statusBadge) {
                    statusBadge.textContent = statusDisplay;
                    statusBadge.className = `badge ${badgeClass}`;
                }
                
                // Update our cached record status immediately
                existingRecord.status = statusDisplay;
            }
            
            // Only update stats if the status actually changed
            if (oldStatus !== newStatus) {
                // Get current stats
                let presentCount = parseInt(document.getElementById('admin-presentCount').textContent) || 0;
                let absentCount = parseInt(document.getElementById('admin-absentCount').textContent) || 0;
                let lateCount = parseInt(document.getElementById('admin-lateCount').textContent) || 0;
                
                // Decrement old status count
                if (oldStatus === 'present') {
                    presentCount = Math.max(0, presentCount - 1);
                } else if (oldStatus === 'absent') {
                    absentCount = Math.max(0, absentCount - 1);
                } else if (oldStatus === 'late') {
                    lateCount = Math.max(0, lateCount - 1);
                }
                
                // Increment new status count
                if (newStatus === 'present') {
                    presentCount++;
                } else if (newStatus === 'absent') {
                    absentCount++;
                } else if (newStatus === 'late') {
                    lateCount++;
                }
                
                // Update the stats display immediately
                updateStats({
                    totalRecords: parseInt(document.getElementById('admin-totalRecords').textContent) || 0,
                    presentCount: presentCount,
                    absentCount: absentCount,
                    lateCount: lateCount
                });
            }
        } else {
            // If we can't find the row, reload all data
            loadAttendanceData(false);
        }
        
        showToast('Attendance record updated successfully', 'success');
        
        // Fetch fresh stats from the server to ensure accuracy
        setTimeout(() => {
            fetch(buildApiUrl(), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data && data.stats) {
                    updateStats(data.stats);
                }
            })
            .catch(err => {
                // Error handled silently
            });
        }, 500);
    })
    .catch(error => {
        showToast(`Error: ${error.message}`, 'error');
    })
    .finally(() => {
        if (submitBtn) submitBtn.disabled = false;
    });
}

function showArchiveConfirmation(id) {
    // Find the attendance record data
    const record = findRowById(id);
    
    if (!record) {
        showToast('Attendance record not found', 'error');
        return;
    }
    
    // Populate modal with attendance details
    document.getElementById('archiveStudentName').textContent = record.student_name;
    document.getElementById('archiveClassName').textContent = record.class_name;
    document.getElementById('archiveAttendanceId').value = id;
    
    // Reset form fields
    document.getElementById('archiveReason').value = '';
    document.getElementById('archiveComment').value = '';
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('archiveConfirmModal'));
            modal.show();
}

function archiveAttendanceRecord() {
    const recordId = document.getElementById('archiveAttendanceId').value;
    const reason = document.getElementById('archiveReason').value;
    const comment = document.getElementById('archiveComment').value;
        
    if (!reason) {
        showToast('Please select a reason for archiving', 'error');
        return;
    }
        
    // Get the record details before archiving to update counts properly
    const recordToArchive = findRowById(recordId);
    if (!recordToArchive) {
        showToast('Record not found', 'error');
        return;
    }
    const recordStatus = recordToArchive.status.toLowerCase();
    
    // Show loading state
    const confirmBtn = document.getElementById('confirmArchiveBtn');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
    confirmBtn.disabled = true;
    
    // Send archive request
    fetch(`/api/attendance/${recordId}/archive`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            reason: reason,
            comment: comment
        })
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
            // Hide archive confirmation modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('archiveConfirmModal'));
            if (modal) modal.hide();
            
            // Remove the row from the table immediately
            removeRowById(recordId);
            
            // Update status counters based on the archived record's status
            let totalRecords = parseInt(document.getElementById('admin-totalRecords').textContent) || 0;
            let presentCount = parseInt(document.getElementById('admin-presentCount').textContent) || 0;
            let absentCount = parseInt(document.getElementById('admin-absentCount').textContent) || 0;
            let lateCount = parseInt(document.getElementById('admin-lateCount').textContent) || 0;
            
            // Decrement the total count
            totalRecords = Math.max(0, totalRecords - 1);
            
            // Decrement the appropriate status count
            if (recordStatus === 'present') {
                presentCount = Math.max(0, presentCount - 1);
            } else if (recordStatus === 'absent') {
                absentCount = Math.max(0, absentCount - 1);
            } else if (recordStatus === 'late') {
                lateCount = Math.max(0, lateCount - 1);
            }
            
            // Update the stats display
            updateStats({
                totalRecords: totalRecords,
                presentCount: presentCount,
                absentCount: absentCount,
                lateCount: lateCount
            });
            
            // Show success message
            showToast('Attendance record archived successfully', 'success');
            
            // Fetch latest stats from API to ensure everything is in sync
            setTimeout(() => {
                fetch(buildApiUrl(), {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data && data.stats) {
                        updateStats({
                            totalRecords: data.total_records || 0,
                            presentCount: data.stats.present || 0,
                            absentCount: data.stats.absent || 0,
                            lateCount: data.stats.late || 0
                        });
                    }
                })
                .catch(err => {
                    // Error handled silently
                });
            }, 500);
        } else {
            throw new Error(data.message || 'Failed to archive attendance');
        }
    })
    .catch(error => {
        showToast(`Error archiving attendance record`, 'error');
    })
    .finally(() => {
        // Reset button state
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    });
}

function initializeDefaultFilters() {
    const dateStart = document.getElementById('admin-dateRangeStart');
    const dateEnd = document.getElementById('admin-dateRangeEnd');
    
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

// Helper functions for toast notifications
function getToastBg(type) {
    switch (type) {
        case 'success': return 'success';
        case 'error': return 'danger';
        case 'warning': return 'warning';
        default: return 'primary';
    }
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return 'bi bi-check-circle-fill';
        case 'error': return 'bi bi-exclamation-circle-fill';
        case 'warning': return 'bi bi-exclamation-triangle-fill';
        default: return 'bi bi-info-circle-fill';
    }
}

function showToast(message, type = 'info') {
    // Use the existing toast notification from toast_notification.html
    const statusToast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = statusToast.querySelector('.toast-header i');
    
    if (!statusToast || !toastTitle || !toastMessage || !toastIcon) {
        // Fallback to custom toast if template elements not found
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

// Fallback function to create custom toasts if the template is not available
function createCustomToast(message, type = 'info') {
    // Find or create toast container
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element if it doesn't exist
    const toastId = 'toast-' + Math.floor(Math.random() * 1000000);
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${getToastBg(type)} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="${getToastIcon(type)} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    // Add toast to container
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // Initialize and show toast
    const toastElement = document.getElementById(toastId);
    if (toastElement) {
        const toast = new bootstrap.Toast(toastElement, {
            delay: 5000,
            autohide: true
        });
        
        toast.show();
        
        // Remove the toast from DOM after it's hidden
        toastElement.addEventListener('hidden.bs.toast', function () {
            this.remove();
        });
    }
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function exportToCsv() {
    // Show a notification that export is being prepared
    showToast('Preparing CSV export...', 'info');
    
    const params = new URLSearchParams();
    
    const classSelect = document.querySelector('select[name="class_id"]') || 
                       document.getElementById('admin-classSelect');
    const instructorSelect = document.querySelector('select[name="instructor_id"]') || 
                            document.getElementById('admin-instructorSelect');
    const statusSelect = document.querySelector('select[name="status"]') || 
                         document.getElementById('admin-statusSelect');
    const studentSearch = document.querySelector('input[name="student_name"]') || 
                          document.getElementById('admin-studentSearch');
    const dateStart = document.querySelector('input[name="date_start"]') || 
                      document.getElementById('admin-dateRangeStart');
    const dateEnd = document.querySelector('input[name="date_end"]') || 
                    document.getElementById('admin-dateRangeEnd');
    
    if (classSelect && classSelect.value && classSelect.value !== 'All Classes') 
        params.append('class_id', classSelect.value);
    if (instructorSelect && instructorSelect.value && instructorSelect.value !== 'All Instructors') 
        params.append('instructor_id', instructorSelect.value);
    if (statusSelect && statusSelect.value && statusSelect.value !== 'All Statuses') 
        params.append('status', statusSelect.value);
    if (studentSearch && studentSearch.value) 
        params.append('student_name', studentSearch.value);
    if (dateStart && dateStart.value) 
        params.append('date_start', dateStart.value);
    if (dateEnd && dateEnd.value) 
        params.append('date_end', dateEnd.value);
    
    params.append('admin', 'true');
    params.append('export', 'csv');
    
    const exportUrl = `/api/attendance/export?${params.toString()}`;
    
    try {
        const link = document.createElement('a');
    link.href = exportUrl;
    link.setAttribute('download', 'attendance_export.csv');
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

function findExportButton() {
    const btnById = document.getElementById('admin-exportCsvBtn') || 
                    document.getElementById('exportCsvBtn');
    if (btnById) return btnById;
    
    const btnByAttr = document.querySelector('button[data-action="export"]') ||
                     document.querySelector('button[aria-label="Export CSV"]');
    if (btnByAttr) return btnByAttr;
    
    const btnByClass = document.querySelector('.export-btn') || 
                      document.querySelector('.export-csv-btn');
    if (btnByClass) return btnByClass;
    
    const buttons = document.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.includes('Export CSV') || 
            buttons[i].textContent.includes('Export') ||
            buttons[i].textContent.includes('CSV')) {
            return buttons[i];
        }
    }
    
    return null;
}

const AdminAttendance = {
    init: function() {
        initializeDefaultFilters();
        
        const filterForm = document.getElementById('admin-filterForm') || 
                          document.querySelector('form');
        if (filterForm) {
            filterForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const paginationInfo = document.querySelector('.pagination-info') || 
                                      document.getElementById('admin-paginationInfo');
                if (paginationInfo) paginationInfo.dataset.page = '1';
                
                loadAttendanceData(false);
            });
        }
        
        const exportCsvBtn = findExportButton();
        
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', exportToCsv);
        }
        
        const selectFilters = ['admin-classSelect', 'admin-instructorSelect', 'admin-statusSelect'];
        selectFilters.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.addEventListener('change', function() {
                    const paginationInfo = document.querySelector('.pagination-info') || 
                                           document.getElementById('admin-paginationInfo');
                    if (paginationInfo) paginationInfo.dataset.page = '1';
                    
                    loadAttendanceData(false);
                });
            }
        });
        
        const studentSearch = document.getElementById('admin-studentSearch');
        if (studentSearch) {
            studentSearch.addEventListener('input', debounce(function() {
                const paginationInfo = document.querySelector('.pagination-info') || 
                                       document.getElementById('admin-paginationInfo');
                if (paginationInfo) paginationInfo.dataset.page = '1';
                
                loadAttendanceData(false);
            }, 500));
        }
        
        const dateInputs = ['admin-dateRangeStart', 'admin-dateRangeEnd'];
        dateInputs.forEach(id => {
            const dateInput = document.getElementById(id);
            if (dateInput) {
                dateInput.addEventListener('change', function() {
                    const paginationInfo = document.querySelector('.pagination-info') || 
                                           document.getElementById('admin-paginationInfo');
                    if (paginationInfo) paginationInfo.dataset.page = '1';
                    
                    loadAttendanceData(false);
                });
            }
        });
        
        const rowsPerPage = document.getElementById('admin-rowsPerPageSelect');
        if (rowsPerPage) {
            rowsPerPage.addEventListener('change', function() {
                const paginationInfo = document.querySelector('.pagination-info') || 
                                       document.getElementById('admin-paginationInfo');
                if (paginationInfo) paginationInfo.dataset.page = '1';
                
                loadAttendanceData(true);
            });
        }
        
        const prevPageBtn = document.querySelector('.prev-page-btn') || 
                           document.getElementById('admin-prevPageBtn');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function() {
                if (isLoading) return;
                
                const paginationInfo = document.querySelector('.pagination-info') || 
                                      document.getElementById('admin-paginationInfo');
                if (!paginationInfo) return;
                
                const currentPage = parseInt(paginationInfo.dataset.page || '1');
                if (currentPage > 1) {
                    paginationInfo.dataset.page = (currentPage - 1).toString();
                    loadAttendanceData(true);
                }
            });
        }
        
        const nextPageBtn = document.querySelector('.next-page-btn') || 
                           document.getElementById('admin-nextPageBtn');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function() {
                if (isLoading) return;
                
                const paginationInfo = document.querySelector('.pagination-info') || 
                                      document.getElementById('admin-paginationInfo');
                if (!paginationInfo) return;
                
                const currentPage = parseInt(paginationInfo.dataset.page || '1');
                const total = parseInt(paginationInfo.dataset.total || '0');
                const perPage = parseInt(document.getElementById('admin-rowsPerPageSelect')?.value || '5');
                const totalPages = Math.ceil(total / perPage);
                
                if (currentPage < totalPages) {
                    paginationInfo.dataset.page = (currentPage + 1).toString();
                    loadAttendanceData(true);
                }
            });
        }
        
        const clearFiltersBtn = document.getElementById('admin-clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', function() {
                const filterForm = document.getElementById('admin-filterForm');
                if (filterForm) {
                    filterForm.reset();
                    initializeDefaultFilters();
                    
                    const paginationInfo = document.querySelector('.pagination-info') || 
                                           document.getElementById('admin-paginationInfo');
                    if (paginationInfo) paginationInfo.dataset.page = '1';
                    
                    loadAttendanceData(false);
                }
            });
        }
        
        const editForm = document.getElementById('editAttendanceForm');
        if (editForm) {
            editForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveAttendanceChanges();
            });
        }
        
        const confirmArchiveBtn = document.getElementById('confirmArchiveBtn');
        if (confirmArchiveBtn) {
            confirmArchiveBtn.addEventListener('click', function() {
                archiveAttendanceRecord();
            });
        }
        
        loadAttendanceData();
    },
    
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

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the view attendance page either by DOM elements or by active page
    const isViewAttendancePage = 
        document.getElementById('admin-tableBody') || 
        document.querySelector('table.attendance-table') ||
        document.querySelector('.attendance-records') ||
        window.app?.activePage === 'view_attendance' ||
        document.body.getAttribute('data-active-page') === 'view_attendance' ||
        document.body.getAttribute('data-page') === 'view_attendance';
        
    if (isViewAttendancePage) {
        window.AdminAttendance = AdminAttendance;
        AdminAttendance.init();
        
        // Add class to the correct nav item to show it as active
        const viewAttendanceNavItem = document.querySelector('a[href*="attendance-view"]');
        if (viewAttendanceNavItem) {
            viewAttendanceNavItem.classList.add('active');
            const parentLi = viewAttendanceNavItem.closest('li');
            if (parentLi) {
                parentLi.classList.add('active');
            }
        }
    }
});