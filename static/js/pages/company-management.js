// Define functions at the top
function updateTable(companies) {
    const tableBody = document.querySelector('#companyTable tbody');
    if (!tableBody) {
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
            <td class="align-middle status-cell">
                <span class="badge ${company.status === 'Active' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}" 
                      style="padding: 0.4em 0.65em; font-size: 0.8rem; font-weight: 600; vertical-align: middle; display: inline-block;">
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
    console.log('Company management page loaded'); // Kept as requested previously

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
        paginationInfo: document.getElementById('paginationInfo'),
        exportBtn: document.getElementById('exportCSV')
    };

    // Initialize variables
    let allCompanies = [];
    let currentPage = 1;
    let itemsPerPage = parseInt(elements.rowsPerPage?.value) || 5;

    // Define fetchAndUpdateData function
    function fetchAndUpdateData() {
        const selectedStatus = elements.statusFilter ? elements.statusFilter.value : 'All';
        const tableBody = document.querySelector('#companyTable tbody');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Loading...</td></tr>';
        
        fetch(`/api/companies-direct${selectedStatus === 'All' ? '' : `?status=${selectedStatus}`}`)
            .then(response => response.json())
            .then(data => {
                allCompanies = data;
                filterAndDisplay();
            })
            .catch(error => {
                console.error('Error fetching company data:', error); // Kept error log
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error loading data</td></tr>';
            });
    }

    // Function to filter and display companies
    function filterAndDisplay() {
        const selectedStatus = elements.statusFilter ? elements.statusFilter.value : 'All';
        let filteredCompanies;

        // Filter logic based on status and archive state
        if (selectedStatus === 'Archived') {
            filteredCompanies = allCompanies.filter(company => company.is_archived == 1);
        } else if (selectedStatus === 'Active') {
            filteredCompanies = allCompanies.filter(company => company.status === 'Active' && company.is_archived == 0);
        } else if (selectedStatus === 'Inactive') {
            filteredCompanies = allCompanies.filter(company => company.status === 'Inactive' && company.is_archived == 0);
        } else { 
            filteredCompanies = allCompanies.filter(company => company.is_archived == 0);
        }

        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const visibleCompanies = filteredCompanies.slice(startIdx, endIdx);
        
        updateTable(visibleCompanies);
        
        // Stats calculation logic
        const stats = {
            total_companies: allCompanies.filter(c => c.is_archived == 0).length,
            active_companies: allCompanies.filter(c => c.status === 'Active' && c.is_archived == 0).length,
            inactive_companies: allCompanies.filter(c => c.status === 'Inactive' && c.is_archived == 0).length,
        };
        updateStats(stats);
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

    // Export Button Listener
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const exportButton = this;
            const originalButtonText = exportButton.innerHTML;
            exportButton.disabled = true;
            exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Preparing...';

            const status = elements.statusFilter?.value || '';
            const search = elements.searchInput?.value || '';
            let baseUrl = '/api/companies/export';
            const params = [];
            if (status) params.push(`status=${encodeURIComponent(status)}`);
            if (search) params.push(`search=${encodeURIComponent(search)}`);
            const queryString = params.join('&');
            const countUrl = `${baseUrl}/count?${queryString}`;
            const exportUrl = `${baseUrl}?${queryString}`;
            
            // Show processing toast
            showToast('Preparing export, please wait...', 'info', 'Processing');
            
            fetch(countUrl)
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(errData => {
                            throw new Error(errData.error || `HTTP error ${response.status}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        const count = data.count;
                        if (count > 0) {
                            showToast(`Exported ${count} ${count === 1 ? 'company' : 'companies'} to CSV file`, 'success', 'Success');
                            window.location.href = exportUrl;
                        } else {
                            showToast('No companies match the current filters for export.', 'info', 'No Data to Export');
                        }
                    } else {
                        showToast(data.error || 'Failed to count companies for export.', 'error', 'Export Error');
                    }
                })
                .catch(error => {
                    console.error('Error counting companies for export:', error);
                    showToast(error.message || 'An error occurred while preparing the export.', 'error', 'Export Failed');
                })
                .finally(() => {
                    exportButton.disabled = false;
                    exportButton.innerHTML = originalButtonText;
                });
        });
    }

    // Initial data fetch
    fetchAndUpdateData();

    // Listener for showing/hiding custom reason input in archive modal
    const reasonSelect = document.getElementById('archiveCompanyReason');
    const customReasonContainer = document.getElementById('archiveCompanyCustomReasonContainer');
    if (reasonSelect && customReasonContainer) {
        reasonSelect.addEventListener('change', function() {
            if (this.value === 'other') {
                customReasonContainer.classList.remove('d-none');
            } else {
                customReasonContainer.classList.add('d-none');
            }
        });
    }

    // Listener for the final confirmation button in the archive modal
    const confirmArchiveBtn = document.getElementById('confirmArchiveCompanyBtn');
    if (confirmArchiveBtn) {
        confirmArchiveBtn.addEventListener('click', function() {
            const companyIdToArchive = document.getElementById('archiveCompanyIdInput').value;
            const reasonDropdown = document.getElementById('archiveCompanyReason');
            let archiveReason = reasonDropdown.value;

            if (archiveReason === 'other') {
                archiveReason = document.getElementById('archiveCompanyCustomReason').value.trim();
            }

            if (!archiveReason) {
                 // Show error toast if no reason selected/provided
                 showToast('Please select or provide an archive reason.', 'error', 'Error');
                 return; // Stop execution
            }

            // Disable button to prevent double clicks
            this.disabled = true; 
            this.textContent = 'Archiving...';

            // Get CSRF token from meta tag
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            if (!csrfToken) {
                console.warn('CSRF token not found, request may fail');
                showToast('CSRF token missing. Request may fail.', 'warning', 'Warning');
            }
            
            // Show processing toast
            const companyName = document.getElementById('archiveCompanyNameDisplay').textContent;
            showToast(`Archiving company "${companyName}"...`, 'info', 'Processing');
            
            fetch(`/api/companies/${companyIdToArchive}/archive`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken || ''
                },
                credentials: 'same-origin',
                body: JSON.stringify({ reason: archiveReason }) // Send reason in body
            })
            .then(response => {
                 // Check if response is ok, if not, attempt to parse as JSON for error
                if (!response.ok) {
                    // Check specifically for 400 status which might indicate active students
                    if (response.status === 400) {
                        const error = new Error('Please inactive the student(s) from this company before archiving the company. Try again later!');
                        error.status = response.status;
                        throw error;
                    }
                    
                    // Try to parse the error response as JSON
                    return response.json().then(errData => {
                        // If JSON parsing is successful, create an error with message from JSON
                        const error = new Error(errData.error || `HTTP error ${response.status}`);
                        error.data = errData; // Attach the full error data
                        error.status = response.status; // Attach the status code
                        throw error;
                    }).catch(() => { 
                        // If response is not JSON (e.g., HTML error page), throw generic error
                        const error = new Error(`HTTP error ${response.status}: Please try again later.`);
                        error.status = response.status;
                        throw error;
                    });
                }
                // If response is OK, parse JSON as usual
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Get company name for the success message
                    const companyName = document.getElementById('archiveCompanyNameDisplay').textContent;
                    const companyId = document.getElementById('archiveCompanyIdDisplay').textContent;
                    
                    // Show success toast with company details
                    showToast(`Company "${companyName}" archived successfully`, 'success', 'Success');
                    
                    // Refresh table data
                    if (window.fetchAndUpdateData) {
                        window.fetchAndUpdateData(); 
                    } else {
                        console.error('fetchAndUpdateData function not found on window object.');
                    }
                    // Close the modal
                    const archiveModalInstance = bootstrap.Modal.getInstance(document.getElementById('archiveCompanyModal'));
                    if (archiveModalInstance) {
                         archiveModalInstance.hide();
                    }
                    
                    // Add link to archives in the toast
                    setTimeout(() => {
                        try {
                            // Use a more specific selector if needed, e.g., within a specific toast container
                            const toastElement = document.querySelector('.toast.show .toast-body'); 
                            if (toastElement) {
                                const archiveLink = document.createElement('div');
                                archiveLink.className = 'mt-2';
                                archiveLink.innerHTML = '<a href="/admin/archive-view?type=company" class="btn btn-sm btn-outline-secondary">View in Company Archives</a>';
                                toastElement.appendChild(archiveLink);
            } else {
                                console.warn('Could not find visible toast body to add archive link.');
            }
                        } catch (error) {
                            console.error('Error adding archive link to toast:', error);
                        }
                    }, 100); // Small delay to ensure toast is rendered

            } else {
                    // Error message from backend JSON
                    let errorMessage = data.error || 'Error archiving company';
                    if (data.details) { // Show details if provided (e.g., active students)
                        errorMessage += ` (${data.details})`;
                    }
                    showToast(errorMessage, 'error', 'Error');
                }
            })
            .catch(error => {
                console.error('Error during company archive fetch:', error);
                
                // Use the specific error message if available from parsed JSON
                let errorMessage;
                if (error.data && error.data.error) {
                    errorMessage = error.data.error;
                    if (error.data.details) {
                        errorMessage += ` - ${error.data.details}`;
                    }
                } else {
                    // Fallback to generic error message
                    errorMessage = error.message || 'An error occurred while archiving the company.';
                }
                
                showToast(errorMessage, 'error', 'Error');
            })
            .finally(() => {
                 // Re-enable button regardless of success/failure
                 this.disabled = false;
                 this.textContent = 'Archive Company';
            });
        });
    }

    // Make fetchAndUpdateData available to window for edit/archive functionality
    window.fetchAndUpdateData = fetchAndUpdateData;

    // Add listener for the save button in the new edit student status modal
    const saveStudentStatusBtn = document.getElementById('saveStudentStatusBtn');
    if (saveStudentStatusBtn) {
        saveStudentStatusBtn.addEventListener('click', saveStudentStatusFromModal);
    }

    // Add listeners for bulk action dropdown items
    const bulkMarkActive = document.getElementById('modalBulkMarkActive');
    const bulkMarkInactive = document.getElementById('modalBulkMarkInactive');

    if (bulkMarkActive) {
        bulkMarkActive.addEventListener('click', (e) => {
            e.preventDefault();
            handleModalBulkAction('active');
        });
    }
    if (bulkMarkInactive) {
        bulkMarkInactive.addEventListener('click', (e) => {
            e.preventDefault();
            handleModalBulkAction('inactive');
        });
    }
    
    // Initial setup for select all checkbox state
    const selectAllCheckbox = document.getElementById('modalSelectAllStudents');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.disabled = true;
    }
    toggleBulkActions(); // Ensure bulk actions are hidden initially

    console.log('Company management initialized successfully'); // Added log
});

// --- State for View Modal Pagination --- 
let viewModalCurrentPage = 1; // Track current page globally for refresh

// --- Global Function to Load and Show View Modal --- 
async function loadAndShowViewModal(companyId, targetPage = 1) { // Added targetPage argument
    viewModalCurrentPage = targetPage; // Set the global tracker
    try {
        const response = await fetch(`/api/companies-direct/${companyId}`);
        if (!response.ok) {
             throw new Error(`HTTP error ${response.status}`);
        }
        const company = await response.json();

        // let modalCurrentPage = 1;
        let modalItemsPerPage = 5; 
        let modalAllStudents = company.students || [];
        modalItemsPerPage = parseInt(document.getElementById('modalRowsPerPage')?.value || '5'); // Read current selection

        // --- Populate Company Details --- 
        document.getElementById('viewCompanyName').textContent = company.name;
        document.getElementById('viewCompanyId').textContent = company.company_id;
        document.getElementById('viewCompanyContact').textContent = company.contact;
        document.getElementById('viewCompanyEmail').textContent = company.email;
        const statusBadge = document.getElementById('viewCompanyStatus');
        statusBadge.textContent = company.status;
        statusBadge.className = `badge ${company.status === 'Active' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`;

        // --- Student Count Header --- 
        const studentsCount = modalAllStudents.length;
        const activeCount = modalAllStudents.filter(s => s.status === 'Active').length;
        const inactiveCount = modalAllStudents.filter(s => s.status === 'Inactive').length;
        document.getElementById('companyStudentsHeader').innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0">Company Students (${studentsCount})</h6>
                <div class="d-flex gap-3">
                    <small class="text-success">Active: ${activeCount}</small>
                    <small class="text-danger">Inactive: ${inactiveCount}</small>
                </div>
            </div>
        `;

        // --- Function to Update Modal Pagination Controls (Reads global viewModalCurrentPage) ---
        function updateModalPagination() {
            const totalStudents = modalAllStudents.length;
            const totalPages = Math.ceil(totalStudents / modalItemsPerPage);
            // Read global page state
            const startIndex = (viewModalCurrentPage - 1) * modalItemsPerPage; 
            const endIndex = Math.min(startIndex + modalItemsPerPage, totalStudents);

            const infoEl = document.getElementById('modalPaginationInfo');
            const prevBtn = document.getElementById('modalPrevPage');
            const nextBtn = document.getElementById('modalNextPage');

            if (infoEl) {
                infoEl.textContent = totalStudents > 0 ? `${startIndex + 1}-${endIndex} of ${totalStudents}` : '0 students';
            }
            if (prevBtn) {
                prevBtn.disabled = viewModalCurrentPage === 1;
            }
            if (nextBtn) {
                nextBtn.disabled = viewModalCurrentPage === totalPages || totalStudents === 0;
            }
        }

        // --- Initial Student Table Render (Based on targetPage) ---
        const initialStartIndex = (viewModalCurrentPage - 1) * modalItemsPerPage;
        const initialEndIndex = Math.min(initialStartIndex + modalItemsPerPage, modalAllStudents.length);
        updateModalStudentTable(modalAllStudents.slice(initialStartIndex, initialEndIndex));
        updateModalPagination(); // Initial pagination update

        // --- Attach Event Listeners for Modal Pagination (Updates global viewModalCurrentPage) --- 
        const rowsSelect = document.getElementById('modalRowsPerPage');
        const prevBtn = document.getElementById('modalPrevPage');
        const nextBtn = document.getElementById('modalNextPage');

        // Use .replaceWith(clone) to ensure old listeners are removed before adding new ones
        if (rowsSelect) {
            rowsSelect.value = modalItemsPerPage;
            const newRowsSelect = rowsSelect.cloneNode(true);
            rowsSelect.parentNode.replaceChild(newRowsSelect, rowsSelect);
            newRowsSelect.addEventListener('change', function() {
                modalItemsPerPage = parseInt(this.value);
                viewModalCurrentPage = 1; // Reset to page 1 on changing items per page
                const startIndex = (viewModalCurrentPage - 1) * modalItemsPerPage;
                const endIndex = Math.min(startIndex + modalItemsPerPage, modalAllStudents.length);
                updateModalStudentTable(modalAllStudents.slice(startIndex, endIndex));
                updateModalPagination();
            });
        }
        if (prevBtn) {
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
            newPrevBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (viewModalCurrentPage > 1) {
                    viewModalCurrentPage--; // Update global page
                    const startIndex = (viewModalCurrentPage - 1) * modalItemsPerPage;
                    const endIndex = Math.min(startIndex + modalItemsPerPage, modalAllStudents.length);
                    updateModalStudentTable(modalAllStudents.slice(startIndex, endIndex));
                    updateModalPagination();
                }
            });
        }
         if (nextBtn) {
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
            newNextBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const totalPages = Math.ceil(modalAllStudents.length / modalItemsPerPage);
                if (viewModalCurrentPage < totalPages) {
                    viewModalCurrentPage++; // Update global page
                    const startIndex = (viewModalCurrentPage - 1) * modalItemsPerPage;
                    const endIndex = Math.min(startIndex + modalItemsPerPage, modalAllStudents.length);
                    updateModalStudentTable(modalAllStudents.slice(startIndex, endIndex));
                    updateModalPagination();
                }
            });
        }
        
        // Show the modal if it's not already shown
        const modalElement = document.getElementById('viewCompanyModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        modalInstance.show();

    } catch (error) {
        console.error('Error loading or showing view modal:', error);
        showToast(`Could not load company details: ${error.message}`, 'error', 'Error');
    }
}

// --- Modify handleCompanyAction to call the new global function --- 
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

                        // Get CSRF token from meta tag
                        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                        if (!csrfToken) {
                            console.warn('CSRF token not found, request may fail');
                            showToast('CSRF token missing. Request may fail.', 'warning', 'Warning');
                        }
                        
                        // Show processing toast
                        showToast(`Updating company "${updatedCompany.name}"...`, 'info', 'Processing');
                        
                        // Disable submit button and show loading state
                        const submitButton = document.querySelector('#editCompanyForm button[type="submit"]');
                        const originalButtonText = submitButton.innerHTML;
                        submitButton.disabled = true;
                        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
                        
                        fetch(`/api/companies-direct/${companyId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrfToken || ''
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify(updatedCompany)
                        })
                        .then(response => {
                            if (!response.ok) {
                                return response.json().then(errData => {
                                    throw new Error(errData.error || `HTTP error ${response.status}`);
                                });
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data.success) {
                                // Close modal
                                bootstrap.Modal.getInstance(document.getElementById('editCompanyModal')).hide();
                                
                                // Refresh table
                                fetchAndUpdateData();
                                
                                // Show success toast with company details
                                showToast('Company updated successfully', 'success', 'Success');
                            } else {
                                // Show error toast
                                showToast('Failed to update company', 'error', data.error || 'Update Failed');
                            }
                        })
                        .catch(error => {
                            console.error('Error updating company:', error);
                            // Show error toast with details
                            showToast(error.message || 'An error occurred while updating the company', 'error', 'Error');
                        })
                        .finally(() => {
                            // Re-enable button and restore original text
                            if (submitButton) {
                                submitButton.disabled = false;
                                submitButton.innerHTML = originalButtonText;
                            }
                        });
                    };
                })
                .catch(error => {
                    console.error('Error fetching company details:', error);
                    // Show error toast
                    showToast('Error fetching company details', 'error', 'Error');
                });
            break;
        case 'view':
            loadAndShowViewModal(companyId); // Call the new global function
            break;
        case 'archive':
            showArchiveConfirmation(companyId);
            break;
        default:
            console.log('Unknown action:', action);
    }
};

function showArchiveConfirmation(companyId) {
    const modalElement = document.getElementById('archiveCompanyModal');
    const modalTitle = modalElement.querySelector('.modal-title');
    const confirmButton = modalElement.querySelector('#confirmArchiveCompanyBtn');
    const companyIdInput = document.getElementById('archiveCompanyIdInput'); // Get hidden input
    const companyNameDisplay = document.getElementById('archiveCompanyNameDisplay'); // Element to display name
    const companyIdDisplay = document.getElementById('archiveCompanyIdDisplay'); // Element to display ID

    if (!modalElement || !modalTitle || !confirmButton || !companyIdInput || !companyNameDisplay || !companyIdDisplay) {
        console.error('Archive confirmation modal elements missing (modal, title, button, hidden input, name/id display).');
        showToast('Cannot open archive dialog. UI elements missing.', 'error', 'Error');
        return;
    }

    // Store the companyId in the hidden input AND button dataset
    companyIdInput.value = companyId;
    confirmButton.dataset.companyId = companyId; // Keep for potential fallback, though input is preferred
    companyIdDisplay.textContent = companyId; // Display the ID

    // Fetch company name to display in the title and warning message
            fetch(`/api/companies-direct/${companyId}`)
                .then(response => response.json())
                .then(company => {
            const name = company?.name || 'this company'; // Use fetched name or default
            modalTitle.textContent = `Archive Company: ${name}`;
            companyNameDisplay.textContent = name; // Display the name in warning
        })
        .catch(error => {
            console.error('Error fetching company name for archive modal:', error);
            modalTitle.textContent = `Archive Company`; // Default title on error
            companyNameDisplay.textContent = 'this company'; // Default name on error
        });

    // Reset reason dropdown and custom input before showing
    const reasonSelect = document.getElementById('archiveCompanyReason');
    const customReasonInput = document.getElementById('archiveCompanyCustomReason');
    const customReasonContainer = document.getElementById('archiveCompanyCustomReasonContainer');
    if(reasonSelect) reasonSelect.value = '';
    if(customReasonInput) customReasonInput.value = '';
    if(customReasonContainer) customReasonContainer.classList.add('d-none');

    // Show the modal
    const archiveModal = new bootstrap.Modal(modalElement);
    archiveModal.show();
}

function saveCompanyChanges() {
    const form = document.getElementById('editCompanyForm');
    const companyId = form.dataset.companyId; // Assuming company ID is stored in a data attribute
    const saveButton = document.getElementById('saveCompanyBtn');

    if (!form || !companyId || !saveButton) {
        showToast('Could not save changes. Form elements missing.', 'error', 'Error');
        return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Ensure status is included
    data.status = document.getElementById('editCompanyStatus').value;

    // Disable button
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

            fetch(`/api/companies-direct/${companyId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
            // Add CSRF token header if needed
                },
        body: JSON.stringify(data)
            })
            .then(response => response.json())
    .then(result => {
        if (result.success) {
            showToast('Success', result.message || 'Company updated successfully.', 'success');
            fetchAndUpdateData(); // Refresh the table
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editCompanyModal'));
            if (editModal) {
                editModal.hide();
            }
                } else {
            showToast('Error', result.error || 'Failed to update company.', 'error');
                }
            })
            .catch(error => {
        console.error('Error updating company:', error);
        showToast('Error', `Failed to update company: ${error.message}`, 'error');
    })
    .finally(() => {
        // Re-enable button
        saveButton.disabled = false;
        saveButton.innerHTML = 'Save Changes';
    });
}

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

