// Initialize state
let currentPageState = {
    page: 1,
    perPage: 5,
    totalItems: 0,
    currentData: [], // Initialize as empty array
    searchTerm: '',
    statusFilter: ''
};

let currentEditingClass = null;

// Add this function at the global scope (outside DOMContentLoaded)
function exportClassesCSV() {
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = '/export-classes-csv';
    
    // Get current filters
    const status = document.getElementById('statusFilter')?.value || '';
    const search = document.getElementById('searchInput')?.value || '';
    
    // Add query parameters if filters are active
    if (status || search) {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (search) params.append('search', search);
        link.href += '?' + params.toString();
    }
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Add console logs to debug data loading
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM Content Loaded');
    try {
        const response = await fetch('/api/classes');
        console.log('API Response:', response);
        
        if (!response.ok) throw new Error('Failed to fetch classes');
        const data = await response.json();
        console.log('Fetched Data:', data);
        
        currentPageState.currentData = data || [];
        currentPageState.totalItems = currentPageState.currentData.length;
        
        // Update status cards when data is loaded
        updateStatusCards(currentPageState.currentData);
        
        // Update table
        updateTable();
        
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

    } catch (error) {
        console.error('Error initializing class data:', error);
        showToast('Error', 'Failed to load classes', 'error');
    }
});

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

        const startIndex = (currentPageState.page - 1) * currentPageState.perPage;
        const endIndex = Math.min(startIndex + currentPageState.perPage, filteredData.length);
        const paginatedData = filteredData.slice(startIndex, endIndex);

        const tbody = document.querySelector('tbody');
        if (tbody) {
            if (paginatedData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center">No classes found</td>
                    </tr>`;
            } else {
                tbody.innerHTML = paginatedData.map(classItem => `
                    <tr>
                        <td>
                            <div class="fw-semibold">${classItem.name}</div>
                            <div class="small text-muted">${classItem.class_id}</div>
                        </td>
                        <td>${classItem.day}</td>
                        <td>${classItem.time}</td>
                        <td>${classItem.instructor}</td>
                        <td>${classItem.year}</td>
                        <td>
                            <span class="badge ${
                                classItem.status === 'Active' ? 'bg-success-subtle text-success' : 
                                classItem.status === 'Completed' ? 'bg-info-subtle text-info' :
                                'bg-danger-subtle text-danger'
                            }">
                                ${classItem.status}
                            </span>
                        </td>
                        <td class="text-end">
                            <div class="d-flex gap-2 justify-content-end">
                                <button class="btn btn-link p-0" onclick="handleClassAction('edit', '${classItem.class_id}')">
                                    <i class="bi bi-pencil" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" data-bs-toggle="modal" data-bs-target="#viewClassModal" onclick="handleClassAction('view', '${classItem.class_id}')">
                                    <i class="bi bi-eye" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" onclick="handleClassAction('delete', '${classItem.class_id}')">
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
                'No classes found';
        }

        // Update pagination buttons
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        if (prevButton) prevButton.disabled = currentPageState.page === 1;
        if (nextButton) nextButton.disabled = endIndex >= filteredData.length;

    } catch (error) {
        console.error('Error updating table:', error);
        showToast('Error', 'Failed to update table', 'error');
    }
}

// Function to update statistics
function updateStats(stats) {
    const totalElement = document.querySelector('.total-classes');
    const activeElement = document.querySelector('.active-classes');
    const inactiveElement = document.querySelector('.inactive-classes');

    if (totalElement) totalElement.textContent = stats.total_classes;
    if (activeElement) activeElement.textContent = stats.active_classes;
    if (inactiveElement) inactiveElement.textContent = stats.inactive_classes;
}

// Function to fetch and update data
async function fetchAndUpdateData() {
    try {
        const response = await fetch('/class-management-data');
        const data = await response.json();
        console.log('Fetched data from server:', data);
        currentPageState.currentData = data;
        updateTable(data);
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        currentPageState.currentData = [];
        return [];
    }
}

// Show toast function
function showToast(title, message, type = 'success') {
    const toast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const iconElement = toast.querySelector('.toast-header i');
    
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    iconElement.className = type === 'success' 
        ? 'bi bi-check-circle-fill text-success me-2'
        : 'bi bi-exclamation-circle-fill text-danger me-2';
    
    const bsToast = new bootstrap.Toast(toast, {
        delay: 3000
    });
    bsToast.show();
}

