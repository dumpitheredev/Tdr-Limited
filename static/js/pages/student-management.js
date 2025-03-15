let currentPageState = {
    page: 1,
    perPage: 5,
    totalItems: 0,
    currentData: [],
    searchTerm: '',
    statusFilter: ''
};

let currentEditingStudent = null;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initial data fetch
        const response = await fetch('/api/students');
        if (!response.ok) {
            throw new Error('Failed to fetch students');
        }
        const data = await response.json();
        
        // Store the data in currentPageState
        currentPageState.currentData = data.filter(user => user.role === 'Student') || [];
        currentPageState.totalItems = currentPageState.currentData.length;
        
        // Update status cards when data is loaded
        updateStatusCards(currentPageState.currentData);
        
        // Initialize table
        updateTable();
        
        // Add status filter handler
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                currentPageState.page = 1;
                currentPageState.statusFilter = this.value;
                updateTable();
            });
        }
        
        // Add search handler
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                currentPageState.page = 1;
                currentPageState.searchTerm = this.value;
                updateTable();
            });
        }

        // Add rows per page handler
    const rowsPerPage = document.getElementById('rowsPerPage');
        if (rowsPerPage) {
            rowsPerPage.addEventListener('change', function() {
                currentPageState.page = 1;
                currentPageState.perPage = parseInt(this.value);
                updateTable();
            });
        }

        // Add pagination handlers
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
        
        if (prevPage) {
            prevPage.addEventListener('click', function() {
                if (currentPageState.page > 1) {
                    currentPageState.page--;
                    updateTable();
                }
            });
        }

        if (nextPage) {
            nextPage.addEventListener('click', function() {
                const maxPage = Math.ceil(currentPageState.totalItems / currentPageState.perPage);
                if (currentPageState.page < maxPage) {
                    currentPageState.page++;
                    updateTable();
                }
            });
        }

    } catch (error) {
        console.error('Error initializing student management:', error);
        showToast('Error', 'Failed to load students', 'error');
    }
});

function updateTable() {
    try {
        // Get filtered data
        let filteredData = [...(currentPageState.currentData || [])];

        // Apply status filter
        if (currentPageState.statusFilter) {
            filteredData = filteredData.filter(student => 
                student.status === currentPageState.statusFilter
            );
        }

        // Apply search filter
        if (currentPageState.searchTerm) {
            const searchTerm = currentPageState.searchTerm.toLowerCase();
            filteredData = filteredData.filter(student =>
                student.name.toLowerCase().includes(searchTerm) ||
                student.user_id.toLowerCase().includes(searchTerm)
            );
        }

        // Update total items
        const totalItems = filteredData.length;
        currentPageState.totalItems = totalItems;

        // Calculate pagination
        const startIndex = (currentPageState.page - 1) * currentPageState.perPage;
        const endIndex = Math.min(startIndex + currentPageState.perPage, totalItems);
        const paginatedData = filteredData.slice(startIndex, endIndex);

        // Update table content
        const tbody = document.querySelector('tbody');
        if (tbody) {
            if (paginatedData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center">No students found</td>
                    </tr>`;
            } else {
                tbody.innerHTML = paginatedData.map(student => `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <img src="/static/images/${student.profile_img}" 
                                     alt="Profile" 
                                     class="rounded-circle me-2" 
                                     width="32" 
                                     height="32">
                                <div>
                                    <div class="fw-semibold">${student.name}</div>
                                    <div class="small text-muted">${student.user_id}</div>
                                </div>
                            </div>
                        </td>
                        <td>${student.role}</td>
                        <td>
                            <span class="badge ${
                                student.status === 'Active' ? 'bg-success-subtle text-success' : 
                                student.status === 'Completed' ? 'bg-info-subtle text-info' :
                                'bg-danger-subtle text-danger'
                            }" style="${
                                student.status === 'Completed' ? 'bg-info-subtle text-info' : ''
                            }">
                                ${student.status}
                            </span>
                        </td>
                        <td class="text-end">
                            <div class="d-flex gap-2 justify-content-end">
                                <button class="btn btn-link p-0" onclick="handleStudentAction('edit', '${student.user_id}')">
                                    <i class="bi bi-pencil" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" data-bs-toggle="modal" data-bs-target="#viewStudentModal" onclick="handleStudentAction('view', '${student.user_id}')">
                                    <i class="bi bi-eye" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" onclick="handleStudentAction('delete', '${student.user_id}')">
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
            paginationInfo.textContent = totalItems > 0 ? 
                `${startIndex + 1}-${endIndex} of ${totalItems}` : 
                'No students found';
        }

        // Update button states
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        if (prevButton) prevButton.disabled = currentPageState.page === 1;
        if (nextButton) nextButton.disabled = endIndex >= totalItems;

    } catch (error) {
        console.error('Error updating table:', error);
        showToast('Error', 'Failed to update table', 'error');
    }
}

