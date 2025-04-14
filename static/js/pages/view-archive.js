// Initialize state
const currentState = {
    folder: '', // No default selection
    page: 1,
    perPage: 5,
    search: '',
    total: 0
};

// Define all supported archive types
const archiveTypes = {
    'class': {
        title: 'Archived Classes',
        icon: 'bi-book',
        columns: ['ID', 'Name', 'Schedule', 'Year', 'Archive Date', 'Actions']
    },
    'student': {
        title: 'Archived Students',
        icon: 'bi-person-badge',
        columns: ['ID', 'Name', 'Company', 'Archive Date', 'Actions']
    },
    'company': {
        title: 'Archived Companies',
        icon: 'bi-building',
        columns: ['ID', 'Name', 'Contact', 'Archive Date', 'Actions']
    },
    'attendance': {
        title: 'Archived Attendance',
        icon: 'bi-calendar-check',
        columns: ['ID', 'Date', 'Class', 'Student', 'Status', 'Archive Date', 'Actions']
    },
    'admin': {
        title: 'Archived Administrators',
        icon: 'bi-person-gear',
        columns: ['ID', 'Name', 'Email', 'Archive Date', 'Status', 'Actions']
    }
};

// Store temporarily the record info for modal confirmation
let recordToRestore = null;
let recordToDelete = null;
let restoredRecord = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Archive page loaded');
    
    // Initialize the archive page with a single function call
    // This will handle all initialization, event listeners, and data loading
    initializeArchivePage();
});

// Main initialization function
function initializeArchivePage() {
    // Set initial counts to zero
    initializeCardCounts();
    
    // Set up all event listeners
    setupEventListeners();
    
    // Load initial counts separately from any specific archive data
    fetchArchiveCounts().then(() => {
        console.log('Archive counts loaded successfully');
    }).catch(err => {
        console.error('Failed to load initial archive counts:', err);
    });
    
    // Process URL parameters
    processURLParams();
    
    // If no folder is selected, just load the initial counts
    if (!currentState.folder) {
        loadInitialCounts();
    }
}

// Setup all event listeners in one place
function setupEventListeners() {
    // Archive type dropdown change
    const archiveTypeFilter = document.getElementById('archiveTypeFilter');
    if (archiveTypeFilter) {
        archiveTypeFilter.addEventListener('change', function() {
            const selectedType = this.value;
            currentState.folder = selectedType;
            currentState.page = 1; // Reset to first page
            
            if (selectedType) {
                showArchiveTable(selectedType);
                loadArchiveData(selectedType);
                highlightSelectedCard(selectedType);
                updateURLParams();
            } else {
                hideAllArchiveTables();
                document.getElementById('defaultMessage').classList.remove('d-none');
                document.getElementById('defaultMessage').innerHTML = `
                    <i class="bi bi-archive fs-1 text-muted"></i>
                    <p class="mt-3 text-muted">Please select an archive type from the dropdown above</p>
                `;
                // Clear selection highlight from all cards
                highlightSelectedCard(null);
                updateURLParams();
            }
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Use a longer debounce time to reduce API calls
        const searchDebounceTime = 500; // 500ms
        let searchTimeout;
        
        searchInput.addEventListener('input', function() {
            // Update state with current search term
            currentState.search = this.value;
            
            // Toggle clear button visibility
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.classList.toggle('d-none', currentState.search.length === 0);
            }
            
            // Debounce search to avoid too many requests
            clearTimeout(searchTimeout);
            
            // Only trigger search if we have at least 2 characters or if search is cleared
            if (currentState.search.length === 0 || currentState.search.length >= 2) {
                searchTimeout = setTimeout(() => {
                    if (currentState.folder) {
                        // If a specific folder is selected, only search in that folder
                        currentState.page = 1; // Reset to first page for new searches
                        loadArchiveData(currentState.folder);
                    } else if (currentState.search.length >= 2) {
                        // Only search all types when no folder is selected AND search has min 2 chars
                        searchAllArchiveTypes(currentState.search);
                    } else {
                        // No folder selected and search cleared - show default message
                        hideAllArchiveTables();
                        document.getElementById('defaultMessage').classList.remove('d-none');
                        document.getElementById('defaultMessage').innerHTML = `
                            <i class="bi bi-archive fs-1 text-muted"></i>
                            <p class="mt-3 text-muted">Please select an archive type from the dropdown above</p>
                        `;
                        loadInitialCounts();
                    }
                }, searchDebounceTime);
            }
        });
    }
    
    // Clear search button
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
                currentState.search = '';
                this.classList.add('d-none');
                
                // Trigger search with empty term
                if (currentState.folder) {
                    loadArchiveData(currentState.folder);
                } else {
                    hideAllArchiveTables();
                    document.getElementById('defaultMessage').classList.remove('d-none');
                    document.getElementById('defaultMessage').innerHTML = `
                        <i class="bi bi-archive fs-1 text-muted"></i>
                        <p class="mt-3 text-muted">Please select an archive type from the dropdown above</p>
                    `;
                }
            }
        });
    }
    
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
    
    // Export button
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportCSV();
        });
    }
    
    // Set up event listeners for pagination and rows per page
    setupPaginationListeners();
    
    // Set up card click handlers
    setupArchiveCardListeners();
}

