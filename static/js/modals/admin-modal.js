/**
 * Admin Modal View - Handles displaying admin details with permission management
 * 
 * Features:
 * - Displays admin basic information with profile image
 * - Shows permissions with visual indicators based on access level
 * - Different permission displays for full vs limited access admins
 * - Compatible with Bootstrap 5 modals
 */

/**
 * Show admin details in a modal
 * @param {Object} userData - The admin data from the parent component
 */
async function showAdminModalView(userData) {
    try {
        const adminModal = document.getElementById('viewAdminModal');
        if (!adminModal) {
            showToast('Error: Admin view modal not found', 'error');
            return;
        }

        updateAdminInfo(userData);
        displayPermissions(userData);
        updateModalFooter(userData.id || userData.user_id);
        
        // Use the shared modal utility if available
        if (window.ModalHelpers && window.ModalHelpers.showModal) {
            window.ModalHelpers.showModal('viewAdminModal');
        } else {
            // Fallback to direct Bootstrap API
            const viewModal = new bootstrap.Modal(adminModal);
            viewModal.show();
        }
    } catch (error) {
        console.error('Error showing admin modal:', error);
        showToast('Error: Failed to load admin details', 'error');
    }
}

/**
 * Update admin information in the modal
 * @param {Object} data - The admin data
 */
function updateAdminInfo(data) {
    const adminIdElement = document.getElementById('adminId');
    const adminNameElement = document.getElementById('adminName');
    const adminStatusElement = document.getElementById('adminStatus');
    const adminRoleElement = document.getElementById('adminRole');
    const adminImageElement = document.getElementById('adminImage');
    const adminAccessLevelElement = document.getElementById('adminAccessLevel');
    
    if (adminNameElement) adminNameElement.textContent = `${data.first_name} ${data.last_name}` || data.name || '';
    if (adminIdElement) adminIdElement.textContent = data.id || data.user_id || '';
    if (adminRoleElement) adminRoleElement.textContent = data.role || data.admin_role || 'Administrator';
    
    if (adminAccessLevelElement) {
        const accessLevel = data.access_level || 'full';
        const badgeClass = accessLevel === 'limited' ? 'bg-warning-subtle text-warning' : 'bg-primary-subtle text-primary';
        const accessText = accessLevel === 'limited' ? 'Limited Access' : 'Full Access';
        
        adminAccessLevelElement.innerHTML = `
            <span class="badge ${badgeClass}">${accessText}</span>
            ${accessLevel === 'limited' ? '<small class="d-block mt-1 text-muted">(Read-only access: cannot create, update, delete, or change status of records)</small>' : ''}
        `;
    }
    
    if (adminStatusElement) {
        const isActive = data.is_active !== undefined ? data.is_active : (data.status === 'Active');
        adminStatusElement.textContent = isActive ? 'Active' : 'Inactive';
        adminStatusElement.className = isActive
            ? 'badge bg-success-subtle text-success'
            : 'badge bg-danger-subtle text-danger';
    }
    
    if (adminImageElement) {
        let imagePath = '/static/images/profile.png';
        
        if (data.profile_img) {
            if (data.profile_img.startsWith('/') || data.profile_img.startsWith('http')) {
                imagePath = data.profile_img;
            } else {
                imagePath = `/static/images/${data.profile_img}`;
            }
        }
        
        adminImageElement.src = imagePath;
        adminImageElement.style.display = 'block';
        adminImageElement.style.width = '100px';
        adminImageElement.style.height = '100px';
        adminImageElement.style.objectFit = 'cover';
        adminImageElement.classList.add('rounded-circle');
        adminImageElement.alt = `${data.first_name} ${data.last_name}` || data.name || 'Administrator';
    }
}

/**
 * Display permissions for the admin
 * @param {Object} data - The admin data
 */
function displayPermissions(data) {
    const permissionsDiv = document.getElementById('adminPermissions');
    if (!permissionsDiv) return;
    
    if (!data.permissions && !data.access_roles) {
        permissionsDiv.innerHTML = `
            <div class="list-group-item text-center py-3 text-muted">
                <i class="bi bi-shield-lock fs-3"></i>
                <p class="mb-0 mt-2">No permission information available.</p>
            </div>
        `;
        return;
    }
    
    const permissions = data.permissions || data.access_roles || [];
    const accessLevel = data.access_level || 'full';
    
    if (Array.isArray(permissions) && permissions.length > 0) {
        const listGroup = document.createElement('div');
        listGroup.className = 'list-group';
        permissionsDiv.innerHTML = '';
        permissionsDiv.appendChild(listGroup);
        
        permissions.forEach(permission => {
            appendPermissionItem(listGroup, permission, accessLevel);
        });
    } else {
        permissionsDiv.innerHTML = `
            <div class="list-group-item text-center py-3 text-muted">
                <i class="bi bi-shield-lock fs-3"></i>
                <p class="mb-0 mt-2">This admin has no specific permissions assigned.</p>
            </div>
        `;
    }
}

