// Define functions at the top
function updateTable(companies) {
    const tableBody = document.querySelector('#companyTable tbody');
    if (!tableBody) {
        console.error('Table body not found');
        return;
    }
    
    tableBody.innerHTML = companies.map(company => `
        <tr>
            <td class="align-middle">
                <div class="fw-medium">${company.contact}</div>
                <div class="text-muted small">${company.email}</div>
            </td>
            <td class="align-middle">
                <div class="fw-medium">${company.name}</div>
                <div class="text-muted small">${company.company_id}</div>
            </td>
            <td class="align-middle">
                <span class="badge ${company.status === 'Active' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}">
                    ${company.status}
                </span>
            </td>
            <td class="align-middle text-end">
                <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-link p-0" onclick="handleCompanyAction('edit', '${company.company_id}')">
                        <i class="bi bi-pencil" style="color: #191970;"></i>
                    </button>
                    <button class="btn btn-link p-0" onclick="handleCompanyAction('view', '${company.company_id}')">
                        <i class="bi bi-eye" style="color: #191970;"></i>
                    </button>
                    <button class="btn btn-link p-0" onclick="handleCompanyAction('archive', '${company.company_id}')">
                        <i class="bi bi-archive" style="color: #191970;"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats(stats) {
    const totalElement = document.querySelector('.total-companies');
    const activeElement = document.querySelector('.active-companies');
    const inactiveElement = document.querySelector('.inactive-companies');

    if (totalElement) totalElement.textContent = stats.total_companies;
    if (activeElement) activeElement.textContent = stats.active_companies;
    if (inactiveElement) inactiveElement.textContent = stats.inactive_companies;
}

// Set default rows per page
function setDefaultRows() {
    const rowsPerPage = 5;
    const tableBody = document.querySelector('#companyTable tbody');
    const allRows = tableBody.querySelectorAll('tr');
    
    allRows.forEach((row, index) => {
        row.style.display = (index < rowsPerPage) ? '' : 'none';
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Get elements
    const elements = {
        rowsPerPage: document.getElementById('rowsPerPage'),
        exportCsv: document.getElementById('exportCsv'),
        statusFilter: document.getElementById('statusFilter'),
        companyTable: document.getElementById('companyTable'),
        totalCompanies: document.querySelector('.total-companies'),
        activeCompanies: document.querySelector('.active-companies'),
        inactiveCompanies: document.querySelector('.inactive-companies'),
        searchInput: document.getElementById('searchInput'),
        prevPage: document.getElementById('prevPage'),
        nextPage: document.getElementById('nextPage'),
        paginationInfo: document.getElementById('paginationInfo')
    };

    // Initialize variables
    let allCompanies = []; // Store all companies for pagination
    let currentPage = 1;
    let itemsPerPage = parseInt(elements.rowsPerPage?.value) || 5;

    // Define fetchAndUpdateData function
    function fetchAndUpdateData() {
        const selectedStatus = elements.statusFilter ? elements.statusFilter.value : '';
        
        // Show loading state
        const tableBody = document.querySelector('#companyTable tbody');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Loading...</td></tr>';
        
        // Fetch data
        fetch(`/api/companies-direct${selectedStatus ? `?status=${selectedStatus}` : ''}`)
            .then(response => response.json())
            .then(data => {
                allCompanies = data.companies;
                filterAndDisplay();
            })
            .catch(error => {
                console.error('Error:', error);
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error loading data</td></tr>';
            });
    }

    // Function to filter and display companies
    function filterAndDisplay() {
        const selectedStatus = elements.statusFilter ? elements.statusFilter.value : '';
        
        // Filter companies based on selected status
        const filteredCompanies = selectedStatus ? 
            allCompanies.filter(company => company.status === selectedStatus) : 
            allCompanies;

        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const visibleCompanies = filteredCompanies.slice(startIdx, endIdx);
        
        // Update table with visible companies
        updateTable(visibleCompanies);
        
        // Calculate stats from all companies
        const stats = {
            total_companies: allCompanies.length,
            active_companies: allCompanies.filter(company => company.status === 'Active').length,
            inactive_companies: allCompanies.filter(company => company.status === 'Inactive').length
        };
        
        // Update stats display
        updateStats(stats);
        
        // Update pagination based on filtered companies
        updatePagination(filteredCompanies);
    }

    // Function to filter table rows
    function filterTable() {
        const searchText = elements.searchInput.value.toLowerCase();
        const rows = document.querySelectorAll('#companyTable tbody tr');
        
        rows.forEach(function(row) {
            const companyName = row.querySelector('td:nth-child(2) .fw-medium').textContent.toLowerCase();
            const companyId = row.querySelector('td:nth-child(2) .text-muted.small').textContent.toLowerCase();
            const matches = companyName.includes(searchText) || companyId.includes(searchText);
            row.style.display = matches ? '' : 'none';
        });
    }

    // Update pagination info and buttons
    function updatePagination(filteredCompanies) {
        const totalCompanies = filteredCompanies.length;
        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, totalCompanies);

        // Update pagination info text
        if (elements.paginationInfo) {
            elements.paginationInfo.textContent = `${startIdx + 1}-${endIdx} of ${totalCompanies}`;
        }

        // Enable/disable prev/next buttons
        if (elements.prevPage) {
            elements.prevPage.disabled = currentPage === 1;
        }
        if (elements.nextPage) {
            elements.nextPage.disabled = endIdx >= totalCompanies;
        }
    }

    // Event handlers
    if (elements.rowsPerPage) {
        elements.rowsPerPage.addEventListener('change', function() {
            itemsPerPage = parseInt(this.value);
            currentPage = 1;
            filterAndDisplay();
        });
    }

    if (elements.prevPage) {
        elements.prevPage.addEventListener('click', function(e) {
            e.preventDefault();
            if (!this.disabled && currentPage > 1) {
                currentPage--;
                filterAndDisplay();
            }
        });
    }

    if (elements.nextPage) {
        elements.nextPage.addEventListener('click', function(e) {
            e.preventDefault();
            const totalPages = Math.ceil(allCompanies.length / itemsPerPage);
            if (!this.disabled && currentPage < totalPages) {
                currentPage++;
                filterAndDisplay();
            }
        });
    }

    // Status filter handler
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', function() {
            currentPage = 1; // Reset to first page when filter changes
            filterAndDisplay();
        });
    }

    // Search input handler
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', filterTable);
    }

    // Initial data load
    fetch('/api/companies')
        .then(response => response.json())
        .then(data => {
            allCompanies = data.companies;
            filterAndDisplay();
        })
        .catch(error => console.error('Error:', error));

    // Export CSV handler
    if (elements.exportCsv) {
        elements.exportCsv.addEventListener('click', function() {
            // Get visible rows (respecting current filters)
            const rows = document.querySelectorAll('#companyTable tbody tr');
            const visibleRows = Array.from(rows).filter(row => 
                row.style.display !== 'none'
            );

            // Create CSV content
            const headers = ['Contact Name', 'Email', 'Company Name', 'Company ID', 'Status'];
            const csvContent = [
                headers.join(','),
                ...visibleRows.map(row => {
                    const contact = row.querySelector('td:nth-child(1) .fw-medium').textContent.trim();
                    const email = row.querySelector('td:nth-child(1) .text-muted.small').textContent.trim();
                    const companyName = row.querySelector('td:nth-child(2) .fw-medium').textContent.trim();
                    const companyId = row.querySelector('td:nth-child(2) .text-muted.small').textContent.trim();
                    const status = row.querySelector('td:nth-child(3) .badge').textContent.trim();

                    return [
                        `"${contact}"`,
                        `"${email}"`,
                        `"${companyName}"`,
                        `"${companyId}"`,
                        `"${status}"`
                    ].join(',');
                })
            ].join('\n');

            // Create and trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'companies.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    const addCompanyModal = document.getElementById('addCompanyModal');
    const addCompanyForm = document.getElementById('addCompanyForm');
    const companyIdInput = document.getElementById('companyId');
    const emailInput = document.getElementById('contactEmail');
    const confirmEmailInput = document.getElementById('confirmEmail');

    // Generate company ID when modal is shown
    if (addCompanyModal) {
        addCompanyModal.addEventListener('show.bs.modal', function() {
            companyIdInput.value = generateCompanyId();
        });
    }

    // Form validation and submission
    if (addCompanyForm) {
        addCompanyForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Check if emails match
            if (emailInput.value !== confirmEmailInput.value) {
                confirmEmailInput.setCustomValidity('Email addresses do not match');
                confirmEmailInput.reportValidity();
                return;
            } else {
                confirmEmailInput.setCustomValidity('');
            }

            // Check form validity
            if (!this.checkValidity()) {
                event.stopPropagation();
                this.classList.add('was-validated');
                return;
            }

            // Collect form data
            const formData = {
                company_id: companyIdInput.value,
                name: document.getElementById('companyName').value,
                contact: document.getElementById('contactName').value,
                email: emailInput.value,
                status: 'Active' // Default status for new companies
            };

            // TODO: Send data to server
            console.log('Form submitted:', formData);
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(addCompanyModal);
            modal.hide();
            this.reset();
            this.classList.remove('was-validated');
            
            // Refresh table data
            fetchAndUpdateData();
        });

        // Real-time email confirmation validation
        confirmEmailInput.addEventListener('input', function() {
            if (this.value !== emailInput.value) {
                this.setCustomValidity('Email addresses do not match');
            } else {
                this.setCustomValidity('');
            }
        });

        emailInput.addEventListener('input', function() {
            if (confirmEmailInput.value && this.value !== confirmEmailInput.value) {
                confirmEmailInput.setCustomValidity('Email addresses do not match');
            } else {
                confirmEmailInput.setCustomValidity('');
            }
        });
    }

    // Make fetchAndUpdateData available to window for edit functionality
    window.fetchAndUpdateData = fetchAndUpdateData;
});

// Handle company actions (edit, view, archive)
window.handleCompanyAction = function(action, companyId) {
    switch(action) {
        case 'edit':
            fetch(`/api/companies-direct/${companyId}`)
                .then(response => response.json())
                .then(company => {
                    // Update edit form fields
                    document.getElementById('editCompanyName').value = company.name;
                    document.getElementById('editCompanyId').value = company.company_id;
                    document.getElementById('editCompanyContact').value = company.contact;
                    document.getElementById('editCompanyEmail').value = company.email;
                    document.getElementById('editCompanyStatus').value = company.status;

                    // Show the edit modal
                    const editModal = new bootstrap.Modal(document.getElementById('editCompanyModal'));
                    editModal.show();

                    // Handle form submission
                    const editForm = document.getElementById('editCompanyForm');
                    editForm.onsubmit = function(e) {
                        e.preventDefault();
                        
                        const updatedCompany = {
                            name: document.getElementById('editCompanyName').value,
                            company_id: document.getElementById('editCompanyId').value,
                            contact: document.getElementById('editCompanyContact').value,
                            email: document.getElementById('editCompanyEmail').value,
                            status: document.getElementById('editCompanyStatus').value
                        };

                        fetch(`/api/companies-direct/${companyId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(updatedCompany)
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                // Close modal
                                bootstrap.Modal.getInstance(document.getElementById('editCompanyModal')).hide();
                                
                                // Refresh table
                                fetchAndUpdateData();
                                
                                // Show success toast
                                const toastTitle = document.getElementById('toastTitle');
                                const toastMessage = document.getElementById('toastMessage');
                                const statusToast = document.getElementById('statusToast');
                                
                                toastTitle.textContent = 'Success';
                                toastMessage.textContent = 'Company updated successfully';
                                const toast = new bootstrap.Toast(statusToast);
                                toast.show();
                            } else {
                                // Show error toast
                                const toastTitle = document.getElementById('toastTitle');
                                const toastMessage = document.getElementById('toastMessage');
                                const statusToast = document.getElementById('statusToast');
                                
                                toastTitle.textContent = 'Error';
                                toastMessage.textContent = data.error || 'Error updating company';
                                const toast = new bootstrap.Toast(statusToast);
                                toast.show();
                            }
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            // Show error toast
                            const toastTitle = document.getElementById('toastTitle');
                            const toastMessage = document.getElementById('toastMessage');
                            const statusToast = document.getElementById('statusToast');
                            
                            toastTitle.textContent = 'Error';
                            toastMessage.textContent = 'Error updating company';
                            const toast = new bootstrap.Toast(statusToast);
                            toast.show();
                        });
                    };
                })
                .catch(error => {
                    console.error('Error fetching company details:', error);
                    // Show error toast
                    const toastTitle = document.getElementById('toastTitle');
                    const toastMessage = document.getElementById('toastMessage');
                    const statusToast = document.getElementById('statusToast');
                    
                    toastTitle.textContent = 'Error';
                    toastMessage.textContent = 'Error fetching company details';
                    const toast = new bootstrap.Toast(statusToast);
                    toast.show();
                });
            break;
        case 'view':
            fetch(`/api/companies-direct/${companyId}`)
                .then(response => response.json())
                .then(company => {
                    // Update company details
                    document.getElementById('viewCompanyName').textContent = company.name;
                    document.getElementById('viewCompanyId').textContent = company.company_id;
                    document.getElementById('viewCompanyContact').textContent = company.contact;
                    document.getElementById('viewCompanyEmail').textContent = company.email;
                    
                    // Update status badge
                    const statusBadge = document.getElementById('viewCompanyStatus');
                    statusBadge.textContent = company.status;
                    statusBadge.className = `badge ${company.status === 'Active' ? 
                        'bg-success-subtle text-success' : 
                        'bg-danger-subtle text-danger'}`;

                    // Add student count header
                    const studentsCount = company.students.length;
                    const activeCount = company.students.filter(s => s.status === 'Active').length;
                    const completedCount = company.students.filter(s => s.status === 'Completed').length;
                    const inactiveCount = company.students.filter(s => s.status === 'Inactive').length;

                    document.getElementById('companyStudentsHeader').innerHTML = `
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="mb-0">Company Students (${studentsCount})</h6>
                            <div class="d-flex gap-3">
                                <small class="text-success">Active: ${activeCount}</small>
                                <small style="color: #0dcaf0;">Completed: ${completedCount}</small>
                                <small class="text-danger">Inactive: ${inactiveCount}</small>
                            </div>
                        </div>
                    `;

                    // Update students table
                    const studentsTableBody = document.getElementById('companyStudentsTable');
                    studentsTableBody.innerHTML = company.students.map(student => `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center">
                                    <img src="/static/images/${student.profile_img}" 
                                         class="rounded-circle me-3" 
                                         width="40" 
                                         height="40"
                                         alt="${student.name}">
                                    <div>
                                        <div class="fw-medium">${student.name}</div>
                                        <div class="text-muted small">${student.user_id}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="badge ${
                                    student.status === 'Completed' ? 'bg-info-subtle' :
                                    student.status === 'Active' ? 'bg-success-subtle text-success' : 
                                    'bg-danger-subtle text-danger'
                                }" ${student.status === 'Completed' ? 'style="color: #0dcaf0;"' : ''}>
                                    ${student.status}
                                </span>
                            </td>
                        </tr>
                    `).join('');

                    // Show the company modal
                    const modal = new bootstrap.Modal(document.getElementById('viewCompanyModal'));
                    modal.show();
                })
                .catch(error => {
                    console.error('Error fetching company details:', error);
                });
            break;
        case 'archive':
            if (confirm('Are you sure you want to archive this company?')) {
                console.log('Archiving company:', companyId);
            }
            break;
    }
};

