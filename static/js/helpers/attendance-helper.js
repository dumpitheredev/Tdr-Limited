/**
 * Attendance Helper Functions
 * This file contains shared functions for handling attendance data across different views
 */

// Define attendancePageState 
window.attendancePageState = window.attendancePageState || {
    page: 1,
    perPage: 5,
    totalStudents: 0
};

// Store current attendance data for pagination in the global scope to prevent redeclaration
window.currentAttendanceData = window.currentAttendanceData || [];

// Store selectors in a global variable to prevent redeclaration
if (!window.ATTENDANCE_SELECTORS) {
    window.ATTENDANCE_SELECTORS = {
        studentNameColumn: '#studentNameColumn',
        recordsTableBody: '#recordsTableBody',
        calendarHeaderRow: '#calendarHeaderRow, #dateHeaderRow',
        attendancePaginationContainer: '#attendancePaginationContainer',
        startDate: '#startDate',
        endDate: '#endDate',
        studentId: '#studentId',
        classId: '#classIdElement',
    };
}

// Check if SELECTORS is already defined globally before creating local reference
// This prevents the constant redeclaration error
var SELECTORS = window.ATTENDANCE_SELECTORS;

/**
 * Get the appropriate badge class for an attendance status
 * @param {string} status - The attendance status (Present, Late, Absent, etc.)
 * @returns {string} CSS class for the badge
 */
function getBadgeClassForStatus(status) {
    if (!status) return 'bg-secondary';
    
    status = status.toLowerCase();
    if (status === 'present') return 'bg-success-subtle text-success';
    if (status === 'late') return 'bg-warning-subtle text-warning';
    if (status === 'absent') return 'bg-danger-subtle text-danger';
    return 'bg-secondary-subtle text-secondary';
}

