document.addEventListener('DOMContentLoaded', function() {
    const markAttendanceButtons = document.querySelectorAll('.mark-attendance-btn');
    const attendanceTableSection = document.getElementById('attendance-table-section');
    const selectedClassName = document.getElementById('selected-class-name');
    const attendanceTableBody = document.getElementById('attendanceTableBody');
    const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
    const attendanceDate = document.getElementById('attendanceDate');
    
    // Set default date to today
    const today = new Date();
    attendanceDate.value = today.toISOString().split('T')[0];
    
    // Toast elements and initialization
    const statusToast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = statusToast.querySelector('.toast-header i');
    const toast = new bootstrap.Toast(statusToast);
    
    let selectedClassId = null;
    let selectedClassNameText = '';
    
    // Mock data for students enrolled in each class
    const classEnrollments = {
        '1': [ // Engineering Fundamentals
            { id: 'st89mn', name: 'Michael Chen', profile_img: 'profile.png' },
            { id: 'st12qw', name: 'Liu Wei', profile_img: 'profile2.png' },
            { id: 'st45ty', name: 'David Smith', profile_img: 'profile3.png' }
        ],
        '2': [ // CAD Design
            { id: 'st45ty', name: 'David Smith', profile_img: 'profile3.png' },
            { id: 'st78gh', name: 'Sophie Martin', profile_img: 'profile4.png' },
            { id: 'st34mm', name: 'Emily Brown', profile_img: 'profile5.png' },
            { id: 'st67kl', name: 'James Wilson', profile_img: 'profile.png' }
        ],
        '3': [ // Materials Science
            { id: 'st89mn', name: 'Michael Chen', profile_img: 'profile.png' },
            { id: 'st78gh', name: 'Sophie Martin', profile_img: 'profile4.png' },
            { id: 'st34mm', name: 'Emily Brown', profile_img: 'profile5.png' },
            { id: 'st91ab', name: 'Sarah Johnson', profile_img: 'profile2.png' },
            { id: 'st23cd', name: 'Robert Lee', profile_img: 'profile3.png' }
        ]
    };
    
    // Mock attendance data for previous dates
    const previousAttendance = {
        '1': {
            '2023-11-15': {
                'st89mn': { status: 'Present', comment: 'On time' },
                'st12qw': { status: 'Absent', comment: 'Sick leave' },
                'st45ty': { status: 'Late', comment: 'Traffic delay' }
            },
            '2023-11-22': {
                'st89mn': { status: 'Present', comment: '' },
                'st12qw': { status: 'Present', comment: '' },
                'st45ty': { status: 'Present', comment: '' }
            }
        },
        '2': {
            '2023-11-16': {
                'st45ty': { status: 'Present', comment: '' },
                'st78gh': { status: 'Present', comment: '' },
                'st34mm': { status: 'Absent', comment: 'Family emergency' },
                'st67kl': { status: 'Late', comment: 'Bus delay' }
            }
        },
        '3': {
            '2023-11-17': {
                'st89mn': { status: 'Present', comment: '' },
                'st78gh': { status: 'Present', comment: '' },
                'st34mm': { status: 'Present', comment: '' },
                'st91ab': { status: 'Absent', comment: 'Doctor appointment' },
                'st23cd': { status: 'Present', comment: '' }
            }
        }
    };
    
    markAttendanceButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            // Get the class ID and name from the button
            selectedClassId = this.dataset.classId;
            selectedClassNameText = this.dataset.className;
            selectedClassName.textContent = selectedClassNameText;
            
            // Show the attendance table
            attendanceTableSection.style.display = 'block';
            
            // Load students for this class
            loadStudentsForClass(selectedClassId);
            
            // Scroll to the table
            attendanceTableSection.scrollIntoView({ behavior: 'smooth' });
        });
    });
    
    // Date change handler
    attendanceDate.addEventListener('change', function() {
        if (selectedClassId) {
            loadStudentsForClass(selectedClassId);
        }
    });
    
    function loadStudentsForClass(classId) {
        // Clear the table first
        attendanceTableBody.innerHTML = '';
        
        // Get students enrolled in this class
        const students = classEnrollments[classId] || [];
        
        if (students.length === 0) {
            // No students enrolled
            const noStudentsRow = document.createElement('tr');
            noStudentsRow.innerHTML = `
                <td colspan="3" class="text-center py-4">
                    <p class="text-muted mb-0">No students enrolled in this class.</p>
                </td>
            `;
            attendanceTableBody.appendChild(noStudentsRow);
            return;
        }
        
        // Check if we have attendance data for this date
        const selectedDate = attendanceDate.value;
        const existingAttendance = previousAttendance[classId] && previousAttendance[classId][selectedDate];
        
        // Reset save button
        saveAttendanceBtn.innerHTML = '<i class="bi bi-save me-1"></i> Save Attendance';
        saveAttendanceBtn.disabled = false;
        
        // Add student rows
        students.forEach(student => {
            const studentRow = document.createElement('tr');
            studentRow.className = 'student-row';
            
            // Get existing attendance data for this student if available
            const studentAttendance = existingAttendance && existingAttendance[student.id];
            
            studentRow.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${window.location.origin}/static/images/${student.profile_img}" 
                             alt="Profile" class="rounded-circle me-2" width="35" height="35">
                        <div>
                            <h6 class="mb-0">${student.name}</h6>
                            <small class="text-muted">${student.id}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <select class="form-select form-select-sm attendance-status" 
                            name="status_${student.id}" 
                            data-student-id="${student.id}"
                            aria-label="Attendance status"
                            onchange="updateStatusStyle(this)">
                        <option value="" ${!studentAttendance ? 'selected disabled' : ''}>Select status</option>
                        <option value="Present" ${studentAttendance && studentAttendance.status === 'Present' ? 'selected' : ''} class="text-success">Present</option>
                        <option value="Absent" ${studentAttendance && studentAttendance.status === 'Absent' ? 'selected' : ''} class="text-danger">Absent</option>
                        <option value="Late" ${studentAttendance && studentAttendance.status === 'Late' ? 'selected' : ''} class="text-warning">Late</option>
                    </select>
                </td>
                <td>
                    <input type="text" class="form-control form-control-sm attendance-comment" 
                           data-student-id="${student.id}"
                           name="comment_${student.id}" 
                           placeholder="Add comment (optional)"
                           value="${studentAttendance ? studentAttendance.comment : ''}">
                </td>
            `;
            
            attendanceTableBody.appendChild(studentRow);
            
            // Apply styling to pre-selected status
            if (studentAttendance) {
                const statusSelect = studentRow.querySelector('.attendance-status');
                updateStatusStyle(statusSelect);
            }
        });
        
        // Initialize pagination after loading students
        initializePagination();
        
        // Set up search after loading students
        const searchInput = document.getElementById('searchInput');
        searchInput.value = ''; // Clear search on new class selection
        searchInput.addEventListener('input', filterTable);
    }

    // Save Attendance button click handler
    saveAttendanceBtn.addEventListener('click', function() {
        // Validate that all students have a status selected
        const statusSelects = document.querySelectorAll('.attendance-status');
        let allValid = true;
        let incompleteCount = 0;
        
        statusSelects.forEach(select => {
            if (!select.value) {
                select.classList.add('is-invalid');
                allValid = false;
                incompleteCount++;
            } else {
                select.classList.remove('is-invalid');
            }
        });
        
        if (!allValid) {
            // Show error toast
            toastTitle.textContent = "Error";
            toastMessage.textContent = `Please select a status for all students. ${incompleteCount} status(es) missing.`;
            toastIcon.classList.remove('bi-check-circle-fill', 'text-success');
            toastIcon.classList.add('bi-exclamation-circle-fill', 'text-danger');
            toast.show();
            return;
        }
        
        // Collect attendance data
        const attendanceData = {
            class_id: selectedClassId,
            class_name: selectedClassNameText,
            date: attendanceDate.value,
            records: []
        };
        
        // Get all student rows
        document.querySelectorAll('.student-row').forEach(row => {
            const statusSelect = row.querySelector('.attendance-status');
            if (statusSelect) {
                const studentId = statusSelect.dataset.studentId;
                const status = statusSelect.value;
                const comment = row.querySelector('.attendance-comment').value;
                
                attendanceData.records.push({
                    student_id: studentId,
                    status: status,
                    comment: comment
                });
            }
        });
        
        // Send data to server
        console.log("Sending attendance data:", attendanceData);
        
        // Simulate API call with a timeout (replace with actual fetch in production)
        setTimeout(() => {
            // Show success toast with class name
            toastTitle.textContent = "Success";
            toastMessage.textContent = `Attendance for ${selectedClassNameText} on ${formatDate(attendanceDate.value)} has been successfully saved.`;
            toastIcon.classList.remove('bi-exclamation-circle-fill', 'text-danger');
            toastIcon.classList.add('bi-check-circle-fill', 'text-success');
            toast.show();
            
            // Store in our mock data structure
            if (!previousAttendance[selectedClassId]) {
                previousAttendance[selectedClassId] = {};
            }
            
            previousAttendance[selectedClassId][attendanceDate.value] = {};
            
            attendanceData.records.forEach(record => {
                previousAttendance[selectedClassId][attendanceDate.value][record.student_id] = {
                    status: record.status,
                    comment: record.comment
                };
            });
            
            // Change save button to indicate saved state
            saveAttendanceBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Saved';
            
        }, 1000);
        
        /* 
        // Actual implementation would use fetch API
        fetch('/api/admin/save-attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(attendanceData),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success toast with class name
                toastTitle.textContent = "Success";
                toastMessage.textContent = `Attendance for ${selectedClassNameText} on ${formatDate(attendanceDate.value)} has been successfully saved.`;
                toastIcon.classList.remove('bi-exclamation-circle-fill', 'text-danger');
                toastIcon.classList.add('bi-check-circle-fill', 'text-success');
                toast.show();
            } else {
                // Show error toast
                toastTitle.textContent = "Error";
                toastMessage.textContent = data.message || "Failed to save attendance. Please try again.";
                toastIcon.classList.remove('bi-check-circle-fill', 'text-success');
                toastIcon.classList.add('bi-exclamation-circle-fill', 'text-danger');
                toast.show();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            // Show error toast
            toastTitle.textContent = "Error";
            toastMessage.textContent = "Network error. Please try again.";
            toastIcon.classList.remove('bi-check-circle-fill', 'text-success');
            toastIcon.classList.add('bi-exclamation-circle-fill', 'text-danger');
            toast.show();
        });
        */
    });

    // Format date for display
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    // Search functionality
    function filterTable() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const tableRows = document.querySelectorAll('.student-row');
        let visibleCount = 0;
        
        tableRows.forEach(row => {
            const studentName = row.querySelector('h6').textContent.toLowerCase();
            const studentId = row.querySelector('small').textContent.toLowerCase();
            
            const matchesSearch = studentName.includes(searchTerm) || 
                                 studentId.includes(searchTerm);
            
            // Mark as filtered for pagination use
            if (matchesSearch) {
                visibleCount++;
                row.classList.remove('d-none');
            } else {
                row.classList.add('d-none');
            }
        });
        
        // Reset to first page when searching
        currentPage = 1;
        updatePagination();
    }
    
    // Pagination functionality
    const rowsPerPage = document.getElementById('rowsPerPage');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');
    
    let currentPage = 1;
    
    function initializePagination() {
        // Reset page
        currentPage = 1;
        
        // Remove existing event listeners and add new ones
        rowsPerPage.removeEventListener('change', handleRowsPerPageChange);
        prevPageBtn.removeEventListener('click', handlePrevPage);
        nextPageBtn.removeEventListener('click', handleNextPage);
        
        rowsPerPage.addEventListener('change', handleRowsPerPageChange);
        prevPageBtn.addEventListener('click', handlePrevPage);
        nextPageBtn.addEventListener('click', handleNextPage);
        
        updatePagination();
    }
    
    function handleRowsPerPageChange() {
        currentPage = 1;
        updatePagination();
    }
    
    function handlePrevPage() {
        if (currentPage > 1) {
            currentPage--;
            updatePagination();
        }
    }
    
    function handleNextPage() {
        const totalPages = Math.ceil(getVisibleRows().length / parseInt(rowsPerPage.value));
        if (currentPage < totalPages) {
            currentPage++;
            updatePagination();
        }
    }
    
    function getVisibleRows() {
        return Array.from(document.querySelectorAll('.student-row')).filter(row => !row.classList.contains('d-none'));
    }
    
    function updatePagination() {
        const visibleRows = getVisibleRows();
        const rowsPerPageValue = parseInt(rowsPerPage.value);
        const totalRows = visibleRows.length;
        const totalPages = Math.ceil(totalRows / rowsPerPageValue);
        
        // Update pagination buttons state
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalRows === 0;
        
        // Show/hide rows based on current page
        const startIdx = (currentPage - 1) * rowsPerPageValue;
        const endIdx = Math.min(startIdx + rowsPerPageValue, totalRows);
        
        // First hide all rows that should be visible
        visibleRows.forEach(row => {
            row.style.display = 'none';
        });
        
        // Show only the rows for current page
        visibleRows.forEach((row, index) => {
            if (index >= startIdx && index < endIdx) {
                row.style.display = '';
            }
        });
        
        // Special case: If no rows to display after filtering
        if (totalRows === 0) {
            paginationInfo.textContent = `0 of 0`;
        } else {
            // Update pagination info text
            paginationInfo.textContent = `${startIdx + 1}-${endIdx} of ${totalRows}`;
        }
    }
});

// Function to update status select styling
function updateStatusStyle(select) {
    // Remove all previous styling classes
    select.classList.remove('text-success', 'text-danger', 'text-warning', 'border-success', 'border-danger', 'border-warning');
    
    // Add appropriate styling based on selected value
    switch(select.value) {
        case 'Present':
            select.classList.add('text-success', 'border-success');
            break;
        case 'Absent':
            select.classList.add('text-danger', 'border-danger');
            break;
        case 'Late':
            select.classList.add('text-warning', 'border-warning');
            break;
    }
} 