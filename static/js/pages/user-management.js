// Initialize state
let currentPageState = {
    page: 1,
    perPage: 5,
    totalItems: 0,
    currentData: [],
    searchTerm: '',
    roleFilter: '' // Add role filter state
};

// Add these at the top with your other state
let currentEditingUser = null;

// Load and initialize data
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        
        // Initialize data
        currentPageState.currentData = Array.isArray(data) ? data : [];
        currentPageState.totalItems = currentPageState.currentData.length;
        
        // Initial table render
        updateTable();
        
        // Add search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                currentPageState.searchTerm = this.value;
                currentPageState.page = 1;
                updateTable();
            });
        }

        // Add role filter functionality
        const roleFilter = document.getElementById('roleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', function() {
                currentPageState.roleFilter = this.value;
                currentPageState.page = 1;
                updateTable();
            });
        }

        // Add rows per page functionality
        const rowsPerPage = document.getElementById('rowsPerPage');
        if (rowsPerPage) {
            rowsPerPage.addEventListener('change', function() {
                currentPageState.perPage = parseInt(this.value);
                currentPageState.page = 1;
                updateTable();
            });
        }

        // Add pagination event listeners
        const prevButton = document.getElementById('prevPage');
        if (prevButton) {
            prevButton.addEventListener('click', function() {
                if (currentPageState.page > 1) {
                    currentPageState.page--;
                    updateTable();
                }
            });
        }

        const nextButton = document.getElementById('nextPage');
        if (nextButton) {
            nextButton.addEventListener('click', function() {
                const maxPage = Math.ceil(currentPageState.totalItems / currentPageState.perPage);
                if (currentPageState.page < maxPage) {
                    currentPageState.page++;
                    updateTable();
                }
            });
        }

    } catch (error) {
        console.error('Error initializing user data:', error);
    }
});

function updateTable() {
    try {
        // Get all data
        let filteredData = [...currentPageState.currentData];

        // Apply role filter
        if (currentPageState.roleFilter) {
            filteredData = filteredData.filter(user => 
                user.role === currentPageState.roleFilter
            );
        }

        // Apply search filter
        if (currentPageState.searchTerm) {
            const searchTerm = currentPageState.searchTerm.toLowerCase();
            filteredData = filteredData.filter(user =>
                (user.name?.toLowerCase() || '').includes(searchTerm) ||
                (user.user_id?.toLowerCase() || '').includes(searchTerm) ||
                (user.role?.toLowerCase() || '').includes(searchTerm)
            );
        }

        // Update total items after filtering
        currentPageState.totalItems = filteredData.length;

        // Calculate pagination
        const startIndex = (currentPageState.page - 1) * currentPageState.perPage;
        const endIndex = Math.min(startIndex + currentPageState.perPage, filteredData.length);
        const paginatedData = filteredData.slice(startIndex, endIndex);

        // Update table content
        const tbody = document.querySelector('tbody');
        if (tbody) {
            if (paginatedData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center">No users found</td>
                    </tr>`;
            } else {
                tbody.innerHTML = paginatedData.map(user => `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <img src="/static/images/${user.profile_img || 'default.png'}" 
                                     alt="Profile" 
                                     class="rounded-circle me-2" 
                                     width="32" 
                                     height="32">
                                <div>
                                    <div class="fw-semibold">${user.name}</div>
                                    <div class="small text-muted">${user.user_id}</div>
                                </div>
                            </div>
                        </td>
                        <td>${user.role}</td>
                        <td>
                            <span class="badge ${user.status === 'Active' ? 
                                'bg-success-subtle text-success' : 
                                'bg-danger-subtle text-danger'}">
                                ${user.status}
                            </span>
                        </td>
                        <td class="text-end">
                            <div class="d-flex gap-2 justify-content-end">
                                <button class="btn btn-link p-0" onclick="handleUserAction('edit', '${user.user_id}')">
                                    <i class="bi bi-pencil" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" onclick="handleUserAction('view', '${user.user_id}')">
                                    <i class="bi bi-eye" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0">
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
                'No users found';
        }

        // Update pagination buttons state
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        if (prevButton) prevButton.disabled = currentPageState.page === 1;
        if (nextButton) nextButton.disabled = endIndex >= filteredData.length;

    } catch (error) {
        console.error('Error updating table:', error);
    }
}

