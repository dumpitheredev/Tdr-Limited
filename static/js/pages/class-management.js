// Initialize state
let currentPageState = {
    page: 1,
    perPage: 5,
    totalItems: 0,
    currentData: [], // Initialize as empty array
    searchTerm: '',
    statusFilter: ''
};

// Attendance table pagination state
let attendancePageState = {
    page: 1,
    perPage: 5,
    totalStudents: 0
};

let currentEditingClass = null;

// Store current attendance data for reference
let currentAttendanceData = [];

// Function to export classes to CSV
async function exportClassesCSV() {
    try {
        // Show a loading indicator or toast
        showToast('Info', 'Preparing CSV export...', 'info');
    
    // Get current filters
    const status = document.getElementById('statusFilter')?.value || '';
    const search = document.getElementById('searchInput')?.value || '';
    
        // Build the URL with query parameters
        let url = '/api/classes/export-csv';
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
        const filename = `class-data-${new Date().toISOString().split('T')[0]}.csv`;
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
        
        // Clean up
        window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(link);
        
        showToast('Success', 'CSV file downloaded successfully', 'success');
    } catch (error) {
        showToast('Error', `Failed to export CSV: ${error.message}`, 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    try {
        // Check URL parameters for restored class ID
        const urlParams = new URLSearchParams(window.location.search);
        const restoredId = urlParams.get('restored');
        
        // Fetch class data
        fetchAndUpdateData();
        
        // Initialize modals including academic year dropdowns
        initializeModals();
        
        // If restored ID was provided, highlight it
        if (restoredId) {
            setTimeout(() => {
                highlightRestoredClass(restoredId);
            }, 500);
        }
        
        // Add event listeners for search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                currentPageState.page = 1;
                currentPageState.searchTerm = this.value;
                updateTable();
            });
        }

        // Add event listeners for status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                currentPageState.page = 1;
                currentPageState.statusFilter = this.value;
                updateTable();
            });
        }

        // Add event listener for rows per page
        const rowsPerPage = document.getElementById('rowsPerPage');
        if (rowsPerPage) {
            rowsPerPage.addEventListener('change', function() {
                currentPageState.page = 1;
                currentPageState.perPage = parseInt(this.value);
                updateTable();
            });
        }

        // Add pagination event listeners
        document.getElementById('prevPage')?.addEventListener('click', function() {
            if (currentPageState.page > 1) {
                currentPageState.page--;
                updateTable();
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', function() {
            const maxPage = Math.ceil(currentPageState.totalItems / currentPageState.perPage);
            if (currentPageState.page < maxPage) {
                currentPageState.page++;
                updateTable();
            }
        });

        // Add event listener for add class form submission
        const addClassForm = document.getElementById('addClassForm');
        if (addClassForm) {
            addClassForm.addEventListener('submit', handleAddClass);
        }

        // Add event listener for edit class form submission
        const editClassForm = document.getElementById('editClassForm');
        if (editClassForm) {
            editClassForm.addEventListener('submit', handleEditClass);
        }

    } catch (error) {
        showToast('Error', 'Failed to load classes', 'error');
    }
});

// Function to highlight a restored class
function highlightRestoredClass(classId) {
    // Find the class row
    const classRow = document.querySelector(`tr[data-class-id="${classId}"]`);
    
    if (classRow) {
        // Scroll to the row
        classRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight
        classRow.classList.add('bg-success-subtle');
        
        // Add a success toast
        showToast('Success', 'Class has been successfully restored from archives', 'success');
        
        // Remove highlight after a few seconds
        setTimeout(() => {
            classRow.classList.remove('bg-success-subtle');
        }, 3000);
    } else {
        // Simply display a toast notification - no retries or loops
        showToast('Success', 'Class has been successfully restored.', 'success');
        
        // Check if we need to reload data
        const isInData = currentPageState.currentData.some(c => c.class_id === classId);
        if (!isInData) {
            // Only reload data once if the class isn't found
            fetchAndUpdateData();
        }
    }
}

// Function to fetch and update data
async function fetchAndUpdateData() {
    try {
        const response = await fetch('/api/classes');
        
        if (!response.ok) throw new Error('Failed to fetch classes');
        const data = await response.json();
        
        // Clean up the data - handle null/invalid years
        if (Array.isArray(data)) {
            data.forEach(item => {
                // Convert null or "null" years to empty string
                if (!item.year || item.year === "null") {
                    item.year = ""; // This will be displayed as N/A in the UI
                }
            });
        }
        
        currentPageState.currentData = data || [];
        currentPageState.totalItems = currentPageState.currentData.length;
        
        // Update status cards when data is loaded
        updateStatusCards(currentPageState.currentData);
        
        // Update table
        updateTable();
        
        return data;
    } catch (error) {
        showToast('Error', 'Failed to load classes', 'error');
        currentPageState.currentData = [];
        return [];
    }
}

