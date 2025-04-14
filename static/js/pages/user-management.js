/**
 * User Management Module
 * 
 * This module handles all functionality for the user management page including:
 * - Fetching and displaying users with pagination
 * - Filtering by role, status and search
 * - User actions (view, edit, archive)
 * - Managing user statistics
 */

// ------------------- State Management -------------------
let state = {
    // Pagination
    page: 1,
    perPage: 5,
    totalItems: 0,
    
    // Filters
    searchTerm: '',
    roleFilter: '',
    statusFilter: '',
    
    // Data
    currentData: [],
    
    // Currently selected user
    currentEditingUser: null
};

// ------------------- Core Functions -------------------

/**
 * Initializes the user management page
 */
async function initUserManagement() {
    console.log('User management page loaded');
    try {
        await loadUsers();
        setupEventListeners();
        updateTable();
        updateCardStatistics();
        console.log('User management initialized successfully');
    } catch (error) {
        console.error('Error initializing user management:', error);
        showToast('Failed to initialize user management', 'error');
    }
}

/**
 * Load users from the API with optional filters
 */
async function loadUsers() {
    try {
        const params = new URLSearchParams();
        if (state.roleFilter) params.append('role', state.roleFilter);
        if (state.statusFilter) params.append('status', state.statusFilter);
        if (state.searchTerm) params.append('search', state.searchTerm);
        
        const queryString = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`/api/users${queryString}`);
        
        if (!response.ok) throw new Error('Failed to fetch users');
        
        const data = await response.json();
        
        state.currentData = Array.isArray(data) ? data.map(formatUserData) : [];
        state.totalItems = state.currentData.length;
        
        return state.currentData;
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
        return [];
    }
}

/**
 * Format raw user data into a consistent structure
 */
function formatUserData(user) {
    // Map lowercase role names to properly formatted role names
    let formattedRole = user.role;
    if (typeof formattedRole === 'string') {
        const roleLower = formattedRole.toLowerCase();
        if (roleLower === 'admin' || roleLower === 'administrator') {
            formattedRole = 'Administrator';
        } else if (roleLower === 'instructor') {
            formattedRole = 'Instructor';
        } else if (roleLower === 'student') {
            formattedRole = 'Student';
        }
    }

    return {
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: formattedRole,
        status: user.is_active ? 'Active' : 'Inactive',
        profile_img: user.profile_img || 'profile.png'
    };
}