// Handle student actions (view, edit, delete)
window.handleStudentAction = async function(action, studentId) {
    switch(action) {
        case 'view':
            try {
                const response = await fetch(`/api/students/${studentId}`);
                if (!response.ok) throw new Error('Failed to fetch student details');
                const student = await response.json();

                // Update modal content with student details
                document.getElementById('studentName').textContent = student.name;
                document.getElementById('studentId').textContent = student.user_id;
                document.getElementById('studentStatus').textContent = student.status;
                document.getElementById('studentStatus').className = `badge ${
                    student.status === 'Active' ? 'bg-success' : 'bg-danger'
                }`;
                document.getElementById('studentImage').src = `/static/images/${student.profile_img}`;
                
                // Update company and group info
                document.getElementById('studentCompany').textContent = 
                    student.company || 'Not Assigned';
                document.getElementById('studentGroup').textContent = 
                    student.group || 'Not Assigned';

                // Update enrolled classes
                const enrolledClasses = student.enrolled_classes || [];
                document.getElementById('enrolledClasses').innerHTML = 
                    enrolledClasses.length ? enrolledClasses.map(classInfo => `
                        <div class="mb-2">
                            <div class="fw-semibold">${classInfo.class_code} - ${classInfo.class_name}</div>
                            <div class="small text-muted">
                                Schedule: ${classInfo.schedule}<br>
                                Instructor: ${classInfo.instructor}
                            </div>
                        </div>
                    `).join('') : '<p class="text-muted mb-0">No classes enrolled</p>';

            } catch (error) {
                console.error('Error viewing student:', error);
            }
            break;

        case 'edit':
            try {
                const response = await fetch(`/api/students/${studentId}`);
                if (!response.ok) throw new Error('Failed to fetch student details');
                const student = await response.json();
                
                // Store the current editing student
                currentEditingStudent = student;
                
                // Set the current status in the select
                const statusSelect = document.getElementById('studentStatusSelect');
                statusSelect.value = student.status;
                
                // Show the edit modal
                const editModal = new bootstrap.Modal(document.getElementById('editStudentModal'));
                editModal.show();
            } catch (error) {
                console.error('Error editing student:', error);
            }
            break;

        case 'delete':
            console.log('Delete student:', studentId);
            break;
    }
};

function initializeModalPagination() {
    // Get all required elements with null checks
    const modalRowsPerPage = document.getElementById('modalRowsPerPage');
    const modalPrevPage = document.getElementById('modalPrevPage');
    const modalNextPage = document.getElementById('modalNextPage');
    const modalPaginationInfo = document.getElementById('modalPaginationInfo');

    // Initialize state variables
    let modalCurrentPage = 1;
    let modalPerPage = modalRowsPerPage ? parseInt(modalRowsPerPage.value) || 10 : 10; // Default to 10 if element not found
    let modalTotalItems = 0;

    // Function to update modal pagination info
    function updateModalPaginationInfo(start, end, total) {
        if (modalPaginationInfo) {
            modalPaginationInfo.textContent = `${start}-${end} of ${total}`;
        }
    }

    // Function to update modal pagination buttons
    function updateModalPaginationButtons(totalItems) {
        if (!modalPrevPage || !modalNextPage) return;
        
        const maxPage = Math.ceil(totalItems / modalPerPage);
        modalPrevPage.disabled = modalCurrentPage <= 1;
        modalNextPage.disabled = modalCurrentPage >= maxPage;
    }

    // Event handlers for modal pagination
    if (modalRowsPerPage) {
        modalRowsPerPage.addEventListener('change', function() {
            modalPerPage = parseInt(this.value) || 10;
            modalCurrentPage = 1; // Reset to first page
            updateModalPaginationInfo(1, modalPerPage, modalTotalItems);
            updateModalPaginationButtons(modalTotalItems);
        });
    }

    if (modalPrevPage) {
        modalPrevPage.addEventListener('click', function() {
            if (!this.disabled && modalCurrentPage > 1) {
                modalCurrentPage--;
                const start = (modalCurrentPage - 1) * modalPerPage + 1;
                const end = Math.min(start + modalPerPage - 1, modalTotalItems);
                updateModalPaginationInfo(start, end, modalTotalItems);
                updateModalPaginationButtons(modalTotalItems);
            }
        });
    }

    if (modalNextPage) {
        modalNextPage.addEventListener('click', function() {
            const maxPage = Math.ceil(modalTotalItems / modalPerPage);
            if (!this.disabled && modalCurrentPage < maxPage) {
                modalCurrentPage++;
                const start = (modalCurrentPage - 1) * modalPerPage + 1;
                const end = Math.min(start + modalPerPage - 1, modalTotalItems);
                updateModalPaginationInfo(start, end, modalTotalItems);
                updateModalPaginationButtons(modalTotalItems);
            }
        });
    }

    // Initialize pagination with default values
    modalTotalItems = 50; // Replace with actual total
    if (modalPaginationInfo && modalPrevPage && modalNextPage) {
        updateModalPaginationInfo(1, modalPerPage, modalTotalItems);
        updateModalPaginationButtons(modalTotalItems);
    }
}