// Function to generate company ID (ma + 2 digits + 2 letters)
function generateCompanyId() {
    const digits = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const letters = String.fromCharCode(97 + Math.floor(Math.random() * 26)) + 
                    String.fromCharCode(97 + Math.floor(Math.random() * 26));
    return `ma${digits}${letters}`;
}

// Function to update the student table within the view modal
function updateModalStudentTable(students) {
    const tbody = document.getElementById('companyStudentsTable');
    const selectAllCheckbox = document.getElementById('modalSelectAllStudents');
    if (!tbody || !selectAllCheckbox) return;

    tbody.innerHTML = ''; // Clear existing rows
    selectAllCheckbox.checked = false; // Uncheck select all
    toggleBulkActions(); // Hide bulk actions initially

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No students found for this company.</td></tr>'; // Updated colspan to 4
        selectAllCheckbox.disabled = true;
        return;
    }
    selectAllCheckbox.disabled = false;

    students.forEach(student => {
        const row = document.createElement('tr');
        const statusBadgeClass = student.status === 'Active' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
        
        row.innerHTML = `
            <td><input type="checkbox" class="form-check-input modal-student-checkbox" value="${student.user_id}"></td>
            <td>
                <div class="d-flex align-items-center">
                    <img src="/static/images/${student.profile_img || 'profile.png'}" 
                         alt="${student.name}" 
                         class="rounded-circle me-2" 
                         width="32" 
                         height="32">
                    <div>
                        <div class="fw-medium">${student.name}</div>
                        <div class="small text-muted">${student.user_id}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge ${statusBadgeClass}">${student.status}</span></td>
            <td class="text-end"> 
                <button class="btn btn-sm btn-link text-primary p-0 edit-student-status-btn"
                        data-student-id="${student.user_id}"
                        data-student-name="${student.name}"
                        data-current-status="${student.status}"
                        title="Edit Status">
                    <i class="bi bi-pencil" style="color: #191970;"></i>
                </button>
            </td> 
        `;
        tbody.appendChild(row);
    });

    // Re-add event listeners for the edit buttons
    tbody.querySelectorAll('.edit-student-status-btn').forEach(button => {
        button.addEventListener('click', function() {
            prepareEditStudentStatusModal(this.dataset.studentId, this.dataset.studentName, this.dataset.currentStatus);
        });
    });

    // Add event listeners for checkboxes
    tbody.querySelectorAll('.modal-student-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            toggleBulkActions();
            // Check if all checkboxes are checked
            const allChecked = Array.from(tbody.querySelectorAll('.modal-student-checkbox')).every(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
        });
    });

    // Listener for select all checkbox
    selectAllCheckbox.addEventListener('change', function() {
        tbody.querySelectorAll('.modal-student-checkbox').forEach(checkbox => {
            checkbox.checked = this.checked;
        });
        toggleBulkActions();
    });
}