// Function to update the table with current data
function updateTable() {
    try {
        let filteredData = Array.isArray(currentPageState.currentData) ? [...currentPageState.currentData] : [];

        if (currentPageState.statusFilter) {
            filteredData = filteredData.filter(classItem => 
                classItem.status === currentPageState.statusFilter
            );
        }

        if (currentPageState.searchTerm) {
            const searchTerm = currentPageState.searchTerm.toLowerCase();
            filteredData = filteredData.filter(classItem =>
                classItem.name.toLowerCase().includes(searchTerm) ||
                classItem.class_id.toLowerCase().includes(searchTerm)
            );
        }

        // Update total items count for pagination
        currentPageState.totalItems = filteredData.length;

        const startIndex = (currentPageState.page - 1) * currentPageState.perPage;
        const endIndex = Math.min(startIndex + currentPageState.perPage, filteredData.length);
        const paginatedData = filteredData.slice(startIndex, endIndex);

        const tbody = document.getElementById('classTableBody');
        if (tbody) {
            if (paginatedData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4">
                            <div class="d-flex flex-column align-items-center">
                                <i class="bi bi-search fs-1 text-muted mb-2"></i>
                                <p class="text-muted mb-0">No classes found</p>
                            </div>
                        </td>
                    </tr>`;
            } else {
                tbody.innerHTML = paginatedData.map(classItem => `
                    <tr data-class-id="${classItem.class_id}">
                        <td>
                            <div class="fw-semibold">${classItem.name}</div>
                            <div class="small text-muted">${classItem.class_id}</div>
                        </td>
                        <td>${classItem.day}</td>
                        <td>${classItem.time}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="fw-medium">${classItem.instructor}</div>
                            </div>
                        </td>
                        <td>${classItem.year && classItem.year !== "null" ? classItem.year : "N/A"}</td>
                        <td>
                            <span class="badge ${getStatusBadgeClass(classItem.status)}">
                                ${classItem.status}
                            </span>
                        </td>
                        <td class="text-center">
                            <div class="d-flex gap-2 justify-content-center">
                                <button class="btn btn-link p-0" 
                                        data-bs-toggle="modal" 
                                        data-bs-target="#viewClassModal" 
                                        onclick="handleClassAction('${classItem.class_id}', 'view')"
                                        title="View details">
                                    <i class="bi bi-eye" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" 
                                        data-bs-toggle="modal" 
                                        data-bs-target="#editClassModal" 
                                        onclick="handleClassAction('${classItem.class_id}', 'edit')"
                                        title="Edit class">
                                    <i class="bi bi-pencil" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" 
                                        onclick="handleClassAction('${classItem.class_id}', 'archive')"
                                        title="Archive class">
                                    <i class="bi bi-archive" style="color: #191970;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // Update pagination info
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            paginationInfo.textContent = filteredData.length > 0 ? 
                `${startIndex + 1}-${endIndex} of ${filteredData.length}` :
                '0-0 of 0';
        }

        // Update pagination buttons
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        if (prevButton) prevButton.disabled = currentPageState.page === 1;
        if (nextButton) nextButton.disabled = endIndex >= filteredData.length;

    } catch (error) {
        showToast('Error', 'Failed to update table', 'error');
    }
}

// Function to update status cards
function updateStatusCards(data) {
    try {
        if (!Array.isArray(data)) {
            return;
        }
        
        const totalClasses = data.length;
        const activeClasses = data.filter(c => c.status === 'Active').length;
        const inactiveClasses = data.filter(c => c.status === 'Inactive').length;
        
        // Update the count elements
        document.querySelector('[data-count="total"]').textContent = totalClasses;
        document.querySelector('[data-count="active"]').textContent = activeClasses;
        document.querySelector('[data-count="inactive"]').textContent = inactiveClasses;
    } catch (error) {
        // Silently handle errors
    }
}

// Function to get badge class based on status
function getStatusBadgeClass(status) {
    switch (status) {
        case 'Active':
            return 'bg-success-subtle text-success';
        case 'Inactive':
            return 'bg-danger-subtle text-danger';
        default:
            return 'bg-secondary-subtle text-secondary';
    }
}

// Show toast notification
function showToast(title, message, type = 'success') {
    try {
        // Get the toast element
    const toast = document.getElementById('statusToast');
        if (!toast) {
            alert(`${title}: ${message}`);
            return;
        }
        
        // Get elements inside toast
        const toastTitle = toast.querySelector('#toastTitle');
        const toastMessage = toast.querySelector('#toastMessage');
    const iconElement = toast.querySelector('.toast-header i');
    
        // Update toast content
        if (toastTitle) toastTitle.textContent = title;
        if (toastMessage) toastMessage.textContent = message;
    
    // Update icon based on type
    if (iconElement) {
            // Set icon class based on type
            if (type === 'success') {
                iconElement.className = 'bi bi-check-circle-fill text-success me-2';
            } else if (type === 'error') {
                iconElement.className = 'bi bi-exclamation-circle-fill text-danger me-2';
            } else if (type === 'info') {
                iconElement.className = 'bi bi-info-circle text-primary me-2';
            } else if (type === 'warning') {
                iconElement.className = 'bi bi-exclamation-triangle-fill text-warning me-2';
            }
        }
        
        // Create a new Bootstrap toast instance and show it
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
    } catch (error) {
        // Fallback to alert
        alert(`${title}: ${message}`);
    }
}

// Handle class actions (view, edit, archive)
window.handleClassAction = async function(classId, action) {
            try {
        if (action === 'view') {
        // Fetch class details
                const response = await fetch(`/api/classes/${classId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch class details');
            }
            
                const classData = await response.json();
                
            // Close any existing modals first
            const existingModals = document.querySelectorAll('.modal.show');
            existingModals.forEach(modal => {
                closeModalProperly(modal);
            });
                
            // Populate the modal with class data
                populateViewClassModal(classData);
            
            // Show the modal
            const modal = document.getElementById('viewClassModal');
            const viewModal = new bootstrap.Modal(modal);
            viewModal.show();
            
            // Add event handler for closing the modal properly
            modal.addEventListener('hidden.bs.modal', function onHidden() {
                modal.removeEventListener('hidden.bs.modal', onHidden);
                
                // Additional cleanup for any stray backdrops
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(backdrop => {
                    backdrop.remove();
                });
                
                // Reset body styling
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }, { once: true });
            
        } else if (action === 'edit') {
            // Fetch class details for editing
            const response = await fetch(`/api/classes/${classId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch class details');
            }
            
            const classData = await response.json();
            
            // Close any existing modals first
            const existingModals = document.querySelectorAll('.modal.show');
            existingModals.forEach(modal => {
                closeModalProperly(modal);
            });
            
            // Populate the edit modal form
                populateEditClassModal(classData);
                
            // Show the edit modal
            const modal = document.getElementById('editClassModal');
            const editModal = new bootstrap.Modal(modal);
            editModal.show();
            
            // Add event handler for closing the modal properly
            modal.addEventListener('hidden.bs.modal', function onHidden() {
                modal.removeEventListener('hidden.bs.modal', onHidden);
                
                // Additional cleanup for any stray backdrops
                const backdrops = document.querySelectorAll('.modal-backdrop');
                backdrops.forEach(backdrop => {
                    backdrop.remove();
                });
                
                // Reset body styling
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }, { once: true });
            
        } else if (action === 'archive') {
            // Fetch class details for archiving
            const response = await fetch(`/api/classes/${classId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch class details');
            }
            
            const classData = await response.json();
            
            // Close any existing modals first
            const existingModals = document.querySelectorAll('.modal.show');
            existingModals.forEach(modal => {
                closeModalProperly(modal);
            });
            
            // Confirm archive action
                confirmArchiveClass(classData);
        }
            } catch (error) {
        showToast('Error', `Failed to load class details: ${error.message}`, 'error');
    }
};

// Populate view class modal
function populateViewClassModal(classData) {
    const modal = document.getElementById('viewClassModal');
    if (!modal) return;
    
    // Set class details
    modal.querySelector('#className').textContent = classData.name || 'N/A';
    modal.querySelector('#classId').textContent = classData.class_id || 'N/A';
    modal.querySelector('#classDay').textContent = classData.day || 'N/A';
    modal.querySelector('#classTime').textContent = classData.time || 'N/A';
    modal.querySelector('#classInstructor').textContent = classData.instructor || 'Not Assigned';
    modal.querySelector('#instructorId').textContent = classData.instructor_id || 'Not Assigned';
    modal.querySelector('#academicYear').textContent = classData.year && classData.year !== "null" ? classData.year : 'N/A';
    
    // Set description if available
    const descriptionElement = modal.querySelector('#classDescription');
    if (descriptionElement) {
        descriptionElement.textContent = classData.description || 'No description available';
    }
    
    // Set status badge
    const statusBadge = modal.querySelector('#classStatus');
    if (statusBadge) {
    statusBadge.className = `badge ${getStatusBadgeClass(classData.status)}`;
        statusBadge.textContent = classData.status || 'Unknown';
    }
    
    // Load attendance records for this class
    loadClassAttendance(classData.class_id);
}

// Load attendance records for a class
async function loadClassAttendance(classId, startDate, endDate) {
    try {
        // Create the loading indicator for table bodies
        const studentNameColumn = document.querySelector('#studentNameColumn');
        const recordsTableBody = document.querySelector('#recordsTableBody');
        
        if (studentNameColumn) {
            studentNameColumn.innerHTML = `
                <tr>
                    <td class="student-cell text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mt-2 mb-0">Loading data...</p>
                    </td>
                </tr>
            `;
        }
        
        if (recordsTableBody) {
            recordsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="text-muted mt-2 mb-0">Loading attendance data...</p>
                    </td>
                </tr>
            `;
        }
        
        // If dates are not provided, default to last 7 days
        if (!startDate || !endDate) {
            const today = new Date();
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 6); // 7 days including today
            
            startDate = formatDateForApi(lastWeek);
            endDate = formatDateForApi(today);
        }
        
        // Format dates if they're in dd/mm/yyyy format
        if (startDate && startDate.includes('/')) {
            startDate = formatDateForApi(startDate);
        }
        if (endDate && endDate.includes('/')) {
            endDate = formatDateForApi(endDate);
        }

        // Use the correct API endpoint that exists in the backend
        const response = await fetch(`/api/classes/${classId}/attendance?start_date=${startDate}&end_date=${endDate}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch attendance data');
        }
        
        const data = await response.json();
        
        // Store the data for later reference
        currentAttendanceData = data;
        
        // Use updateAttendanceTables instead of updateAttendanceTable
        updateAttendanceTables(data);
        updateAttendanceStats(data);
    } catch (error) {
        console.error('Error loading class attendance:', error);
        
        // Update student column with error
        const studentNameColumn = document.querySelector('#studentNameColumn');
        if (studentNameColumn) {
            studentNameColumn.innerHTML = `
                <tr>
                    <td class="student-cell text-center">
                        <i class="bi bi-exclamation-triangle text-warning"></i>
                        <p class="text-muted mt-2 mb-0">Error loading data</p>
                    </td>
                </tr>
            `;
        }
        
        // Update records table with error
        const recordsTableBody = document.querySelector('#recordsTableBody');
        if (recordsTableBody) {
            recordsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="bi bi-exclamation-circle text-danger fs-1 mb-2"></i>
                            <p class="text-muted mb-0">Error loading attendance data</p>
                            <p class="text-muted mb-0 small">${error.message}</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

// Format date from Date object or dd/mm/yyyy string to yyyy-mm-dd
function formatDateForApi(date) {
    if (date instanceof Date) {
        // Format Date object to yyyy-mm-dd
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    } else if (typeof date === 'string' && date.includes('/')) {
        // Convert dd/mm/yyyy to yyyy-mm-dd
        const [day, month, year] = date.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    // Return as is if already in correct format
    return date;
}

// Update attendance table with data
function updateAttendanceTable(attendanceData) {
    const attendanceTableBody = document.querySelector('#attendanceTableBody');
    if (!attendanceTableBody) return;
    
    if (!attendanceData || attendanceData.length === 0) {
        attendanceTableBody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <i class="bi bi-calendar3 text-muted fs-1 mb-2"></i>
                        <p class="text-muted mb-0">No attendance records found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Generate table rows from attendance data
    const rows = attendanceData.map(record => `
        <tr>
            <td class="student-cell">
                <div class="student-name">${record.student_name}</div>
                <div class="student-info">${record.student_id}</div>
            </td>
            <td class="attendance-cell">
                <span class="attendance-badge badge ${getAttendanceBadgeClass(record.status)}">
                    ${record.status}
                </span>
            </td>
            <td class="text-center">
                <div class="d-flex gap-2 justify-content-center">
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="viewAttendanceDetails('${record.id}')"
                            title="View details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" 
                            onclick="editAttendanceRecord('${record.id}')"
                            title="Edit record">
                        <i class="bi bi-pencil"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    attendanceTableBody.innerHTML = rows;
}

// Update attendance statistics
function updateAttendanceStats(attendanceData) {
    if (!attendanceData) return;
    
    // Count totals
    const totalRecords = attendanceData.length;
    const presentCount = attendanceData.filter(r => r.status && r.status === 'Present').length;
    const absentCount = attendanceData.filter(r => r.status && r.status === 'Absent').length;
    const lateCount = attendanceData.filter(r => r.status && r.status === 'Late').length;
    
    // Calculate percentage
    const presentPercentage = totalRecords > 0 ? ((presentCount + lateCount) / totalRecords) * 100 : 0;
    
    // Update UI elements if they exist
    const totalPresentEl = document.getElementById('totalPresent');
    const totalLateEl = document.getElementById('totalLate');
    const totalAbsenceEl = document.getElementById('totalAbsence');
    const attendancePercentageEl = document.getElementById('attendancePercentage');
    
    if (totalPresentEl) totalPresentEl.textContent = presentCount;
    if (totalLateEl) totalLateEl.textContent = lateCount;
    if (totalAbsenceEl) totalAbsenceEl.textContent = absentCount;
    if (attendancePercentageEl) attendancePercentageEl.textContent = `${presentPercentage.toFixed(1)}%`;
}

// Get badge class for attendance status
function getBadgeClassForStatus(status) {
    if (!status) return 'bg-secondary';
    
    // Convert to lowercase for case-insensitive comparison
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'present') {
        return 'bg-success';
    } else if (statusLower === 'absent') {
        return 'bg-danger';
    } else if (statusLower === 'late') {
        return 'bg-warning';
    } else {
        return 'bg-secondary';
    }
}

// Format timestamp for display
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    // Handle different timestamp formats
    let timeStr = timestamp;
    if (timestamp.includes(':')) {
        // If timestamp already contains time information, extract it
        const parts = timestamp.split(' ');
        if (parts.length > 1) {
            timeStr = parts[1];
        }
        
        // Keep only HH:MM part if needed
        if (timeStr.length > 5) {
            timeStr = timeStr.substring(0, 5);
        }
    }
    
    return timeStr;
}

// View attendance details
window.viewAttendanceDetails = function(recordId) {
    // Find the record in current attendance data
    const record = currentAttendanceData.find(r => r.id == recordId);
    if (!record) {
        console.error('Record not found');
        showToast('Error', 'Attendance record not found', 'error');
        return;
    }
    
    // Create modal if it doesn't exist
    let modalElement = document.getElementById('attendanceDetailModal');
    if (!modalElement) {
        const modalHTML = `
        <div class="modal fade" id="attendanceDetailModal" tabindex="-1" aria-labelledby="attendanceDetailModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="attendanceDetailModalLabel">Attendance Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3 row">
                            <label class="col-sm-4 col-form-label">Student:</label>
                            <div class="col-sm-8">
                                <p class="form-control-plaintext" id="detailStudent">-</p>
                            </div>
                        </div>
                        <div class="mb-3 row">
                            <label class="col-sm-4 col-form-label">Class:</label>
                            <div class="col-sm-8">
                                <p class="form-control-plaintext" id="detailClass">-</p>
                            </div>
                        </div>
                        <div class="mb-3 row">
                            <label class="col-sm-4 col-form-label">Date:</label>
                            <div class="col-sm-8">
                                <p class="form-control-plaintext" id="detailDate">-</p>
                            </div>
                        </div>
                        <div class="mb-3 row">
                            <label class="col-sm-4 col-form-label">Status:</label>
                            <div class="col-sm-8">
                                <p class="form-control-plaintext" id="detailStatus">
                                    <span class="badge bg-secondary">-</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalElement = document.getElementById('attendanceDetailModal');
        
        // Add a click handler to the close button
        const closeButton = modalElement.querySelector('button[data-bs-dismiss="modal"]');
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                closeModalProperly(modalElement);
            });
        }
    }
    
    // Update modal content
    const modal = modalElement;
    modal.querySelector('#detailStudent').textContent = record.student_name;
    modal.querySelector('#detailClass').textContent = document.getElementById('className').textContent;
    modal.querySelector('#detailDate').textContent = record.date;
    
    // Set status badge
    let statusClass = '';
    switch(record.status.toLowerCase()) {
        case 'present':
            statusClass = 'bg-success-subtle text-success';
            break;
        case 'absent':
            statusClass = 'bg-danger-subtle text-danger';
            break;
        case 'late':
            statusClass = 'bg-warning-subtle text-warning';
            break;
        default:
            statusClass = 'bg-secondary-subtle text-secondary';
    }
    
    modal.querySelector('#detailStatus').innerHTML = `
        <span class="badge ${statusClass}" style="padding: 8px 16px; font-size: 14px;">
            ${record.status}
        </span>
    `;
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
};

// Edit attendance record
window.editAttendanceRecord = function(recordId) {
    // Implement edit functionality
};

// Populate edit class modal
function populateEditClassModal(classData) {
    const modal = document.getElementById('editClassModal');
    if (!modal) return;
    
    // Set form values
    modal.querySelector('#editClassId').value = classData.class_id;
    modal.querySelector('#editClassName').value = classData.name;
    
    // Set description if available
    const descriptionField = modal.querySelector('#editClassDescription');
    if (descriptionField) {
        descriptionField.value = classData.description || '';
    }
    
    modal.querySelector('#editClassDay').value = classData.day;
    
    // Parse time for start and end time fields
    const timeRange = classData.time.split(' - ');
    if (timeRange.length === 2) {
        modal.querySelector('#editClassStartTime').value = timeRange[0];
        modal.querySelector('#editClassEndTime').value = timeRange[1];
    }
    
    // Set instructor and year
    if (classData.instructor_id) {
    modal.querySelector('#editClassInstructor').value = classData.instructor_id;
    }
    
    // Handle year values properly - allow for different academic year formats
    const yearDropdown = modal.querySelector('#editClassYear');
    if (yearDropdown) {
        if (classData.year && classData.year !== "null") {
            // Try to match the year format exactly
            let yearFound = false;
            for (let i = 0; i < yearDropdown.options.length; i++) {
                if (yearDropdown.options[i].value === classData.year) {
                    yearDropdown.selectedIndex = i;
                    yearFound = true;
                    break;
                }
            }
            
            // If exact match not found but we have a valid year, set the value directly
            if (!yearFound) {
                // First check if the option exists, if not add it
                const option = document.createElement('option');
                option.value = classData.year;
                option.textContent = classData.year;
                
                // Add it right after the placeholder (position 1)
                if (yearDropdown.options.length >= 1) {
                    yearDropdown.insertBefore(option, yearDropdown.options[1]);
                } else {
                    yearDropdown.appendChild(option);
                }
                
                // Select the newly added option
                yearDropdown.value = classData.year;
            }
        } else {
            // If year is null or empty, select the placeholder option
            yearDropdown.selectedIndex = 0;
        }
    }
    
    modal.querySelector('#editClassStatus').value = classData.status;
}

// Confirm archive class
function confirmArchiveClass(classData) {
    // Get the modal elements
    const modal = document.getElementById('archiveClassModal');
    const archiveClassName = document.getElementById('archiveClassName');
    const archiveClassId = document.getElementById('archiveClassId');
    const archiveClassIdInput = document.getElementById('archiveClassIdInput');
    
    // Set the class details in the modal
    archiveClassName.textContent = classData.name;
    archiveClassId.textContent = classData.class_id;
    archiveClassIdInput.value = classData.class_id;
    
    // Clear previous values
    document.getElementById('archiveReason').value = '';
    document.getElementById('archiveComment').value = '';
    
    // Initialize the modal
    const archiveModal = new bootstrap.Modal(modal);
    archiveModal.show();
    
    // Set up the confirm button event handler
    document.getElementById('confirmArchiveClassBtn').onclick = function() {
        const reason = document.getElementById('archiveReason').value;
        const comment = document.getElementById('archiveComment').value;
        
        // Validate that a reason is selected
        if (!reason) {
            showToast('Error', 'Please select a reason for archiving', 'error');
            return;
        }
        
        // Combine reason and comment
        const archiveNote = comment ? `${reason}: ${comment}` : reason;
        
        // Update class status with the archive note
        updateClassStatus(classData.class_id, 'Inactive', archiveNote);
        
        // Close the modal properly
        closeModalProperly(modal);
    };
}

// Update class status
async function updateClassStatus(classId, newStatus, archiveNote = '') {
    try {
        const response = await fetch(`/api/classes/${classId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                status: newStatus,
                archiveNote: archiveNote
            }),
        });

        if (!response.ok) throw new Error('Failed to update class status');

        // Refresh data
        await fetchAndUpdateData();
        
        showToast('Success', `Class status updated to ${newStatus} and sent to archive`, 'success');
    } catch (error) {
        showToast('Error', 'Failed to update class status', 'error');
    }
}

