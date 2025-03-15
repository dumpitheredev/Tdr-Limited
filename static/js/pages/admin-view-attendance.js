document.addEventListener('DOMContentLoaded', function() {
    // Initialize state
    const state = {
        currentPage: 1,
        rowsPerPage: 5,
        totalRecords: 0,
        filteredRecords: [],
        filters: {
            class: '',
            instructor: '',
            student: '',
            status: '',
            dateStart: '',
            dateEnd: ''
        }
    };

    // DOM elements
    const elements = {
        // Filter elements
        classSelect: document.getElementById('classSelect'),
        instructorSelect: document.getElementById('instructorSelect'),
        studentSearch: document.getElementById('studentSearch'),
        statusSelect: document.getElementById('statusSelect'),
        dateRangeStart: document.getElementById('dateRangeStart'),
        dateRangeEnd: document.getElementById('dateRangeEnd'),
        applyFiltersBtn: document.getElementById('applyFiltersBtn'),
        clearFiltersBtn: document.getElementById('clearFiltersBtn'),
        
        // Table elements
        attendanceTableBody: document.getElementById('attendanceTableBody'),
        
        // Pagination elements
        rowsPerPageSelect: document.getElementById('rowsPerPageSelect'),
        prevPageBtn: document.getElementById('prevPageBtn'),
        nextPageBtn: document.getElementById('nextPageBtn'),
        paginationInfo: document.getElementById('paginationInfo'),
        
        // Stats elements
        totalRecords: document.getElementById('totalRecords'),
        presentCount: document.getElementById('presentCount'),
        absentCount: document.getElementById('absentCount'),
        lateCount: document.getElementById('lateCount'),
        
        // Export button
        exportCsvBtn: document.getElementById('exportCsvBtn'),
        
        // Modal elements
        attendanceDetailModal: new bootstrap.Modal(document.getElementById('attendanceDetailModal')),
        editAttendanceModal: new bootstrap.Modal(document.getElementById('editAttendanceModal')),
        archiveConfirmModal: new bootstrap.Modal(document.getElementById('archiveConfirmModal')),
        
        // Toast
        statusToast: document.getElementById('statusToast'),
        toastTitle: document.getElementById('toastTitle'),
        toastMessage: document.getElementById('toastMessage')
    };

    // Initialize toast
    const toast = new bootstrap.Toast(elements.statusToast);

    // Mock attendance data (in a real app, this would come from an API)
    const mockAttendanceData = generateMockAttendanceData();
    
    // Initialize the page
    initializePage();
    
    // Event listeners
    function setupEventListeners() {
        // Filter events
        elements.applyFiltersBtn.addEventListener('click', applyFilters);
        elements.clearFiltersBtn.addEventListener('click', clearFilters);
        
        // Pagination events
        elements.rowsPerPageSelect.addEventListener('change', handleRowsPerPageChange);
        elements.prevPageBtn.addEventListener('click', goToPreviousPage);
        elements.nextPageBtn.addEventListener('click', goToNextPage);
        
        // Export event
        elements.exportCsvBtn.addEventListener('click', exportAttendanceToCsv);
        
        // Setup view, edit, and archive button event delegation
        elements.attendanceTableBody.addEventListener('click', handleTableActions);
        
        // Save attendance changes
        document.getElementById('saveAttendanceBtn').addEventListener('click', saveAttendanceChanges);
        
        // Confirm archive
        document.getElementById('confirmArchiveBtn').addEventListener('click', archiveAttendanceRecord);
    }
    
    // Initialize the page
    function initializePage() {
        // Set default date range (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        elements.dateRangeEnd.value = formatDateForInput(today);
        elements.dateRangeStart.value = formatDateForInput(thirtyDaysAgo);
        
        // Set initial data
        state.filteredRecords = [...mockAttendanceData];
        state.totalRecords = mockAttendanceData.length;
        
        // Update UI
        updateTable();
        updateStats();
        
        // Setup event listeners
        setupEventListeners();
    }
    
    // Apply filters
    function applyFilters() {
        state.currentPage = 1;
        
        // Get filter values
        state.filters.class = elements.classSelect.value;
        state.filters.instructor = elements.instructorSelect.value;
        state.filters.student = elements.studentSearch.value.toLowerCase();
        state.filters.status = elements.statusSelect.value;
        state.filters.dateStart = elements.dateRangeStart.value;
        state.filters.dateEnd = elements.dateRangeEnd.value;
        
        // Filter the data
        state.filteredRecords = mockAttendanceData.filter(record => {
            // Class filter
            if (state.filters.class && record.class_id !== state.filters.class) {
                return false;
            }
            
            // Instructor filter
            if (state.filters.instructor && record.instructor_id !== state.filters.instructor) {
                return false;
            }
            
            // Student name filter
            if (state.filters.student && 
                !record.student_name.toLowerCase().includes(state.filters.student) &&
                !record.student_id.toLowerCase().includes(state.filters.student)) {
                return false;
            }
            
            // Status filter
            if (state.filters.status && record.status !== state.filters.status) {
                return false;
            }
            
            // Date range filter
            if (state.filters.dateStart && record.date < state.filters.dateStart) {
                return false;
            }
            
            if (state.filters.dateEnd && record.date > state.filters.dateEnd) {
                return false;
            }
            
            return true;
        });
        
        // Update UI
        updateTable();
        updateStats();
        
        // Show toast with filter results
        showToast(
            'Filters Applied', 
            `Found ${state.filteredRecords.length} attendance records matching your criteria.`,
            'success'
        );
    }
    
    // Clear filters
    function clearFilters() {
        // Reset filter form
        document.getElementById('filterForm').reset();
        
        // Reset filter state
        state.filters = {
            class: '',
            instructor: '',
            student: '',
            status: '',
            dateStart: '',
            dateEnd: ''
        };
        
        // Reset to default date range
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        elements.dateRangeEnd.value = formatDateForInput(today);
        elements.dateRangeStart.value = formatDateForInput(thirtyDaysAgo);
        
        // Reset to page 1
        state.currentPage = 1;
        
        // Reset filtered data
        state.filteredRecords = [...mockAttendanceData];
        
        // Update UI
        updateTable();
        updateStats();
        
        // Show toast
        showToast('Filters Cleared', 'All filters have been reset.', 'success');
    }
    
    // Update table with current data and pagination
    function updateTable() {
        const startIndex = (state.currentPage - 1) * state.rowsPerPage;
        const endIndex = Math.min(startIndex + state.rowsPerPage, state.filteredRecords.length);
        const paginatedData = state.filteredRecords.slice(startIndex, endIndex);
        
        // Clear table
        elements.attendanceTableBody.innerHTML = '';
        
        if (paginatedData.length === 0) {
            // No records found
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `
                <td colspan="6" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <i class="bi bi-search fs-1 text-muted mb-2"></i>
                        <p class="text-muted mb-0">No attendance records found</p>
                    </div>
                </td>
            `;
            elements.attendanceTableBody.appendChild(noDataRow);
        } else {
            // Add records to table
            paginatedData.forEach(record => {
                const row = document.createElement('tr');
                
                // Format date for display
                const displayDate = formatDateForDisplay(record.date);
                
                // Get status badge class
                const statusBadgeClass = getStatusBadgeClass(record.status);
                const statusText = capitalizeFirstLetter(record.status);
                
                row.innerHTML = `
                    <td>${displayDate}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="/static/images/${record.student_profile_img}" 
                                 alt="Profile" class="rounded-circle me-2" width="35" height="35">
                            <div>
                                <h6 class="mb-0">${record.student_name}</h6>
                                <small class="text-muted">${record.student_id}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div>
                            <span class="fw-medium">${record.class_name}</span>
                            <small class="d-block text-muted">${record.class_id}</small>
                        </div>
                    </td>
                    <td>
                        <div>
                            <span class="fw-medium">${record.instructor_name}</span>
                            <small class="d-block text-muted">${record.instructor_id}</small>
                        </div>
                    </td>
                    <td>
                        <span class="badge ${statusBadgeClass}" style="padding: 8px 16px; font-size: 14px;">
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        <div class="d-flex gap-2 justify-content-center">
                            <button class="btn btn-link p-0" 
                                    data-record-id="${record.id}"
                                    onclick="handleTableActions(event)"
                                    title="View details">
                                <i class="bi bi-eye view-attendance-btn" style="color: #191970;"></i>
                            </button>
                            <button class="btn btn-link p-0" 
                                    data-record-id="${record.id}"
                                    onclick="handleTableActions(event)"
                                    title="Edit attendance">
                                <i class="bi bi-pencil edit-attendance-btn" style="color: #191970;"></i>
                            </button>
                            <button class="btn btn-link p-0" 
                                    data-record-id="${record.id}"
                                    onclick="handleTableActions(event)"
                                    title="Archive record">
                                <i class="bi bi-archive archive-attendance-btn" style="color: #191970;"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                elements.attendanceTableBody.appendChild(row);
            });
        }
        
        // Update pagination info
        updatePaginationInfo(startIndex, endIndex);
    }
    
    // Update pagination information
    function updatePaginationInfo(startIndex, endIndex) {
        // Update pagination text
        if (state.filteredRecords.length === 0) {
            elements.paginationInfo.textContent = '0-0 of 0';
        } else {
            elements.paginationInfo.textContent = `${startIndex + 1}-${endIndex} of ${state.filteredRecords.length}`;
        }
        
        // Update pagination buttons
        elements.prevPageBtn.disabled = state.currentPage === 1;
        elements.nextPageBtn.disabled = endIndex >= state.filteredRecords.length;
    }
    
    // Update statistics
    function updateStats() {
        // Count records by status
        const presentCount = state.filteredRecords.filter(record => record.status === 'present').length;
        const absentCount = state.filteredRecords.filter(record => record.status === 'absent').length;
        const lateCount = state.filteredRecords.filter(record => record.status === 'late').length;
        
        // Update stats display
        elements.totalRecords.textContent = state.filteredRecords.length;
        elements.presentCount.textContent = presentCount;
        elements.absentCount.textContent = absentCount;
        elements.lateCount.textContent = lateCount;
    }
    
    // Handle rows per page change
    function handleRowsPerPageChange() {
        state.rowsPerPage = parseInt(elements.rowsPerPageSelect.value);
        state.currentPage = 1; // Reset to first page
        updateTable();
    }
    
    // Go to previous page
    function goToPreviousPage() {
        if (state.currentPage > 1) {
            state.currentPage--;
            updateTable();
        }
    }
    
    // Go to next page
    function goToNextPage() {
        const maxPage = Math.ceil(state.filteredRecords.length / state.rowsPerPage);
        if (state.currentPage < maxPage) {
            state.currentPage++;
            updateTable();
        }
    }
    
    // Handle table actions (view, edit, archive)
    function handleTableActions(event) {
        // Find the closest button
        const viewBtn = event.target.closest('.view-attendance-btn');
        const editBtn = event.target.closest('.edit-attendance-btn');
        const archiveBtn = event.target.closest('.archive-attendance-btn');
        
        if (viewBtn) {
            const recordId = viewBtn.closest('button').dataset.recordId;
            viewAttendanceRecord(recordId);
        } else if (editBtn) {
            const recordId = editBtn.closest('button').dataset.recordId;
            editAttendanceRecord(recordId);
        } else if (archiveBtn) {
            const recordId = archiveBtn.closest('button').dataset.recordId;
            confirmArchiveAttendance(recordId);
        }
    }
    
    // View attendance record
    function viewAttendanceRecord(recordId) {
        const record = findRecordById(recordId);
        if (!record) return;
        
        // Populate modal with record data
        document.getElementById('detailStudent').textContent = `${record.student_name} (${record.student_id})`;
        document.getElementById('detailClass').textContent = `${record.class_name} (${record.class_id})`;
        document.getElementById('detailInstructor').textContent = `${record.instructor_name} (${record.instructor_id})`;
        document.getElementById('detailDate').textContent = formatDateForDisplay(record.date);
        
        // Set status badge
        const statusBadge = document.getElementById('detailStatus').querySelector('.badge');
        statusBadge.className = `badge ${getStatusBadgeClass(record.status)}`;
        statusBadge.textContent = capitalizeFirstLetter(record.status);
        
        // Set comment
        document.getElementById('detailComment').textContent = record.comment || 'No comments';
        
        // Show modal
        elements.attendanceDetailModal.show();
    }
    
    // Edit attendance record
    function editAttendanceRecord(recordId) {
        const record = findRecordById(recordId);
        if (!record) return;
        
        // Populate edit form
        document.getElementById('editAttendanceId').value = record.id;
        document.getElementById('editStudent').value = `${record.student_name} (${record.student_id})`;
        document.getElementById('editClass').value = `${record.class_name} (${record.class_id})`;
        document.getElementById('editInstructor').value = `${record.instructor_name} (${record.instructor_id})`;
        document.getElementById('editDate').value = record.date;
        document.getElementById('editStatus').value = record.status;
        document.getElementById('editComment').value = record.comment || '';
        
        // Show modal
        elements.editAttendanceModal.show();
    }
    
    // Save attendance changes
    function saveAttendanceChanges() {
        const recordId = document.getElementById('editAttendanceId').value;
        const newStatus = document.getElementById('editStatus').value;
        const newComment = document.getElementById('editComment').value;
        
        // Find and update the record
        const recordIndex = state.filteredRecords.findIndex(r => r.id.toString() === recordId);
        if (recordIndex !== -1) {
            // Update the record
            state.filteredRecords[recordIndex].status = newStatus;
            state.filteredRecords[recordIndex].comment = newComment;
            
            // Also update in the original data
            const originalIndex = mockAttendanceData.findIndex(r => r.id.toString() === recordId);
            if (originalIndex !== -1) {
                mockAttendanceData[originalIndex].status = newStatus;
                mockAttendanceData[originalIndex].comment = newComment;
            }
            
            // Update UI
            updateTable();
            updateStats();
            
            // Close modal
            elements.editAttendanceModal.hide();
            
            // Show success toast
            showToast('Success', 'Attendance record has been updated.', 'success');
        }
    }
    
    // Confirm archive attendance
    function confirmArchiveAttendance(recordId) {
        const record = findRecordById(recordId);
        if (!record) return;
        
        // Populate confirmation modal
        document.getElementById('archiveStudentName').textContent = record.student_name;
        document.getElementById('archiveClassName').textContent = record.class_name;
        document.getElementById('archiveRecordId').value = record.id;
        
        // Show modal
        elements.archiveConfirmModal.show();
    }
    
    // Archive attendance record
    function archiveAttendanceRecord() {
        const recordId = document.getElementById('archiveRecordId').value;
        const reason = document.getElementById('archiveReason').value;
        const comment = document.getElementById('archiveComment').value;
        
        // Validate that a reason is selected
        if (!reason) {
            showToast('Error', 'Please select a reason for archiving', 'error');
            return;
        }
        
        // In a real app, you would send an API request to archive the record
        // with the reason and comment
        // For this demo, we'll just remove it from our arrays
        
        // Combine reason and comment for the archive note
        const archiveNote = comment ? `${reason}: ${comment}` : reason;
        console.log('Archiving record with note:', archiveNote);
        
        // Remove from filtered records
        state.filteredRecords = state.filteredRecords.filter(r => r.id.toString() !== recordId);
        
        // Remove from original data
        const originalIndex = mockAttendanceData.findIndex(r => r.id.toString() === recordId);
        if (originalIndex !== -1) {
            mockAttendanceData.splice(originalIndex, 1);
        }
        
        // Update UI
        updateTable();
        updateStats();
        
        // Close modal
        elements.archiveConfirmModal.hide();
        
        // Show success toast
        showToast('Success', 'Attendance record has been archived', 'success');
    }
    
    // Export attendance to CSV
    function exportAttendanceToCsv() {
        // Create CSV content
        let csvContent = 'Date,Student ID,Student Name,Class ID,Class Name,Instructor ID,Instructor Name,Status,Comment\n';
        
        state.filteredRecords.forEach(record => {
            const row = [
                record.date,
                record.student_id,
                record.student_name,
                record.class_id,
                record.class_name,
                record.instructor_id,
                record.instructor_name,
                record.status,
                `"${record.comment || ''}"`
            ];
            csvContent += row.join(',') + '\n';
        });
        
        // Create download link
        const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `attendance_export_${formatDateForFilename(new Date())}.csv`);
        document.body.appendChild(link);
        
        // Trigger download
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        
        // Show success toast
        showToast('Export Complete', `${state.filteredRecords.length} records exported to CSV.`, 'success');
    }
    
    // Helper function to find a record by ID
    function findRecordById(id) {
        return state.filteredRecords.find(record => record.id.toString() === id.toString());
    }
    
    // Helper function to show toast
    function showToast(title, message, type = 'success') {
        elements.toastTitle.textContent = title;
        elements.toastMessage.textContent = message;
        
        // Update icon based on type
        const iconElement = elements.statusToast.querySelector('.toast-header i');
        if (iconElement) {
            if (type === 'success') {
                iconElement.className = 'bi bi-check-circle-fill text-success me-2';
            } else {
                iconElement.className = 'bi bi-exclamation-circle-fill text-danger me-2';
            }
        }
        
        toast.show();
    }
    
    // Helper function to get status badge class
    function getStatusBadgeClass(status) {
        switch (status) {
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
    
    // Helper function to format date for display
    function formatDateForDisplay(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    // Helper function to format date for input fields
    function formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }
    
    // Helper function to format date for filenames
    function formatDateForFilename(date) {
        return date.toISOString().split('T')[0].replace(/-/g, '');
    }
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Generate mock attendance data
    function generateMockAttendanceData() {
        const data = [];
        const statuses = ['present', 'absent', 'late'];
        const students = [
            { id: 'st89mn', name: 'Michael Chen', profile_img: 'profile.png' },
            { id: 'st12qw', name: 'Liu Wei', profile_img: 'profile2.png' },
            { id: 'st45ty', name: 'David Smith', profile_img: 'profile3.png' },
            { id: 'st78gh', name: 'Sophie Martin', profile_img: 'profile4.png' },
            { id: 'st34mm', name: 'Emily Brown', profile_img: 'profile5.png' }
        ];
        const classes = [
            { id: 'kl45xy', name: 'Mathematics 101' },
            { id: 'kl72ab', name: 'Physics Basic' },
            { id: 'kl89cd', name: 'Chemistry Lab' }
        ];
        const instructors = [
            { id: 'ak45yx', name: 'Sarah Johnson' },
            { id: 'ak67lp', name: 'James Rodriguez' },
            { id: 'ak89er', name: 'Anna Kowalski' }
        ];
        
        // Generate 30 days of attendance records
        const today = new Date();
        
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateString = formatDateForInput(date);
            
            // Skip weekends
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            
            // Generate records for each class
            classes.forEach(cls => {
                // Assign an instructor to this class
                const instructor = instructors[Math.floor(Math.random() * instructors.length)];
                
                // Generate attendance for each student
                students.forEach(student => {
                    // Random status
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    
                    // Generate comment based on status
                    let comment = '';
                    if (status === 'absent') {
                        const reasons = ['Sick leave', 'Family emergency', 'Doctor appointment', 'Personal reasons'];
                        comment = reasons[Math.floor(Math.random() * reasons.length)];
                    } else if (status === 'late') {
                        const reasons = ['Traffic delay', 'Bus was late', 'Overslept', 'Previous class ran over'];
                        comment = reasons[Math.floor(Math.random() * reasons.length)];
                    }
                    
                    // Add record
                    data.push({
                        id: data.length + 1,
                        date: dateString,
                        student_id: student.id,
                        student_name: student.name,
                        student_profile_img: student.profile_img,
                        class_id: cls.id,
                        class_name: cls.name,
                        instructor_id: instructor.id,
                        instructor_name: instructor.name,
                        status: status,
                        comment: comment
                    });
                });
            });
        }
        
        return data;
    }
});