// Setup archive card click handlers
function setupArchiveCardListeners() {
    const archiveTypes = ['student', 'class', 'company', 'instructor', 'admin', 'attendance'];
    archiveTypes.forEach(type => {
        const card = document.getElementById(`${type}ArchiveCard`);
        if (card) {
            card.addEventListener('click', function() {
                switchArchiveType(type);
            });
        }
    });
}

// Setup pagination event listeners
function setupPaginationListeners() {
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
            currentState.page++;
            loadArchiveData(currentState.folder);
        });
    }
}

// Add the missing processURLParams function
function processURLParams() {
    // Check URL parameters for folder selection
    const urlParams = new URLSearchParams(window.location.search);
    const folderParam = urlParams.get('type');
    
    // If 'user' folder is specified, redirect to student archive instead
    if (folderParam === 'user') {
        // Redirect to student archive instead
        const newUrl = window.location.pathname + '?type=student';
        window.history.replaceState({}, '', newUrl);
        currentState.folder = 'student';
    } else {
        currentState.folder = folderParam || '';
    }
    
    // Get page parameter if it exists
    const pageParam = urlParams.get('page');
    if (pageParam && !isNaN(parseInt(pageParam))) {
        currentState.page = parseInt(pageParam);
    } else {
        currentState.page = 1;
    }
    
    // Get search parameter if it exists
    currentState.search = urlParams.get('search') || '';
    
    // If search parameter exists, update the search input
    if (currentState.search) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = currentState.search;
            
            // Show clear button
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.classList.remove('d-none');
            }
        }
    }
    
    // If we have a folder parameter, update UI and load data
    if (currentState.folder) {
        // Update the dropdown to match the selected folder
        const archiveTypeFilter = document.getElementById('archiveTypeFilter');
        if (archiveTypeFilter) {
            archiveTypeFilter.value = currentState.folder;
        }
        
        // Show the table for this folder
        showArchiveTable(currentState.folder);
        
        // Load data for this folder
        loadArchiveData(currentState.folder);
        
        // Highlight the selected card
        highlightSelectedCard(currentState.folder);
    } else {
        // No folder parameter, show default view
        hideAllArchiveTables();
        document.getElementById('defaultMessage').classList.remove('d-none');
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
    } else if (folder === 'user') {
        // Create user archive table if it doesn't exist
        createUserArchiveTable();
    }
    
    // Update title with selected type
    updateArchiveTitle(folder);
}

function hideAllArchiveTables() {
    document.querySelectorAll('.archive-table').forEach(table => {
        table.classList.add('d-none');
    });
}