/**
 * Setup all event listeners for the page
 */
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            state.searchTerm = this.value;
            state.page = 1;
            handleFiltersChanged();
        });
    }

    // Role filter
    const roleFilter = document.getElementById('roleFilter');
    if (roleFilter) {
        roleFilter.addEventListener('change', function() {
            state.roleFilter = this.value;
            state.page = 1;
            handleFiltersChanged();
        });
    }

    // Rows per page
    const rowsPerPage = document.getElementById('rowsPerPage');
    if (rowsPerPage) {
        rowsPerPage.addEventListener('change', function() {
            state.perPage = parseInt(this.value);
            state.page = 1;
            updateTable();
        });
    }

    // Pagination buttons
    const prevButton = document.getElementById('prevPage');
    if (prevButton) {
        prevButton.addEventListener('click', function() {
            if (state.page > 1) {
                state.page--;
                updateTable();
            }
        });
    }

    const nextButton = document.getElementById('nextPage');
    if (nextButton) {
        nextButton.addEventListener('click', function() {
            const maxPage = Math.ceil(state.totalItems / state.perPage);
            if (state.page < maxPage) {
                state.page++;
                updateTable();
            }
        });
    }

    // Set up delegation for user action buttons (edit, view, toggle status)
    // Use document level delegation to catch all buttons regardless of container
    document.addEventListener('click', function(event) {
        // Handle toggle status buttons
        const toggleButton = event.target.closest('.toggle-status-btn');
        if (toggleButton) {
            event.preventDefault();
            const userId = toggleButton.getAttribute('data-user-id');
            const isCurrentlyActive = toggleButton.getAttribute('data-is-active') === 'true';
            
            // Call status toggle function with the opposite of current status
            saveUserStatus(userId, !isCurrentlyActive);
            return;
        }
        
        // Handle edit buttons
        const editButton = event.target.closest('button[data-user-id]');
        if (editButton && editButton.querySelector('.bi-pencil')) {
            const userId = editButton.getAttribute('data-user-id');
            handleEditUser(userId);
            return;
        }
        
        // Handle view buttons
        const viewButton = event.target.closest('.view-user-btn');
        if (viewButton) {
            const userId = viewButton.getAttribute('data-user-id');
            handleViewUser(userId);
            return;
        }
        
        // Handle delete buttons
        const deleteButton = event.target.closest('.delete-user-btn');
        if (deleteButton) {
            const userId = deleteButton.getAttribute('data-user-id');
            handleArchiveUser(userId);
            return;
        }
        
        // Handle save status button in edit modal
        const saveStatusButton = event.target.closest('#saveUserStatusBtn');
        if (saveStatusButton) {
            handleSaveUserStatus();
            return;
        }
    });

    // Export button listener (attached only once)
    const exportBtn = document.getElementById('exportUserCSV');
    if (exportBtn) {
        exportBtn.addEventListener('click', function(e) {
            e.preventDefault();

            const exportButton = this;
            const originalButtonText = exportButton.innerHTML;
            exportButton.disabled = true;
            exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Preparing...';

            const params = new URLSearchParams();
            if (state.roleFilter) params.append('role', state.roleFilter);
            if (state.statusFilter) params.append('status', state.statusFilter);
            if (state.searchTerm) params.append('search', state.searchTerm);
            const queryString = params.toString();
            
            const countUrl = `/api/users/export/count?${queryString}`;
            const exportUrl = `/api/users/export?${queryString}`;

            fetch(countUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const count = data.count;
                        if (count > 0) {
                            showToast(`Exported ${count} users to CSV`, 'success');
                            setTimeout(() => {
                                window.location.href = exportUrl;
                            }, 100);
                        } else {
                            showToast('No Users', 'No users match the current filters for export.', 'info');
                        }
                    } else {
                        showToast('Error', data.error || 'Failed to count users for export.', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error during count fetch:', error);
                    showToast('An error occurred while preparing the user export.', 'error');
                })
                .finally(() => {
                    exportButton.disabled = false;
                    exportButton.innerHTML = originalButtonText;
                });
        });
    }
    
    initializeTooltips();

    // Set up the show/hide of the custom reason field when "other" is selected
    const archiveReasonSelect = document.getElementById('archiveReason');
    const customReasonContainer = document.getElementById('customReasonContainer');
    
    if (archiveReasonSelect && customReasonContainer) {
        archiveReasonSelect.addEventListener('change', function() {
            if (this.value === 'other') {
                customReasonContainer.classList.remove('d-none');
            } else {
                customReasonContainer.classList.add('d-none');
            }
        });
    }
}

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Handle filters changed - reload data and update UI
 */
async function handleFiltersChanged() {
    await loadUsers();
    updateTable();
    updateCardStatistics();
}

/**
 * Update the href of the export button based on current filters
 */