// Reusable function for displaying empty states
function displayEmptyState(container, iconClass, message) {
    if (container) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <i class="${iconClass} text-muted fs-1 mb-2"></i>
                        <p class="text-muted mb-0">${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

/**
 * Update attendance tables with student data
 * @param {Array} data - Array of attendance records
 */
function updateAttendanceTables(data) {
    console.log('[ATTENDANCE HELPER] Updating attendance tables with', data?.length || 0, 'records');
    
    try {
        const studentNameColumn = document.querySelector(SELECTORS.studentNameColumn);
        const recordsTableBody = document.querySelector(SELECTORS.recordsTableBody);

        // Handle different data formats - ensure we have an array
        let attendanceData = data;
        if (!Array.isArray(attendanceData)) {
            if (data && typeof data === 'object') {
                // Try to extract array from common response formats
                if (Array.isArray(data.data)) {
                    attendanceData = data.data;
                } else if (Array.isArray(data.students)) {
                    attendanceData = data.students;
                } else if (Array.isArray(data.attendance)) {
                    attendanceData = data.attendance;
                } else if (data.results && Array.isArray(data.results)) {
                    attendanceData = data.results;
                } else {
                    // Last resort - try to convert object to array if it has numeric keys
                    const possibleArray = Object.keys(data)
                        .filter(key => !isNaN(parseInt(key)))
                        .map(key => data[key]);
                    
                    if (possibleArray.length > 0) {
                        attendanceData = possibleArray;
                    } else {
                        attendanceData = [];
                    }
                }
            } else {
                attendanceData = [];
            }
        }
        
        // If no data, show empty state
        if (!attendanceData || attendanceData.length === 0) {
            displayEmptyState(studentNameColumn, 'bi bi-person', 'No students found');
            displayEmptyState(recordsTableBody, 'bi bi-calendar3', 'No attendance records found');
            updateAttendanceStats(0, 0, 0);
            return;
        }
        
        // Group data by student
        const studentGroups = {};
        attendanceData.forEach(record => {
            // Handle different property naming conventions
            const studentId = record.student_id || record.studentId || record.id || '';
            let studentName = record.student_name || record.studentName || record.name || 'Unknown Student';
            
            // Handle cases where name might be in first_name/last_name format
            if (!studentName || studentName === 'Unknown Student') {
                const firstName = record.first_name || record.firstName || '';
                const lastName = record.last_name || record.lastName || '';
                if (firstName || lastName) {
                    studentName = `${firstName} ${lastName}`.trim();
                }
            }
            
            if (!studentGroups[studentId]) {
                studentGroups[studentId] = {
                    student_id: studentId,
                    student_name: studentName,
                    records: []
                };
            }
            studentGroups[studentId].records.push(record);
        });
        
        // Convert to array and sort by student name
        const students = Object.values(studentGroups).sort((a, b) => 
            a.student_name.localeCompare(b.student_name)
        );
        
        // Apply pagination to students if needed
        let paginatedStudents = students;
        window.attendancePageState.totalStudents = students.length;
        const startIndex = (window.attendancePageState.page - 1) * window.attendancePageState.perPage;
        const endIndex = Math.min(startIndex + window.attendancePageState.perPage, students.length);
        paginatedStudents = students.slice(startIndex, endIndex);
        
        // Store the current data for pagination
        window.currentAttendanceData = attendanceData;
        
        // Update student name column
        if (studentNameColumn) {
            studentNameColumn.innerHTML = paginatedStudents.map(student => `
                <tr>
                    <td class="student-cell">
                        <div class="student-name">${student.student_name}</div>
                        <div class="student-info">${student.student_id}</div>
                    </td>
                </tr>
            `).join('');
        }
        
        // Get all unique dates from the data
        const dates = [...new Set(data.map(record => record.date))].sort();
        
        // Update header with dates
        const dateHeaderRow = document.querySelector(SELECTORS.calendarHeaderRow);
        if (dateHeaderRow) {
            dateHeaderRow.innerHTML = dates.map(date => {
                // Format date for display (convert YYYY-MM-DD to MM/DD)
                const displayDate = date.split('-');
                return `<th class="attendance-header">${displayDate[1]}/${displayDate[2]}</th>`;
            }).join('');
        }
        
        // Update records table with attendance data
        if (recordsTableBody) {
            if (dates.length === 0) {
                recordsTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4">
                            <div class="d-flex flex-column align-items-center">
                                <i class="bi bi-calendar3 text-muted fs-1 mb-2"></i>
                                <p class="text-muted mb-0">No attendance dates found</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Create rows for each student with columns for each date
            recordsTableBody.innerHTML = paginatedStudents.map(student => {
                // Create a cell for each date
                const dateCells = dates.map(date => {
                    // Find record for this student on this date
                    const record = student.records.find(r => r.date === date);
                    if (!record) {
                        return '<td class="text-center">-</td>';
                    }
                    
                    // Determine badge class based on status
                    const badgeClass = getBadgeClassForStatus(record.status);
                    return `
                        <td class="text-center">
                            <span class="badge ${badgeClass}" data-record-id="${record.id}">
                                ${record.status.charAt(0)}
                            </span>
                        </td>
                    `;
                }).join('');
                
                return `<tr>${dateCells}</tr>`;
            }).join('');
        }
        
        // Update pagination if container exists
        updateAttendancePagination();
        
        // Update attendance statistics
        updateAttendanceStats(data);
    } catch (error) {
        console.error('[ATTENDANCE HELPER] Error updating attendance tables:', error);
    }
}

/**
 * Updates attendance statistics cards with provided data
 * @param {number|Array} present - Number of present attendances or array of attendance records
 * @param {number} absent - Number of absent attendances 
 * @param {number} late - Number of late attendances
 * @param {number} total - Total number of attendances
 */
function updateAttendanceStats(present, absent, late, total) {
    try {

        
        // Check if we're in the student modal context - if so, skip this function
        // as the modal handles its own updates directly to avoid duplication
        const studentModalActive = document.getElementById('student-attendance-tab')?.classList.contains('active');
        if (studentModalActive) {

            return;
        }
        
        // If first parameter is an array, calculate stats from the array
        if (Array.isArray(present)) {
            const data = present;
            let presentCount = 0;
            let lateCount = 0;
            let absentCount = 0;
            
            data.forEach(record => {
                // Handle different property naming conventions
                const status = ((record.status || record.attendanceStatus || '')
                    .toString()
                    .toLowerCase()
                    .trim());
                
                if (status === 'present') presentCount++;
                else if (status === 'late') lateCount++;
                else if (status === 'absent') absentCount++;
            });
            
            present = presentCount;
            absent = absentCount;
            late = lateCount;
            total = data.length;
        } else if (arguments.length <= 2) {
            // If only 1-2 arguments provided, assume present and absent
            total = (present || 0) + (absent || 0) + (late || 0);
            late = 0; // Default late to 0 if not provided
        }
        
        // Ensure all values are numbers
        present = Number(present) || 0;
        absent = Number(absent) || 0;
        late = Number(late) || 0;
        total = Number(total) || (present + absent + late);
        
        // Get stats elements
        const totalPresentEl = document.getElementById('totalPresent');
        const totalLateEl = document.getElementById('totalLate');
        const totalAbsenceEl = document.getElementById('totalAbsence');
        const attendancePercentageEl = document.getElementById('attendancePercentage');
        
        // Update stats if elements exist
        if (totalPresentEl) totalPresentEl.textContent = present;
        if (totalLateEl) totalLateEl.textContent = late;
        if (totalAbsenceEl) totalAbsenceEl.textContent = absent;
        
        if (attendancePercentageEl) {
            // Calculate percentage including late as present
            let percentage = total > 0 ? (((present + late) / total) * 100) : 0;
            
            // Calculate raw percentage
            
            // Format to one decimal place
            const formattedPercentage = percentage.toFixed(1);
            attendancePercentageEl.textContent = `${formattedPercentage}%`;
            
            // Add color based on percentage
            if (percentage >= 90) {
                attendancePercentageEl.style.color = '#28a745'; // Green for good attendance
            } else if (percentage >= 75) {
                attendancePercentageEl.style.color = '#ffc107'; // Yellow for moderate
            } else {
                attendancePercentageEl.style.color = '#dc3545'; // Red for poor
            }
            

        }
        

    } catch (error) {
        console.error('[ATTENDANCE HELPER] Error updating stats:', error);
    }
}

/**
 * Update attendance pagination controls
 */
function updateAttendancePagination() {
    try {
        const container = document.querySelector(SELECTORS.attendancePaginationContainer);
        if (!container) return;
        
        // Show pagination only if needed
        if (window.attendancePageState.totalStudents <= window.attendancePageState.perPage) {
            container.style.display = 'none';
            return;
        }
        
        // Show pagination controls
        container.style.display = 'flex';
        
        // Calculate total pages
        const totalPages = Math.ceil(window.attendancePageState.totalStudents / window.attendancePageState.perPage);
        
        // Update pagination info text
        const paginationInfo = container.querySelector('.attendance-pagination-info');
        if (paginationInfo) {
            const startItem = ((window.attendancePageState.page - 1) * window.attendancePageState.perPage) + 1;
            const endItem = Math.min(startItem + window.attendancePageState.perPage - 1, window.attendancePageState.totalStudents);
            paginationInfo.textContent = `${startItem}-${endItem} of ${window.attendancePageState.totalStudents}`;
        }
        
        // Enable/disable prev/next buttons
        const prevBtn = container.querySelector('.attendance-prev-btn');
        const nextBtn = container.querySelector('.attendance-next-btn');
        
        if (prevBtn) prevBtn.disabled = window.attendancePageState.page <= 1;
        if (nextBtn) nextBtn.disabled = window.attendancePageState.page >= totalPages;
    } catch (error) {
        console.error('[ATTENDANCE HELPER] Error updating attendance pagination:', error);
    }
}

/**
 * Load attendance data for a student
 * @param {string} studentId - The student ID
 * @param {string} startDate - Optional start date filter in YYYY-MM-DD format
 * @param {string} endDate - Optional end date filter in YYYY-MM-DD format
 * @returns {Array} - The attendance records
 */
async function loadStudentAttendance(studentId, startDate = null, endDate = null) {
    console.log('[ATTENDANCE HELPER] Loading attendance for student:', studentId);
    
    try {
        if (!studentId) {
            console.warn('[ATTENDANCE HELPER] Missing student ID');
            return [];
        }
        
        // Build API URL with optional date filters
        let apiUrl = `/api/students/${studentId}/attendance`;
        let params = [];
        
        if (startDate) params.push(`start_date=${startDate}`);
        if (endDate) params.push(`end_date=${endDate}`);
        
        // Add query parameters if they exist
        if (params.length > 0) {
            apiUrl += `?${params.join('&')}`;
        }
        
        console.log(`[ATTENDANCE HELPER] Fetching from: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate that data is properly formatted
        if (!data || typeof data !== 'object') {
            console.warn('[ATTENDANCE HELPER] API returned invalid data format');
            return [];
        }
        
        // Get records array, handling different API response formats
        let records = [];
        if (Array.isArray(data)) {
            records = data;
        } else if (data.attendance && Array.isArray(data.attendance)) {
            records = data.attendance;
        } else if (data.records && Array.isArray(data.records)) {
            records = data.records;
        }
        
        // Process and normalize the records
        const processedRecords = records.map(record => {
            // Check if record has expected properties
            if (!record || typeof record !== 'object') {
                console.warn('[ATTENDANCE HELPER] Invalid record in attendance data:', record);
                return null;
            }
            
            // Get required fields with fallbacks
            return {
                id: record.id || record.record_id || `temp-${Math.random().toString(36).substring(2, 9)}`,
                student_id: record.student_id || record.studentId || studentId,
                student_name: record.student_name || record.studentName || 'Unknown Student',
                date: record.date || new Date().toISOString().split('T')[0],
                status: record.status || 'Unknown',
                class_id: record.class_id || record.classId || '0',
                class_name: record.class_name || record.className || 'Unknown Class'
            };
        }).filter(record => record !== null);
        
        console.log(`[ATTENDANCE HELPER] Processed ${processedRecords.length} records`);
        
        // Update UI
        updateAttendanceTables(processedRecords);
        
        return processedRecords;
    } catch (error) {
        console.error('[ATTENDANCE HELPER] Error loading student attendance:', error);
        
        // Show error in UI
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
        
        // Show toast if available
        if (typeof showToast === 'function') {
            showToast(`Failed to load attendance data: ${error.message}`, 'error');
        }
        
        return [];
    }
}

/**
 * Apply date filter to attendance data
 * @param {string} context - The context of the filter (modal, page, etc.)
 * @returns {Promise<void>}
 */
async function applyDateFilter(context = 'page') {
    try {
        console.log('[ATTENDANCE HELPER] Applying date filter for context:', context);
        
        // Get date inputs based on context
        const startDateSelector = context === 'modal' ? '#modalStartDate' : SELECTORS.startDate;
        const endDateSelector = context === 'modal' ? '#modalEndDate' : SELECTORS.endDate;
        
        const startDateEl = document.querySelector(startDateSelector);
        const endDateEl = document.querySelector(endDateSelector);
        
        if (!startDateEl || !endDateEl) {
            console.error('[ATTENDANCE HELPER] Date inputs not found:', { startDateSelector, endDateSelector });
            return;
        }
        
        let startDate = startDateEl.value;
        let endDate = endDateEl.value;
        
        // Validate dates
        if (!startDate || !endDate) {
            if (typeof showToast === 'function') {
                showToast('Please select both start and end dates', 'warning');
            } else {
                alert('Please select both start and end dates');
            }
            return;
        }
        
        console.log('[ATTENDANCE HELPER] Raw date values:', { startDate, endDate });
        
        // Handle different date formats
        // Format 1: dd/mm/yyyy (UK format)
        if (startDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [day, month, year] = startDate.split('/');
            startDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Format 2: mm/dd/yyyy (US format)
        else if (startDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [month, day, year] = startDate.split('/');
            startDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Format 3: Flatpickr might return a Date object
        else if (startDateEl._flatpickr && startDateEl._flatpickr.selectedDates.length > 0) {
            const selectedDate = startDateEl._flatpickr.selectedDates[0];
            startDate = formatDateForApi(selectedDate);
        }
        
        // Same logic for end date
        if (endDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [day, month, year] = endDate.split('/');
            endDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (endDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [month, day, year] = endDate.split('/');
            endDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (endDateEl._flatpickr && endDateEl._flatpickr.selectedDates.length > 0) {
            const selectedDate = endDateEl._flatpickr.selectedDates[0];
            endDate = formatDateForApi(selectedDate);
        }
        
        console.log('[ATTENDANCE HELPER] Formatted date values:', { startDate, endDate });
        
        // Validate date format
        if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) {
            if (typeof showToast === 'function') {
                showToast('Invalid date format. Please use YYYY-MM-DD format.', 'error');
            } else {
                alert('Invalid date format. Please use YYYY-MM-DD format.');
            }
            return;
        }
        
        // Validate date range
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            console.warn('[ATTENDANCE HELPER] Start date is after end date');
            if (typeof showToast === 'function') {
                showToast('Start date cannot be after end date', 'warning');
            } else {
                alert('Start date cannot be after end date');
            }
            return;
        }
        
        // Show loading state
        updateLoadingState(true, context);
        
        // Get student ID if available
        const studentIdEl = document.querySelector(SELECTORS.studentId);
        const studentId = studentIdEl ? studentIdEl.textContent || studentIdEl.value : null;
        
        // Load attendance with filters - handle both modal and page contexts
        if (studentId) {
            // We have a student ID, so we can filter attendance for that student
            console.log(`[ATTENDANCE HELPER] Loading student attendance with filters: ${startDate} to ${endDate} for student ${studentId}`);
            
            if (typeof loadAttendanceForStudent === 'function') {
                // If we have loadAttendanceForStudent available (from student-modal.js), use it
                await loadAttendanceForStudent(studentId, startDate, endDate);
            } else {
                // Otherwise use the loadStudentAttendance function
                await loadStudentAttendance(studentId, startDate, endDate);
            }
        } else if (context === 'page') {
            // This is for filtering the attendance page without a specific student
            console.log('[ATTENDANCE HELPER] Filtering page-level attendance data');
            // You would implement this if needed for a different page
        }
        
        // Hide loading state
        updateLoadingState(false, context);
    } catch (error) {
        console.error('[ATTENDANCE HELPER] Error applying date filter:', error);
        if (typeof showToast === 'function') {
            showToast(`Error applying date filter: ${error.message}`, 'error');
        }
        updateLoadingState(false, context);
    }
}

/**
 * Check if a date string is in valid YYYY-MM-DD format
 * @param {string} dateString - The date string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidDateFormat(dateString) {
    // Check if the string matches the YYYY-MM-DD pattern
    return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

/**
 * Update loading state for date filters
 * @param {boolean} isLoading - Whether the data is loading
 * @param {string} context - The context (modal, page)
 */
function updateLoadingState(isLoading, context) {
    const applyBtn = document.getElementById(context === 'modal' ? 'modalApplyDateFilter' : 'applyDateFilter');
    const resetBtn = document.getElementById(context === 'modal' ? 'modalResetDateFilter' : 'resetDateFilter');
    
    if (applyBtn) {
        if (isLoading) {
            applyBtn.disabled = true;
            applyBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
        } else {
            applyBtn.disabled = false;
            applyBtn.innerHTML = '<i class="bi bi-funnel"></i> Apply Filter';
        }
    }
    
    if (resetBtn) {
        resetBtn.disabled = isLoading;
    }
}

/**
 * Reset date filter
 * @param {string} context - The context ('modal' or 'page')
 */
function resetDateFilter(context = '') {
    try {

        
        // Clear date inputs based on context
        let startDateEl, endDateEl;
        
        if (context === 'modal') {
            startDateEl = document.getElementById('modalStartDate');
            endDateEl = document.getElementById('modalEndDate');
        } else {
            startDateEl = document.querySelector(SELECTORS.startDate);
            endDateEl = document.querySelector(SELECTORS.endDate);
        }
        
        if (startDateEl) startDateEl.value = '';
        if (endDateEl) endDateEl.value = '';
        
        // Check which context we're in
        if (context === 'modal') {
            // In the student modal context
            const studentId = currentStudentId || document.querySelector(SELECTORS.studentId)?.textContent;
            if (studentId) {
                // Reloading attendance data after filter reset
                loadAttendanceForStudent(studentId);
            } else {
                // Could not determine student ID for reset
            }
        } else {
            // In the regular page context
            const studentId = document.querySelector(SELECTORS.studentId)?.textContent;
            if (studentId) {
                // Reloading attendance data after filter reset
                loadStudentAttendance(studentId);
            } else {
                // Could not determine context for reset
            }
        }
    } catch (error) {
        console.error('[ATTENDANCE HELPER] Error resetting date filter:', error);
    }
}

/**
 * Format date for API (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDateForApi(date) {
    return date.toISOString().split('T')[0];
}

// Export functions for global use
window.updateAttendanceTables = updateAttendanceTables;
window.updateAttendanceStats = updateAttendanceStats;
window.getBadgeClassForStatus = getBadgeClassForStatus;
window.updateAttendancePagination = updateAttendancePagination;
window.loadStudentAttendance = loadStudentAttendance;
window.applyDateFilter = applyDateFilter;
window.resetDateFilter = resetDateFilter;

// Add event listeners when document loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up date pickers
    if (typeof flatpickr !== 'undefined') {
        const dateConfig = {
            dateFormat: 'Y-m-d',
            altFormat: 'm/d/Y',
            altInput: true,
        };
        
        flatpickr(SELECTORS.startDate, dateConfig);
        flatpickr(SELECTORS.endDate, dateConfig);
    }
    
    // Set up pagination event listeners
    const prevBtn = document.querySelector('.attendance-prev-btn');
    const nextBtn = document.querySelector('.attendance-next-btn');
    const rowsPerPage = document.getElementById('attendanceRowsPerPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            if (window.attendancePageState.page > 1) {
                window.attendancePageState.page--;
                updateAttendanceTables(window.currentAttendanceData);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            const totalPages = Math.ceil(window.attendancePageState.totalStudents / window.attendancePageState.perPage);
            if (window.attendancePageState.page < totalPages) {
                window.attendancePageState.page++;
                updateAttendanceTables(window.currentAttendanceData);
            }
        });
    }
    
    if (rowsPerPage) {
        rowsPerPage.addEventListener('change', function() {
            window.attendancePageState.perPage = parseInt(this.value);
            window.attendancePageState.page = 1;
            updateAttendanceTables(window.currentAttendanceData);
        });
    }
    
    console.log('[ATTENDANCE HELPER] Initialized successfully');
});