// Helper Functions
function handleUserSubmit(formData) {
    const newUserRow = createUserRow(formData);
    table.addItem(newUserRow);
    Notification.success('User created successfully');
}

function handleModalReset() {
    const userIdField = document.getElementById('userIdField');
    if (userIdField) {
        userIdField.value = 'Auto-generated, please select a role';
    }
}

function generateUserId(role) {
    const prefix = {
        'Administrator': 'bh',
        'Instructor': 'ak',
        'Student': 'st'
    }[role];

    return prefix + Array.from(
        { length: 4 }, 
        () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
}

function createUserRow(data) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <div class="d-flex align-items-center">
                <img src="/static/images/profile.png" 
                     class="rounded-circle me-3" 
                     width="40" 
                     height="40"
                     alt="${data.firstName} ${data.lastName}">
                <div>
                    <div class="fw-medium">${data.firstName} ${data.lastName}</div>
                    <div class="text-muted small">${data.userId}</div>
                </div>
            </div>
        </td>
        <td class="align-middle">${data.role}</td>
        <td class="align-middle">
            <span class="badge bg-success-subtle">Active</span>
        </td>
        <td class="align-middle text-end">
            <div class="d-flex gap-2 justify-content-end">
                <button class="btn btn-link p-0" onclick="handleUserAction('edit', '${data.userId}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-link p-0" onclick="handleUserAction('view', '${data.userId}')">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-link p-0 text-danger" onclick="handleUserAction('archive', '${data.userId}')">
                    <i class="bi bi-archive"></i>
                </button>
            </div>
        </td>
    `;
    return tr;
}

function downloadCSV(data, filename) {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => 
                `"${(row[header] || '').replace(/"/g, '""')}"`
            ).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Global function for row actions
window.handleUserAction = async function(action, userId) {
    switch(action) {
        case 'edit':
            try {
                const response = await fetch(`/api/users/${userId}`);
                if (!response.ok) throw new Error('Failed to fetch user details');
                const userData = await response.json();
                
                currentEditingUser = userData;
                
                const statusSelect = document.getElementById('userStatusSelect');
                if (statusSelect) {
                    statusSelect.value = userData.status;
                }
                
                const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
                editModal.show();
            } catch (error) {
                console.error('Error editing user:', error);
            }
            break;
            
        case 'view':
            try {
                const response = await fetch(`/api/users/${userId}`);
                if (!response.ok) throw new Error('Failed to fetch user details');
                const userData = await response.json();
                
                // Show different modal based on user role
                switch(userData.role.toLowerCase()) {
                    case 'student':
                        await showStudentModal(userData);
                        break;
                    case 'instructor':
                        await showInstructorModal(userData);
                        break;
                    case 'admin':
                        await showAdminModal(userData);
                        break;
                }
            } catch (error) {
                console.error('Error viewing user:', error);
                showToast('Error', 'Failed to load user details', 'error');
            }
            break;
    }
};

