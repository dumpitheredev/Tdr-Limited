document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const rowsPerPage = document.getElementById('rowsPerPage');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const paginationInfo = document.getElementById('paginationInfo');

    // Initialize state at the very top
    let currentPageState = {
        page: 1,
        perPage: 5,
        totalItems: 0,
        currentData: [], // Initialize as empty array
        searchTerm: '',
        statusFilter: ''
    };

    let currentEditingInstructor = null;

    // Function to update table data with pagination
    function updateTable() {
        try {
            // Ensure we have an array to work with
            let filteredData = Array.isArray(currentPageState.currentData) ? [...currentPageState.currentData] : [];

            if (currentPageState.statusFilter) {
                filteredData = filteredData.filter(instructor => 
                    instructor.status === currentPageState.statusFilter
                );
            }

            if (currentPageState.searchTerm) {
                const searchTerm = currentPageState.searchTerm.toLowerCase();
                filteredData = filteredData.filter(instructor =>
                    instructor.name.toLowerCase().includes(searchTerm) ||
                    instructor.user_id.toLowerCase().includes(searchTerm)
                );
            }

            // Update total items
            currentPageState.totalItems = filteredData.length;

            // Calculate pagination
            const startIndex = (currentPageState.page - 1) * currentPageState.perPage;
            const endIndex = Math.min(startIndex + currentPageState.perPage, filteredData.length);
            const paginatedData = filteredData.slice(startIndex, endIndex);

            // Update table content
            const tbody = document.querySelector('tbody');
            if (tbody) {
                if (filteredData.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center">No instructors found</td>
                        </tr>`;
                } else {
                    tbody.innerHTML = paginatedData.map(instructor => `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center">
                                    <img src="/static/images/${instructor.profile_img}" 
                                         alt="Profile" 
                                         class="rounded-circle me-2" 
                                         width="32" 
                                         height="32">
                                    <div>
                                        <div class="fw-semibold">${instructor.name}</div>
                                        <div class="small text-muted">${instructor.user_id}</div>
                                    </div>
                                </div>
                            </td>
                            <td>${instructor.role}</td>
                            <td>
                                <span class="badge ${instructor.status === 'Active' ? 
                                    'bg-success-subtle text-success' : 
                                    'bg-danger-subtle text-danger'}">
                                    ${instructor.status}
                                </span>
                            </td>
                            <td class="text-end">
                                <div class="d-flex gap-2 justify-content-end">
                                    <button class="btn btn-link p-0" onclick="handleInstructorAction('edit', '${instructor.user_id}')">
                                        <i class="bi bi-pencil" style="color: #191970;"></i>
                                    </button>
                                    <button class="btn btn-link p-0" data-bs-toggle="modal" data-bs-target="#viewInstructorModal" onclick="handleInstructorAction('view', '${instructor.user_id}')">
                                        <i class="bi bi-eye" style="color: #191970;"></i>
                                    </button>
                                    <button class="btn btn-link p-0" onclick="handleInstructorAction('delete', '${instructor.user_id}')">
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
                    'No instructors found';
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

    // Function to update stats
    function updateStats(stats) {
        if (stats) {
            document.querySelector('.total-instructors').textContent = stats.total_instructors || 0;
            document.querySelector('.active-instructors').textContent = stats.active_instructors || 0;
            document.querySelector('.inactive-instructors').textContent = stats.inactive_instructors || 0;
        }
    }

    // Function to fetch and update data
    function fetchAndUpdateData() {
        const status = statusFilter.value;
        fetch(`/api/instructors?status=${status}`)
            .then(response => response.json())
            .then(data => {
                currentPageState.currentData = data.instructors;
                currentPageState.totalItems = data.instructors.length;
                updateTable();
                updateStats(data.stats);
            })
            .catch(handleError);
    }

    // Function to handle API errors
    function handleError(error) {
        console.error('Error:', error);
        // Implement error handling UI feedback here
    }

    // Event handlers for pagination
    if (rowsPerPage) {
        rowsPerPage.addEventListener('change', function() {
            currentPageState.perPage = parseInt(this.value);
            currentPageState.page = 1; // Reset to first page
            updateTable();
        });
    }

    if (prevPage) {
        prevPage.addEventListener('click', function() {
            if (!this.disabled && currentPageState.page > 1) {
                currentPageState.page--;
                updateTable();
            }
        });
    }

    if (nextPage) {
        nextPage.addEventListener('click', function() {
            const maxPage = Math.ceil(currentPageState.totalItems / currentPageState.perPage);
            if (!this.disabled && currentPageState.page < maxPage) {
                currentPageState.page++;
                updateTable();
            }
        });
    }

    // Status filter handler
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentPageState.page = 1; // Reset to first page
            currentPageState.statusFilter = this.value;
            fetchAndUpdateData();
        });
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const tableRows = document.querySelectorAll('table tbody tr');

            tableRows.forEach(row => {
                const instructorName = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
                const instructorId = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
                const specialization = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
                const email = row.querySelector('td:nth-child(4)').textContent.toLowerCase();

                if (instructorName.includes(searchTerm) || 
                    instructorId.includes(searchTerm) || 
                    specialization.includes(searchTerm) || 
                    email.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    // Status filter functionality
    if (statusFilter) {
        statusFilter.addEventListener('change', function(e) {
            const selectedStatus = e.target.value.toLowerCase();
            const tableRows = document.querySelectorAll('table tbody tr');

            tableRows.forEach(row => {
                const status = row.querySelector('td:nth-child(5) span').textContent.toLowerCase();
                if (!selectedStatus || status === selectedStatus) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    // Handle instructor actions
    window.handleInstructorAction = async function(action, instructorId) {
        switch(action) {
            case 'view':
                const modalElement = document.getElementById('viewInstructorModal');
                if (!modalElement) {
                    console.error('Modal element not found');
                    return;
                }

                let viewModal = bootstrap.Modal.getInstance(modalElement);
                if (!viewModal) {
                    viewModal = new bootstrap.Modal(modalElement);
                }
                
                try {
                    const response = await fetch(`/api/instructors/${instructorId}`);
                    if (!response.ok) throw new Error('Failed to fetch instructor details');
                    const instructor = await response.json();
                    
                    // Profile image and basic info
                    const instructorImage = document.getElementById('instructorImage');
                    if (instructorImage) {
                        instructorImage.src = instructor.profile_img;
                        instructorImage.onerror = function() {
                            this.src = '/static/images/profile.png';
                        };
                    }

                    document.getElementById('instructorName').textContent = instructor.name;
                    document.getElementById('instructorId').textContent = instructor.user_id;
                    document.getElementById('instructorDepartment').textContent = instructor.department;
                    document.getElementById('totalClasses').textContent = instructor.total_classes;
                    
                    // Update status badge
                    const statusBadge = document.getElementById('instructorStatus');
                    if (statusBadge) {
                        statusBadge.textContent = instructor.status;
                        statusBadge.className = `badge ${instructor.status === 'Active' ? 'bg-success' : 'bg-danger'}`;
                    }

                    // Populate assigned classes
                    const assignedClassesDiv = document.getElementById('assignedClasses');
                    if (assignedClassesDiv && instructor.assigned_classes) {
                        assignedClassesDiv.innerHTML = instructor.assigned_classes.map(cls => `
                            <div class="list-group-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="mb-1" style="color: #191970;">${cls.name}</h6>
                                        <small class="text-muted">${cls.schedule}</small>
                                    </div>
                                    <span class="badge ${cls.status === 'Active' ? 
                                        'bg-success-subtle text-success' : 
                                        'bg-danger-subtle text-danger'}">${cls.status}</span>
                                </div>
                            </div>
                        `).join('');
                    }
                    
                    viewModal.show();
                } catch (error) {
                    console.error('Error fetching instructor details:', error);
                }
                break;

            case 'edit':
                try {
                    const response = await fetch(`/api/instructors/${instructorId}`);
                    if (!response.ok) throw new Error('Failed to fetch instructor details');
                    const instructor = await response.json();
                    
                    currentEditingInstructor = instructor;
                    
                    const statusSelect = document.getElementById('instructorStatusSelect');
                    statusSelect.value = instructor.status;
                    
                    const editModal = new bootstrap.Modal(document.getElementById('editInstructorModal'));
                    editModal.show();
                } catch (error) {
                    console.error('Error editing instructor:', error);
                    showToast('Error', 'Failed to load instructor details', 'error');
                }
                break;

            case 'delete':
                console.log('Deleting instructor:', instructorId);
                break;
        }
    };

    // Add this function to handle CSV export
    function exportInstructorsCSV() {
        // Get current filters
        const status = statusFilter ? statusFilter.value : '';
        const search = searchInput ? searchInput.value : '';

        // Build the URL with query parameters
        let exportUrl = `/export-instructors-csv?`;
        if (status) exportUrl += `status=${status}&`;
        if (search) exportUrl += `search=${search}`;

        // Trigger download
        window.location.href = exportUrl;
    }

    // Add event listener for export button
    const exportButton = document.querySelector('[title="Export CSV"]');
    if (exportButton) {
        exportButton.addEventListener('click', exportInstructorsCSV);
    }

    // Initial data load
    fetchAndUpdateData();

    // Remove or update the attendance table object
    const attendanceTable = {
        init: function(type = 'instructor') {
            this.type = type;
            this.bindEvents();
        },

        bindEvents: function() {
            // Keep only necessary event bindings
            const resetFilterBtn = document.querySelector('button[onclick="attendanceTable.resetFilter()"]');
            if (resetFilterBtn) {
                resetFilterBtn.removeAttribute('onclick');
            }
        }
    };

    // Initialize modal functionality
    const viewInstructorModal = document.getElementById('viewInstructorModal');
    
    if (viewInstructorModal) {
        viewInstructorModal.addEventListener('show.bs.modal', function() {
            // Initialize attendance table with instructor type
            attendanceTable.init('instructor');
            
            // Style any buttons if needed
            const applyFilterBtn = viewInstructorModal.querySelector('.apply-filter');
            if (applyFilterBtn) {
                applyFilterBtn.style.backgroundColor = '#191970';
                applyFilterBtn.style.borderColor = '#191970';
            }
        });
    }

    // Helper function to format the schedule
    function formatSchedule(schedule) {
        // Assuming schedule is in format "Day, HH:mm - HH:mm"
        return schedule;
    }

    // Helper function to generate attendance cells
    function generateAttendanceCells(attendance) {
        // Assuming attendance is an array of 5 days (Mon-Fri)
        return Array(5).fill(null).map((_, index) => {
            const status = attendance?.[index]?.status || 'absent';
            const badgeClass = status.toLowerCase() === 'present' 
                ? 'bg-success-subtle text-success' 
                : 'bg-danger-subtle text-danger';
            
            return `
                <td class="text-center">
                    <span class="badge ${badgeClass}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
            `;
        }).join('');
    }

    // Show toast function
    function showToast(title, message, type = 'success') {
        const toast = document.getElementById('statusToast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const iconElement = toast.querySelector('.toast-header i');
        
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        iconElement.className = type === 'success' 
            ? 'bi bi-check-circle-fill text-success me-2'
            : 'bi bi-exclamation-circle-fill text-danger me-2';
        
        const bsToast = new bootstrap.Toast(toast, {
            delay: 3000
        });
        bsToast.show();
    }

    // Update the saveInstructorStatus function
    window.saveInstructorStatus = async function() {
        if (!currentEditingInstructor) return;
        
        try {
            const newStatus = document.getElementById('instructorStatusSelect').value;
            
            const response = await fetch(`/api/instructors/${currentEditingInstructor.user_id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) throw new Error('Failed to update instructor status');

            // Update the current data safely
            if (Array.isArray(currentPageState.currentData)) {
                currentPageState.currentData = currentPageState.currentData.map(instructor => {
                    if (instructor.user_id === currentEditingInstructor.user_id) {
                        return { ...instructor, status: newStatus };
                    }
                    return instructor;
                });
            }

            // Close modal
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editInstructorModal'));
            if (editModal) {
                editModal.hide();
            }

            // Update table
            updateTable();

            // Show success message
            showToast('Success', 'Instructor status updated successfully', 'success');

        } catch (error) {
            console.error('Error saving instructor status:', error);
            showToast('Error', 'Failed to update instructor status', 'error');
        }
    };
}); 