// Initialize state
const currentState = {
    folder: '', // No default selection
    page: 1,
    perPage: 10,
    search: '',
    total: 0
};

// Store temporarily the record info for modal confirmation
let recordToRestore = null;
let recordToDelete = null;
let restoredRecord = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Archive page loaded');
    
    // Check URL params for archive type
    const params = new URLSearchParams(window.location.search);
    const archiveType = params.get('type');
    
    if (archiveType && ['class', 'student', 'company', 'instructor'].includes(archiveType)) {
        currentState.folder = archiveType;
        
        // Set dropdown value
        const archiveTypeFilter = document.getElementById('archiveTypeFilter');
        if (archiveTypeFilter) {
            archiveTypeFilter.value = archiveType;
        }
        
        // Show the correct archive table and load data
        showArchiveTable(currentState.folder);
        loadArchiveData(currentState.folder);
        
        // Update UI to show selected archive type
        updateDropdownAppearance(currentState.folder);
        
        // Highlight the selected card
        highlightSelectedCard(currentState.folder);
    } else {
        // No type selected, show default message
        hideAllArchiveTables();
        document.getElementById('defaultMessage').classList.remove('d-none');
        
        // Reset dropdown to placeholder
        const archiveTypeFilter = document.getElementById('archiveTypeFilter');
        if (archiveTypeFilter) {
            archiveTypeFilter.value = '';
        }
        
        // Load initial counts
        loadInitialCounts();
    }
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Archive type filter
    const archiveTypeFilter = document.getElementById('archiveTypeFilter');
    if (archiveTypeFilter) {
        archiveTypeFilter.addEventListener('change', function() {
            const selectedFolder = this.value;
            if (selectedFolder) {
                currentState.folder = selectedFolder;
                currentState.page = 1; // Reset to first page when switching folders
                showArchiveTable(selectedFolder);
                loadArchiveData(selectedFolder);
                
                // Update dropdown appearance
                updateDropdownAppearance(selectedFolder);
                
                // Highlight the selected card
                highlightSelectedCard(selectedFolder);
            } else {
                // Hide all tables and show default message
                hideAllArchiveTables();
                document.getElementById('defaultMessage').classList.remove('d-none');
                
                // Clear the selected highlight in UI
                currentState.folder = '';
                updateArchiveCounts({ student: 0, class: 0, company: 0, instructor: 0 });
                loadInitialCounts();
            }
        });
        
        // Set dropdown value to current state (may be empty string)
        archiveTypeFilter.value = currentState.folder;
        if (currentState.folder) {
            updateDropdownAppearance(currentState.folder);
        }
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentState.search = this.value;
            
            // Toggle clear button visibility
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                if (currentState.search.length > 0) {
                    clearBtn.classList.remove('d-none');
                } else {
                    clearBtn.classList.add('d-none');
                }
            }
            
            // Debounce search to avoid too many requests
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                if (currentState.search.length >= 2) {
                    if (currentState.folder) {
                        // If we have a specific folder type, search in that type
                        loadArchiveData(currentState.folder);
                    } else {
                        // If no folder is selected, search all types
                        searchAllArchiveTypes(currentState.search);
                    }
                } else if (currentState.search.length === 0) {
                    // If search is cleared
                    if (currentState.folder) {
                        // Reload current folder data
                        loadArchiveData(currentState.folder);
    } else {
                        // Show default message and load initial counts
                        hideAllArchiveTables();
                        document.getElementById('defaultMessage').classList.remove('d-none');
                        document.getElementById('defaultMessage').innerHTML = `
                            <i class="bi bi-archive fs-1 text-muted"></i>
                            <p class="mt-3 text-muted">Please select an archive type from the dropdown above</p>
                        `;
                        loadInitialCounts();
                    }
                }
            }, 300);
        });
    }
    
    // Rows per page selector
    const rowsPerPage = document.getElementById('rowsPerPage');
    if (rowsPerPage) {
        rowsPerPage.addEventListener('change', function() {
            currentState.perPage = parseInt(this.value);
            currentState.page = 1;
            loadArchiveData(currentState.folder);
        });
    }
    
    // Pagination buttons
    const prevPage = document.getElementById('prevPage');
    if (prevPage) {
        prevPage.addEventListener('click', function() {
            if (currentState.page > 1) {
                currentState.page--;
                loadArchiveData(currentState.folder);
            }
        });
    }
    
    const nextPage = document.getElementById('nextPage');
    if (nextPage) {
        nextPage.addEventListener('click', function() {
            // We need to check against total pages which we'd get from the API response
            currentState.page++;
            loadArchiveData(currentState.folder);
        });
    }
    
    // Export button
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportCSV();
        });
    }
}

