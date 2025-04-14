/**
 * Instructor Modal View
 * Handles displaying instructor details in a modal
 */

/**
 * Clean up the modal backdrop to prevent it from persisting
 * @param {string} modalId - Optional ID of the modal element to clean up
 */
function cleanupModalBackdrop(modalId) {
    try {
        if (modalId) {
            // Only clean up specific modal
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                // Try to use Bootstrap's API first
                try {
                    const bsModal = bootstrap.Modal.getInstance(modalElement);
                    if (bsModal) {
                        bsModal.hide();
                    }
                } catch (err) {
                    // Not a problem if Bootstrap instance not found
                }
                
                // Find and remove only backdrops that belong to this modal
                const backdropForModal = document.querySelector(`.modal-backdrop[data-modal-id="${modalId}"]`);
                if (backdropForModal) {
                    backdropForModal.remove();
                }
            }
        } else {
            // Only remove "stray" backdrops - those that don't have a visible modal
            const visibleModals = Array.from(document.querySelectorAll('.modal.show'));
            if (visibleModals.length === 0) {
                // No visible modals, safe to remove all backdrops
                document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
                    backdrop.remove();
                });
                
                // Only reset body classes if no modals are visible
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('padding-right');
                document.body.style.removeProperty('overflow');
            }
        }
    } catch (error) {
        console.error('Error cleaning up modal backdrop:', error);
    }
}

/**
 * Show instructor details in a modal
 * @param {Object} userData - The instructor data from the API
 */
async function showInstructorModalView(userData) {
    try {
        const instructorModal = document.getElementById('viewInstructorModal');
        if (!instructorModal) {
            showToast('Error: Instructor view modal not found', 'error');
            return;
        }

        const instructorData = userData;
        updateInstructorInfo(instructorData);
        displayClasses(instructorData);
        updateModalFooter(instructorData.id || instructorData.user_id);
        
        // Try using jQuery if available
        if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
            // Using jQuery to avoid Bootstrap modal issues - allow backdrop click to close
            $(instructorModal).modal({
                backdrop: true,  // true allows clicking outside to close
                keyboard: true   // allow ESC key to close
            });
            
            // Clean up when the modal is hidden
            $(instructorModal).one('hidden.bs.modal', function() {
                // Clean up backdrops
                $('.modal-backdrop').remove();
                $('body').removeClass('modal-open').css('padding-right', '').css('overflow', '');
            });
            
            return; // Exit if jQuery method was used
        }
        
        // Direct DOM manipulation if jQuery is not available
        // First, clean up any existing backdrop elements
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        
        // Reset body styles
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');
        
        // Add modal classes
        instructorModal.classList.add('show');
        instructorModal.style.display = 'block';
        instructorModal.setAttribute('aria-modal', 'true');
        instructorModal.removeAttribute('aria-hidden');
        
        // Add body classes
        document.body.classList.add('modal-open');
        
        // Create and append backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
        
        // Set up close handlers
        const closeButtons = instructorModal.querySelectorAll('[data-bs-dismiss="modal"]');
        closeButtons.forEach(button => {
            button.addEventListener('click', closeModal);
        });
        
        // Add backdrop click handler to close modal when clicking outside
        instructorModal.addEventListener('click', function(event) {
            // Check if the click was directly on the modal element (backdrop) and not on its children
            if (event.target === instructorModal) {
                closeModal();
            }
        });
        
        // Also add backdrop click handler
        backdrop.addEventListener('click', closeModal);
        
        // Function to close the modal
        function closeModal() {
            instructorModal.classList.remove('show');
            instructorModal.style.display = 'none';
            instructorModal.setAttribute('aria-hidden', 'true');
            instructorModal.removeAttribute('aria-modal');
            
            // Remove the backdrop
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            
            // Reset body
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('overflow');
            
            // Remove event listeners
            closeButtons.forEach(button => {
                button.removeEventListener('click', closeModal);
            });
            instructorModal.removeEventListener('click', arguments.callee);
            if (backdrop.parentNode) {
                backdrop.removeEventListener('click', closeModal);
            }
        }
        
    } catch (error) {
        console.error('Error showing instructor modal:', error);
        showToast('Error: Failed to load instructor details', 'error');
    }
}

/**
 * Update instructor information in the modal
 * @param {Object} data - The instructor data
 */