/**
 * Append a permission item to the list group
 * @param {HTMLElement} container - The container to append to
 * @param {Object|string} permission - The permission data or permission name
 * @param {string} accessLevel - The admin's access level (full or limited)
 */
function appendPermissionItem(container, permission, accessLevel = 'full') {
    const item = document.createElement('div');
    item.className = 'list-group-item permission-item';
    
    let permissionName, permissionDesc;
    
    if (typeof permission === 'string') {
        permissionName = permission;
        permissionDesc = getPermissionDescription(permission);
    } else {
        permissionName = permission.name || permission.role || 'Unknown Permission';
        permissionDesc = permission.description || getPermissionDescription(permissionName);
    }
    
    const isLimited = accessLevel === 'limited';
    const isCRUDPermission = checkIfCRUDPermission(permissionName);
    const isGranted = !isLimited || !isCRUDPermission;
    
    const badgeClass = isGranted ? 'bg-primary-subtle text-primary' : 'bg-danger-subtle text-danger';
    const badgeText = isGranted ? 'Granted' : 'Not Granted';
    
    item.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <h6 class="mb-1">${permissionName}</h6>
                <p class="mb-0 text-muted small">${permissionDesc}</p>
            </div>
            <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
    `;
    
    container.appendChild(item);
}

/**
 * Check if a permission is related to CRUD operations
 * @param {string} permissionName - The permission name
 * @returns {boolean} - True if the permission involves CRUD operations
 */
function checkIfCRUDPermission(permissionName) {
    const crudPermissions = [
        'user_management',
        'class_management',
        'enrollment_management',
        'attendance_tracking',
        'system_settings'
    ];
    
    const normalizedName = permissionName.toLowerCase().replace(/\s+/g, '_');
    return crudPermissions.includes(normalizedName);
}

/**
 * Get a human-readable description for common permissions
 * @param {string} permissionName - The permission name
 * @returns {string} - The permission description
 */
function getPermissionDescription(permissionName) {
    const descriptions = {
        'user_management': 'Can view, add, edit, and delete user accounts',
        'class_management': 'Can create, edit, and manage class schedules',
        'enrollment_management': 'Can manage student enrollments in classes',
        'attendance_tracking': 'Can record and edit attendance records',
        'report_generation': 'Can generate and view system reports',
        'system_settings': 'Can configure system-wide settings',
        'admin_access': 'Full administrative access to all system functions',
        'instructor_management': 'Can manage instructor accounts and assignments',
        'student_management': 'Can manage student accounts and records',
        'super_admin': 'Unrestricted access to all system functions and settings'
    };
    
    const normalizedName = permissionName.toLowerCase().replace(/\s+/g, '_');
    return descriptions[normalizedName] || `Access to ${permissionName.replace(/_/g, ' ')} functionality`;
}

/**
 * Update modal footer with appropriate buttons
 * @param {string} adminId - The admin ID
 */
function updateModalFooter(adminId) {
    const viewModalFooter = document.querySelector('#viewAdminModal .modal-footer');
    if (!viewModalFooter) return;
    
    viewModalFooter.innerHTML = '';
    viewModalFooter.style.display = 'flex';
    viewModalFooter.style.justifyContent = 'space-between';
    
    const leftContainer = document.createElement('div');
    const rightContainer = document.createElement('div');
    viewModalFooter.appendChild(leftContainer);
    viewModalFooter.appendChild(rightContainer);
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn btn-secondary';
    closeButton.setAttribute('data-bs-dismiss', 'modal');
    closeButton.textContent = 'Close';
    
    // Add event handler to use shared modal utility if available
    if (window.ModalHelpers && window.ModalHelpers.hideModal) {
        closeButton.addEventListener('click', function() {
            window.ModalHelpers.hideModal('viewAdminModal');
        });
    }
    
    rightContainer.appendChild(closeButton);
}

// Make the function available globally
window.showAdminModalView = showAdminModalView; 