// Handle add class form submission
async function handleAddClass(event) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const formData = new FormData(form);
        
        // Try multiple possible field names for class name
        let className = formData.get('addClassName') || formData.get('className') || '';
        
        // Get remaining fields - try multiple possible names
        const dayOfWeek = formData.get('addClassDay') || formData.get('dayOfWeek') || '';
        const startTime = formData.get('addClassStartTime') || formData.get('startTime') || '09:00';
        const endTime = formData.get('addClassEndTime') || formData.get('endTime') || '10:00';
        const instructorId = formData.get('addClassInstructor') || formData.get('instructor') || '';
        
        // Validate required fields
        if (!className || className.trim() === '') {
            throw new Error('Please enter a class name');
        }
        
        if (!dayOfWeek || dayOfWeek === 'null') {
            throw new Error('Please select a day of the week');
        }
        
        if (!instructorId || instructorId === 'null') {
            throw new Error('Please select an instructor');
        }
        
        // Check if either time is null, empty or invalid
        if (!startTime || startTime === "null") {
            throw new Error('Please select a start time');
        }
        
        if (!endTime || endTime === "null") {
            throw new Error('Please select an end time');
        }
        
        // Get the year value and handle empty selection
        let yearValue = formData.get('addClassYear') || formData.get('academicYear') || '';
        
        // If year is empty or null, use "N/A" as fallback
        if (!yearValue || yearValue === "null" || yearValue === "") {
            yearValue = "N/A";
        }
        
        // Create new class object
        const newClass = {
            name: className,
            description: formData.get('addClassDescription') || formData.get('description') || '',
            day: dayOfWeek,
            time: `${startTime} - ${endTime}`,
            instructor_id: instructorId,
            year: yearValue,
            status: formData.get('addClassStatus') || formData.get('status') || 'Active'
        };

        // Get the modal element
        const modalEl = document.getElementById('addClassModal');

        // Close modal properly before making API request
        closeModalProperly(modalEl);
        
        // Send to server
        const response = await fetch('/api/classes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newClass),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add class');
        }
        
        // Refresh data
        await fetchAndUpdateData();
        
        // Show success message after a small delay to ensure modal is fully gone
        setTimeout(() => {
            showToast('Success', 'Class added successfully', 'success');
        }, 300);
    } catch (error) {
        showToast('Error', `Failed to add class: ${error.message}`, 'error');
    }
}