async function loadArchiveData(folder) {
    const currentFolder = folder || currentState.folder;
    
    if (!currentFolder) {
        // No folder selected, just show the default message
        document.getElementById('defaultMessage').classList.remove('d-none');
        return;
    }
    
    // Always load all archive counts to keep stats consistent
    fetchArchiveCounts();
    
    // Hide all tables and show loading state
    hideAllArchiveTables();
    document.getElementById('defaultMessage').classList.add('d-none');
    
    // Show the folder-specific table with loading state
    const table = document.getElementById(`${currentFolder}ArchiveTable`);
    if (table) {
        table.classList.remove('d-none');
    }
    
    // Update the title
    document.getElementById('archiveTableTitle').textContent = 
        currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1) + ' Archive Records';
    
    // Get the appropriate tbody
    const tbody = document.querySelector(`#${currentFolder}ArchiveBody`);
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    <span>Loading archives...</span>
                </td>
            </tr>
        `;
    }
    
    try {
        // Build API URL
        let url = `/api/archives/${currentFolder}`;
        
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
        
        // Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error: ${response.status}` }));
            throw new Error(errorData.error || `Failed to fetch archive data: ${response.status}`);
        }
        
        const data = await response.json();

        // Update table body
        if (tbody) {
            if (!data.records || data.records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><i class="bi bi-info-circle me-2"></i>No archived records found</td></tr>';
            } else {
                tbody.innerHTML = data.records.map(record => generateTableRow(record, currentFolder)).join('');
            }
        }

        // Update pagination info
        updatePaginationInfo(data);

    } catch (error) {
        console.error('Error loading archive data:', error);
        
        // Show error message in table
        const tbody = document.querySelector(`#${currentFolder}ArchiveBody`);
        const colspan = currentFolder === 'attendance' ? 7 : 6;
        
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle me-2"></i>${error.message}</td></tr>`;
        }
        
        // Show toast with error message
        showToast('Error', `Failed to load archive data: ${error.message}`, 'error');
        
        // Reset pagination if there's an error
        document.getElementById('pageInfo').textContent = '0-0 of 0';
        document.getElementById('prevPage').disabled = true;
        document.getElementById('nextPage').disabled = true;
    }
}