// Handle student view action
function handleStudentView(studentId) {
    // Hide company modal first
    const companyModal = bootstrap.Modal.getInstance(document.getElementById('viewCompanyModal'));
    companyModal.hide();

    // Fetch and show student details in student modal
    fetch(`/api/students/${studentId}`)
        .then(response => response.json())
        .then(student => {
            // Update just the student name in header
            document.getElementById('studentName').textContent = student.name;
            
            // Initialize attendance data
            const fromDate = document.querySelector('input[type="date"]');
            if (fromDate) {
                fromDate.value = new Date().toISOString().split('T')[0];
                // Trigger attendance fetch
                fetchAttendanceData(student.user_id, fromDate.value);
            }

            // Show the student modal
            const studentModal = new bootstrap.Modal(document.getElementById('viewStudentModal'));
            studentModal.show();
        })
        .catch(error => {
            console.error('Error fetching student details:', error);
        });
}

// Function to fetch attendance data
function fetchAttendanceData(studentId, fromDate, toDate = '') {
    fetch(`/api/attendance/${studentId}?from=${fromDate}${toDate ? `&to=${toDate}` : ''}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update attendance table
                updateAttendanceTable(data.data, data.dates);
                // Update statistics
                updateAttendanceStats(data.data);
            }
        })
        .catch(error => console.error('Error fetching attendance:', error));
}

// Function to update attendance statistics
function updateAttendanceStats(attendanceData) {
    let totalPresent = 0;
    let totalAbsence = 0;
    let totalDays = 0;

    attendanceData.forEach(student => {
        student.attendance.forEach(record => {
            totalDays++;
            if (record.status === 'Present') totalPresent++;
            else if (record.status === 'Absent') totalAbsence++;
        });
    });

    document.getElementById('totalPresent').textContent = totalPresent;
    document.getElementById('totalAbsence').textContent = totalAbsence;
    document.getElementById('attendancePercentage').textContent = 
        totalDays ? `${Math.round((totalPresent / totalDays) * 100)}%` : '0%';
}

// Add event listeners for date filters
document.addEventListener('DOMContentLoaded', () => {
    const fromDate = document.querySelector('input[type="date"]');
    const toDate = document.querySelector('input[type="date"][name="to"]');
    const applyFilter = document.querySelector('.btn.apply-filter');
    const resetFilter = document.querySelector('.btn.reset-filter');

    if (applyFilter) {
        applyFilter.addEventListener('click', () => {
            const studentId = document.getElementById('studentId').textContent;
            fetchAttendanceData(studentId, fromDate.value, toDate.value);
        });
    }

    if (resetFilter) {
        resetFilter.addEventListener('click', () => {
            const studentId = document.getElementById('studentId').textContent;
            fromDate.value = new Date().toISOString().split('T')[0];
            toDate.value = '';
            fetchAttendanceData(studentId, fromDate.value);
        });
    }
});

// Initialize tooltips if any
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
});

// Function to generate company ID (ma + 2 numbers + 2 letters)
function generateCompanyId() {
    const numbers = '0123456789';
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let id = 'ma';
    
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