function updateExportButton() {
    const exportBtn = document.getElementById('exportUserCSV');
    if (!exportBtn) return;

    // Remove previous listener to avoid duplicates if this is called multiple times
    const newExportBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);

    // Add the new event listener
    newExportBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        const exportButton = this;
        const originalButtonText = exportButton.innerHTML;

        // Disable button and show loading state
        exportButton.disabled = true;
        exportButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Preparing...';

        // Get current filters from state
        const params = new URLSearchParams();
        if (state.roleFilter) params.append('role', state.roleFilter);
        if (state.statusFilter) params.append('status', state.statusFilter);
        if (state.searchTerm) params.append('search', state.searchTerm);
        const queryString = params.toString();
        
        const countUrl = `/api/users/export/count?${queryString}`;
        const exportUrl = `/api/users/export?${queryString}`;

        fetch(countUrl)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const count = data.count;
                    if (count > 0) {
                        // Use the global showToast
                        showToast('Export Started', `Exporting ${count} ${count === 1 ? 'user' : 'users'} to CSV...`, 'success');
                        setTimeout(() => {
                            window.location.href = exportUrl; // Trigger download
                        }, 100); // 100ms delay
                    } else {
                        showToast('No Users', 'No users match the current filters for export.', 'info');
                    }
                } else {
                    showToast('Error', data.error || 'Failed to count users for export.', 'error');
                }
            })
            .catch(error => {
                console.error('Error counting users for export:', error);
                showToast('An error occurred while preparing the user export.', 'error');
            })
            .finally(() => {
                // Re-enable button and restore original text
                exportButton.disabled = false;
                exportButton.innerHTML = originalButtonText;
            });
    });
}

// ------------------- UI Update Functions -------------------

/**
 * Update the user table with current data and filters
 */
function updateTable() {
    try {
        // Apply pagination
        const startIndex = (state.page - 1) * state.perPage;
        const endIndex = Math.min(startIndex + state.perPage, state.totalItems);
        const paginatedData = state.currentData.slice(startIndex, endIndex);

        // Update table content
        const tbody = document.querySelector('tbody');
        if (!tbody) return;
        
            if (paginatedData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                    <td colspan="4" class="text-center py-5">
                        <div class="text-muted">
                            <i class="bi bi-inbox fs-2"></i>
                            <p class="mt-2">No users found</p>
                        </div>
                    </td>
                </tr>
            `;
            } else {
            // Generate table rows
                tbody.innerHTML = paginatedData.map(user => `
                <tr data-user-role="${user.role}">
                        <td>
                            <div class="d-flex align-items-center">
                            <img src="${user.profile_img ? `/static/images/${user.profile_img}` : '/static/images/profile.png'}" 
                                class="rounded-circle me-3" 
                                width="40" 
                                height="40"
                                alt="${user.name}">
                                <div>
                                <div class="fw-medium">${user.name}</div>
                                <div class="text-muted small">${user.user_id}</div>
                                </div>
                            </div>
                        </td>
                    <td class="align-middle">${user.role}</td>
                    <td class="align-middle">
                        <span class="badge ${user.status === 'Active' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}">
                                ${user.status}
                            </span>
                        </td>
                    <td class="align-middle text-end">
                            <div class="d-flex gap-2 justify-content-end">
                                <button class="btn btn-link p-0" onclick="handleUserAction('edit', '${user.user_id}')">
                                    <i class="bi bi-pencil" style="color: #191970;"></i>
                                </button>
                                <button class="btn btn-link p-0" onclick="handleUserAction('view', '${user.user_id}')">
                                    <i class="bi bi-eye" style="color: #191970;"></i>
                                </button>
                            <button class="btn btn-link p-0" onclick="handleUserAction('archive', '${user.user_id}')">
                                    <i class="bi bi-archive" style="color: #191970;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
        }

        // Update pagination info
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            if (state.totalItems === 0) {
                paginationInfo.textContent = '0 items';
            } else {
                paginationInfo.textContent = `${startIndex + 1}-${endIndex} of ${state.totalItems}`;
            }
        }

        // Update pagination buttons
        const prevButton = document.getElementById('prevPage');
        if (prevButton) {
            prevButton.disabled = state.page <= 1;
        }

        const nextButton = document.getElementById('nextPage');
        if (nextButton) {
            nextButton.disabled = endIndex >= state.totalItems;
        }
    } catch (error) {
        console.error('Error updating table:', error);
    }
}

/**
 * Update card statistics based on filtered data
 */
