// Initialize state
let currentPageState = {
    page: 1,
    perPage: 5,
    totalItems: 0,
    currentData: [], // Initialize as empty array
    searchTerm: '',
    statusFilter: ''
};

let currentEditingClass = null;

// Function to export classes to CSV
function exportClassesCSV() {
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = '/export-classes-csv';
    
    // Get current filters
    const status = document.getElementById('statusFilter')?.value || '';
    const search = document.getElementById('searchInput')?.value || '';
    
    // Add query parameters if filters are active
    if (status || search) {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (search) params.append('search', search);
        link.href += '?' + params.toString();
    }
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM Content Loaded - Class Management');
    try {
        // Initialize toast notification
        initializeToasts();
        
        // Fetch class data
        await fetchAndUpdateData();
        
        // Add event listeners for search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                currentPageState.page = 1;
                currentPageState.searchTerm = this.value;
                updateTable();
            });
        }

        // Add event listeners for status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                currentPageState.page = 1;
                currentPageState.statusFilter = this.value;
                updateTable();
            });
        }

        // Add event listener for rows per page
        const rowsPerPage = document.getElementById('rowsPerPage');
        if (rowsPerPage) {
            rowsPerPage.addEventListener('change', function() {
                currentPageState.page = 1;
                currentPageState.perPage = parseInt(this.value);
                updateTable();
            });
        }

        // Add pagination event listeners
        document.getElementById('prevPage')?.addEventListener('click', function() {
            if (currentPageState.page > 1) {
                currentPageState.page--;
                updateTable();
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', function() {
            const maxPage = Math.ceil(currentPageState.totalItems / currentPageState.perPage);
            if (currentPageState.page < maxPage) {
                currentPageState.page++;
                updateTable();
            }
        });

        // Add event listener for add class form submission
        const addClassForm = document.getElementById('addClassForm');
        if (addClassForm) {
            addClassForm.addEventListener('submit', handleAddClass);
        }

        // Add event listener for edit class form submission
        const editClassForm = document.getElementById('editClassForm');
        if (editClassForm) {
            editClassForm.addEventListener('submit', handleEditClass);
        }

    } catch (error) {
        console.error('Error initializing class data:', error);
        showToast('Error', 'Failed to load classes', 'error');
    }
});

// Function to fetch and update data
async function fetchAndUpdateData() {
    try {
        const response = await fetch('/api/classes');
        
        if (!response.ok) throw new Error('Failed to fetch classes');
        const data = await response.json();
        
        currentPageState.currentData = data || [];
        currentPageState.totalItems = currentPageState.currentData.length;
        
        // Update status cards when data is loaded
        updateStatusCards(currentPageState.currentData);
        
        // Update table
        updateTable();
        
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Error', 'Failed to load classes', 'error');
        currentPageState.currentData = [];
        return [];
    }
}