// Handle class actions
window.handleClassAction = async function(action, classId) {
    switch(action) {
        case 'edit':
            try {
                const response = await fetch(`/api/classes/${classId}`);
                if (!response.ok) throw new Error('Failed to fetch class details');
                const classData = await response.json();
                
                currentEditingClass = classData;
                
                const statusSelect = document.getElementById('classStatusSelect');
                statusSelect.value = classData.status;
                
                const editModal = new bootstrap.Modal(document.getElementById('editClassModal'));
                editModal.show();
            } catch (error) {
                console.error('Error editing class:', error);
                showToast('Error', 'Failed to load class details', 'error');
            }
            break;
            
        case 'view':
            const modalElement = document.getElementById('viewClassModal');
            if (!modalElement) {
                console.error('Modal element not found');
                return;
            }

            let viewModal = bootstrap.Modal.getInstance(modalElement);
            if (!viewModal) {
                viewModal = new bootstrap.Modal(modalElement);
            }

            // Initialize pagination state
            const paginationState = {
                currentPage: 1,
                rowsPerPage: 5,
                totalStudents: 0
            };

            fetch(`/class-management-data`)
                .then(response => response.json())
                .then(classes => {
                    const classDetails = classes.find(c => c.class_id === classId);
                    if (!classDetails) {
                        console.error('Class not found');
                        return;
                    }

                    // Update modal content with class details
                    document.getElementById('className').textContent = classDetails.name;
                    document.getElementById('classId').textContent = classDetails.class_id;
                    document.getElementById('classDay').textContent = classDetails.day;
                    document.getElementById('classTime').textContent = classDetails.time;
                    document.getElementById('classInstructor').textContent = classDetails.instructor;
                    document.getElementById('instructorId').textContent = classDetails.instructor_id;
                    document.getElementById('academicYear').textContent = classDetails.year;

                    // Update status badge
                    const statusBadge = document.getElementById('classStatus');
                    if (statusBadge) {
                        statusBadge.textContent = classDetails.status;
                        statusBadge.className = `badge ${classDetails.status === 'Active' ? 
                            'bg-success' : 'bg-danger'}`;
                    }

                    fetch('/api/students')
                        .then(response => response.json())
                        .then(data => {
                            const students = data.filter(user => user.role === 'Student');
                            paginationState.totalStudents = students.length;

                            // Function to update table data
                            function updateTableData() {
                                const start = (paginationState.currentPage - 1) * paginationState.rowsPerPage;
                                const end = start + paginationState.rowsPerPage;
                                const paginatedStudents = students.slice(start, end);

                                // Update student names column
                                const studentNameColumn = document.getElementById('studentNameColumn');
                                if (studentNameColumn) {
                                    studentNameColumn.innerHTML = paginatedStudents.map(student => `
                                        <tr>
                                            <td class="student-cell">
                                                <div class="student-name">${student.name}</div>
                                                <div class="student-info">Student ID: ${student.user_id}</div>
                                            </td>
                                        </tr>
                                    `).join('');
                                }

                                // Update attendance data
                                const attendanceTableBody = document.getElementById('attendanceTableBody');
                                if (attendanceTableBody) {
                                    attendanceTableBody.innerHTML = paginatedStudents.map(student => `
                                        <tr>${generateAttendanceCells()}</tr>
                                    `).join('');
                                }

                                // Update pagination info
                                const totalPages = Math.ceil(paginationState.totalStudents / paginationState.rowsPerPage);
                                const startRange = start + 1;
                                const endRange = Math.min(end, paginationState.totalStudents);
                                document.getElementById('modalPageInfo').textContent = 
                                    `${startRange}-${endRange} of ${paginationState.totalStudents}`;

                                // Update button states
                                document.getElementById('modalPrevPage').disabled = paginationState.currentPage === 1;
                                document.getElementById('modalNextPage').disabled = paginationState.currentPage === totalPages;
                            }

                            // Initialize pagination controls
                            document.getElementById('modalRowsPerPage').addEventListener('change', function(e) {
                                paginationState.rowsPerPage = parseInt(e.target.value);
                                paginationState.currentPage = 1;
                                updateTableData();
                            });

                            document.getElementById('modalPrevPage').addEventListener('click', function() {
                                if (paginationState.currentPage > 1) {
                                    paginationState.currentPage--;
                                    updateTableData();
                                }
                            });

                            document.getElementById('modalNextPage').addEventListener('click', function() {
                                const totalPages = Math.ceil(paginationState.totalStudents / paginationState.rowsPerPage);
                                if (paginationState.currentPage < totalPages) {
                                    paginationState.currentPage++;
                                    updateTableData();
                                }
                            });

                            // Initial table update
                            updateTableData();
                        })
                        .catch(error => {
                            console.error('Error fetching students:', error);
                        });

                    viewModal.show();
                })
                .catch(error => {
                    console.error('Error fetching class details:', error);
                });
            break;

        case 'delete':
            console.log('Archive class:', classId);
            break;
    }
};