function updateCardStatistics() {
    try {
        // Calculate total counts
        const totalUsers = state.currentData.length;
        const activeUsers = state.currentData.filter(user => user.status === 'Active').length;
        const inactiveUsers = totalUsers - activeUsers;

        // Update DOM elements
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('activeUsers').textContent = activeUsers;
        document.getElementById('inactiveUsers').textContent = inactiveUsers;
        
    } catch (error) {
        console.error('Error updating card statistics:', error);
    }
}

// ------------------- User Action Handlers -------------------

/**
 * Handle user actions (edit, view, archive)
 */
function handleUserAction(action, userId) {
    switch (action) {
        case 'edit':
            handleEditUser(userId);
            break;
        case 'view':
            handleViewUser(userId);
            break;
        case 'archive':
            handleArchiveUser(userId);
            break;
        default:
            console.error('Unknown action:', action);
    }
}

/**
 * Handle edit user action
 */
async function handleEditUser(userId) {
    try {
        const form = document.getElementById('editUserForm');
        if (form) form.classList.add('loading');
        
        const cachedUser = state.currentData.find(user => user.user_id == userId);
        if (cachedUser) {
            state.currentEditingUser = cachedUser;
            populateEditForm(cachedUser);
        }
        
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
            console.error('Failed to fetch user details from API');
            throw new Error('Failed to fetch user details');
        }
        const userData = await response.json();
        
        state.currentEditingUser = userData;
        populateEditForm(userData);
        
        const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
        editModal.show();
    } catch (error) {
        console.error('Error in handleEditUser:', error);
        showToast('Error loading user data', 'error');
    } finally {
        const form = document.getElementById('editUserForm');
        if (form) form.classList.remove('loading');
    }
}

/**
 * Handle view user action
 */
async function handleViewUser(userId) {
    try {
        const cachedUser = state.currentData.find(user => user.user_id == userId);
        if (cachedUser) {
            showUserModal(cachedUser);
        }
        
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
            console.error('Failed to fetch user details from API');
            throw new Error('Failed to fetch user details');
        }
        const userData = await response.json();
        
        showUserModal(userData);
    } catch (error) {
        console.error('Error in handleViewUser:', error);
        showToast('Error loading user data', 'error');
    }
}

/**
 * Show the appropriate modal for a user
 * @param {Object} userData - The user data
 */
function showUserModal(userData) {
    // Determine user role
    const roleLower = (userData.role || '').toLowerCase();
    
    // Calculate user type for modal function
    let userType;
    if (roleLower.includes('student')) {
        userType = 'student';
    } else if (roleLower.includes('instructor') || roleLower.includes('teacher')) {
        userType = 'instructor';
    } else if (roleLower.includes('admin') || roleLower.includes('administrator')) {
        userType = 'admin';
    } else {
        console.error('Unknown user role:', userData.role);
        showToast('Unknown user role', 'error');
        return;
    }
    
    // Prepare data for modal - ensure all required fields
    const preparedData = {
        ...userData,
        id: userData.id || userData.user_id,
        user_id: userData.user_id || userData.id,
        user_type: userType,
        is_active: userData.is_active || userData.status === 'Active'
    };
    
    // Show appropriate modal based on user type
    switch (userType) {
        case 'student':
            if (typeof window.showStudentModalView === 'function') {
                window.showStudentModalView(preparedData);
            } else {
                showToast('Student modal view not available', 'error');
            }
            break;
            
                    case 'instructor':
            if (typeof window.showInstructorModalView === 'function') {
                window.showInstructorModalView(preparedData);
            } else {
                showToast('Instructor modal view not available', 'error');
            }
                        break;
            
                    case 'admin':
            if (typeof window.showAdminModalView === 'function') {
                window.showAdminModalView(preparedData);
            } else {
                showToast('Admin modal view not available', 'error');
            }
            break;
            
        default:
            showToast('Unknown user type', 'error');
    }
}

/**
 * Handle archive user action
 */