// Function to calculate and update attendance statistics
function updateAttendanceStatistics() {
    try {
        // Get all attendance cells
        const attendanceCells = document.querySelectorAll('.attendance-cell .badge');
        
        let totalPresent = 0;
        let totalAbsence = 0;
        let totalDays = attendanceCells.length;
        
        // Count present and absent days
        attendanceCells.forEach(badge => {
            if (badge.classList.contains('badge-present')) {
                totalPresent++;
            } else if (badge.classList.contains('badge-absent')) {
                totalAbsence++;
            }
            // Note: Late is counted as present for percentage calculation
            if (badge.classList.contains('badge-late')) {
                totalPresent++;
            }
        });
        
        // Calculate attendance percentage
        const attendancePercentage = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;
        
        // Update the statistics in the modal - with null checks
        const totalPresentElement = document.getElementById('totalPresent');
        const totalAbsenceElement = document.getElementById('totalAbsence');
        const attendancePercentageElement = document.getElementById('attendancePercentage');
        
        if (totalPresentElement) totalPresentElement.textContent = totalPresent;
        if (totalAbsenceElement) totalAbsenceElement.textContent = totalAbsence;
        if (attendancePercentageElement) {
            attendancePercentageElement.textContent = `${attendancePercentage.toFixed(2)}%`;
        }
    } catch (error) {
        console.error('Error updating attendance statistics:', error);
    }
}