// Add save status function
window.saveUserStatus = async function() {
    if (!currentEditingUser) return;
    
    try {
        const newStatus = document.getElementById('userStatusSelect').value;
        
        const response = await fetch(`/api/users/${currentEditingUser.user_id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update user status');

        // Update local data
        if (Array.isArray(currentPageState.currentData)) {
            currentPageState.currentData = currentPageState.currentData.map(user => {
                if (user.user_id === currentEditingUser.user_id) {
                    return { ...user, status: newStatus };
                }
                return user;
            });
        }

        // Close modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
        if (editModal) {
            editModal.hide();
        }

        // Update table
        updateTable();

        // Show success message
        showToast('Success', 'User status updated successfully', 'success');

    } catch (error) {
        console.error('Error saving user status:', error);
        showToast('Error', 'Failed to update user status', 'error');
    }
};

function updateStats(stats) {
    document.getElementById('totalUsers').textContent = stats.total_users;
    document.getElementById('activeUsers').textContent = stats.active_users;
    document.getElementById('inactiveUsers').textContent = stats.inactive_users;
}

// Add the showToast function
function showToast(title, message, type = 'success') {
    const toast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const iconElement = toast.querySelector('.toast-header i');
    
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Update icon and color based on type
    iconElement.className = type === 'success' 
        ? 'bi bi-check-circle-fill text-success me-2'
        : 'bi bi-exclamation-circle-fill text-danger me-2';
    
    const bsToast = new bootstrap.Toast(toast, {
        delay: 3000
    });
    bsToast.show();
}

// Add toast HTML to your user management page
const toastHTML = `
<!-- Toast Notification -->
<div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div id="statusToast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header">
            <i class="bi bi-check-circle-fill text-success me-2"></i>
            <strong class="me-auto" id="toastTitle">Success</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body" id="toastMessage">
            Operation completed successfully
        </div>
    </div>
</div>
`;

// Add toast to the document when loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add toast container to body
    document.body.insertAdjacentHTML('beforeend', toastHTML);
    
    // ... rest of your existing DOMContentLoaded code ...
});

async function showStudentModal(userData) {
    try {
        // Fetch additional student data
        const studentResponse = await fetch(`/api/students/${userData.user_id}`);
        if (!studentResponse.ok) throw new Error('Failed to fetch student details');
        const studentData = await studentResponse.json();

        // Update student modal elements
        document.getElementById('studentImage').src = `/static/images/${userData.profile_img || 'default.png'}`;
        document.getElementById('studentName').textContent = userData.name;
        document.getElementById('studentId').textContent = userData.user_id;
        document.getElementById('studentStatus').textContent = userData.status;
        document.getElementById('studentCompany').textContent = studentData.company || 'N/A';
        document.getElementById('studentGroup').textContent = studentData.group || 'N/A';

        // Update status badge class
        const statusBadge = document.getElementById('studentStatus');
        statusBadge.className = `badge ${
            userData.status === 'Active' ? 'bg-success' : 
            userData.status === 'Inactive' ? 'bg-danger' : 
            'bg-secondary'
        }`;

        // Update enrolled classes section
        const enrolledClassesDiv = document.getElementById('enrolledClasses');
        if (enrolledClassesDiv && studentData.enrolled_classes) {
            const classesHtml = studentData.enrolled_classes.map(cls => `
                <div class="mb-4">
                    <h6 class="mb-1" style="color: #191970;">${cls.class_name}</h6>
                    <div class="text-muted">${cls.schedule}</div>
                    <div class="text-muted">Instructor: ${cls.instructor}</div>
                </div>
            `).join('');
            
            enrolledClassesDiv.innerHTML = classesHtml || '<p class="text-muted mb-0">No lecture details available</p>';
        }

        // Change header to "Lecture Details"
        const studentHeader = document.querySelector('.student-header');
        if (studentHeader) {
            studentHeader.textContent = 'Lecture Details';
        }

        // Mock attendance data structure (similar to student-management.js)
        const lectureData = studentData.enrolled_classes.map(cls => ({
            name: cls.class_name,
            time: cls.schedule,
            attendance: [
                { status: 'present', time: '9:00 AM' },
                { status: 'late', time: '9:15 AM' },
                { status: 'present', time: '9:00 AM' },
                { status: 'absent', time: '-' },
                { status: 'present', time: '9:00 AM' }
            ]
        }));

        // Update the attendance table
        const studentNameColumn = document.getElementById('studentNameColumn');
        const attendanceBody = document.getElementById('attendanceTableBody');

        // Clear existing content
        studentNameColumn.innerHTML = '';
        attendanceBody.innerHTML = '';

        // Populate lecture details
        lectureData.forEach(lecture => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="student-cell">
                    <div class="student-name">${lecture.name}</div>
                    <div class="student-info">${lecture.time}</div>
                </td>
            `;
            studentNameColumn.appendChild(row);

            // Create attendance row
            const attendanceRow = document.createElement('tr');
            lecture.attendance.forEach(day => {
                let badgeClasses = '';
                switch(day.status) {
                    case 'present':
                        badgeClasses = 'bg-success-subtle text-success';
                        break;
                    case 'absent':
                        badgeClasses = 'bg-danger-subtle text-danger';
                        break;
                    case 'late':
                        badgeClasses = 'bg-warning-subtle text-warning';
                        break;
                }
                
                attendanceRow.innerHTML += `
                    <td class="attendance-cell">
                        <div class="attendance-content">
                            <span class="badge ${badgeClasses}" style="padding: 8px 16px; font-size: 14px;">
                                ${day.status.charAt(0).toUpperCase() + day.status.slice(1)}
                            </span>
                            <span class="attendance-time">${day.time}</span>
                        </div>
                    </td>
                `;
            });
            attendanceBody.appendChild(attendanceRow);
        });

        // Calculate and update statistics
        const totalPresent = lectureData.reduce((sum, lecture) => 
            sum + lecture.attendance.filter(day => 
                day.status === 'present' || day.status === 'late'
            ).length, 0);
        
        const totalAbsent = lectureData.reduce((sum, lecture) => 
            sum + lecture.attendance.filter(day => day.status === 'absent').length, 0);
        
        const totalDays = lectureData.reduce((sum, lecture) => 
            sum + lecture.attendance.length, 0);
        
        const attendancePercentage = ((totalPresent / totalDays) * 100).toFixed(2);

        // Update statistics
        document.getElementById('totalPresent').textContent = totalPresent;
        document.getElementById('totalAbsence').textContent = totalAbsent;
        document.getElementById('attendancePercentage').textContent = `${attendancePercentage}%`;

        // Show the modal
        const viewModal = new bootstrap.Modal(document.getElementById('viewStudentModal'));
        viewModal.show();

    } catch (error) {
        console.error('Error showing student modal:', error);
        console.error('Error details:', error.message);
        showToast('Error', 'Failed to load student details', 'error');
    }
}