// Save class status
window.saveClassStatus = async function() {
    if (!currentEditingClass) return;
    
    try {
        const newStatus = document.getElementById('classStatusSelect').value;
        
        const response = await fetch(`/api/classes/${currentEditingClass.class_id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update class status');

        // Update local data safely
        if (Array.isArray(currentPageState.currentData)) {
            currentPageState.currentData = currentPageState.currentData.map(classItem => {
                if (classItem.class_id === currentEditingClass.class_id) {
                    return { ...classItem, status: newStatus };
                }
                return classItem;
            });
        }

        // Close modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editClassModal'));
        if (editModal) {
            editModal.hide();
        }

        // Update both table and status cards
        updateTable();
        updateStatusCards(currentPageState.currentData);

        // Show success toast
        showToast('Success', 'Class status updated successfully', 'success');

    } catch (error) {
        console.error('Error saving class status:', error);
        showToast('Error', 'Failed to update class status', 'error');
    }
};

// Helper function to generate attendance cells
function generateAttendanceCells() {
    // Include 'Late' status in the possible statuses
    const statuses = ['Present', 'Late', 'Absent', 'Present', 'Present'];
    return statuses.map(status => {
        let badgeClass;
        switch(status) {
            case 'Present':
                badgeClass = 'bg-success-subtle text-success';
                break;
            case 'Late':
                badgeClass = 'bg-warning-subtle text-warning';
                break;
            case 'Absent':
                badgeClass = 'bg-danger-subtle text-danger';
                break;
        }
        
        // Show time for both Present and Late statuses
        const timeDisplay = (status === 'Present' || status === 'Late') ? 
            `<div class="attendance-time">${status === 'Late' ? '09:15 AM' : '09:00 AM'}</div>` : 
            '';
        
        return `
            <td class="attendance-cell">
                <div class="attendance-content">
                    <span class="badge ${badgeClass} attendance-badge">${status}</span>
                    ${timeDisplay}
                </div>
            </td>
        `;
    }).join('');
}

// Function to generate class ID
function generateClassId() {
    const prefix = 'kl';
    const numbers = '0123456789';
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let id = prefix;
    
    // Add 2 random numbers
    for (let i = 0; i < 2; i++) {
        id += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    
    // Add 2 random letters
    for (let i = 0; i < 2; i++) {
        id += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    
    return id;
}

// Initialize add class modal functionality
const addClassModal = document.getElementById('addClassModal');
const addClassForm = document.getElementById('addClassForm');
const classIdInput = document.getElementById('classId');

if (addClassModal) {
    addClassModal.addEventListener('show.bs.modal', function() {
        classIdInput.value = generateClassId();
    });
}

if (addClassForm) {
    addClassForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Check form validity
        if (!this.checkValidity()) {
            event.stopPropagation();
            this.classList.add('was-validated');
            return;
        }

        // Validate time range
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        if (startTime >= endTime) {
            alert('End time must be after start time');
            return;
        }

        // Collect form data
        const formData = {
            class_id: classIdInput.value,
            name: document.getElementById('className').value,
            day: document.getElementById('dayOfWeek').value,
            time: `${startTime} - ${endTime}`,
            instructor: document.getElementById('instructor').value,
            year: document.getElementById('academicYear').value,
            status: 'Active' // Default status for new classes
        };

        // TODO: Send data to server
        console.log('Form submitted:', formData);
        
        // Close modal and reset form
        const modal = bootstrap.Modal.getInstance(addClassModal);
        modal.hide();
        this.reset();
        this.classList.remove('was-validated');
        
        // Refresh table data
        fetchAndUpdateData();
    });
}

// Update the showClassDetails function to handle split view
window.showClassDetails = async function(classId) {
    try {
        // Find the class details from the current data
        const classItem = currentPageState.currentData.find(item => item.class_id === classId);
        
        if (!classItem) {
            console.error('Class not found:', classId);
            return;
        }

        // Update class details section
        document.getElementById('className').textContent = classItem.name;
        document.getElementById('classId').textContent = classItem.class_id;
        document.getElementById('classDay').textContent = classItem.day;
        document.getElementById('classTime').textContent = classItem.time;
        document.getElementById('classInstructor').textContent = classItem.instructor;
        document.getElementById('instructorId').textContent = classItem.instructor_id;
        document.getElementById('academicYear').textContent = classItem.year;
        
        // Update status badge
        const statusBadge = document.getElementById('classStatus');
        statusBadge.textContent = classItem.status;
        statusBadge.className = `badge ${classItem.status === 'Active' ? 
            'bg-success-subtle text-success' : 
            'bg-danger-subtle text-danger'}`;

        // Mock attendance data for this class
        const attendanceData = [
            {
                name: 'Miracle Apalowo',
                studentId: 'bh72zf',
                attendance: [
                    { status: 'Late', time: '8:15 AM' },
                    { status: 'Present', time: '8:00 AM' },
                    { status: 'Present', time: '8:00 AM' },
                    { status: 'Present', time: '8:00 AM' },
                    { status: 'Late', time: '8:20 AM' }
                ],
                hoursPercentage: '6.0/100%'
            },
            {
                name: 'Harry Maguire',
                studentId: 'bh75tj',
                attendance: [
                    { status: 'Absent', time: '-' },
                    { status: 'Absent', time: '-' },
                    { status: 'Present', time: '8:00 AM' },
                    { status: 'Present', time: '8:00 AM' },
                    { status: 'Late', time: '8:30 AM' }
                ],
                hoursPercentage: '4.5/100%'
            },
            {
                name: 'Mark Benson',
                studentId: 'bh92ks',
                attendance: [
                    { status: 'Present', time: '8:00 AM' },
                    { status: 'Present', time: '8:00 AM' },
                    { status: 'Absent', time: '-' },
                    { status: 'Absent', time: '-' },
                    { status: 'Absent', time: '-' }
                ],
                hoursPercentage: '3.0/100%'
            }
        ];

        // Update student names column
        const studentNameColumn = document.getElementById('studentNameColumn');
        studentNameColumn.innerHTML = attendanceData.map(student => `
            <tr>
                <td class="student-cell">
                    <div class="student-name">${student.name}</div>
                    <div class="student-info">${student.studentId}</div>
                    <div class="student-info">${student.hoursPercentage}</div>
                </td>
            </tr>
        `).join('');

        // Update attendance table body
        const tbody = document.getElementById('attendanceTableBody');
        tbody.innerHTML = attendanceData.map(student => `
            <tr>
                ${student.attendance.map(day => `
                    <td class="attendance-cell">
                        <div class="attendance-badge">
                            <span class="badge ${getStatusBadgeClass(day.status)}">
                                ${day.status}
                            </span>
                        </div>
                        <div class="attendance-time">
                            ${day.time}
                        </div>
                    </td>
                `).join('')}
            </tr>
        `).join('');

        // Calculate and update statistics
        const totalPresent = attendanceData.reduce((sum, student) => 
            sum + student.attendance.filter(day => day.status === 'Present').length, 0);
        
        const totalAbsent = attendanceData.reduce((sum, student) => 
            sum + student.attendance.filter(day => day.status === 'Absent').length, 0);
        
        const totalAttendances = attendanceData.length * 5; // 5 days
        const attendancePercentage = ((totalPresent / totalAttendances) * 100).toFixed(2);

        document.getElementById('totalPresent').textContent = totalPresent;
        document.getElementById('totalAbsence').textContent = totalAbsent;
        document.getElementById('attendancePercentage').textContent = `${attendancePercentage}%`;

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('viewClassModal'));
        modal.show();

    } catch (error) {
        console.error('Error showing class details:', error);
    }
};

// Update the badge classes to match the image
function getStatusBadgeClass(status) {
    switch(status) {
        case 'Present':
            return 'bg-success text-white';
        case 'Absent':
            return 'bg-danger text-white';
        case 'Late':
            return 'bg-warning text-dark';
        default:
            return 'bg-secondary';
    }
}

// Handle modal focus management
const viewClassModal = document.getElementById('viewClassModal');
if (viewClassModal) {
    viewClassModal.addEventListener('shown.bs.modal', function () {
        // Set focus to first focusable element
        const firstFocusable = this.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
    });

    viewClassModal.addEventListener('hidden.bs.modal', function () {
        // Return focus to trigger element
        const triggerElement = document.querySelector('[data-bs-target="#viewClassModal"]');
        if (triggerElement) {
            triggerElement.focus();
        }
    });
}
// Initialize tooltips
document.addEventListener('DOMContentLoaded', function() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});

// Add this function to update the status cards
function updateStatusCards(data) {
    if (!Array.isArray(data)) return;

    const totalClasses = data.length;
    const activeClasses = data.filter(item => item.status === 'Active').length;
    const completedClasses = data.filter(item => item.status === 'Completed').length;
    const inactiveClasses = data.filter(item => item.status === 'Inactive').length;

    // Update the numbers in the cards
    document.querySelector('[data-count="total"]').textContent = totalClasses;
    document.querySelector('[data-count="active"]').textContent = activeClasses;
    document.querySelector('[data-count="completed"]').textContent = completedClasses;
    document.querySelector('[data-count="inactive"]').textContent = inactiveClasses;
} 