// Handle edit class form submission
async function handleEditClass(event) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const formData = new FormData(form);
        
        // Get the year value and respect user selection
        let yearValue = formData.get('editClassYear');
        
        // Only use fallbacks if the year is truly empty or "null" string
        if (!yearValue || yearValue === "null" || yearValue === "") {
            // Get the selected value directly from the dropdown
            const yearDropdown = document.getElementById('editClassYear');
            if (yearDropdown && yearDropdown.selectedIndex > 0) {
                // Use the actually selected option
                yearValue = yearDropdown.options[yearDropdown.selectedIndex].value;
            } else {
                // Use "N/A" as the fallback
                yearValue = "N/A";
            }
        }
        
        // Create updated class object
        const updatedClass = {
            name: formData.get('editClassName'),
            description: formData.get('editClassDescription'),
            day: formData.get('editClassDay'),
            time: `${formData.get('editClassStartTime')} - ${formData.get('editClassEndTime')}`,
            instructor_id: formData.get('editClassInstructor'),
            year: yearValue,
            status: formData.get('editClassStatus')
        };
        
        const classId = formData.get('editClassId');
        
        // Get the modal element
        const modalEl = document.getElementById('editClassModal');
        
        // Close modal properly before making API request
        closeModalProperly(modalEl);
        
        // Send update to server
        const response = await fetch(`/api/classes/${classId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedClass),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update class');
        }
            
        // Refresh data
        await fetchAndUpdateData();
            
        // Show success message after a small delay to ensure modal is fully gone
        setTimeout(() => {
            showToast('Success', 'Class updated successfully', 'success');
        }, 300);

    } catch (error) {
        showToast('Error', `Failed to update class: ${error.message}`, 'error');
    }
}

// Generate a random class ID (for demo purposes)
function generateClassId() {
    const prefix = 'CL';
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${randomPart}`;
} 