function showArchiveTable(folder) {
    // Hide all archive tables and default message
    hideAllArchiveTables();
    document.getElementById('defaultMessage').classList.add('d-none');
        
        // Show selected archive table
        const selectedTable = document.getElementById(`${folder}ArchiveTable`);
        if (selectedTable) {
            selectedTable.classList.remove('d-none');
    }
}

function hideAllArchiveTables() {
    document.querySelectorAll('.archive-table').forEach(table => {
        table.classList.add('d-none');
    });
}

async function loadArchiveData(folder) {
    try {
        // Show loading state
        const tbody = document.querySelector(`#${folder}ArchiveBody`);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div><span>Loading archives...</span></td></tr>';
        }
        
        // Hide tables but keep selected one visible
        document.querySelectorAll('.archive-table').forEach(table => {
            if (table.id === `${folder}ArchiveTable`) {
                table.classList.remove('d-none');
            } else {
                table.classList.add('d-none');
            }
        });
        
        // Hide default message
        document.getElementById('defaultMessage').classList.add('d-none');
        
        // Build URL with query parameters
        let url = `/api/archives/${folder}`;
        const params = new URLSearchParams();
        
        if (currentState.search) {
            params.append('search', currentState.search);
        }
        
        params.append('page', currentState.page);
        params.append('per_page', currentState.perPage);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        // Fetch data from API
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch archive data: ${response.status}`);
        const data = await response.json();

        // Update stats counts
        updateArchiveCounts(data.counts || { student: 0, class: 0, company: 0, instructor: 0 });

        // Update table body
        if (tbody) {
            if (!data.records || data.records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="bi bi-info-circle me-2"></i>No archived records found</td></tr>';
            } else {
                tbody.innerHTML = data.records.map(record => generateTableRow(record, folder)).join('');
            }
        }

        // Update pagination info
        updatePaginationInfo(data);

    } catch (error) {
        console.error('Error loading archive data:', error);
        // Show error message in table
        const tbody = document.querySelector(`#${folder}ArchiveBody`);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle me-2"></i>${error.message}</td></tr>`;
        }
        
        // Reset pagination if there's an error
        document.getElementById('pageInfo').textContent = '0-0 of 0';
        document.getElementById('prevPage').disabled = true;
        document.getElementById('nextPage').disabled = true;
    }
}

// Function to update archive counts
function updateArchiveCounts(counts) {
    // Update the counts in the stats cards with animation
    const countElements = {
        'student': document.getElementById('studentCount'),
        'class': document.getElementById('classCount'),
        'company': document.getElementById('companyCount'),
        'instructor': document.getElementById('instructorCount')
    };
    
    // Update count values with 0 or the actual count
    Object.keys(countElements).forEach(type => {
        const countElement = countElements[type];
        if (countElement) {
            const count = counts[type] || 0;
            countElement.textContent = count;
        }
    });
    
    // If a folder is selected, highlight that card
    if (currentState.folder) {
        highlightSelectedCard(currentState.folder);
    } else {
        // Otherwise, remove highlight from all cards
        const allCards = ['student', 'class', 'company', 'instructor'];
        allCards.forEach(cardType => {
            const card = document.getElementById(`${cardType}ArchiveCard`);
            if (card) {
                card.classList.remove('archive-card-selected');
            }
        });
    }
}