// Function to show/hide bulk actions dropdown
function toggleBulkActions() {
    const container = document.getElementById('modalBulkActionsContainer');
    const checkboxes = document.querySelectorAll('#companyStudentsTable .modal-student-checkbox:checked');
    if (container) {
        container.style.display = checkboxes.length > 0 ? 'block' : 'none';
    }
}

// Function to handle bulk status updates
async function handleModalBulkAction(action) {
    const checkboxes = document.querySelectorAll('#companyStudentsTable .modal-student-checkbox:checked');
    const studentIds = Array.from(checkboxes).map(cb => cb.value);
    const newStatusIsActive = action === 'active';
    const companyIdToRefresh = document.getElementById('editStudentStatusCompanyIdInput').value || document.getElementById('viewCompanyId').textContent;
    const currentPageBeforeBulk = viewModalCurrentPage; // Capture current page

    if (studentIds.length === 0) {
        showToast('Info', 'Please select at least one student.', 'info');
        return;
    }

    // Optional: Add a confirmation step here if desired
    // if (!confirm(`Are you sure you want to mark ${studentIds.length} students as ${newStatusIsActive ? 'Active' : 'Inactive'}?`)) {
    //     return;
    // }

    showToast('Processing', `Updating status for ${studentIds.length} students...`, 'info');

    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    const promises = studentIds.map(studentId => 
        fetch(`/api/users/${studentId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || ''
            },
            credentials: 'same-origin',
            body: JSON.stringify({ is_active: newStatusIsActive })
        })
        .then(response => response.ok ? response.json() : response.json().then(err => Promise.reject(err)))
    );

    try {
        const results = await Promise.allSettled(promises);
        const successfulUpdates = results.filter(r => r.status === 'fulfilled').length;
        const failedUpdates = results.filter(r => r.status === 'rejected').length;

        let message = '';
        if (successfulUpdates > 0) {
            message += `${successfulUpdates} student(s) updated successfully.`;
        }
        if (failedUpdates > 0) {
            message += ` ${failedUpdates} update(s) failed.`;
            console.error('Bulk update failures:', results.filter(r => r.status === 'rejected'));
        }

        showToast(failedUpdates > 0 ? 'Warning' : 'Success', message.trim(), failedUpdates > 0 ? 'warning' : 'success');

        // Refresh the modal student list preserving the current page
        if (companyIdToRefresh) {
            await loadAndShowViewModal(companyIdToRefresh, currentPageBeforeBulk); // Pass current page
        }

    } catch (error) { // Should not happen with Promise.allSettled, but for safety
        console.error('Unexpected error during bulk update:', error);
        showToast('Error', 'An unexpected error occurred during bulk update.', 'error');
    }
}

// Function to populate and show the edit student status modal
function prepareEditStudentStatusModal(studentId, studentName, currentStatus) {
    document.getElementById('editStudentStatusName').textContent = studentName;
    document.getElementById('editStudentStatusIdDisplay').textContent = studentId;
    document.getElementById('editStudentStatusIdInput').value = studentId;
    document.getElementById('editStudentStatusSelect').value = currentStatus;
    
    // Store the company ID currently being viewed so we know which company data to refresh
    const currentCompanyId = document.getElementById('viewCompanyId').textContent;
    document.getElementById('editStudentStatusCompanyIdInput').value = currentCompanyId;

    const editModal = new bootstrap.Modal(document.getElementById('editStudentStatusModal'));
    editModal.show();
}

// Function to save student status from the modal
async function saveStudentStatusFromModal() {
    const studentId = document.getElementById('editStudentStatusIdInput').value;
    const newStatus = document.getElementById('editStudentStatusSelect').value;
    const companyIdToRefresh = document.getElementById('editStudentStatusCompanyIdInput').value;
    const saveBtn = document.getElementById('saveStudentStatusBtn');
    const currentPageBeforeSave = viewModalCurrentPage; // Capture current page

    // Disable button
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

    try {
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!csrfToken) {
            console.warn('CSRF token not found, request may fail');
            showToast('Warning', 'CSRF token missing. Request may fail.', 'warning');
        }
        
        const response = await fetch(`/api/users/${studentId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || ''
            },
            credentials: 'same-origin',
            body: JSON.stringify({ is_active: newStatus === 'Active' }) // API expects boolean is_active
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error ${response.status}`);
        }

        showToast('Success', data.message || 'Student status updated successfully');

        // Refresh the student list preserving the current page
        if (companyIdToRefresh) {
             await loadAndShowViewModal(companyIdToRefresh, currentPageBeforeSave); // Pass current page
        }

        // Hide the edit status modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editStudentStatusModal'));
        if (editModal) {
            editModal.hide();
        }

    } catch (error) {
        console.error('Error saving student status:', error);
        showToast('Error', error.message || 'Failed to update student status', 'error');
    } finally {
        // Re-enable button
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Status';
    }
}

// Event listener for Add Company form submission
const addCompanyFormForListener = document.getElementById('addCompanyForm'); // Use a different var name if needed
if (addCompanyFormForListener) {
    addCompanyFormForListener.addEventListener('submit', async function (event) {
        event.preventDefault();
        event.stopPropagation();
        // console.log("Correct Add Company Form submit listener triggered."); // REMOVED LOG

        // Define email inputs within this scope
        const contactEmailInput = document.getElementById('contactEmail');
        const confirmEmailInput = document.getElementById('confirmEmail');
        const companyIdInput = document.getElementById('companyId'); // Also define here for consistency

        let isFormValid = true;

        // 1. Custom Email Confirmation Validation
        if (contactEmailInput && confirmEmailInput) {
            if (contactEmailInput.value !== confirmEmailInput.value) {
                confirmEmailInput.setCustomValidity('Email addresses do not match');
                isFormValid = false;
                // console.log("Email validation FAILED."); // REMOVED LOG
            } else {
                confirmEmailInput.setCustomValidity(''); // Clear custom error
                // console.log("Email validation PASSED."); // REMOVED LOG
            }
        }

        // 2. Bootstrap Validation
        const bootstrapValid = addCompanyFormForListener.checkValidity(); // Get result
        // console.log("Bootstrap checkValidity():", bootstrapValid); // REMOVED LOG
        if (!bootstrapValid) {
            isFormValid = false;
        }

        // Add Bootstrap validation classes
        addCompanyFormForListener.classList.add('was-validated');

        // console.log("Final isFormValid check before fetch:", isFormValid); // REMOVED LOG
        if (isFormValid) {
            // console.log("Form is valid, proceeding to fetch..."); // REMOVED LOG
            // Form is valid, proceed with submission
            const formData = {
                name: document.getElementById('companyName').value,
                contact: document.getElementById('contactName').value,
                email: contactEmailInput.value,
                company_id: companyIdInput.value
            };

            // Select the button associated with the form, even if it's outside the form tag
            const submitButton = document.querySelector('button[form="addCompanyForm"][type="submit"]'); 
            const originalButtonText = submitButton.innerHTML;

            // Get CSRF token from the form's hidden field (preferred) or meta tag
            const csrfTokenField = document.querySelector('#addCompanyForm input[name="csrf_token"]');
            const csrfToken = csrfTokenField ? csrfTokenField.value : document.head.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            if (!csrfToken) {
                console.warn('CSRF token not found, request may fail');
                showToast('Warning', 'CSRF token missing. Request may fail.', 'warning');
            }
            
            // Disable the submit button and show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';
            
            // Show processing toast
            showToast(`Adding company ${formData.name}...`, 'info', 'Processing');
            
            fetch('/api/companies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken || ''
                },
                credentials: 'same-origin',
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) {
                    // If response is not ok, try to parse error message
                    return response.json().then(errData => {
                        throw new Error(errData.error || `HTTP error ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Success message with company details
                    showToast(`Company "${formData.name}" (ID: ${formData.company_id}) added successfully`, 'success', 'Success');
                    
                    // Close modal explicitly
                    const modalInstance = bootstrap.Modal.getInstance(addCompanyModalElement);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                    
                    // Refresh table data
                    if (window.fetchAndUpdateData) {
                        window.fetchAndUpdateData();
                    } else {
                        console.error('fetchAndUpdateData function not found on window object.');
                    }
                } else {
                    showToast(data.error || 'Error adding company', 'error', 'Error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast(error.message || 'An error occurred while adding the company', 'error', 'Error');
            })
            .finally(() => {
                // Re-enable the button and restore original text
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            });
        }
    });
} 