// New function to fetch all archive counts separately
async function fetchArchiveCounts() {
    try {
        const response = await fetch('/api/archives/counts');
        if (!response.ok) {
            throw new Error(`Failed to fetch archive counts: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update all counts with the fetched data
        updateArchiveCounts(data.counts || {
            student: 0,
            class: 0,
            company: 0,
            instructor: 0,
            admin: 0,
            attendance: 0
        });
        
        return data.counts;
    } catch (error) {
        console.error('Error fetching archive counts:', error);
        // Don't reset counts on error - keep the existing values
        return null;
    }
}

// Function to update archive counts
function updateArchiveCounts(counts) {
    const updateCount = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value || 0;
        }
    };
    
    updateCount('studentCount', counts.student);
    updateCount('classCount', counts.class);
    updateCount('companyCount', counts.company);
    updateCount('instructorCount', counts.instructor);
    updateCount('adminCount', counts.admin);
    updateCount('attendanceCount', counts.attendance);
}

// Function to handle clicking on stat cards
function switchArchiveType(type) {
    // Only switch if it's a different type or no type is selected
    if (type !== currentState.folder) {
        // Clear search when switching types
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            currentState.search = '';
            // Hide clear button
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
                clearBtn.classList.add('d-none');
            }
        }
        
        // Update dropdown
        const archiveTypeFilter = document.getElementById('archiveTypeFilter');
        if (archiveTypeFilter) {
            archiveTypeFilter.value = type;
        }
        
        // Update state and reset pagination
        currentState.folder = type;
        currentState.page = 1;
        
        // Show the table for this folder
        showArchiveTable(type);
        
        // Load data for this folder
        loadArchiveData(type);
        
        // Highlight the selected card
        highlightSelectedCard(type);
        
        // Update URL params to reflect the change
        updateURLParams();
    }
}

// Function to highlight the selected card
function highlightSelectedCard(type) {
    // Remove highlight from all cards
    const allCards = ['student', 'class', 'company', 'instructor', 'admin', 'attendance'];
    allCards.forEach(cardType => {
        const card = document.getElementById(`${cardType}ArchiveCard`);
        if (card) {
            card.classList.remove('archive-card-selected');
            // Add a subtle box shadow to all cards
            card.style.boxShadow = '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)';
        }
    });
    
    // Add highlight to selected card
    const selectedCard = document.getElementById(`${type}ArchiveCard`);
    if (selectedCard) {
        selectedCard.classList.add('archive-card-selected');
        // Add a more prominent box shadow and border to the selected card
        selectedCard.style.boxShadow = '0 0.5rem 1rem rgba(0, 0, 0, 0.15)';
        selectedCard.style.borderLeft = '4px solid #191970';
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

// Helper function to extract archive reason and admin info from description or notes
const extractArchiveReason = (text) => {
    if (!text) return { reason: 'Archived', admin: null };
    
    // Extract the basic reason
    const reasonMatch = text.match(/ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(\n|$)/);
    const reason = reasonMatch && reasonMatch[1] ? reasonMatch[1].trim() : 'Archived';
    
    // Try to extract admin info if available
    const adminMatch = text.match(/Archived by: (.+?)(\n|$)/);
    const admin = adminMatch && adminMatch[1] ? adminMatch[1].trim() : null;
    
    return { reason, admin };
};

// Format the archive reason with admin info
const formatArchiveReason = (reasonObj) => {
    // For legacy archive records without admin information, add a default message
    if (!reasonObj.admin) {
        return `${reasonObj.reason} - Archived by Administrator`;
    } else {
        return `${reasonObj.reason} - Archived by ${reasonObj.admin}`;
    }
};

function generateTableRow(record, type) {
    switch(type) {
        case 'class':
            // Extract archive reason from description
            const classReasonObj = extractArchiveReason(record.description);
            const classReason = formatArchiveReason(classReasonObj);
            
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
                        <span class="badge bg-secondary-subtle text-secondary">${classReason}</span>
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
            // Check all possible fields for archive note information
            let studentNotesText = record.notes || record.description;
            if (!studentNotesText && record.archive_note) {
                studentNotesText = record.archive_note;
            }
            
            const studentReasonObj = extractArchiveReason(studentNotesText);
            const studentReason = formatArchiveReason(studentReasonObj);
            
            // Make sure we have a valid company name
            const companyName = record.company_name || record.company || 'Not Assigned';
            
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
                    <td>${companyName}</td>
                    <td>${record.archive_date || 'Unknown'}</td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">${studentReason}</span>
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
            // Extract archive reason from description or notes
            const companyReasonObj = extractArchiveReason(record.description || record.notes);
            const companyReason = formatArchiveReason(companyReasonObj);
            
            return `
                <tr>
                    <td>
                        <div>
                            <div class="fw-medium">${record.name}</div>
                            <div class="text-muted small">${record.company_id}</div>
                        </div>
                    </td>
                    <td>${record.contact || ''}</td>
                    <td>${record.email || ''}</td>
                    <td>${record.archive_date || 'Unknown'}</td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">${companyReason}</span>
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
            // Check all possible fields for archive note information
            let instructorNotesText = record.notes || record.description;
            if (!instructorNotesText && record.archive_note) {
                instructorNotesText = record.archive_note;
            }
            
            const instructorReasonObj = extractArchiveReason(instructorNotesText);
            const instructorReason = formatArchiveReason(instructorReasonObj);
            
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
                        <span class="badge bg-secondary-subtle text-secondary">${instructorReason}</span>
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
        case 'attendance':
            // Extract archive reason or use provided one
            let attendanceReasonObj;
            if (record.archive_reason) {
                attendanceReasonObj = {
                    reason: record.archive_reason,
                    admin: record.archived_by || null
                };
            } else {
                attendanceReasonObj = extractArchiveReason(record.notes);
            }
            const attendanceReason = formatArchiveReason(attendanceReasonObj);
            
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="/static/images/${record.student_profile_img || 'profile.png'}" 
                                 alt="Profile" 
                                 class="rounded-circle me-2" 
                                 width="32" 
                                 height="32">
                            <div>
                                <div class="fw-semibold">${record.student_name || 'Unknown'}</div>
                                <div class="small text-muted">${record.student_id || 'Unknown'}</div>
                            </div>
                        </div>
                    </td>
                    <td>${record.class_name || 'Unknown'}</td>
                    <td>${record.date || 'Unknown'}</td>
                    <td>
                        <span class="badge ${getBadgeClassForStatus(record.status)}">${record.status || 'Unknown'}</span>
                    </td>
                    <td>${record.archive_date || 'Unknown'}</td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">${attendanceReason}</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.id}', 'attendance')" title="Restore">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.id}', 'attendance')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        case 'admin':
            // Extract archive reason from notes field
            const adminReasonObj = extractArchiveReason(record.notes);
            const adminReason = formatArchiveReason(adminReasonObj);
            
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
                                <div class="text-muted small">${record.id || ''}</div>
                            </div>
                        </div>
                    </td>
                    <td>${record.email || ''}</td>
                    <td>${record.archive_date || 'Unknown'}</td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">Inactive</span>
                    </td>
                    <td>
                        <span class="badge bg-secondary-subtle text-secondary">${adminReason}</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.id}', 'admin')" title="Restore">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.id}', 'admin')" title="Delete">
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

// Function to get badge class for status
function getBadgeClassForStatus(status) {
    if (!status) return 'bg-secondary-subtle text-secondary';
    
    switch (status.toLowerCase()) {
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

// Function to initialize card counts to "0" on page load
function initializeCardCounts() {
    // Set all count elements to "0" by default
    updateArchiveCounts({ 
        student: 0, 
        class: 0, 
        company: 0, 
        instructor: 0, 
        admin: 0,
        attendance: 0 
    });
}

// Create a reusable function to handle API requests with loading UI
async function makeAPIRequest(url, options = {}, button = null) {
    // Store original button content if provided
    let originalContent = button ? button.innerHTML : null;
    let isButtonDisabled = false;
    
    try {
        // Show loading state on button if provided
        if (button) {
            originalContent = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
            button.disabled = true;
            isButtonDisabled = true;
        }
        
        // Make the API request
        const response = await fetch(url, options);
        
        // Handle non-OK responses
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error: ${response.status}` }));
            throw new Error(errorData.error || `Request failed: ${response.status}`);
        }
        
        // Parse and return the response data
        return await response.json();
    } catch (error) {
        // Let the caller handle the error
        throw error;
    } finally {
        // Reset button state if provided
        if (button && originalContent && isButtonDisabled) {
            button.innerHTML = originalContent;
            button.disabled = false;
        }
    }
}

async function performRestore(id, type) {
    const button = document.querySelector(`button[onclick*="restoreRecord('${id}"]`);
    
    try {
        // Make API request with button UI handling
        const data = await makeAPIRequest(`/api/archives/restore/${type}/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, button);
        
        // Show success message
        showToast('Success', data.message || 'Record has been restored', 'success');
        
        // Refresh data - Load main table first
        await loadArchiveData(currentState.folder);
        // Then refresh counts
        await fetchArchiveCounts();

        // Special handling for classes to prompt navigation
        if (type === 'class' && data.id) {
            showClassNavigationModal(data.id);
        }

    } catch (error) {
        console.error('Error restoring record:', error);
        showToast('Error', error.message || 'Failed to restore record', 'error');
    }
}

async function performDelete(id, type) {
    const button = document.querySelector(`button[onclick*="deleteRecord('${id}"]`);
    
    try {
        // Make API request with button UI handling
        const data = await makeAPIRequest(`/api/archives/delete/${type}/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        }, button);
        
        // Show success message
        showToast('Success', data.message || 'Record has been permanently deleted', 'success');
        
        // Refresh data - Load main table first, then counts
        await loadArchiveData(currentState.folder);
        await fetchArchiveCounts();
        
    } catch (error) {
        console.error('Error deleting record:', error);
        showToast('Error', error.message || 'Failed to delete record', 'error');
    }
}

async function exportCSV() {
    const exportBtn = document.getElementById('exportCsvBtn');
    
    try {
        showToast('Export', 'Preparing CSV export...', 'info');
        
        if (!currentState.folder) {
            throw new Error('Please select an archive type to export');
        }
        
        const searchParam = currentState.search ? `search=${encodeURIComponent(currentState.search)}` : '';
        const url = `/api/archives/export/${currentState.folder}`;
        const queryURL = searchParam ? `${url}?${searchParam}` : url;
        
        // Use the generic API request function
        let response;
        try {
            // For this case we need the raw response, not JSON
            response = await fetch(queryURL);
            
            if (exportBtn) {
                exportBtn.innerHTML = '<i class="bi bi-arrow-up-right"></i> Export CSV';
                exportBtn.disabled = false;
            }
            
            if (!response.ok) {
                let errorMessage = `Export failed with status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // Fallback to default error message
                }
                throw new Error(errorMessage);
            }
        } catch (error) {
            throw error;
        }
        
        let filename = `archived_${currentState.folder}_${new Date().toISOString().slice(0, 10)}.csv`;
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        const blob = await response.blob();
        const url_link = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url_link;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url_link);
        document.body.removeChild(a);
        
        showToast('Success', `CSV exported successfully as ${filename}`, 'success');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast('Error', `Failed to export data: ${error.message}`, 'error');
        
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
        archiveTypeFilter.style.borderColor = '#191970';
        
        const options = archiveTypeFilter.options;
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            if (option.value === selectedFolder) {
                const folderName = selectedFolder.charAt(0).toUpperCase() + selectedFolder.slice(1);
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
        let url = '/api/archives/counts';
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch archive counts: ${response.status}`);
        const data = await response.json();

        updateArchiveCounts(data.counts || { 
            student: 0, 
            class: 0, 
            company: 0, 
            instructor: 0, 
            attendance: 0 
        });
        
    } catch (error) {
        console.error('Error loading archive counts:', error);
        updateArchiveCounts({ 
            student: 0, 
            class: 0, 
            company: 0, 
            instructor: 0, 
            attendance: 0 
        });
    }
}

// Function to search all archive types
async function searchAllArchiveTypes(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
        return;
    }
    
    document.getElementById('defaultMessage').classList.add('d-none');
    hideAllArchiveTables();
    
    document.getElementById('defaultMessage').classList.remove('d-none');
    document.getElementById('defaultMessage').innerHTML = `
        <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Searching...</span>
        </div>
        <p class="mt-2 text-muted">Searching across all archive types for "${searchTerm}"</p>
    `;
    
    const archiveTypes = ['student', 'class', 'company', 'instructor', 'admin', 'attendance'];
    let resultsFound = false;
    let typeWithResults = null;
    
    try {
        const searchPromises = archiveTypes.map(async (type) => {
            const url = `/api/archives/${type}?search=${encodeURIComponent(searchTerm)}&page=1&per_page=${currentState.perPage}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Error searching ${type}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const resultCount = data.records ? data.records.length : 0;
            
            if (resultCount > 0) {
                resultsFound = true;
                if (!typeWithResults) {
                    typeWithResults = type;
                }
            }
            
            return { type, count: resultCount, data };
        });
        
        const results = await Promise.all(searchPromises);
        document.getElementById('defaultMessage').classList.add('d-none');
        
        if (resultsFound && typeWithResults) {
            currentState.folder = typeWithResults; 
            
            const archiveTypeFilter = document.getElementById('archiveTypeFilter');
            if (archiveTypeFilter) {
                archiveTypeFilter.value = typeWithResults;
            }
            
            const typeResult = results.find(r => r.type === typeWithResults);
            showArchiveTable(typeWithResults);
            
            const tbody = document.querySelector(`#${typeWithResults}ArchiveBody`);
            if (tbody && typeResult && typeResult.data.records) {
                if (typeResult.data.records.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No results found</td></tr>';
                } else {
                    tbody.innerHTML = typeResult.data.records.map(record => 
                        generateTableRow(record, typeWithResults)
                    ).join('');
                    
                    updatePaginationInfo(typeResult.data);
                }
            }
            
            highlightSelectedCard(typeWithResults);
            updateURLParams();
        } else {
            document.getElementById('defaultMessage').classList.remove('d-none');
            document.getElementById('defaultMessage').innerHTML = `
                <i class="bi bi-search fs-1 text-muted"></i>
                <p class="mt-3 text-muted">No results found for "${searchTerm}"</p>
                <button class="btn btn-sm btn-outline-secondary mt-2" onclick="clearSearch()">
                    <i class="bi bi-arrow-counterclockwise me-1"></i> Clear search
                </button>
            `;
        }
    } catch (error) {
        console.error("Error during multi-archive search:", error);
        
        document.getElementById('defaultMessage').classList.remove('d-none');
        document.getElementById('defaultMessage').innerHTML = `
            <i class="bi bi-exclamation-triangle fs-1 text-danger"></i>
            <p class="mt-3 text-danger">An error occurred during search.</p>
            <p class="text-muted small">${error.message}</p>
            <button class="btn btn-sm btn-outline-secondary mt-2" onclick="clearSearch()">
                <i class="bi bi-arrow-counterclockwise me-1"></i> Clear search
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
    // Clear search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Update state
    currentState.search = '';
    
    // Hide clear button
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.classList.add('d-none');
    }
    
    if (currentState.folder) {
        // If a folder is selected, reload its data without the search filter
        loadArchiveData(currentState.folder);
    } else {
        // No folder selected, just show default message
        hideAllArchiveTables();
        document.getElementById('defaultMessage').classList.remove('d-none');
        document.getElementById('defaultMessage').innerHTML = `
            <i class="bi bi-archive fs-1 text-muted"></i>
            <p class="mt-3 text-muted">Please select an archive type from the dropdown above</p>
        `;
    }
    
    // Update URL params to remove search
    updateURLParams();
    
    // Return focus to search input
    if (searchInput) {
        searchInput.focus();
    }
}

// Expose the new helper functions to the window object
window.clearSearch = clearSearch;
window.selectArchiveType = selectArchiveType;
window.restoreRecord = function(id, type) {
    showRestoreConfirmation(id, type);
};
window.deleteRecord = function(id, type) {
    showDeleteConfirmation(id, type);
};

// Optimize the state update to prevent unnecessary reloads
function updateState(newState) {
    let shouldReload = false;
    
    // Only reload data if state actually changed
    if (currentState.page !== newState.page ||
        currentState.perPage !== newState.perPage ||
        currentState.folder !== newState.folder ||
        currentState.search !== newState.search) {
        shouldReload = true;
    }
    
    // Update state
    Object.assign(currentState, newState);
    
    // Update URL parameters
    updateURLParams();
    
    // Only reload if needed
    if (shouldReload) {
        loadArchiveData(currentState.folder);
    }
}

// Function to update URL parameters based on current state
function updateURLParams() {
    const params = new URLSearchParams();
    
    if (currentState.folder) {
        params.set('type', currentState.folder);
    }
    
    if (currentState.search) {
        params.set('search', currentState.search);
    }
    
    if (currentState.page > 1) {
        params.set('page', currentState.page.toString());
    }
    
    // Update URL without reloading the page
    const paramsString = params.toString();
    const newURL = paramsString ? `${window.location.pathname}?${paramsString}` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
}

// Create user archive table if it doesn't exist
function createUserArchiveTable() {
    // Check if the table container already exists
    if (document.getElementById('userArchiveTable')) {
        return;
    }
    
    // Get the main container
    const mainContainer = document.querySelector('.content-body');
    if (!mainContainer) return;
    
    // Create the table container
    const tableContainer = document.createElement('div');
    tableContainer.id = 'userArchiveTable';
    tableContainer.className = 'archive-table';
    
    // Use the columns from the archiveTypes configuration
    const columns = archiveTypes.user.columns;
    
    // Create table HTML
    tableContainer.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Archive Date</th>
                        <th>Status</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody id="userArchiveTableBody">
                    <tr>
                        <td colspan="5" class="text-center py-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-4">
            <div class="pagination-info">0-0 of 0</div>
            <div class="pagination d-flex gap-2">
                <button id="prevPageBtn" class="btn btn-sm btn-outline-secondary" disabled>
                    <i class="bi bi-chevron-left"></i>
                </button>
                <button id="nextPageBtn" class="btn btn-sm btn-outline-secondary" disabled>
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>
    `;
    
    // Append to the container
    mainContainer.appendChild(tableContainer);
}

// Update archive title
function updateArchiveTitle(folder) {
    const archiveTableTitle = document.getElementById('archiveTableTitle');
    if (archiveTableTitle) {
        const folderName = folder.charAt(0).toUpperCase() + folder.slice(1);
        archiveTableTitle.textContent = `${folderName} Archives`;
    }
} 