// Function to handle clicking on stat cards
function switchArchiveType(type) {
    // Only switch if it's a different type
    if (type !== currentState.folder) {
        // Update dropdown
        const archiveTypeFilter = document.getElementById('archiveTypeFilter');
        if (archiveTypeFilter) {
            archiveTypeFilter.value = type;
        }
        
        // Update state
        currentState.folder = type;
        currentState.page = 1; // Reset to first page
        
        // Update UI
        showArchiveTable(type);
        loadArchiveData(type);
        highlightSelectedCard(type);
    }
}

// Function to highlight the selected card
function highlightSelectedCard(type) {
    // Remove highlight from all cards
    const allCards = ['student', 'class', 'company', 'instructor'];
    allCards.forEach(cardType => {
        const card = document.getElementById(`${cardType}ArchiveCard`);
        if (card) {
            card.classList.remove('archive-card-selected');
        }
    });
    
    // Add highlight to selected card
    const selectedCard = document.getElementById(`${type}ArchiveCard`);
    if (selectedCard) {
        selectedCard.classList.add('archive-card-selected');
    }
}

function updatePaginationInfo(data) {
    const pageInfo = document.getElementById('pageInfo');
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
    
    if (pageInfo) {
        if (data.records && data.records.length > 0) {
            const start = (currentState.page - 1) * currentState.perPage + 1;
            const end = start + data.records.length - 1;
            const total = data.total || data.records.length;
            pageInfo.textContent = `${start}-${end} of ${total}`;
        } else {
            pageInfo.textContent = '0-0 of 0';
        }
    }
    
    if (prevButton) {
        prevButton.disabled = currentState.page <= 1;
    }
    
    if (nextButton) {
        const hasMore = data.total ? (currentState.page * currentState.perPage < data.total) : false;
        nextButton.disabled = !hasMore;
    }
}

function generateTableRow(record, type) {
    switch(type) {
        case 'class':
            // Extract archive reason if available
            let archiveReason = 'Archived';
            
            if (record.description && record.description.includes('ARCHIVE NOTE')) {
                const match = record.description.match(/ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(\n|$)/);
                if (match && match[1]) {
                    archiveReason = match[1].trim();
                }
            }
            
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="rounded-circle bg-primary-subtle p-2 me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                <i class="bi bi-book" style="color: #191970;"></i>
                            </div>
                            <div>
                                <div class="fw-medium">${record.name}</div>
                                <div class="text-muted small">${record.class_id}</div>
                            </div>
                        </div>
                    </td>
                    <td>${record.instructor || 'Not Assigned'}</td>
                    <td>${record.day}, ${record.time}</td>
                    <td>${record.archive_date || 'Unknown'}</td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">${archiveReason}</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.class_id}', 'class')" title="Restore">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.class_id}', 'class')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        case 'student':
            // Extract archive reason if available
            let studentArchiveReason = 'Archived';
            if (record.description && record.description.includes('ARCHIVE NOTE')) {
                const match = record.description.match(/ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(\n|$)/);
                if (match && match[1]) {
                    studentArchiveReason = match[1].trim();
                }
            }
            
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="/static/images/${record.profile_img || 'profile.png'}" 
                                 alt="Profile" 
                                 class="rounded-circle me-2" 
                                 width="32" 
                                 height="32">
                            <div>
                                <div class="fw-semibold">${record.name || `${record.first_name || ''} ${record.last_name || ''}`}</div>
                                <div class="small text-muted">${record.user_id || record.id || ''}</div>
                            </div>
                        </div>
                    </td>
                    <td>${record.email || ''}</td>
                    <td>${record.company || 'Not Assigned'}</td>
                    <td>${record.archive_date || 'Unknown'}</td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">${studentArchiveReason}</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.user_id || record.id}', 'student')" title="Restore">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.user_id || record.id}', 'student')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        case 'company':
            // Extract archive reason if available
            let companyArchiveReason = 'Archived';
            if (record.description && record.description.includes('ARCHIVE NOTE')) {
                const match = record.description.match(/ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(\n|$)/);
                if (match && match[1]) {
                    companyArchiveReason = match[1].trim();
                }
            }
            
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="rounded-circle bg-warning-subtle p-2 me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                <i class="bi bi-building" style="color: #fd7e14;"></i>
                            </div>
                            <div>
                        <div class="fw-medium">${record.name}</div>
                        <div class="text-muted small">${record.company_id}</div>
                            </div>
                        </div>
                    </td>
                    <td>${record.contact || ''}</td>
                    <td>${record.email || ''}</td>
                    <td>${record.archive_date || 'Unknown'}</td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">${companyArchiveReason}</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.company_id}', 'company')" title="Restore">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.company_id}', 'company')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        case 'instructor':
            // Extract archive reason if available
            let instructorArchiveReason = 'Archived';
            if (record.description && record.description.includes('ARCHIVE NOTE')) {
                const match = record.description.match(/ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(\n|$)/);
                if (match && match[1]) {
                    instructorArchiveReason = match[1].trim();
                }
            }
            
            const department = record.department || 'Not Assigned';
            
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="/static/images/${record.profile_img || 'profile.png'}" 
                                 class="rounded-circle me-3" 
                                 width="40" 
                                 height="40"
                                 alt="${record.name || `${record.first_name || ''} ${record.last_name || ''}`}">
                            <div>
                                <div class="fw-medium">${record.name || `${record.first_name || ''} ${record.last_name || ''}`}</div>
                                <div class="text-muted small">${record.instructor_id || record.id || ''}</div>
                            </div>
                        </div>
                    </td>
                    <td>${record.email || ''}</td>
                    <td>${department}</td>
                    <td>${record.archive_date || 'Unknown'}</td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">${instructorArchiveReason}</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.instructor_id || record.id}', 'instructor')" title="Restore">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.instructor_id || record.id}', 'instructor')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        default:
            return `<tr><td colspan="6" class="text-center">Unsupported archive type: ${type}</td></tr>`;
    }
}