// --- Add Company Modal Logic --- 

// Get references to modal elements
const addCompanyModalElement = document.getElementById('addCompanyModal');
const addCompanyForm = document.getElementById('addCompanyForm'); // Can re-use this name here

// Event listener for when the Add Company modal is ABOUT TO BE shown
if (addCompanyModalElement) {
    addCompanyModalElement.addEventListener('show.bs.modal', function () {
        // console.log('Add Company Modal show.bs.modal event triggered.'); // REMOVED LOG
        const companyIdInput = document.getElementById('companyId');
        const confirmEmailInput = document.getElementById('confirmEmail'); // Need this for resetting validation
        
        // Generate and set the Company ID
        if (companyIdInput) {
            const newId = generateCompanyId();
            companyIdInput.value = newId;
            // console.log('Generated Company ID:', newId); // REMOVED LOG
        } else {
            console.error('#companyId input not found in modal show event.');
        }
        // Reset form validation state visually
        if (addCompanyForm) {
            addCompanyForm.classList.remove('was-validated');
            // Clear previous custom validation errors on confirm email
            if (confirmEmailInput) {
                confirmEmailInput.setCustomValidity('');
            }
        }
    });
}

// Event listener for when the Add Company modal IS hidden
if (addCompanyModalElement) {
    addCompanyModalElement.addEventListener('hidden.bs.modal', function () {
        // console.log('Add Company Modal hidden.bs.modal event triggered.'); // REMOVED LOG
        if (addCompanyForm) {
            addCompanyForm.reset(); // Clear all form fields
            addCompanyForm.classList.remove('was-validated'); // Reset validation state
        }
        const companyIdInput = document.getElementById('companyId');
        if (companyIdInput) {
             companyIdInput.value = ''; // Clear generated ID
        }
    });
} 