async function showInstructorModal(userData) {
    try {
        // Fetch additional instructor data
        const instructorResponse = await fetch(`/api/instructors/${userData.user_id}`);
        if (!instructorResponse.ok) throw new Error('Failed to fetch instructor details');
        const instructorData = await instructorResponse.json();

        // Update instructor modal elements
        document.getElementById('instructorImage').src = instructorData.profile_img || `/static/images/${userData.profile_img || 'default.png'}`;
        document.getElementById('instructorName').textContent = instructorData.name;
        document.getElementById('instructorId').textContent = instructorData.user_id;
        document.getElementById('instructorStatus').textContent = instructorData.status;
        document.getElementById('instructorDepartment').textContent = instructorData.department || 'N/A';
        document.getElementById('totalClasses').textContent = instructorData.total_classes || 0;

        // Update status badge class
        const statusBadge = document.getElementById('instructorStatus');
        statusBadge.className = `badge ${
            instructorData.status === 'Active' ? 'bg-success' : 
            instructorData.status === 'Inactive' ? 'bg-danger' : 
            'bg-secondary'
        }`;

        // Update assigned classes - removed status badge
        if (instructorData.assigned_classes) {
            document.getElementById('assignedClasses').innerHTML = instructorData.assigned_classes
                .map(cls => `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0">${cls.name}</h6>
                                <small class="text-muted">${cls.schedule}</small>
                            </div>
                        </div>
                    </div>
                `).join('') || '<p class="text-muted mb-0">No classes assigned</p>';
        }

        // Show the modal
        const viewModal = new bootstrap.Modal(document.getElementById('viewInstructorModal'));
        viewModal.show();

    } catch (error) {
        console.error('Error showing instructor modal:', error);
        showToast('Error', 'Failed to load instructor details', 'error');
    }
}