// Add showToast function for consistent notifications
function showToast(title, message, type = 'success') {
    try {
        // Get the toast element
        const toast = document.getElementById('statusToast');
        if (!toast) {
            console.error('Toast element not found');
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
        console.error('Error showing toast:', error);
        // Fallback to alert
        alert(`${title}: ${message}`);
    }
}

// Function to show the restore confirmation modal
function showRestoreConfirmation(id, type) {
    // Store the record info for use in the confirmation handler
    recordToRestore = { id, type };
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('confirmRestoreModal'));
    modal.show();
}

// Function to show post-restore navigation modal for classes
function showClassNavigationModal(id) {
    restoredRecord = { id };
    
    // Update the modal text if needed
    const modal = document.getElementById('classNavigationModal');
    if (modal) {
        // Show the modal
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

// Function to show the delete confirmation modal
function showDeleteConfirmation(id, type) {
    // Store the record info for use in the confirmation handler
    recordToDelete = { id, type };
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    modal.show();
}

// Initialize the modal confirm buttons once the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up the restore confirmation button
    const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
    if (confirmRestoreBtn) {
        confirmRestoreBtn.addEventListener('click', function() {
            if (recordToRestore) {
                performRestore(recordToRestore.id, recordToRestore.type);
                
                // Hide the modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('confirmRestoreModal'));
                if (modal) modal.hide();
            }
        });
    }
    
    // Set up the class navigation confirmation button
    const goToClassBtn = document.getElementById('goToClassBtn');
    if (goToClassBtn) {
        goToClassBtn.addEventListener('click', function() {
            if (restoredRecord) {
                // Navigate to class management page
                window.location.href = '/admin/class-management?restored=' + restoredRecord.id + '&t=' + Date.now();
            }
        });
    }
    
    // Set up event listener for when class navigation modal is closed
    const classNavigationModal = document.getElementById('classNavigationModal');
    if (classNavigationModal) {
        classNavigationModal.addEventListener('hidden.bs.modal', function() {
            // Reload the current archive data when modal is closed without navigation
            if (currentState.folder) {
                loadArchiveData(currentState.folder);
            }
        });
    }
    
    // Set up event listener for when restore confirmation modal is closed
    const restoreConfirmModal = document.getElementById('confirmRestoreModal');
    if (restoreConfirmModal) {
        restoreConfirmModal.addEventListener('hidden.bs.modal', function() {
            // Reset recordToRestore to prevent issues with stale data
            recordToRestore = null;
        });
    }
    
    // Set up the delete confirmation button
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (recordToDelete) {
                performDelete(recordToDelete.id, recordToDelete.type);
                
                // Hide the modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
                if (modal) modal.hide();
            }
        });
    }
    
    // Set up event listener for when delete confirmation modal is closed
    const deleteConfirmModal = document.getElementById('confirmDeleteModal');
    if (deleteConfirmModal) {
        deleteConfirmModal.addEventListener('hidden.bs.modal', function() {
            // Reset recordToDelete to prevent issues with stale data
            recordToDelete = null;
        });
    }
});