function updateInstructorInfo(data) {
    // Directly update critical elements with null checks
    const instructorIdElement = document.getElementById('instructorId');
    const instructorNameElement = document.getElementById('instructorName');
    const instructorStatusElement = document.getElementById('instructorStatus');
    const instructorDepartmentElement = document.getElementById('instructorDepartment');
    const totalClassesElement = document.getElementById('totalClasses');
    const instructorImageElement = document.getElementById('instructorImage');
    
    // Handle name with better fallbacks
    if (instructorNameElement) {
        let displayName = '';
        
        // Try different name formats
        if (data.name && typeof data.name === 'string' && data.name.trim() !== '') {
            // Use name if it exists
            displayName = data.name;
        } else if (data.first_name && data.last_name) {
            // Combine first and last name
            displayName = `${data.first_name} ${data.last_name}`;
        } else if (data.firstName && data.lastName) {
            // Try camelCase format
            displayName = `${data.firstName} ${data.lastName}`;
        } else if (data.full_name) {
            // Try full_name
            displayName = data.full_name;
        }
        
        // If still empty, check if we have a user_id as fallback
        if (!displayName || displayName.trim() === '' || displayName.includes('undefined')) {
            displayName = data.user_id ? `Instructor ${data.user_id}` : 'Unnamed Instructor';
        }
        
        instructorNameElement.textContent = displayName;
    }
    
    // Extract instructor ID once to use consistently
    const idValue = data.id || data.user_id || '';
    
    // First, try the standard approach with the ID
    if (instructorIdElement) {
        instructorIdElement.textContent = idValue;
    }

    // Update or create Instructor ID paragraph if necessary
    const modalBody = document.querySelector('#viewInstructorModal .modal-body');
    if (modalBody) {
        let idP = modalBody.querySelector('p#instructorIdDisplay');
        if (!idP) {
            // Find existing paragraph with the text if ID not present
            const paragraphs = modalBody.querySelectorAll('p');
            idP = Array.from(paragraphs).find(p => p.textContent.includes('Instructor ID:'));
            
            if (!idP) { // If still not found, create it
                idP = document.createElement('p');
                idP.id = 'instructorIdDisplay'; 
                // Try to insert it logically, e.g., before department or after name
                const departmentEl = document.getElementById('instructorDepartment');
                const nameEl = document.getElementById('instructorName');
                const referenceNode = departmentEl?.closest('p') || nameEl?.closest('div')?.nextElementSibling;
                modalBody.insertBefore(idP, referenceNode);
            }
        }
        // Update the content securely
        idP.innerHTML = `Instructor ID: <span style='font-weight: normal;'>${idValue}</span>`; 
    }
    
    // Handle department
    if (instructorDepartmentElement) {
        instructorDepartmentElement.textContent = data.department || 'N/A';
    }
    
    // Set status with appropriate styling
    if (instructorStatusElement) {
        const isActive = data.is_active !== undefined ? data.is_active : (data.status === 'Active');
        instructorStatusElement.textContent = isActive ? 'Active' : 'Inactive';
        instructorStatusElement.className = isActive
            ? 'badge bg-success-subtle text-success'
            : 'badge bg-danger-subtle text-danger';
    }
    
    // Handle instructor image with special care
    if (instructorImageElement) {
        // Ensure default image path as fallback
        let imagePath = '/static/images/profile.png';
        
        // Use instructor image if available
        if (data.profile_img) {
            // Check various path formats
            if (data.profile_img.startsWith('/')) {
                // Absolute path starting with /
                imagePath = data.profile_img;
            } else if (data.profile_img.startsWith('http')) {
                // Full URL
                imagePath = data.profile_img;
            } else {
                // Relative path, add prefix
                imagePath = `/static/images/${data.profile_img}`;
            }
        }
        
        // Apply the image path
        instructorImageElement.src = imagePath;
        
        // Ensure image is visible and properly styled
        instructorImageElement.style.display = 'block';
        instructorImageElement.style.width = '100px';
        instructorImageElement.style.height = '100px';
        instructorImageElement.style.objectFit = 'cover';
        instructorImageElement.classList.add('rounded-circle');
        
        // Set alt text with the instructor name or fallback
        const altText = instructorNameElement ? instructorNameElement.textContent : 'Instructor Profile';
        instructorImageElement.alt = altText;
    }
}

/**
 * Display classes for the instructor
 * @param {Object} data - The instructor data
 */
