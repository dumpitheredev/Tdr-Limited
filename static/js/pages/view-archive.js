let currentState = {
    folder: 'student',
    page: 1,
    perPage: 5,
    search: ''
};

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', initializeArchive);

function initializeArchive() {
    try {
        // Load initial data for class archive
        loadArchiveData('class');
        
        // Set up event listeners if elements exist
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing archive:', error);
    }
}

function setupEventListeners() {
    const archiveFolderSelect = document.getElementById('archiveFolder');
    if (archiveFolderSelect) {
        archiveFolderSelect.addEventListener('change', function() {
            const selectedFolder = this.value;
            changeArchiveFolder(selectedFolder);
        });
    } else {
        console.warn('Archive folder select element not found');
    }

    // Remove the searchInput event listener since we don't have that element
    const rowsPerPage = document.getElementById('rowsPerPage');
    if (rowsPerPage) {
        rowsPerPage.addEventListener('change', function() {
            const selectedFolder = document.getElementById('archiveFolder').value;
            loadArchiveData(selectedFolder);
        });
    }
}

function changeArchiveFolder(folder) {
    try {
        // Hide all archive tables
        document.querySelectorAll('.archive-table').forEach(table => {
            table.classList.add('d-none');
        });
        
        // Show selected archive table
        const selectedTable = document.getElementById(`${folder}ArchiveTable`);
        if (selectedTable) {
            selectedTable.classList.remove('d-none');
        }
        
        // Load data for selected archive
        loadArchiveData(folder);
    } catch (error) {
        console.error('Error changing archive folder:', error);
    }
}

async function loadArchiveData(folder) {
    try {
        const response = await fetch(`/api/archives/${folder}`);
        if (!response.ok) throw new Error('Failed to fetch archive data');
        const data = await response.json();

        const tbody = document.querySelector(`#${folder}ArchiveTable tbody`);
        if (tbody) {
            if (!data.records || data.records.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center">No records found</td></tr>';
            } else {
                tbody.innerHTML = data.records.map(record => generateTableRow(record, folder)).join('');
            }
        }

        // Update pagination info
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = data.records && data.records.length > 0 ? 
                `1-${data.records.length} of ${data.records.length}` : 
                'No records found';
        }

        // Update pagination buttons
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        if (prevButton) prevButton.disabled = true; // For now, since we're not implementing pagination yet
        if (nextButton) nextButton.disabled = true;

    } catch (error) {
        console.error('Error:', error);
    }
}

function generateTableRow(record, type) {
    switch(type) {
        case 'class':
            return `
                <tr>
                    <td>
                        <div class="fw-semibold">${record.name}</div>
                        <div class="small text-muted">${record.class_id}</div>
                    </td>
                    <td>${record.day}</td>
                    <td>${record.time}</td>
                    <td>${record.instructor}</td>
                    <td>${record.year}</td>
                    <td>
                        <span class="badge bg-secondary">Archived</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.class_id}', 'class')">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.class_id}', 'class')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        case 'student':
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="/static/images/${record.profile_img}" 
                                 alt="Profile" 
                                 class="rounded-circle me-2" 
                                 width="32" 
                                 height="32">
                            <div>
                                <div class="fw-semibold">${record.name}</div>
                                <div class="small text-muted">${record.user_id}</div>
                            </div>
                        </div>
                    </td>
                    <td>${record.role}</td>
                    <td>
                        <span class="badge bg-secondary">Archived</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.user_id}', 'student')">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.user_id}', 'student')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        case 'company':
            return `
                <tr>
                    <td class="align-middle">
                        <div class="fw-medium">${record.contact}</div>
                        <div class="text-muted small">${record.email}</div>
                    </td>
                    <td class="align-middle">
                        <div class="fw-medium">${record.name}</div>
                        <div class="text-muted small">${record.company_id}</div>
                    </td>
                    <td class="align-middle">
                        <span class="badge bg-secondary">Archived</span>
                    </td>
                    <td class="align-middle text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.company_id}', 'company')">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.company_id}', 'company')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        case 'instructor':
            return `
                <tr>
                    <td>${record.name}</td>
                    <td>${record.email}</td>
                    <td>${record.phone}</td>
                    <td>
                        <span class="badge bg-secondary">Archived</span>
                    </td>
                    <td class="text-end">
                        <div class="d-flex gap-2 justify-content-end">
                            <button class="btn btn-link text-success p-0" onclick="restoreRecord('${record.instructor_id}', 'instructor')">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="btn btn-link text-danger p-0" onclick="deleteRecord('${record.instructor_id}', 'instructor')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    }
}

function updateCounts(counts) {
    document.getElementById('totalCount').textContent = counts.total;
    document.getElementById('studentCount').textContent = counts.student;
    document.getElementById('classCount').textContent = counts.class;
    document.getElementById('companyCount').textContent = counts.company;
}

function updatePagination(total, currentPage, perPage) {
    const totalPages = Math.ceil(total / perPage);
    document.getElementById('pageInfo').textContent = total ? 
        `Page ${currentPage} of ${totalPages}` : 'No records found';
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || total === 0;
}

function changeRowsPerPage() {
    currentState.perPage = parseInt(document.getElementById('rowsPerPage').value);
    currentState.page = 1;
    loadArchiveData();
}

function changePage(delta) {
    currentState.page += delta;
    loadArchiveData();
}

async function restoreRecord(id, type) {
    if (confirm('Are you sure you want to restore this record?')) {
        try {
            const response = await fetch(`/api/archives/restore/${type}/${id}`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Failed to restore record');
            loadArchiveData(type);
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

async function deleteRecord(id, type) {
    if (confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) {
        try {
            const response = await fetch(`/api/archives/delete/${type}/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete record');
            loadArchiveData(type);
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

async function exportCSV() {
    try {
        window.location.href = `/api/archives/export/${currentState.folder}?search=${currentState.search}`;
    } catch (error) {
        console.error('Error:', error);
    }
} 