function handleArchiveUser(userId) {
    // Find user in current data
    const user = state.currentData.find(user => user.user_id === userId);
    
    if (!user) {
        showToast('Error', 'User not found', 'danger');
        return;
    }
    
    // Populate confirmation modal
    document.getElementById('archiveUserId').value = userId;
    document.getElementById('archiveUserName').textContent = user.name;
    document.getElementById('archiveUserIdDisplay').textContent = userId;
    
    // Show confirmation modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmArchiveModal'));
    confirmModal.show();
}

/**
 * Archive a user (called from confirmation modal)
 */
function archiveUser() {
    // Get the user ID from the modal
    const modal = document.getElementById('confirmArchiveModal');
    const userId = document.getElementById('archiveUserId').value;
    const userName = document.getElementById('archiveUserName').textContent;
    const userRole = document.querySelector('tr[data-user-id="' + userId + '"]')?.getAttribute('data-user-role') || 'User';
    
    // Get the archive reason
    const reasonSelect = document.getElementById('archiveReason');
    const customReasonInput = document.getElementById('customReason');
    
    if (!reasonSelect || !reasonSelect.value) {
        showToast('Please select an archive reason', 'error');
        return;
    }
    
    // Determine the final reason text
    let archiveReason = reasonSelect.value;
    if (archiveReason === 'other' && customReasonInput) {
        if (!customReasonInput.value.trim()) {
            showToast('Please specify a custom reason', 'error');
            return;
        }
        archiveReason = customReasonInput.value.trim();
    }
    
    console.log('Archiving user:', { userId, userName, userRole, reason: archiveReason });
    
    // Disable archive button to prevent multiple submissions
    const archiveBtn = document.getElementById('confirmArchiveBtn');
    if (archiveBtn) {
        archiveBtn.disabled = true;
        archiveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
    }
    
    // Send the archive request
    fetch(`/api/users/${userId}/archive`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            reason: archiveReason
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to archive user');
        }
        return response.json();
    })
    .then(data => {
        console.log('User archived successfully:', data);
        
        // Hide the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('confirmArchiveModal'));
        if (modal) modal.hide();
        
        // Show original success message
        showToast(data.message || 'User has been archived successfully.', 'success');
        
        // Remove from the table
        removeUserFromTable(userId);
        
        // Update statistics
        loadUsers().then(() => {
            updateCardStatistics();
        });
    })
    .catch(error => {
        console.error('Error archiving user:', error);
        showToast('Failed to archive user', 'error');
    })
    .finally(() => {
        // Re-enable archive button
        if (archiveBtn) {
            archiveBtn.disabled = false;
            archiveBtn.innerHTML = 'Confirm Archive';
        }
    });
}

/**
 * Update a user's status in the UI
 * @param {string} userId - The user ID
 * @param {boolean} isActive - Whether the user is active
 */
function updateUserStatusInUI(userId, isActive) {
    // Find the toggle button for this user
    const toggleButton = document.querySelector(`.toggle-status-btn[data-user-id="${userId}"]`);
    if (!toggleButton) return;
    
    // Update the data attribute
    toggleButton.setAttribute('data-is-active', isActive.toString());
    
    // Update tooltip
    toggleButton.setAttribute('title', isActive ? 'Deactivate User' : 'Activate User');
    
    // Try to update Bootstrap tooltip if initialized
    try {
        const tooltip = bootstrap.Tooltip.getInstance(toggleButton);
        if (tooltip) {
            tooltip.dispose();
        }
        new bootstrap.Tooltip(toggleButton);
    } catch (error) {
        console.warn('Could not update tooltip:', error);
    }
    
    // Update icon
    const icon = toggleButton.querySelector('i');
    if (icon) {
        icon.className = `bi bi-toggle-${isActive ? 'on' : 'off'} ${isActive ? 'text-success' : 'text-muted'}`;
    }
    
    // Update status badge in the row
    const userRow = toggleButton.closest('tr');
    if (userRow) {
        const statusBadge = userRow.querySelector('.badge');
        if (statusBadge) {
            statusBadge.textContent = isActive ? 'Active' : 'Inactive';
            statusBadge.className = `badge ${isActive ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`;
        }
    }
}