function displayClasses(data) {
    const assignedClassesDiv = document.getElementById('assignedClasses');
    if (!assignedClassesDiv) return;
    
    if (!data.classes_taught && !data.classes) {
        assignedClassesDiv.innerHTML = `
            <div class="list-group-item text-center py-3 text-muted">
                <i class="bi bi-inbox fs-3"></i>
                <p class="mb-0 mt-2">No class information available.</p>
            </div>
        `;
        const totalClassesElement = document.getElementById('totalClasses');
        if (totalClassesElement) totalClassesElement.textContent = '0';
        return;
    }
    
    const classes = data.classes_taught || data.classes || [];
    
    const totalClassesElement = document.getElementById('totalClasses');
    if (totalClassesElement) totalClassesElement.textContent = classes.length.toString();
    
    if (Array.isArray(classes) && classes.length > 0) {
        // Sort classes - active first, then by name
        const sortedClasses = [...classes].sort((a, b) => {
            // First sort by active status (active first)
            const aActive = a.is_active || false;
            const bActive = b.is_active || false;
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            // Then sort by name
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName);
        });
        
        // Create list group
        const listGroup = document.createElement('div');
        listGroup.className = 'list-group';
        assignedClassesDiv.innerHTML = '';
        assignedClassesDiv.appendChild(listGroup);
        
        // Add classes to list group
        sortedClasses.forEach(cls => {
            appendClassItem(listGroup, cls);
        });
    } else {
        assignedClassesDiv.innerHTML = `
            <div class="list-group-item text-center py-3 text-muted">
                <i class="bi bi-inbox fs-3"></i>
                <p class="mb-0 mt-2">This instructor is not teaching any classes.</p>
            </div>
        `;
        if (totalClassesElement) totalClassesElement.textContent = '0';
    }
}

/**
 * Append a class item to the list group
 * @param {HTMLElement} container - The container to append to
 * @param {Object} cls - The class data
 */
function appendClassItem(container, cls) {
    const item = document.createElement('div');
    item.className = 'list-group-item';
    
    // Create badge class based on status
    const isActive = cls.is_active !== undefined ? cls.is_active : false;
    const badgeClass = isActive
        ? 'bg-success-subtle text-success'
        : 'bg-secondary-subtle text-secondary';
    
    item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <h6 class="mb-0">${cls.name || 'Unnamed Class'}</h6>
                <div class="d-flex gap-3 text-muted small">
                    <span><i class="bi bi-calendar-event me-1"></i>${cls.day || cls.schedule || 'No schedule'}</span>
                    <span><i class="bi bi-clock me-1"></i>${cls.time || 'No time set'}</span>
                    <span><i class="bi bi-people me-1"></i>${cls.enrolled_count || cls.student_count || '0'} Students</span>
                </div>
            </div>
            <span class="badge ${badgeClass}">
                ${isActive ? 'Active' : 'Inactive'}
            </span>
        </div>
    `;
    
    container.appendChild(item);
}

/**
 * Update modal footer with appropriate buttons
 * @param {string} instructorId - The instructor ID
 */
function updateModalFooter(instructorId) {
    const viewModalFooter = document.querySelector('#viewInstructorModal .modal-footer');
    if (!viewModalFooter) return;
    
    // Clear existing footer content
    viewModalFooter.innerHTML = '';
    
    // Set footer style to flex with space-between
    viewModalFooter.style.display = 'flex';
    viewModalFooter.style.justifyContent = 'space-between';
    
    // Add actions at the left
    const leftContainer = document.createElement('div');
    viewModalFooter.appendChild(leftContainer);
    
    // Check if the user has class management access
    const hasClassAccess = document.getElementById('classManagementPage') !== null;
    
    if (hasClassAccess) {
        const classesButton = document.createElement('button');
        classesButton.className = 'btn btn-primary me-2';
        classesButton.style.backgroundColor = '#191970';
        classesButton.innerHTML = '<i class="bi bi-journal-check me-2"></i>Manage Classes';
        
        // Set a custom event handler
        classesButton.addEventListener('click', () => {
            // Close the current modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('viewInstructorModal'));
            if (modal) modal.hide();
            
            // Navigate to class management for this instructor
            setTimeout(() => {
                window.location.href = `/admin/class-management?instructor_id=${instructorId}`;
            }, 300);
        });
        
        leftContainer.appendChild(classesButton);
    }
    
    // Add the close button on the right
    const rightContainer = document.createElement('div');
    viewModalFooter.appendChild(rightContainer);
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn btn-secondary';
    closeButton.setAttribute('data-bs-dismiss', 'modal');
    closeButton.textContent = 'Close';
    
    rightContainer.appendChild(closeButton);
}

// Make the functions available globally
window.showInstructorModalView = showInstructorModalView; 
window.cleanupModalBackdrop = cleanupModalBackdrop; 