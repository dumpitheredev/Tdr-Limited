// Create a global variable to track initialization
if (window.attendanceModuleInitialized) {
    // Skip initialization if already done
} else {
    // Set the flag and log the initial load
    window.attendanceModuleInitialized = true;
    console.log('Mark Attendance page loaded');

    document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const markAttendanceButtons = document.querySelectorAll('.mark-attendance-btn');
    const attendanceTableSection = document.getElementById('attendance-table-section');
    const selectedClassName = document.getElementById('selected-class-name');
    const attendanceTableBody = document.getElementById('attendanceTableBody');
    const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
    const searchInput = document.getElementById('searchInput');
    const rowsPerPage = document.getElementById('rowsPerPage');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');
    
    // Toast elements
    const statusToast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = statusToast.querySelector('.toast-header i');
    const toast = new bootstrap.Toast(statusToast);
    
    // State variables
    let selectedClassId = null;
    let selectedClassNameText = '';
    let currentPage = 1;
    let allStudents = []; // Store all students to avoid refetching
    
    // Initialize event listeners for class buttons
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
            fetchStudentsForClass(selectedClassId);
            
            // Scroll to the table
            attendanceTableSection.scrollIntoView({ behavior: 'smooth' });
        });
    });
    
    // Clear Table functionality has been removed
    
    // Log successful initialization
    console.log('Mark Attendance initialized successfully');
    
    // Function to fetch students for a class
    async function fetchStudentsForClass(classId) {
        // Clear the table first
        attendanceTableBody.innerHTML = '';
        
        // Reset save button state
        saveAttendanceBtn.innerHTML = '<i class="bi bi-save me-1"></i> Save Attendance';
        saveAttendanceBtn.disabled = false;
        
        // Remove any existing message
        const existingMessage = document.querySelector('.attendance-marked-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Show loading indicator
        const loadingRow = document.createElement('tr');
        loadingRow.innerHTML = `
            <td colspan="3" class="text-center py-4">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span>Loading students...</span>
            </td>
        `;
        attendanceTableBody.appendChild(loadingRow);
        
        try {
            // First check if we have cached data in IndexedDB
            let students = [];
            let fromCache = false;
            
            if (window.OfflineDB && !navigator.onLine) {
                try {
                    const cachedData = await window.OfflineDB.getCachedData(`class_students_${classId}`);
                    if (cachedData && cachedData.students) {
                        students = cachedData.students;
                        fromCache = true;
                        console.log('Using cached students data from IndexedDB');
                    }
                } catch (cacheError) {
                    console.warn('Error retrieving cached students:', cacheError);
                }
            }
            
            // If no cached data or we're online, fetch from API
            if (!fromCache) {
                const response = await fetch(`/api/classes/${classId}/students`);
                
                if (!response.ok) {
                    // If we're offline and got a 503 error, this is expected
                    if (response.status === 503) {
                        throw new Error('offline');
                    }
                    throw new Error(`HTTP error ${response.status}`);
                }
                
                const data = await response.json();
                
                // Process the data to handle different API response formats
                let processedStudents = [];
                
                // Check if data is an array directly
                if (Array.isArray(data)) {
                    processedStudents = data;
                } 
                // Check if data has a students property that is an array
                else if (data && data.students && Array.isArray(data.students)) {
                    processedStudents = data.students;
                }
                // Check if data has a data property that is an array
                else if (data && data.data && Array.isArray(data.data)) {
                    processedStudents = data.data;
                }
                // Otherwise, try to use the data as is
                else if (data) {
                    processedStudents = [data];
                }
                
                students = processedStudents;
                
                // Cache the data for offline use
                if (window.OfflineDB) {
                    window.OfflineDB.cacheData(`class_students_${classId}`, {
                        students: students,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Clear loading indicator
            attendanceTableBody.innerHTML = '';
            
            // Store unique students using a Map (ensures no duplicates by ID)
            const uniqueStudentsMap = new Map();
            
            // Process each student, keeping only one per ID
            students.forEach(student => {
                if (student && student.id && !uniqueStudentsMap.has(student.id)) {
                    uniqueStudentsMap.set(student.id, student);
                }
            });
            
            // Convert Map values to array
            allStudents = Array.from(uniqueStudentsMap.values());
                
            if (allStudents.length === 0) {
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
            
            // Get today's date
            const today = new Date().toISOString().split('T')[0];
            
            try {
                // Check for existing attendance records for this specific class and today's date
                const response = await fetch(`/api/classes/${classId}/attendance?date=${today}`);
                const attendanceData = await response.json();
                // Create a map to check if this specific class has attendance records for today
                const existingAttendance = {};
                let hasAttendanceForThisClass = false;
                
                if (attendanceData && Array.isArray(attendanceData) && attendanceData.length > 0) {
                    // Since we're already filtering by class_id in the API, any records returned are for this class
                    hasAttendanceForThisClass = true;
                    
                    // Map attendance records to student IDs
                    attendanceData.forEach(record => {
                        existingAttendance[record.student_id] = {
                            status: record.status,
                            comment: record.comment || ''
                        };
                    });
                }
                        
                // Render students with the appropriate attendance data
                renderStudents(allStudents, existingAttendance, hasAttendanceForThisClass);
                
                // Show message only if this specific class has attendance marked for today
                if (hasAttendanceForThisClass) {
                    // Show message that attendance has been marked
                    const messageContainer = document.createElement('div');
                    messageContainer.className = 'alert alert-info mb-3 attendance-marked-message';
                    messageContainer.innerHTML = `
                        <i class="bi bi-info-circle-fill me-2"></i>
                        Today's attendance has been marked for this class. Please use the <a href="/instructor/view-attendance" class="alert-link">View Attendance</a> page if you need to make changes.
                    `;
                    
                    // Insert the message before the table
                    const attendanceTable = document.getElementById('attendanceTable');
                    if (attendanceTable) {
                        const tableContainer = attendanceTable.parentNode;
                        tableContainer.insertBefore(messageContainer, attendanceTable);
                    }
                    
                    // Disable save button
                    saveAttendanceBtn.disabled = true;
                    saveAttendanceBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Attendance Marked';
                    
                    // Show message in the table instead of toast
                    attendanceTableBody.innerHTML = `
                        <tr>
                            <td colspan="3" class="text-center py-4">
                                <div class="alert alert-info mb-0">
                                    <i class="bi bi-info-circle-fill me-2"></i>
                                    Attendance for <strong>${selectedClassNameText}</strong> has already been marked for today.
                                    <br>
                                    Please use the <a href="/instructor/view-attendance" class="alert-link">View Attendance</a> page if you need to make changes.
                                </div>
                            </td>
                        </tr>
                    `;
                }
                
                // Initialize pagination
                initializePagination();
            } catch (error) {
                console.error('Error fetching attendance data:', error);
                // Still render students even if attendance data fetch fails
                renderStudents(allStudents, {}, false);
                initializePagination();
            }
        } catch (error) {
            console.error('Error fetching students:', error);
            // Check if we're offline
            if (!navigator.onLine && window.OfflineDB) {
                // Try to get cached data
                try {
                    const cachedData = await window.OfflineDB.getCachedData(`class_students_${classId}`);
                    if (cachedData && cachedData.students) {
                        // We have cached data, use it
                        attendanceTableBody.innerHTML = '';
                        renderStudents(cachedData.students);
                        
                        // Show offline indicator
                        const offlineAlert = document.createElement('div');
                        offlineAlert.className = 'alert alert-warning mt-3';
                        offlineAlert.innerHTML = `
                            <i class="bi bi-wifi-off me-2"></i>
                            <strong>Offline Mode:</strong> Using cached data. Changes will sync when you're back online.
                        `;
                        attendanceTableSection.insertBefore(offlineAlert, attendanceTableSection.firstChild);
                        return;
                    } else {
                        showErrorMessage(true);
                    }
                } catch (cacheError) {
                    console.error('Error retrieving cached data:', cacheError);
                    showErrorMessage(true);
                }
            } else {
                showErrorMessage(false);
            }
            
            function showErrorMessage(isOffline) {
                attendanceTableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center py-4">
                            <div class="alert alert-danger mb-0">
                                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                Failed to load students. ${isOffline ? 'You are currently offline and no cached data is available.' : 'Please try again.'}
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }
    
    // Function to render students in the table
    function renderStudents(students, attendanceData = {}, hasMarkedAttendanceToday = false) {
        // Clear the table first to prevent duplication
        attendanceTableBody.innerHTML = '';
        
        students.forEach(student => {
            const row = document.createElement('tr');
            row.className = 'student-row';
            
            // Get attendance data for this student if it exists
            const attendance = attendanceData[student.id] || {};
            
            // Handle different name field formats
            let studentName = '';
            if (student.name) {
                studentName = student.name;
            } else if (student.first_name && student.last_name) {
                studentName = `${student.first_name} ${student.last_name}`;
            } else if (student.firstName && student.lastName) {
                studentName = `${student.firstName} ${student.lastName}`;
            } else {
                studentName = `Student ${student.id}`;
            }
            
            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${window.location.origin}/static/images/${student.profile_img || 'profile.png'}" 
                             alt="Profile" class="rounded-circle me-2" width="35" height="35">
                        <div>
                            <h6 class="mb-0">${studentName}</h6>
                            <small class="text-muted">${student.id}</small>
                        </div>
                    </div>
                </td>
                <td>
                    ${hasMarkedAttendanceToday ? 
                        `<div class="form-control bg-light">${attendance.status || 'Not marked'}</div>` : 
                        `<select class="form-select form-select-sm attendance-status" 
                                name="status_${student.id}" 
                                data-student-id="${student.id}"
                                aria-label="Attendance status"
                                onchange="updateStatusStyle(this)">
                            <option value="" selected disabled>Select status</option>
                            <option value="Present" ${attendance.status === 'Present' ? 'selected' : ''} class="text-success">Present</option>
                            <option value="Absent" ${attendance.status === 'Absent' ? 'selected' : ''} class="text-danger">Absent</option>
                            <option value="Late" ${attendance.status === 'Late' ? 'selected' : ''} class="text-warning">Late</option>
                        </select>`
                    }
                </td>
                <td>
                    <input type="text" class="form-control form-control-sm attendance-comment" 
                           data-student-id="${student.id}"
                           name="comment_${student.id}" 
                           placeholder="Add comment (optional)"
                           value="${attendance.comment || ''}"
                           ${hasMarkedAttendanceToday ? 'disabled' : ''}>
                </td>
            `;
            
            attendanceTableBody.appendChild(row);
            
            // Apply styling to pre-selected status if not marked today
            if (!hasMarkedAttendanceToday && attendance.status) {
                const statusSelect = row.querySelector('.attendance-status');
                if (statusSelect) updateStatusStyle(statusSelect);
            }
        });
        
        // Show the table if there are students
        const attendanceTable = document.getElementById('attendanceTable');
        const noStudentsMessage = document.getElementById('noStudentsMessage');
        
        if (students.length > 0) {
            if (attendanceTable) attendanceTable.classList.remove('d-none');
            if (noStudentsMessage) noStudentsMessage.classList.add('d-none');
        } else {
            if (attendanceTable) attendanceTable.classList.add('d-none');
            if (noStudentsMessage) noStudentsMessage.classList.remove('d-none');
        }
        
        // Disable save button if attendance has been marked
        if (hasMarkedAttendanceToday) {
            saveAttendanceBtn.disabled = true;
            saveAttendanceBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Attendance Marked';
        } else {
            saveAttendanceBtn.disabled = false;
            saveAttendanceBtn.innerHTML = '<i class="bi bi-save me-1"></i> Save Attendance';
        }
    }
    
    // Save Attendance button click handler
    saveAttendanceBtn.addEventListener('click', function() {
        // First check if the button is disabled (attendance already marked)
        if (saveAttendanceBtn.disabled) {
            // Show toast notification that attendance is already marked
            toastTitle.textContent = "Attendance Already Marked";
            toastMessage.textContent = `Attendance for ${selectedClassNameText} has already been marked for today. If you need to make changes, please use the View Attendance page.`;
            toastIcon.classList.remove('bi-check-circle-fill', 'text-success', 'bi-exclamation-circle-fill', 'text-danger');
            toastIcon.classList.add('bi-info-circle-fill', 'text-info');
            toast.show();
            return;
        }
        
        // Double-check with the server if attendance has been marked for today
        const today = new Date().toISOString().split('T')[0];
        
        fetch(`/api/classes/${selectedClassId}/attendance?date=${today}`)
            .then(response => response.json())
            .then(attendanceData => {
                // Check if there are attendance records for this class today
                if (attendanceData && Array.isArray(attendanceData) && attendanceData.length > 0) {
                    // Filter to only include records for the current class
                    const classAttendance = attendanceData.filter(record => record.class_id == selectedClassId);
                    
                    if (classAttendance.length > 0) {
                        // Attendance already marked, show message and disable form
                        saveAttendanceBtn.disabled = true;
                        saveAttendanceBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Attendance Marked';
                        
                        // Show toast notification
                        toastTitle.textContent = "Attendance Already Marked";
                        toastMessage.textContent = `Attendance for ${selectedClassNameText} has already been marked for today. If you need to make changes, please use the View Attendance page.`;
                        toastIcon.classList.remove('bi-check-circle-fill', 'text-success', 'bi-exclamation-circle-fill', 'text-danger');
                        toastIcon.classList.add('bi-info-circle-fill', 'text-info');
                        toast.show();
                        
                        // Reload the page to show the read-only view
                        setTimeout(() => {
                            fetchStudentsForClass(selectedClassId);
                        }, 1500);
                        
                        return;
                    }
                }
                
                // If we get here, attendance hasn't been marked yet, proceed with validation
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
                
                // Continue with saving attendance...
                proceedWithSavingAttendance();
            })
            .catch(error => {
                console.error('Error checking attendance status:', error);
                // If there's an error checking attendance status, proceed with normal validation
                validateAndSaveAttendance();
            });
    });
    
    // Function to validate attendance entries
    function validateAndSaveAttendance() {
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
        
        proceedWithSavingAttendance();
    }
    
    // Function to get CSRF token from cookie or meta tag
    function getCsrfToken() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrf_token='));
        
        if (cookieValue) {
            return cookieValue.split('=')[1];
        }
        
        // If not in cookie, try to find it in a meta tag
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        return null;
    }
    
    // Function to proceed with saving attendance
    function proceedWithSavingAttendance() {
        // Get all attendance status values
        const statusSelects = document.querySelectorAll('.attendance-status');
        const commentInputs = document.querySelectorAll('.attendance-comment');
        
        // Prepare data
        const attendanceData = {
            class_id: selectedClassId,
            date: new Date().toISOString().split('T')[0],
            records: []
        };
        
        // Collect data from each student row
        statusSelects.forEach(select => {
            const studentId = select.dataset.studentId;
            const status = select.value;
            const commentInput = document.querySelector(`.attendance-comment[data-student-id="${studentId}"]`);
            const comment = commentInput ? commentInput.value.trim() : '';
            
            if (status) { // Only include if status is selected
                attendanceData.records.push({
                    student_id: studentId,
                    status: status,
                    comment: comment
                });
            }
        });
        
        // Disable save button and show loading state
        saveAttendanceBtn.disabled = true;
        saveAttendanceBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Saving...
        `;
        
        // Check if we're online
        if (navigator.onLine) {
            // Send data to server
            fetch('/api/attendance/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify(attendanceData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Show success message
                toastTitle.textContent = "Success";
                toastMessage.textContent = "Attendance marked successfully!";
                toastIcon.className = 'bi bi-check-circle-fill me-2';
                toastIcon.style.color = '#198754';
                toast.show();
                
                // Update button state
                saveAttendanceBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Attendance Marked';
                saveAttendanceBtn.disabled = true;
                
                // Refresh the table to show the updated data
                setTimeout(() => {
                    fetchStudentsForClass(selectedClassId);
                }, 1500);
            })
            .catch(error => {
                console.error('Error saving attendance:', error);
                
                // Re-enable save button
                saveAttendanceBtn.disabled = false;
                saveAttendanceBtn.innerHTML = '<i class="bi bi-save me-1"></i> Save Attendance';
                
                // Show error message
                toastTitle.textContent = "Error";
                toastMessage.textContent = "Failed to save attendance. Please try again.";
                toastIcon.className = 'bi bi-exclamation-triangle-fill me-2';
                toastIcon.style.color = '#dc3545';
                toast.show();
                
                // If it's a network error, suggest offline mode
                if (error.message.includes('Network') && window.OfflineDB) {
                    setTimeout(() => {
                        toastTitle.textContent = "Offline Mode Available";
                        toastMessage.textContent = "You appear to be offline. Try again to save in offline mode.";
                        toastIcon.className = 'bi bi-wifi-off me-2';
                        toastIcon.style.color = '#fd7e14';
                        toast.show();
                    }, 3000);
                }
            });
        } else if (window.OfflineDB) {
            // We're offline, save to IndexedDB
            const record = {
                data: attendanceData,
                timestamp: new Date().toISOString()
            };
            
            window.OfflineDB.saveAttendanceRecord(record)
                .then(() => {
                    // Show success message for offline save
                    toastTitle.textContent = "Saved Offline";
                    toastMessage.textContent = "Attendance saved offline. It will sync when you're back online.";
                    toastIcon.className = 'bi bi-wifi-off me-2';
                    toastIcon.style.color = '#fd7e14';
                    toast.show();
                    
                    // Update button state
                    saveAttendanceBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Saved Offline';
                    saveAttendanceBtn.disabled = true;
                    
                    // Register for background sync if supported
                    window.OfflineDB.registerBackgroundSync();
                    
                    // Add offline indicator if not already present
                    if (!document.querySelector('.offline-indicator')) {
                        const offlineAlert = document.createElement('div');
                        offlineAlert.className = 'alert alert-warning mt-3 offline-indicator';
                        offlineAlert.innerHTML = `
                            <i class="bi bi-wifi-off me-2"></i>
                            <strong>Offline Mode:</strong> Changes will sync when you're back online.
                        `;
                        attendanceTableSection.insertBefore(offlineAlert, attendanceTableSection.firstChild);
                    }
                })
                .catch(error => {
                    console.error('Error saving attendance offline:', error);
                    
                    // Re-enable save button
                    saveAttendanceBtn.disabled = false;
                    saveAttendanceBtn.innerHTML = '<i class="bi bi-save me-1"></i> Save Attendance';
                    
                    // Show error message
                    toastTitle.textContent = "Error";
                    toastMessage.textContent = "Failed to save attendance offline. Please try again.";
                    toastIcon.className = 'bi bi-exclamation-triangle-fill me-2';
                    toastIcon.style.color = '#dc3545';
                    toast.show();
                });
        } else {
            // We're offline and no IndexedDB support
            saveAttendanceBtn.disabled = false;
            saveAttendanceBtn.innerHTML = '<i class="bi bi-save me-1"></i> Save Attendance';
            
            toastTitle.textContent = "Error";
            toastMessage.textContent = "You are offline and offline storage is not available.";
            toastIcon.className = 'bi bi-wifi-off me-2';
            toastIcon.style.color = '#dc3545';
            toast.show();
        }
    }
    
    // Search functionality
    function filterTable() {
        const searchTerm = searchInput.value.toLowerCase();
        const tableRows = document.querySelectorAll('.student-row');
        let visibleCount = 0;
        
        tableRows.forEach(row => {
            const studentName = row.querySelector('h6').textContent.toLowerCase();
            const studentId = row.querySelector('small').textContent.toLowerCase();
            
            const matchesSearch = studentName.includes(searchTerm) || 
                                 studentId.includes(searchTerm);
            
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
    function initializePagination() {
        // Reset page
        currentPage = 1;
        
        // Remove existing event listeners
        rowsPerPage.removeEventListener('change', handleRowsPerPageChange);
        prevPageBtn.removeEventListener('click', handlePrevPage);
        nextPageBtn.removeEventListener('click', handleNextPage);
        
        // Add new event listeners
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
        
        // Hide all rows first
        visibleRows.forEach(row => {
            row.style.display = 'none';
        });
        
        // Show only rows for current page
        visibleRows.forEach((row, index) => {
            if (index >= startIdx && index < endIdx) {
                row.style.display = '';
            }
        });
        
        // Update pagination info text
        if (totalRows === 0) {
            paginationInfo.textContent = `0 of 0`;
        } else {
            paginationInfo.textContent = `${startIdx + 1}-${endIdx} of ${totalRows}`;
        }
    }
});
}
