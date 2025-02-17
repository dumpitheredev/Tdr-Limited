class AttendanceTable {
    constructor(containerId, options = {}) {
        this.studentColumn = document.getElementById('studentNameColumn');
        this.attendanceBody = document.getElementById('attendanceTableBody');
        this.startDate = document.getElementById('startDate');
        this.endDate = document.getElementById('endDate');
        this.dateHeaders = [];
        this.options = {
            onStatusChange: options.onStatusChange || (() => {}),
            ...options
        };
        
        this.initializeDateRange();
    }

    initializeDateRange() {
        // Set default date range (current month)
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        this.startDate.value = this.formatDisplayDate(firstDay);
        this.endDate.value = this.formatDisplayDate(lastDay);

        // Load initial data
        this.loadData(this.startDate.value, this.endDate.value);
    }

    async loadData(startDate, endDate) {
        try {
            const response = await fetch(`/api/attendance?start=${startDate}&end=${endDate}`);
            if (!response.ok) throw new Error('Failed to fetch attendance data');
            
            const result = await response.json();
            if (result.success) {
                this.dateHeaders = result.dates;
                this.renderDateHeaders(result.dates);
                this.renderAttendanceData(result.data);
            } else {
                throw new Error(result.error || 'Failed to load data');
            }
        } catch (error) {
            console.error('Error loading attendance data:', error);
            alert('Failed to load attendance data. Please try again.');
        }
    }

    renderDateHeaders(dates) {
        const headerRow = document.querySelector('.calendar-column thead tr');
        if (headerRow) {
            headerRow.innerHTML = dates.map(date => `
                <th class="attendance-header">
                    ${date.day}<br>
                    <small>${date.date}</small>
                </th>
            `).join('');
        }
    }

    renderAttendanceData(data) {
        // Render student names
        this.studentColumn.innerHTML = data.map(student => `
            <tr>
                <td class="student-cell">
                    <div class="student-name">${student.name}</div>
                    <div class="student-info">${student.studentId}</div>
                    <div class="student-info">${student.hoursPercentage}</div>
                </td>
            </tr>
        `).join('');

        // Render attendance data aligned with date headers
        this.attendanceBody.innerHTML = data.map(student => `
            <tr>
                ${this.dateHeaders.map(date => {
                    const attendance = student.attendance.find(a => a.date === date.full_date) || {
                        status: '-',
                        time: '-'
                    };
                    return `
                        <td class="attendance-cell">
                            <div class="attendance-content">
                                <div class="attendance-badge">
                                    <span class="badge ${this.getStatusBadgeClass(attendance.status)}">
                                        ${attendance.status}
                                    </span>
                                </div>
                                <div class="attendance-time">
                                    ${attendance.time}
                                </div>
                            </div>
                        </td>
                    `;
                }).join('')}
            </tr>
        `).join('');
    }

    getStatusBadgeClass(status) {
        switch(status) {
            case 'Present':
                return 'bg-success';
            case 'Absent':
                return 'bg-danger';
            case 'Late':
                return 'bg-warning text-dark';
            default:
                return 'bg-secondary';
        }

    }

    formatDateForAPI(dateStr) {
        // Convert dd/mm/yyyy to yyyy-mm-dd
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    async filterAttendance() {
        const startDate = this.formatDateForAPI(this.startDate.value);
        const endDate = this.formatDateForAPI(this.endDate.value);

        if (!this.validateDateRange()) {
            return;
        }

        await this.loadData(startDate, endDate);
    }

    validateDateRange() {
        if (!this.startDate.value || !this.endDate.value) {
            alert('Please select both start and end dates');
            return false;
        }

        const start = this.parseDateString(this.startDate.value);
        const end = this.parseDateString(this.endDate.value);

        if (start > end) {
            alert('Start date must be before or equal to end date');
            return false;
        }

        return true;
    }

    parseDateString(dateStr) {
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    }

    resetFilter() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        this.startDate.value = this.formatDisplayDate(firstDay);
        this.endDate.value = this.formatDisplayDate(lastDay);

        this.filterAttendance();
    }

    formatDisplayDate(date) {
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
}

// Initialize globally
window.AttendanceTable = AttendanceTable; 
window.AttendanceTable = AttendanceTable; 