async function showAdminModal(userData) {
    try {
        // For admin, we'll just use the basic user data since there's no additional endpoint
        const modalContent = `
            <div class="modal-header">
                <h5 class="modal-title">Administrator Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="d-flex align-items-center gap-4 mb-4">
                    <img src="/static/images/${userData.profile_img || 'default.png'}" 
                         alt="Admin Photo" 
                         class="rounded-circle"
                         style="width: 120px; height: 120px; object-fit: cover;">
                    <div>
                        <div class="d-flex align-items-center gap-3 mb-2">
                            <h2 class="mb-0 fw-semibold" style="color: #191970;">${userData.name}</h2>
                            <span class="badge ${userData.status === 'Active' ? 'bg-success' : 'bg-danger'}">
                                ${userData.status}
                            </span>
                        </div>
                        <p class="mb-1">Admin ID: ${userData.user_id}</p>
                        <p class="mb-0">Role: ${userData.role}</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        `;

        // Update the admin modal content
        const modalElement = document.getElementById('viewAdminModal');
        modalElement.querySelector('.modal-content').innerHTML = modalContent;

        // Show the modal
        const viewModal = new bootstrap.Modal(modalElement);
        viewModal.show();

    } catch (error) {
        console.error('Error showing admin modal:', error);
        showToast('Error', 'Failed to load admin details', 'error');
    }
}

// Add this function to calculate card statistics
function updateCardStatistics(selectedRole = '') {
    try {
        // Get all users from the current data state
        const allUsers = currentPageState.currentData;
        
        // Initialize counters
        let totalUsers = 0;
        let activeUsers = 0;
        let inactiveUsers = 0;

        if (selectedRole === '') {
            // Count all users when no role is selected
            totalUsers = allUsers.length;
            activeUsers = allUsers.filter(user => user.status === 'Active').length;
            inactiveUsers = allUsers.filter(user => user.status === 'Inactive').length;
        } else {
            // Count users of selected role only
            const roleUsers = allUsers.filter(user => user.role === selectedRole);
            totalUsers = roleUsers.length;
            activeUsers = roleUsers.filter(user => user.status === 'Active').length;
            inactiveUsers = roleUsers.filter(user => user.status === 'Inactive').length;
        }

        // Update the cards
        const totalElement = document.getElementById('totalUsers');
        const activeElement = document.getElementById('activeUsers');
        const inactiveElement = document.getElementById('inactiveUsers');

        if (totalElement) totalElement.textContent = totalUsers;
        if (activeElement) activeElement.textContent = activeUsers;
        if (inactiveElement) inactiveElement.textContent = inactiveUsers;

    } catch (error) {
        console.error('Error updating card statistics:', error);
    }
}

// Add event listener for role selector
const roleFilter = document.getElementById('roleFilter');
if (roleFilter) {
    roleFilter.addEventListener('change', function(e) {
        const selectedRole = e.target.value;
        updateCardStatistics(selectedRole);
    });
}

// Initial card update when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateCardStatistics('');
});

// Update statistics when search is performed
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        updateCardStatistics(roleFilter ? roleFilter.value : '');
    });
}

// Update statistics when table content changes
const observer = new MutationObserver(() => {
    updateCardStatistics(roleFilter ? roleFilter.value : '');
});

// Start observing the table for changes
const userTable = document.getElementById('userTable');
if (userTable) {
    observer.observe(userTable, { 
        childList: true, 
        subtree: true 
    });
}