// Function to handle date range search
function handleDateRangeSearch() {
    const dateFrom = document.getElementById('dateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value;
    
    if (dateFrom && dateTo) {
        // Add your date range filtering logic here
        console.log('Date range:', dateFrom, 'to', dateTo);
        // Update the table and statistics based on the date range
        updateAttendanceStatistics();
    }
}

const attendanceTable = {
    init: function(type = 'student') {
        this.type = type;
        this.initializeDatePickers();
        this.bindEvents();
        this.populateTable();
    },

    initializeDatePickers: function() {
        // Initialize start date picker
        this.startDatePicker = flatpickr("#startDate", {
            dateFormat: "d/m/Y",
            allowInput: true,
            maxDate: 'today',
            onChange: (selectedDates, dateStr) => {
                // Update end date minimum when start date changes
                this.endDatePicker.set('minDate', dateStr);
            }
        });

        // Initialize end date picker
        this.endDatePicker = flatpickr("#endDate", {
            dateFormat: "d/m/Y",
            allowInput: true,
            maxDate: 'today',
            onChange: (selectedDates, dateStr) => {
                // Update start date maximum when end date changes
                this.startDatePicker.set('maxDate', dateStr);
            }
        });

        // Set initial dates (last 7 days)
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 6); // Show last 7 days including today

        this.startDatePicker.setDate(lastWeek);
        this.endDatePicker.setDate(today);
    },

    bindEvents: function() {
        // Bind calendar icon clicks
        document.querySelectorAll('.calendar-icon').forEach(icon => {
            icon.style.pointerEvents = 'auto';
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', (e) => {
                const input = e.target.closest('.date-input-wrapper').querySelector('input');
                input._flatpickr.open();
            });
        });

        // Bind filter button clicks
        const applyFilterBtn = document.querySelector('.apply-filter');
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => this.filterAttendance());
        }

        const resetFilterBtn = document.querySelector('button[onclick="attendanceTable.resetFilter()"]');
        if (resetFilterBtn) {
            resetFilterBtn.removeAttribute('onclick');
            resetFilterBtn.addEventListener('click', () => this.resetFilter());
        }
    },

    filterAttendance: function() {
        const startDate = this.startDatePicker.selectedDates[0];
        const endDate = this.endDatePicker.selectedDates[0];
        
        if (startDate && endDate) {
            console.log('Filtering attendance between:', startDate, 'and', endDate);
            // Implement your filtering logic here
            this.populateTable(); // Refresh table with filtered data
        }
    },

    resetFilter: function() {
        // Reset date pickers to last 7 days
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 6);

        this.startDatePicker.setDate(lastWeek);
        this.endDatePicker.setDate(today);

        // Reset table to show all data
        this.populateTable();
    },

    calculateStatistics: function(lectureData) {
        let totalDays = 0;
        let totalPresent = 0;
        let totalAbsent = 0;

        lectureData.forEach(lecture => {
            lecture.attendance.forEach(day => {
                totalDays++;
                if (day.status === 'present' || day.status === 'late') {
                    totalPresent++;
                } else if (day.status === 'absent') {
                    totalAbsent++;
                }
            });
        });

        const attendancePercentage = totalDays > 0 
            ? ((totalPresent / totalDays) * 100).toFixed(2)
            : 0;

        // Update the statistics cards
        const totalPresentElement = document.getElementById('totalPresent');
        const totalAbsenceElement = document.getElementById('totalAbsence');
        const attendancePercentageElement = document.getElementById('attendancePercentage');

        if (totalPresentElement) totalPresentElement.textContent = totalPresent;
        if (totalAbsenceElement) totalAbsenceElement.textContent = totalAbsent;
        if (attendancePercentageElement) attendancePercentageElement.textContent = `${attendancePercentage}%`;
    },

    populateTable: function() {
        const nameColumn = document.getElementById('studentNameColumn');
        const attendanceBody = document.getElementById('attendanceTableBody');
        
        // Using first 3 classes from mock_classes in app.py
        const lectureData = [
            {
                name: '(KL45XY) Mathematics 101',
                time: '09:00 - 10:30',
                attendance: [
                    { status: 'late', time: '9:20 AM' },
                    { status: 'present', time: '9:00 AM' },
                    { status: 'present', time: '9:00 AM' },
                    { status: 'present', time: '9:00 AM' },
                    { status: 'late', time: '9:20 AM' }
                ]
            },
            {
                name: '(KL72AB) Physics Basic',
                time: '11:00 - 12:30',
                attendance: [
                    { status: 'absent', time: '-' },
                    { status: 'absent', time: '-' },
                    { status: 'present', time: '11:00 AM' },
                    { status: 'present', time: '11:00 AM' },
                    { status: 'late', time: '11:30 AM' }
                ]
            },
            {
                name: '(KL89CD) Chemistry Lab',
                time: '14:00 - 15:30',
                attendance: [
                    { status: 'present', time: '14:00 AM' },
                    { status: 'present', time: '14:00 AM' },
                    { status: 'absent', time: '-' },
                    { status: 'absent', time: '-' },
                    { status: 'absent', time: '-' }
                ]
            }
        ];

        if (this.type === 'student') {
            // Clear existing content
            nameColumn.innerHTML = '';
            
            // Update header text
            const header = document.querySelector('.student-header');
            if (header) {
                header.textContent = 'Lecture Details';
            }

            // Populate lecture details
            lectureData.forEach(lecture => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="student-cell">
                        <div class="student-name">${lecture.name}</div>
                        <div class="student-info">${lecture.time}</div>
                    </td>
                `;
                nameColumn.appendChild(row);
            });

            // Rest of the attendance population code remains the same
            attendanceBody.innerHTML = '';
            lectureData.forEach(lecture => {
                const row = document.createElement('tr');
                lecture.attendance.forEach(day => {
                    let badgeClasses = '';
                    switch(day.status) {
                        case 'present':
                            badgeClasses = 'bg-success-subtle text-success';
                break;
                        case 'absent':
                            badgeClasses = 'bg-danger-subtle text-danger';
                break;
                        case 'late':
                            badgeClasses = 'bg-warning-subtle text-warning';
                break;
                    }
                    
                    row.innerHTML += `
                        <td class="attendance-cell">
                            <div class="attendance-content">
                                <span class="badge ${badgeClasses}" 
                                      style="padding: 8px 16px; font-size: 14px;">
                                    ${day.status.charAt(0).toUpperCase() + day.status.slice(1)}
                                </span>
                                <span class="attendance-time">${day.time}</span>
                            </div>
                        </td>
                    `;
                });
                attendanceBody.appendChild(row);
            });

            // Calculate and update statistics
            this.calculateStatistics(lectureData);
        }
    },

    // ... rest of your existing attendance table functions
};

// Initialize based on modal type
document.addEventListener('DOMContentLoaded', function() {
    const viewStudentModal = document.getElementById('viewStudentModal');
    const viewClassModal = document.getElementById('viewClassModal');

    if (viewStudentModal) {
        viewStudentModal.addEventListener('show.bs.modal', function() {
            // Initialize attendance table with student type
            attendanceTable.init('student');
            
            // Make calendar icons clickable in modal
            viewStudentModal.querySelectorAll('.calendar-icon').forEach(icon => {
                icon.style.pointerEvents = 'auto';
                icon.style.cursor = 'pointer';
                icon.addEventListener('click', (e) => {
                    const input = e.target.closest('.date-input-wrapper').querySelector('input');
                    if (input._flatpickr) {
                        input._flatpickr.open();
                    }
                });
            });

            // Style the Apply Filter button
            const applyFilterBtn = viewStudentModal.querySelector('.apply-filter');
            if (applyFilterBtn) {
                applyFilterBtn.style.backgroundColor = '#191970';
                applyFilterBtn.style.borderColor = '#191970';
            }
        });
    }

    if (viewClassModal) {
        viewClassModal.addEventListener('show.bs.modal', function() {
            attendanceTable.init('class');
        });
    }
});

// Add this function at the top level of your file
function showToast(title, message, type = 'success') {
    const toast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const iconElement = toast.querySelector('.toast-header i');
    
    // Update toast content
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Update icon and color based on type
    iconElement.className = type === 'success' 
        ? 'bi bi-check-circle-fill text-success me-2'
        : 'bi bi-exclamation-circle-fill text-danger me-2';
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast, {
        delay: 3000 // Auto-hide after 3 seconds
    });
    bsToast.show();
}

// Add the updateStatusCards function
function updateStatusCards(data) {
    if (!Array.isArray(data)) return;

    const totalStudents = data.length;
    const activeStudents = data.filter(item => item.status === 'Active').length;
    const completedStudents = data.filter(item => item.status === 'Completed').length;
    const inactiveStudents = data.filter(item => item.status === 'Inactive').length;

    // Update the numbers in the cards
    document.querySelector('[data-count="total"]').textContent = totalStudents;
    document.querySelector('[data-count="active"]').textContent = activeStudents;
    document.querySelector('[data-count="completed"]').textContent = completedStudents;
    document.querySelector('[data-count="inactive"]').textContent = inactiveStudents;
}

// Update the saveStudentStatus function
window.saveStudentStatus = async function() {
    if (!currentEditingStudent) return;
    
    try {
        const newStatus = document.getElementById('studentStatusSelect').value;
        
        const response = await fetch(`/api/students/${currentEditingStudent.user_id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update student status');

        // Update local data safely
        if (Array.isArray(currentPageState.currentData)) {
            currentPageState.currentData = currentPageState.currentData.map(student => {
                if (student.user_id === currentEditingStudent.user_id) {
                    return { ...student, status: newStatus };
                }
                return student;
            });
        }

        // Close modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editStudentModal'));
        if (editModal) {
            editModal.hide();
        }

        // Update both table and status cards
        updateTable();
        updateStatusCards(currentPageState.currentData);

        // Show success toast
        showToast('Success', 'Student status updated successfully', 'success');

    } catch (error) {
        console.error('Error saving student status:', error);
        showToast('Error', 'Failed to update student status', 'error');
    }
};