// Function exposed to onClick in HTML
window.restoreRecord = function(id, type) {
    showRestoreConfirmation(id, type);
};

// Function exposed to onClick in HTML
window.deleteRecord = function(id, type) {
    showDeleteConfirmation(id, type);
};

// Function that actually performs the restore
async function performRestore(id, type) {
    // Store button reference for later
    const button = document.querySelector(`button[onclick*="restoreRecord('${id}"]`);
    const originalContent = button ? button.innerHTML : null;
    
    try {
        // Show loading state on the button if possible
        if (button) {
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
            button.disabled = true;
        }
        
        // Use the correct endpoint URL
        const response = await fetch(`/api/restore-archived/${type}/${id}`, {
                method: 'POST'
            });
        
        if (!response.ok) {
            throw new Error(`Failed to restore record: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Show success toast notification
        showToast('Success', result.message || 'Record restored successfully', 'success');
        
        // If we restored a class, show navigation modal
        if (type === 'class') {
            showClassNavigationModal(id);
        } else {
            // For other record types, just reload the data
            if (currentState.folder) {
                loadArchiveData(currentState.folder);
            } else {
                // If no specific folder is selected, refresh counts
                loadInitialCounts();
            }
        }
        
        } catch (error) {
        console.error('Error restoring record:', error);
        // Show error toast notification
        showToast('Error', `Failed to restore record: ${error.message}`, 'error');
        
        // Restore button state - button is now properly in scope
        if (button) {
            button.innerHTML = originalContent;
            button.disabled = false;
        }
    }
}

// Function that actually performs the delete
async function performDelete(id, type) {
    // Store button reference for later
    const button = document.querySelector(`button[onclick*="deleteRecord('${id}"]`);
    const originalContent = button ? button.innerHTML : null;
    
    try {
        // Show loading state on the button if possible
        if (button) {
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
            button.disabled = true;
        }
        
        // Use API endpoint for deletion
            const response = await fetch(`/api/archives/delete/${type}/${id}`, {
                method: 'DELETE'
            });
        
        if (!response.ok) {
            throw new Error(`Failed to delete record: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Show success toast notification
        showToast('Success', result.message || 'Record deleted successfully', 'success');
        
        // Reload the data
        loadArchiveData(currentState.folder);
        
        } catch (error) {
        console.error('Error deleting record:', error);
        // Show error toast notification
        showToast('Error', `Failed to delete record: ${error.message}`, 'error');
        
        // Restore button state if we have a reference to it
        if (button) {
            button.innerHTML = originalContent;
            button.disabled = false;
        }
    }
}

async function exportCSV() {
    try {
        // Show loading toast
        showToast('Export', 'Preparing CSV export...', 'info');
        
        // Get the button to show loading state
        const exportBtn = document.getElementById('exportCsvBtn');
        const originalBtnContent = exportBtn ? exportBtn.innerHTML : '';
        
        if (exportBtn) {
            exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exporting...';
            exportBtn.disabled = true;
        }
        
        // Validate folder type
        if (!currentState.folder) {
            throw new Error('Please select an archive type to export');
        }
        
        // Get current filters
        const searchParam = currentState.search ? `search=${encodeURIComponent(currentState.search)}` : '';
        
        // Create the URL with the current filters - include trailing slash to match API endpoint
        const url = `/api/archives/export/${currentState.folder}`;
        const queryURL = searchParam ? `${url}?${searchParam}` : url;
        
        console.log('Exporting from URL:', queryURL);
        
        // Use fetch API instead of direct navigation
        const response = await fetch(queryURL);
        
        // Reset button state
        if (exportBtn) {
            exportBtn.innerHTML = originalBtnContent;
            exportBtn.disabled = false;
        }
        
        if (!response.ok) {
            // Get the error message from the response if possible
            let errorMessage = `Export failed with status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // If we can't parse the JSON, use the default error message
            }
            throw new Error(errorMessage);
        }
        
        // Get the filename from the Content-Disposition header if available
        let filename = `archived_${currentState.folder}_${new Date().toISOString().slice(0, 10)}.csv`;
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        // Get the blob from the response
        const blob = await response.blob();
        
        // Create a download link and trigger the download
        const url_link = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url_link;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url_link);
        document.body.removeChild(a);
        
        // Show success toast
        showToast('Success', `CSV exported successfully as ${filename}`, 'success');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast('Error', `Failed to export data: ${error.message}`, 'error');
        
        // Reset button if error occurs
        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn) {
            exportBtn.innerHTML = '<i class="bi bi-arrow-up-right"></i> Export CSV';
            exportBtn.disabled = false;
        }
    }
}

// Add this new function to update the dropdown appearance
function updateDropdownAppearance(selectedFolder) {
    const archiveTypeFilter = document.getElementById('archiveTypeFilter');
    if (archiveTypeFilter) {
        // Add a border or background color to indicate selection
        archiveTypeFilter.style.borderColor = '#191970';
        
        // Find the selected option and update its text
        const options = archiveTypeFilter.options;
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            if (option.value === selectedFolder) {
                const folderName = selectedFolder.charAt(0).toUpperCase() + selectedFolder.slice(1);
                // Update the table title
                const tableTitle = document.getElementById('archiveTableTitle');
                if (tableTitle) {
                    tableTitle.textContent = `${folderName} Archives`;
                }
                break;
            }
        }
    }
}

// Function to load just the counts without loading a specific table
async function loadInitialCounts() {
    try {
        // Build URL to fetch only the counts
        let url = '/api/archives/counts';
        
        // Fetch data from API
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch archive counts: ${response.status}`);
        const data = await response.json();

        // Update stats counts
        updateArchiveCounts(data.counts || { student: 0, class: 0, company: 0, instructor: 0 });
        
    } catch (error) {
        console.error('Error loading archive counts:', error);
        // If there's an error, set all counts to 0
        updateArchiveCounts({ student: 0, class: 0, company: 0, instructor: 0 });
    }
}

// Function to search all archive types
async function searchAllArchiveTypes(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return;
    
    try {
        // Hide default message and show a searching message
        hideAllArchiveTables();
        document.getElementById('defaultMessage').innerHTML = `
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Searching...</span>
            </div>
            <p class="mt-3 text-muted">Searching all archives for "${searchTerm}"...</p>
        `;
        document.getElementById('defaultMessage').classList.remove('d-none');
        
        // Initialize results object
        let resultsFound = false;
        const archiveTypes = ['student', 'class', 'company', 'instructor'];
        const resultCounts = {};
        
        // Search each archive type in parallel
        const searchPromises = archiveTypes.map(async (type) => {
            try {
                let url = `/api/archives/${type}?search=${encodeURIComponent(searchTerm)}&page=1&per_page=5`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Failed to search ${type} archives: ${response.status}`);
                }
                
                const data = await response.json();
                resultCounts[type] = data.total || (data.records ? data.records.length : 0);
                return { type, count: resultCounts[type], data };
            } catch (error) {
                console.error(`Error searching ${type} archives:`, error);
                resultCounts[type] = 0;
                return { type, count: 0, error: error.message };
            }
        });
        
        const searchResults = await Promise.all(searchPromises);
        
        // Process results and update UI
        let totalResults = 0;
        const resultsWithData = searchResults.filter(result => result.count > 0);
        
        searchResults.forEach(result => {
            totalResults += result.count;
        });
        
        // Update the archive counts
        updateArchiveCounts(resultCounts);
        
        if (totalResults === 0) {
            // No results found
            document.getElementById('defaultMessage').innerHTML = `
                <i class="bi bi-search fs-1 text-muted"></i>
                <p class="mt-3 text-muted">No archives found matching "${searchTerm}"</p>
                <button class="btn btn-sm btn-outline-secondary mt-2" onclick="clearSearch()">
                    <i class="bi bi-x-circle me-1"></i>Clear search
                </button>
            `;
        } else if (resultsWithData.length === 1) {
            // Only one type has results, automatically select it
            const typeWithResults = resultsWithData[0].type;
            
            // Update dropdown
            const archiveTypeFilter = document.getElementById('archiveTypeFilter');
            if (archiveTypeFilter) {
                archiveTypeFilter.value = typeWithResults;
            }
            
            // Update state
            currentState.folder = typeWithResults;
            
            // Show the table and load data
            showArchiveTable(typeWithResults);
            loadArchiveData(typeWithResults);
            
            // Update UI appearance
            updateDropdownAppearance(typeWithResults);
            highlightSelectedCard(typeWithResults);
        } else {
            // Multiple types have results, show a summary
            const summaryHTML = `
                <i class="bi bi-list-ul fs-1 text-muted"></i>
                <p class="mt-3">Found ${totalResults} results across ${resultsWithData.length} archive types</p>
                <div class="d-flex gap-2 flex-wrap justify-content-center">
                    ${archiveTypes.map(type => {
                        const count = resultCounts[type] || 0;
                        if (count > 0) {
                            return `<button class="btn btn-sm ${type === currentState.folder ? 'btn-primary' : 'btn-outline-primary'}" 
                                    onclick="selectArchiveType('${type}')" style="background-color: ${type === currentState.folder ? '#191970' : ''}; border-color: #191970;">
                                    ${type.charAt(0).toUpperCase() + type.slice(1)} (${count})
                                </button>`;
                        }
                        return '';
                    }).join('')}
                </div>
                <p class="mt-3 text-muted small">Click on an archive type to view detailed results</p>
                <button class="btn btn-sm btn-outline-secondary mt-2" onclick="clearSearch()">
                    <i class="bi bi-x-circle me-1"></i>Clear search
                </button>
            `;
            document.getElementById('defaultMessage').innerHTML = summaryHTML;
        }
    } catch (error) {
        console.error('Error during multi-search:', error);
        document.getElementById('defaultMessage').innerHTML = `
            <i class="bi bi-exclamation-triangle fs-1 text-danger"></i>
            <p class="mt-3 text-danger">Error searching archives: ${error.message}</p>
            <button class="btn btn-sm btn-outline-secondary mt-2" onclick="clearSearch()">
                <i class="bi bi-x-circle me-1"></i>Clear search
            </button>
        `;
    }
}

// Helper function to select archive type from search results
function selectArchiveType(type) {
    const archiveTypeFilter = document.getElementById('archiveTypeFilter');
    if (archiveTypeFilter) {
        archiveTypeFilter.value = type;
        
        // Update state
        currentState.folder = type;
        currentState.page = 1;
        
        // Show the table and load data
        showArchiveTable(type);
        loadArchiveData(type);
        
        // Update UI appearance
        updateDropdownAppearance(type);
        highlightSelectedCard(type);
    }
}

// Helper function to clear search
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        currentState.search = '';
    }
    
    // Hide the clear button
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.classList.add('d-none');
    }
    
    // Reset display based on current state
    if (currentState.folder) {
        loadArchiveData(currentState.folder);
    } else {
        hideAllArchiveTables();
        document.getElementById('defaultMessage').innerHTML = `
            <i class="bi bi-archive fs-1 text-muted"></i>
            <p class="mt-3 text-muted">Please select an archive type from the dropdown above</p>
        `;
        document.getElementById('defaultMessage').classList.remove('d-none');
        loadInitialCounts();
    }
}

// Expose the new helper functions to the window object
window.clearSearch = clearSearch;
window.selectArchiveType = selectArchiveType; 