// Function to update the table with current data
function updateTable() {
    try {
        let filteredData = Array.isArray(currentPageState.currentData) ? [...currentPageState.currentData] : [];

        if (currentPageState.statusFilter) {
            filteredData = filteredData.filter(classItem => 
                classItem.status === currentPageState.statusFilter
            );
        }

        if (currentPageState.searchTerm) {
            const searchTerm = currentPageState.searchTerm.toLowerCase();
            filteredData = filteredData.filter(classItem =>
                classItem.name.toLowerCase().includes(searchTerm) ||
                classItem.class_id.toLowerCase().includes(searchTerm)
            );
        }

        // Update total items count for pagination
        currentPageState.totalItems = filteredData.length;

        const startIndex = (currentPageState.page - 1) * currentPageState.perPage;
        const endIndex = Math.min(startIndex + currentPageState.perPage, filteredData.length);
        const paginatedData = filteredData.slice(startIndex, endIndex);

        const tbody = document.querySelector('tbody');
        if (tbody) {
            if (paginatedData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-4">
                            <div class="d-flex flex-column align-items-center">
                                <i class="bi bi-search fs-1 text-muted mb-2"></i>
                                <p class="text-muted mb-0">No classes found</p>
                            </div>
                        </td>
                    </tr>`;
            } else {
                tbody.innerHTML = paginatedData.map(classItem => `
                    <tr>
                        <td>
                            <div class="fw-semibold">${classItem.name}</div>
                            <div class="small text-muted">${classItem.class_id}</div>
                        </td>
                        <td>${classItem.day}</td>
                        <td>${classItem.time}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="fw-medium">${classItem.instructor}</div>
                            </div>
                        </td>
                        <td>${classItem.year}</td>
                        <td>
                            <span class="badge ${getStatusBadgeClass(classItem.status)}">
                                ${classItem.status}
                            </span>
                        </td>
                        <td class="text-center">
                            <div class="d-flex gap-2 justify-content-center">
                                <button class="btn btn-link p-0" 
                                        data-bs-toggle="modal" 
                                        data-bs-target="#viewClassModal" 
                                        onclick="handleClassAction('view', '${classItem.class_id}')"
                                        title="View details">
                                    <i class="bi bi-eye" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" 
                                        data-bs-toggle="modal" 
                                        data-bs-target="#editClassModal" 
                                        onclick="handleClassAction('edit', '${classItem.class_id}')"
                                        title="Edit class">
                                    <i class="bi bi-pencil" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" 
                                        onclick="handleClassAction('archive', '${classItem.class_id}')"
                                        title="Archive class">
                                    <i class="bi bi-archive" style="color: #191970;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // Update pagination info
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            paginationInfo.textContent = filteredData.length > 0 ? 
                `${startIndex + 1}-${endIndex} of ${filteredData.length}` :
                '0-0 of 0';
        }

        // Update pagination buttons
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        if (prevButton) prevButton.disabled = currentPageState.page === 1;
        if (nextButton) nextButton.disabled = endIndex >= filteredData.length;

    } catch (error) {
        console.error('Error updating table:', error);
        showToast('Error', 'Failed to update table', 'error');
    }
}

// Function to update status cards
function updateStatusCards(data) {
    try {
        if (!Array.isArray(data)) {
            console.error('Invalid data format for status cards');
            return;
        }
        
        const totalClasses = data.length;
        const activeClasses = data.filter(c => c.status === 'Active').length;
        const completedClasses = data.filter(c => c.status === 'Completed').length;
        const inactiveClasses = data.filter(c => c.status === 'Inactive').length;
        
        // Update the count elements
        document.querySelector('[data-count="total"]').textContent = totalClasses;
        document.querySelector('[data-count="active"]').textContent = activeClasses;
        document.querySelector('[data-count="completed"]').textContent = completedClasses;
        document.querySelector('[data-count="inactive"]').textContent = inactiveClasses;
    } catch (error) {
        console.error('Error updating status cards:', error);
    }
}

// Function to get badge class based on status
function getStatusBadgeClass(status) {
    switch (status) {
        case 'Active':
            return 'bg-success-subtle text-success';
        case 'Inactive':
            return 'bg-danger-subtle text-danger';
        case 'Completed':
            return 'bg-info-subtle text-info';
        default:
            return 'bg-secondary-subtle text-secondary';
    }
}

// Initialize toast notifications
function initializeToasts() {
    const toastElList = [].slice.call(document.querySelectorAll('.toast'));
    toastElList.map(function(toastEl) {
        return new bootstrap.Toast(toastEl, {
            autohide: true,
            delay: 5000
        });
    });
}

// Show toast notification
function showToast(title, message, type = 'success') {
    const toast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const iconElement = toast.querySelector('.toast-header i');
    
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Update icon based on type
    if (iconElement) {
    iconElement.className = type === 'success' 
        ? 'bi bi-check-circle-fill text-success me-2'
        : 'bi bi-exclamation-circle-fill text-danger me-2';
    }
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Handle class actions (view, edit, archive)
window.handleClassAction = async function(action, classId) {
            try {
        // Fetch class details
                const response = await fetch(`/api/classes/${classId}`);
                if (!response.ok) throw new Error('Failed to fetch class details');
                const classData = await response.json();
                
        switch(action) {
            case 'view':
                populateViewClassModal(classData);
                break;
                
            case 'edit':
                populateEditClassModal(classData);
                currentEditingClass = classData;
                break;
                
            case 'archive':
                confirmArchiveClass(classData);
                break;
                
            default:
                console.error('Unknown action:', action);
        }
            } catch (error) {
        console.error(`Error handling ${action} action:`, error);
        showToast('Error', `Failed to ${action} class`, 'error');
    }
};

// Populate view class modal
function populateViewClassModal(classData) {
    const modal = document.getElementById('viewClassModal');
    if (!modal) return;
    
    // Set class details
    modal.querySelector('#viewClassName').textContent = classData.name;
    modal.querySelector('#viewClassId').textContent = classData.class_id;
    modal.querySelector('#viewClassDay').textContent = classData.day;
    modal.querySelector('#viewClassTime').textContent = classData.time;
    modal.querySelector('#viewClassInstructor').textContent = classData.instructor;
    modal.querySelector('#viewClassYear').textContent = classData.year;
    
    // Set status badge
    const statusBadge = modal.querySelector('#viewClassStatus');
    statusBadge.className = `badge ${getStatusBadgeClass(classData.status)}`;
    statusBadge.textContent = classData.status;
}

// Populate edit class modal
function populateEditClassModal(classData) {
    const modal = document.getElementById('editClassModal');
    if (!modal) return;
    
    // Set form values
    modal.querySelector('#editClassId').value = classData.class_id;
    modal.querySelector('#editClassName').value = classData.name;
    modal.querySelector('#editClassDay').value = classData.day;
    
    // Parse time for start and end time fields
    const timeRange = classData.time.split(' - ');
    if (timeRange.length === 2) {
        modal.querySelector('#editClassStartTime').value = timeRange[0];
        modal.querySelector('#editClassEndTime').value = timeRange[1];
    }
    
    // Set instructor and year
    modal.querySelector('#editClassInstructor').value = classData.instructor_id;
    modal.querySelector('#editClassYear').value = classData.year;
    modal.querySelector('#editClassStatus').value = classData.status;
}

// Confirm archive class
function confirmArchiveClass(classData) {
    // Get the modal elements
    const modal = document.getElementById('archiveClassModal');
    const archiveClassName = document.getElementById('archiveClassName');
    const archiveClassId = document.getElementById('archiveClassId');
    const archiveClassIdInput = document.getElementById('archiveClassIdInput');
    
    // Set the class details in the modal
    archiveClassName.textContent = classData.name;
    archiveClassId.textContent = classData.class_id;
    archiveClassIdInput.value = classData.class_id;
    
    // Clear previous values
    document.getElementById('archiveReason').value = '';
    document.getElementById('archiveComment').value = '';
    
    // Initialize the modal
    const archiveModal = new bootstrap.Modal(modal);
    archiveModal.show();
    
    // Set up the confirm button event handler
    document.getElementById('confirmArchiveClassBtn').onclick = function() {
        const reason = document.getElementById('archiveReason').value;
        const comment = document.getElementById('archiveComment').value;
        
        // Validate that a reason is selected
        if (!reason) {
            showToast('Error', 'Please select a reason for archiving', 'error');
            return;
        }
        
        // Combine reason and comment
        const archiveNote = comment ? `${reason}: ${comment}` : reason;
        
        // Update class status with the archive note
        updateClassStatus(classData.class_id, 'Inactive', archiveNote);
        
        // Hide the modal
        archiveModal.hide();
    };
}

// Update class status
async function updateClassStatus(classId, newStatus, archiveNote = '') {
    try {
        const response = await fetch(`/api/classes/${classId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                status: newStatus,
                archiveNote: archiveNote
            }),
        });

        if (!response.ok) throw new Error('Failed to update class status');

        // Refresh data
        await fetchAndUpdateData();
        
        showToast('Success', `Class status updated to ${newStatus}`, 'success');
    } catch (error) {
        console.error('Error updating class status:', error);
        showToast('Error', 'Failed to update class status', 'error');
    }
}

// Handle add class form submission
async function handleAddClass(event) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const formData = new FormData(form);
        
        // Create class object from form data
        const classData = {
            name: formData.get('className'),
            day: formData.get('classDay'),
            time: `${formData.get('classStartTime')} - ${formData.get('classEndTime')}`,
            instructor_id: formData.get('classInstructor'),
            year: formData.get('classYear'),
            status: 'Active'
        };
        
        // In a real application, you would send this to the server
        console.log('Adding new class:', classData);
        
        // Simulate API call
        setTimeout(async () => {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addClassModal'));
        modal.hide();
            
            // Reset form
            form.reset();
            
            // Refresh data
            await fetchAndUpdateData();
            
            showToast('Success', 'Class added successfully', 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Error adding class:', error);
        showToast('Error', 'Failed to add class', 'error');
    }
}

// Handle edit class form submission
async function handleEditClass(event) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const formData = new FormData(form);
        
        // Create updated class object
        const updatedClass = {
            class_id: formData.get('editClassId'),
            name: formData.get('editClassName'),
            day: formData.get('editClassDay'),
            time: `${formData.get('editClassStartTime')} - ${formData.get('editClassEndTime')}`,
            instructor_id: formData.get('editClassInstructor'),
            year: formData.get('editClassYear'),
            status: formData.get('editClassStatus')
        };
        
        // In a real application, you would send this to the server
        console.log('Updating class:', updatedClass);
        
        // Simulate API call
        setTimeout(async () => {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editClassModal'));
            modal.hide();
            
            // Refresh data
            await fetchAndUpdateData();
            
            showToast('Success', 'Class updated successfully', 'success');
        }, 1000);

    } catch (error) {
        console.error('Error updating class:', error);
        showToast('Error', 'Failed to update class', 'error');
    }
}

// Generate a random class ID (for demo purposes)
function generateClassId() {
    const prefix = 'CL';
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${randomPart}`;
} 
