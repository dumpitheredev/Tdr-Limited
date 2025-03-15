document.addEventListener('DOMContentLoaded', function() {
    // Safely handle the event listener issue
    const addEventListenerSafely = (selector, event, handler) => {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element '${selector}' not found in the DOM`);
        }
    };

    // Current pagination state
    let currentPage = 1;
    let currentPerPage = 5; // Default to 5 rows per page

    // Fix the event listeners in the attendance view
    addEventListenerSafely('#filterForm', 'submit', function(e) {
        e.preventDefault();
        currentPage = 1; // Reset to first page when filtering
        loadAttendanceData();
    });

    // Clear filters button
    addEventListenerSafely('button[type="reset"]', 'click', function() {
        document.querySelector('#classSelect').value = '';
        document.querySelector('#studentSearch').value = '';
        document.querySelector('#dateRangeStart').value = '';
        document.querySelector('#dateRangeEnd').value = '';
        currentPage = 1; // Reset to first page
        loadAttendanceData();
    });

    // Add input/change event listeners to filter fields
    addEventListenerSafely('#classSelect', 'change', function() {
        currentPage = 1;
        loadAttendanceData();
    });

    addEventListenerSafely('#studentSearch', 'input', function() {
        currentPage = 1;
        loadAttendanceData();
    });

    addEventListenerSafely('#dateRangeStart', 'change', function() {
        currentPage = 1;
        loadAttendanceData();
    });

    addEventListenerSafely('#dateRangeEnd', 'change', function() {
        currentPage = 1;
        loadAttendanceData();
    });

    // Rows per page selector
    addEventListenerSafely('#rowsPerPageSelect', 'change', function() {
        currentPerPage = parseInt(this.value);
        currentPage = 1; // Reset to first page when changing items per page
        loadAttendanceData();
    });

    // Pagination navigation
    addEventListenerSafely('#prevPageBtn', 'click', function() {
        if (currentPage > 1) {
            currentPage--;
            loadAttendanceData();
        }
    });

    addEventListenerSafely('#nextPageBtn', 'click', function() {
        currentPage++;
        loadAttendanceData();
    });

    // Load attendance data function
    function loadAttendanceData() {
        try {
            // Show loading state
            const tableBody = document.querySelector('table tbody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
            }

            // Get filter values
            const classId = document.querySelector('#classSelect')?.value || '';
            const studentName = document.querySelector('#studentSearch')?.value || '';
            const dateStart = document.querySelector('#dateRangeStart')?.value || '';
            const dateEnd = document.querySelector('#dateRangeEnd')?.value || '';

            // Build query string
            const params = new URLSearchParams({
                page: currentPage,
                per_page: currentPerPage,
                class_id: classId,
                student_name: studentName,
                date_start: dateStart,
                date_end: dateEnd
            });

            // Fetch data
            fetch(`/api/attendance?${params.toString()}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    // Check if data has the expected structure
                    if (!data.data) {
                        console.error('Unexpected API response format:', data);
                        throw new Error('Unexpected API response format');
                    }
                    
                    updateAttendanceTable(data);
                    updatePagination(data.pagination);
                })
                .catch(error => {
                    console.error('Error loading attendance data:', error);
                    if (tableBody) {
                        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
                    }
                });
        } catch (error) {
            console.error('Error in loadAttendanceData:', error);
        }
    }

    // Function to update attendance table
    function updateAttendanceTable(data) {
        const tableBody = document.querySelector('table tbody');
        if (!tableBody) return;

        if (data.data && data.data.length > 0) {
            let html = '';
            data.data.forEach(record => {
                // Ensure status is properly formatted for badge display
                const status = record.status.toLowerCase();
                
                html += `
                <tr>
                    <td>${record.date}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="/static/images/profile.png" 
                                 alt="Profile" class="rounded-circle me-2" width="35" height="35">
                            <div>
                                <h6 class="mb-0">${record.student_name}</h6>
                                <small class="text-muted">${record.student_id}</small>
                            </div>
                        </div>
                    </td>
                    <td>${record.class_id}</td>
                    <td>
                        <span class="badge ${
                            status === 'present' ? 'bg-success-subtle text-success' : 
                            (status === 'absent' ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning')
                        }" style="padding: 8px 16px; font-size: 14px;">${
                            status === 'present' ? 'Present' : 
                            (status === 'absent' ? 'Absent' : 'Late')
                        }</span>
                    </td>
                    <td>
                        <div class="action-icons">
                            <button class="btn view-btn" 
                                    data-id="${record.id}"
                                    data-student="${record.student_name}"
                                    data-class="${record.class_name}"
                                    data-class-id="${record.class_id}"
                                    data-date="${record.date}"
                                    data-status="${status}"
                                    data-comment="${record.comment || ''}">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn edit-btn"
                                    data-id="${record.id}"
                                    data-student="${record.student_name}"
                                    data-class="${record.class_name}"
                                    data-class-id="${record.class_id}"
                                    data-date="${record.date}"
                                    data-status="${status}"
                                    data-comment="${record.comment || ''}">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn archive-btn"
                                    data-id="${record.id}"
                                    data-student="${record.student_name}"
                                    data-class="${record.class_name}">
                                <i class="bi bi-archive"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            });
            tableBody.innerHTML = html;
            
            // Add event listeners to action buttons
            setupActionButtons();
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No attendance records found</td></tr>';
        }
    }

    // Function to update pagination
    function updatePagination(pagination) {
        if (!pagination) return;
        
        // Update pagination info text
        const paginationInfo = document.querySelector('#paginationInfo');
        if (paginationInfo) {
            const start = pagination.total > 0 ? (pagination.page - 1) * pagination.per_page + 1 : 0;
            const end = Math.min(start + pagination.per_page - 1, pagination.total);
            paginationInfo.textContent = `${start}-${end} of ${pagination.total}`;
        }
        
        // Disable/enable prev/next buttons
        const prevBtn = document.querySelector('#prevPageBtn');
        const nextBtn = document.querySelector('#nextPageBtn');
        
        if (prevBtn) {
            prevBtn.disabled = pagination.page <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = pagination.page >= pagination.pages || pagination.total === 0;
        }
    }
    
    // Set up event listeners for view, edit, and archive buttons
    function setupActionButtons() {
        // View button listeners
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const student = this.dataset.student;
                const className = this.dataset.class;
                const classId = this.dataset.classId;
                const date = this.dataset.date;
                const status = this.dataset.status;
                const comment = this.dataset.comment;
                
                // Populate the modal
                document.getElementById('detailStudent').textContent = student;
                document.getElementById('detailClass').textContent = `${className} (${classId})`;
                document.getElementById('detailDate').textContent = date;
                
                // Update status badge
                let statusHtml = '';
                if (status === 'present') {
                    statusHtml = `<span class="badge bg-success-subtle text-success" style="padding: 8px 16px; font-size: 14px;">Present</span>`;
                } else if (status === 'absent') {
                    statusHtml = `<span class="badge bg-danger-subtle text-danger" style="padding: 8px 16px; font-size: 14px;">Absent</span>`;
                } else {
                    statusHtml = `<span class="badge bg-warning-subtle text-warning" style="padding: 8px 16px; font-size: 14px;">Late</span>`;
                }
                document.getElementById('detailStatus').innerHTML = statusHtml;
                
                document.getElementById('detailComment').textContent = comment || 'No comment';
                
                // Show the modal
                const modal = new bootstrap.Modal(document.getElementById('attendanceDetailModal'));
                modal.show();
            });
        });
        
        // Edit button listeners
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const student = this.dataset.student;
                const className = this.dataset.class;
                const date = this.dataset.date;
                const status = this.dataset.status;
                const comment = this.dataset.comment;
                
                // Populate the edit modal
                document.getElementById('editAttendanceId').value = id;
                document.getElementById('editStudent').value = student;
                document.getElementById('editClass').value = className;
                document.getElementById('editDate').value = date;
                document.getElementById('editStatus').value = status;
                document.getElementById('editComment').value = comment || '';
                
                // Show the modal
                const modal = new bootstrap.Modal(document.getElementById('editAttendanceModal'));
                modal.show();
            });
        });
        
        // Archive button listeners
        document.querySelectorAll('.archive-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.id;
                const student = this.dataset.student;
                const className = this.dataset.class;
                
                // Populate the archive confirmation modal
                document.getElementById('archiveStudentName').textContent = student;
                document.getElementById('archiveClassName').textContent = className;
                document.getElementById('archiveRecordId').value = id;
                
                // Show the modal
                const modal = new bootstrap.Modal(document.getElementById('archiveConfirmModal'));
                modal.show();
            });
        });
    }

    // Save edited attendance
    addEventListenerSafely('.modal-footer .btn-primary', 'click', function() {
        const id = document.getElementById('editAttendanceId').value;
        const status = document.getElementById('editStatus').value;
        const comment = document.getElementById('editComment').value;
        
        // Send update to the server
        fetch(`/api/attendance/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                status: status,
                comment: comment
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update attendance record');
            }
            return response.json();
        })
        .then(data => {
            // Show success message
            const toastEl = document.querySelector('.toast');
            if (toastEl) {
                const toast = new bootstrap.Toast(toastEl);
                document.querySelector('.toast-body').textContent = 'Attendance record updated successfully!';
                toast.show();
            }
            
            // Close the modal and reload data
            const modal = bootstrap.Modal.getInstance(document.getElementById('editAttendanceModal'));
            modal.hide();
            loadAttendanceData();
        })
        .catch(error => {
            console.error('Error updating attendance:', error);
            // Show error message
            const toastEl = document.querySelector('.toast');
            if (toastEl) {
                const toast = new bootstrap.Toast(toastEl);
                document.querySelector('.toast-body').textContent = 'Error updating attendance record!';
                toast.show();
            }
        });
    });
    
    // Confirm archive
    addEventListenerSafely('#confirmArchiveBtn', 'click', function() {
        const id = document.getElementById('archiveRecordId').value;
        
        // Send archive request to the server
        fetch(`/api/attendance/${id}/archive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to archive attendance record');
            }
            return response.json();
        })
        .then(data => {
            // Show success message
            const toastEl = document.querySelector('.toast');
            if (toastEl) {
                const toast = new bootstrap.Toast(toastEl);
                document.querySelector('.toast-body').textContent = 'Attendance record archived successfully!';
                toast.show();
            }
            
            // Close the modal and reload data
            const modal = bootstrap.Modal.getInstance(document.getElementById('archiveConfirmModal'));
            modal.hide();
            loadAttendanceData();
        })
        .catch(error => {
            console.error('Error archiving attendance:', error);
            // Show error message
            const toastEl = document.querySelector('.toast');
            if (toastEl) {
                const toast = new bootstrap.Toast(toastEl);
                document.querySelector('.toast-body').textContent = 'Error archiving attendance record!';
                toast.show();
            }
        });
    });

    // Initialize rows per page select
    const rowsPerPageSelect = document.querySelector('#rowsPerPageSelect');
    if (rowsPerPageSelect) {
        rowsPerPageSelect.value = currentPerPage.toString();
    }

    // Initial load
    loadAttendanceData();
});