// Function to save user status (active/inactive)
async function saveUserStatus(userId, isActive) {
    try {
        if (!userId || userId === 'undefined' || userId === undefined) {
            console.error('Invalid user ID:', userId);
            showToast('Error: Invalid user ID. Please try again or reload the page.', 'error');
            return;
        }
        isActive = Boolean(isActive === true || isActive === 'true');
        const statusValue = isActive ? 'Active' : 'Inactive';
        
        
        const response = await fetch(`/api/users/${userId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                status: statusValue,
                is_active: isActive
            })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        const userIndex = state.currentData.findIndex(user => user.user_id === userId || user.id === userId);
        if (userIndex >= 0) state.currentData[userIndex].status = statusValue;
        
        updateUserStatusInUI(userId, isActive);
        updateCardStatistics();
        updateTable();
        showToast(`User status updated to ${statusValue}`, 'success');
        return result;
    } catch (error) {
        console.error('Error updating user status:', error);
        showToast('Failed to update user status: ' + (error.message || 'Unknown error'), 'error');
        throw error;
    }
}

/**
 * Populate the edit form with user data
 * @param {Object} userData - The user data to populate the form with
 */
function populateEditForm(userData) {
    if (!userData) {
        console.error('No user data provided to populate form');
        return;
    }
    
    console.log('Populating edit form with user data:', userData);
    
    // Get form elements
    const form = document.getElementById('editUserForm');
    if (!form) {
        console.error('Edit user form not found');
        return;
    }
    
    // Set user ID in hidden field
    const userIdField = document.getElementById('editUserId');
    if (userIdField) {
        userIdField.textContent = userData.user_id || userData.id;
    }
    
    // Set user status in dropdown
    const statusSelect = document.getElementById('userStatusSelect');
    if (statusSelect) {
        const isActive = userData.is_active || userData.status === 'Active';
        statusSelect.value = isActive ? 'Active' : 'Inactive';
    }
    
    // Set name display
    const userNameDisplay = document.getElementById('editUserName');
    if (userNameDisplay) {
        userNameDisplay.textContent = userData.name || `${userData.first_name} ${userData.last_name}`;
    }
    
    // Set user image
    const userImage = document.getElementById('editUserImage');
    if (userImage) {
        userImage.src = userData.profile_img ? `/static/images/${userData.profile_img}` : '/static/images/profile.png';
    }
    
    // Set role display
    const userRoleDisplay = document.getElementById('editUserRole');
    if (userRoleDisplay) {
        userRoleDisplay.textContent = userData.role || '';
    }
    
    // Set form fields if they exist
    const emailField = form.querySelector('[name="email"]');
    if (emailField) {
        emailField.value = userData.email || '';
    }
    
    const firstNameField = form.querySelector('[name="first_name"]');
    if (firstNameField) {
        firstNameField.value = userData.first_name || '';
    }
    
    const lastNameField = form.querySelector('[name="last_name"]');
    if (lastNameField) {
        lastNameField.value = userData.last_name || '';
    }
    
    // Enable form for editing
    form.classList.remove('loading');
}

/**
 * Remove a user from the table after archiving
 * @param {string} userId - The ID of the user to remove
 */
function removeUserFromTable(userId) {
    // Find the user in the current data and remove it
    const userIndex = state.currentData.findIndex(user => user.user_id === userId);
    if (userIndex !== -1) {
        state.currentData.splice(userIndex, 1);
        state.totalItems--;
        
        // Update the table to reflect the change
        updateTable();
    }
    
    // Also try to remove the row directly from the DOM for immediate feedback
    const userRow = document.querySelector(`tr[data-user-id="${userId}"]`);
    if (userRow) {
        userRow.remove();
    }
}

// Make functions globally available
window.handleUserAction = handleUserAction;
window.archiveUser = archiveUser;
window.saveUserStatus = saveUserStatus;

// Initialize on page load
document.addEventListener('DOMContentLoaded', initUserManagement);

/**
 * Extract user data from the table row
 * @param {string} userId - The user ID
 * @param {string} userType - The user type (student, instructor, admin)
 * @returns {Object|null} - The user data object or null if not found
 */
function getUserDataFromRow(userId, userType) {
    // Find the table row containing the user data
    const userRow = document.querySelector(`tr[data-user-id="${userId}"]`);
    if (!userRow) return null;
    
    // Try to find the user in state first (most efficient)
    const userInState = state.currentData.find(u => u.user_id === userId);
    if (userInState) {
        // Add any missing properties for modal display
        return {
            ...userInState,
            user_type: userType,
            // Make sure these properties are defined
            id: userInState.id || userId,
            user_id: userId,
            // Extract additional data from data attributes
            enrollments: getAttributeAsJson(userRow, 'data-enrollments', []),
            attendance: getAttributeAsJson(userRow, 'data-attendance', {present: 0, absent: 0}),
            company: getAttributeAsJson(userRow, 'data-company', null),
            classes_taught: getAttributeAsJson(userRow, 'data-classes', []),
            permissions: getAttributeAsJson(userRow, 'data-permissions', [])
        };
    }
    
    // Fallback to extracting everything from the row
    const userData = {
        id: userId,
        user_id: userId,
        user_type: userType.toLowerCase(),
        is_active: userRow.querySelector('.user-status')?.textContent.trim() === 'Active'
    };
    
    // Add name
    const nameCell = userRow.querySelector('.user-name');
    if (nameCell) {
        // Try to extract first and last name
        const fullName = nameCell.textContent.trim();
        const nameParts = fullName.split(' ');
        
        if (nameParts.length >= 2) {
            userData.first_name = nameParts[0];
            userData.last_name = nameParts.slice(1).join(' ');
        }
        
        userData.name = fullName;
    }
    
    // Add email
    const emailCell = userRow.querySelector('.user-email');
    if (emailCell) {
        userData.email = emailCell.textContent.trim();
    }
    
    // Add profile image
    const imgElement = userRow.querySelector('.user-avatar img');
    if (imgElement) {
        userData.profile_img = imgElement.getAttribute('src');
    }
    
    // Add data attributes
    userData.enrollments = getAttributeAsJson(userRow, 'data-enrollments', []);
    userData.attendance = getAttributeAsJson(userRow, 'data-attendance', {present: 0, absent: 0});
    userData.company = getAttributeAsJson(userRow, 'data-company', null);
    userData.classes_taught = getAttributeAsJson(userRow, 'data-classes', []);
    userData.permissions = getAttributeAsJson(userRow, 'data-permissions', []);
    
    return userData;
}

/**
 * Helper function to get a data attribute as JSON
 * @param {HTMLElement} element - The element with the attribute
 * @param {string} attributeName - The attribute name
 * @param {any} defaultValue - Default value if attribute is missing or invalid
 * @returns {any} - The parsed JSON value or default value
 */
function getAttributeAsJson(element, attributeName, defaultValue) {
    if (!element) return defaultValue;
    
    const attrValue = element.getAttribute(attributeName);
    if (!attrValue) return defaultValue;
    
    try {
        return JSON.parse(attrValue);
    } catch (e) {
        console.warn(`Error parsing ${attributeName}:`, e);
        return defaultValue;
    }
}

/**
 * Handle the save user status button click from the edit modal
 */
function handleSaveUserStatus() {
    try {
        // Get the current editing user from state
        if (!state.currentEditingUser || !state.currentEditingUser.id) {
            showToast('Error: User data not found', 'error');
            return;
        }
        
        const userId = state.currentEditingUser.id;
        const newStatus = document.getElementById('userStatusSelect').value;
        const isActive = newStatus === 'Active';
        
        // Save the user status
        saveUserStatus(userId, isActive).then(() => {
            // Close the modal after successful save
            const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
            if (modal) {
                modal.hide();
            }
        });
    } catch (error) {
        console.error('Error handling save user status:', error);
        showToast('Failed to save user status', 'error');
    }
}