// Date filter functions for attendance table
window.applyDateFilter = function() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        showToast('Error', 'Please select both start and end dates', 'error');
        return;
    }
    
    // Get the current class ID from the modal
    const classId = document.getElementById('classId').textContent;
    if (!classId) {
        console.error('No class ID found');
        return;
    }
    
    // Convert dates if needed
    let formattedStartDate = startDate;
    let formattedEndDate = endDate;
    
    // Convert from dd/mm/yyyy to yyyy-mm-dd format if needed
    if (startDate.includes('/')) {
        formattedStartDate = formatDateForApi(startDate);
    }
    
    if (endDate.includes('/')) {
        formattedEndDate = formatDateForApi(endDate);
    }
    
    // Reload attendance with date filters
    loadClassAttendance(classId, formattedStartDate, formattedEndDate);
};

window.resetDateFilter = function() {
    const startDatePicker = document.getElementById('startDate')._flatpickr;
    const endDatePicker = document.getElementById('endDate')._flatpickr;
    
    if (startDatePicker && endDatePicker) {
        // Reset date pickers
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 6);
        
        startDatePicker.setDate(lastWeek);
        endDatePicker.setDate(today);
        
        // Get the current class ID from the modal
        const classId = document.getElementById('classId').textContent;
        if (classId) {
            // Format dates for API
            const startDate = formatDateForApi(lastWeek);
            const endDate = formatDateForApi(today);
            
            // Reload attendance using the correct date format
            loadClassAttendance(classId, startDate, endDate);
        }
    }
}; 

// Update attendance tables with data
function updateAttendanceTables(attendanceData) {
    const studentNameColumn = document.querySelector('#studentNameColumn');
    const recordsTableBody = document.querySelector('#recordsTableBody');
    const calendarHeaderRow = document.querySelector('#calendarHeaderRow');
    
    // Handle empty data case
    if (!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) {
        if (studentNameColumn) {
            studentNameColumn.innerHTML = `
                <tr>
                    <td class="student-cell text-center">
                        <i class="bi bi-calendar3 text-muted fs-4"></i>
                        <p class="text-muted small mt-2 mb-0">No records</p>
                    </td>
                </tr>
            `;
        }
        
        if (recordsTableBody) {
            recordsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <i class="bi bi-calendar3 text-muted fs-4"></i>
                        <p class="text-muted mt-2 mb-0">No attendance records found</p>
                    </td>
                </tr>
            `;
        }
        
        // Hide pagination controls when no data
        const paginationContainer = document.querySelector('#attendancePaginationContainer');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
        
        return;
    }
    
    // Group data by student for student column
    const studentMap = new Map();
    
    for (const record of attendanceData) {
        if (!record || !record.student_id || !record.student_name) continue;
        
        // Only add each student once to the map
        if (!studentMap.has(record.student_id)) {
            studentMap.set(record.student_id, {
                id: record.student_id,
                name: record.student_name
            });
        }
    }
    
    // Update total students count for pagination
    attendancePageState.totalStudents = studentMap.size;
    
    // Get unique dates from the data and sort chronologically
    const dates = new Set();
    for (const record of attendanceData) {
        if (record && record.date) {
            dates.add(record.date);
        }
    }
    
    const sortedDates = Array.from(dates).sort();
    
    // Update calendar header with day names and dates
    if (calendarHeaderRow && sortedDates.length > 0) {
        let headerHtml = '';
        
        for (const dateStr of sortedDates) {
            try {
                const date = new Date(dateStr);
                // Format day name (Mon, Tue, etc.)
                const day = date.toLocaleDateString('en-US', { weekday: 'short' });
                // Get day number (1-31)
                const dayNum = date.getDate();
                
                headerHtml += `<th class="attendance-header">${day}<br>${dayNum}</th>`;
            } catch (e) {
                headerHtml += `<th class="attendance-header">Date</th>`;
            }
        }
        
        calendarHeaderRow.innerHTML = headerHtml;
    }
    
    // Apply pagination to students
    let studentArray = Array.from(studentMap.values());
    const startIndex = (attendancePageState.page - 1) * attendancePageState.perPage;
    const endIndex = Math.min(startIndex + attendancePageState.perPage, studentArray.length);
    const paginatedStudents = studentArray.slice(startIndex, endIndex);
    
    // Generate student rows
    if (studentNameColumn) {
        let studentRows = '';
        
        for (const student of paginatedStudents) {
            studentRows += `
                <tr>
                    <td class="student-cell">
                        <div class="student-name">${student.name || 'Unknown'}</div>
                        <div class="student-info">${student.id || 'N/A'}</div>
                    </td>
                </tr>
            `;
        }
        
        // If we generated rows, add them; otherwise show empty message
        if (studentRows) {
            studentNameColumn.innerHTML = studentRows;
        } else {
            studentNameColumn.innerHTML = `
                <tr>
                    <td class="student-cell text-center">
                        <i class="bi bi-person text-muted fs-4"></i>
                        <p class="text-muted small mt-2 mb-0">No students</p>
                    </td>
                </tr>
            `;
        }
    }
    
    // Create attendance status cells for each student and date
    if (recordsTableBody) {
        let attendanceRows = '';
        
        for (const student of paginatedStudents) {
            let row = '<tr>';
            
            for (const dateStr of sortedDates) {
                // Find attendance record for this student and date
                const record = attendanceData.find(r => 
                    r.student_id === student.id && r.date === dateStr);
                
                if (record) {
                    const statusClass = getBadgeClassForStatus(record.status);
                    
                    row += `
                        <td class="attendance-cell">
                            <div class="badge ${statusClass}" style="width: 90px; padding: 8px 0; display: block; margin: 0 auto;">
                                ${record.status || 'N/A'}
                            </div>
                        </td>
                    `;
                } else {
                    // No record for this date
                    row += `
                        <td class="attendance-cell">
                            <div class="badge bg-light text-secondary" style="width: 90px; padding: 8px 0; display: block; margin: 0 auto;">
                                --
                            </div>
                        </td>
                    `;
                }
            }
            
            row += '</tr>';
            attendanceRows += row;
        }
        
        // If we generated rows, add them; otherwise show empty message
        if (attendanceRows) {
            recordsTableBody.innerHTML = attendanceRows;
        } else {
            recordsTableBody.innerHTML = `
                <tr>
                    <td colspan="${sortedDates.length || 5}" class="text-center py-4">
                        <i class="bi bi-calendar3 text-muted fs-4"></i>
                        <p class="text-muted mt-2 mb-0">No attendance records found</p>
                    </td>
                </tr>
            `;
        }
    }
    
    // Update attendance statistics
    updateAttendanceStats(attendanceData);
    
    // Update pagination controls
    updateAttendancePagination();
}

// Function to update attendance pagination controls
function updateAttendancePagination() {
    const paginationContainer = document.querySelector('#attendancePaginationContainer');
    if (!paginationContainer) return;
    
    // Show pagination controls when we have data
    paginationContainer.style.display = 'flex';
    
    // Update pagination info
    const paginationInfo = document.querySelector('#attendancePaginationInfo');
    if (paginationInfo) {
        const startIndex = (attendancePageState.page - 1) * attendancePageState.perPage + 1;
        const endIndex = Math.min(startIndex + attendancePageState.perPage - 1, attendancePageState.totalStudents);
        paginationInfo.textContent = attendancePageState.totalStudents > 0 ? 
            `${startIndex}-${endIndex} of ${attendancePageState.totalStudents}` :
            '0-0 of 0';
    }
    
    // Update pagination buttons
    const prevButton = document.querySelector('#attendancePrevPage');
    const nextButton = document.querySelector('#attendanceNextPage');
    
    if (prevButton) {
        prevButton.disabled = attendancePageState.page === 1;
    }
    
    if (nextButton) {
        const maxPage = Math.ceil(attendancePageState.totalStudents / attendancePageState.perPage);
        nextButton.disabled = attendancePageState.page >= maxPage;
    }
}

// Attendance pagination handlers
window.changeAttendanceRowsPerPage = function() {
    const rowsSelect = document.querySelector('#attendanceRowsPerPage');
    if (rowsSelect) {
        attendancePageState.perPage = parseInt(rowsSelect.value);
        attendancePageState.page = 1; // Reset to first page
        updateAttendanceTables(currentAttendanceData);
    }
};

window.goToAttendancePrevPage = function() {
    if (attendancePageState.page > 1) {
        attendancePageState.page--;
        updateAttendanceTables(currentAttendanceData);
    }
};

window.goToAttendanceNextPage = function() {
    const maxPage = Math.ceil(attendancePageState.totalStudents / attendancePageState.perPage);
    if (attendancePageState.page < maxPage) {
        attendancePageState.page++;
        updateAttendanceTables(currentAttendanceData);
    }
}; 

// Function to properly close a modal and clean up
function closeModalProperly(modalEl) {
    // Get the Bootstrap modal instance
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    
    if (modalInstance) {
        // Hide the modal (this should handle backdrop removal)
        modalInstance.hide();
        
        // Wait for modal animation to complete before additional cleanup
        modalEl.addEventListener('hidden.bs.modal', function handler() {
            // Remove this event listener to avoid memory leaks
            modalEl.removeEventListener('hidden.bs.modal', handler);
            
            // Additional cleanup if needed
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => {
                backdrop.remove();
            });
            
            // Reset body classes and styles
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, { once: true }); // Only run once
    }
} 

// Function to generate academic years (current year -1 to current year +5)
function generateAcademicYears() {
    const academicYears = [];
    const currentYear = new Date().getFullYear();
    
    // Generate years from (current - 1) to (current + 5)
    for (let year = currentYear - 1; year <= currentYear + 5; year++) {
        academicYears.push(`${year}/${year + 1}`);
    }
    
    return academicYears;
}

// Function to populate academic year dropdowns
function populateAcademicYearDropdowns() {
    const academicYears = generateAcademicYears();
    
    // Populate academic year dropdowns for the add class modal only
    const addClassModal = document.getElementById('addClassModal');
    if (addClassModal) {
        addClassModal.addEventListener('show.bs.modal', function() {
            // Get the add modal dropdown
            const addYearDropdown = document.getElementById('academicYear');
            
            if (addYearDropdown) {
                // Clear existing options except the first one (placeholder)
                while (addYearDropdown.options.length > 1) {
                    addYearDropdown.remove(1);
                }
                
                // Add new options
                academicYears.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    addYearDropdown.appendChild(option);
                });
            }
        });
    }
    
    // For edit modal, we'll populate the dropdown only once at page load
    // and rely on the values being set in populateEditClassModal
    const editYearDropdown = document.getElementById('editClassYear');
    if (editYearDropdown && editYearDropdown.options.length <= 1) {
        const academicYears = generateAcademicYears();
        
        // Add options only if they don't already exist
        academicYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            editYearDropdown.appendChild(option);
        });
    }
}

// Function to initialize modals
function initializeModals() {
    // Populate academic year dropdowns for the add class modal only
    const addClassModal = document.getElementById('addClassModal');
    if (addClassModal) {
        addClassModal.addEventListener('show.bs.modal', function() {
            // Get the add modal dropdown
            const addYearDropdown = document.getElementById('academicYear');
            
            if (addYearDropdown) {
                const academicYears = generateAcademicYears();
                
                // Clear existing options except the first one (placeholder)
                while (addYearDropdown.options.length > 1) {
                    addYearDropdown.remove(1);
                }
                
                // Add new options
                academicYears.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    addYearDropdown.appendChild(option);
                });
            }
            
            // Set default times if they're empty
            const startTimeField = document.getElementById('addClassStartTime');
            const endTimeField = document.getElementById('addClassEndTime');
            
            if (startTimeField && !startTimeField.value) {
                startTimeField.value = "09:00";
            }
            
            if (endTimeField && !endTimeField.value) {
                endTimeField.value = "10:00";
            }
            
            // Don't reset the form on open as it clears user input
            // Instead, ensure the proper defaults are set
            const nameField = document.getElementById('addClassName');
            const dayField = document.getElementById('addClassDay');
            const statusField = document.getElementById('addClassStatus');
            const instructorField = document.getElementById('addClassInstructor');
            
            // Set default values for required fields if they're empty
            if (statusField && !statusField.value) {
                statusField.value = "Active";
            }
        });
    }
    
    // For edit modal, we'll populate the dropdown only once at page load
    // and rely on the values being set in populateEditClassModal
    const editYearDropdown = document.getElementById('editClassYear');
    if (editYearDropdown && editYearDropdown.options.length <= 1) {
        const academicYears = generateAcademicYears();
        
        // Add options only if they don't already exist
        academicYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            editYearDropdown.appendChild(option);
        });
    }
} 
