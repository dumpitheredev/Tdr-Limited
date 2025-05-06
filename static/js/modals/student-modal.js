/**
 * Student Modal View
 * Handles displaying student details in a modal
 */

// Track if modal is currently being initialized to prevent double initialization
let isModalInitializing = false;

// Modal ID constants for better maintainability
const MODAL_IDS = {
    VIEW_STUDENT: 'viewStudentModal',
    EDIT_STUDENT: 'editStudentModal',
    ARCHIVE_STUDENT: 'confirmArchiveModal',
    ADD_STUDENT: 'addStudentModal'
};

/**
 * Clean up the modal backdrop to prevent it from persisting
 * @param {string} modalId - Optional ID of the modal element to clean up
 */
function cleanupModalBackdrop(modalId) {
    // Use the shared utility function if available
    if (window.ModalHelpers && window.ModalHelpers.cleanupModalBackdrop) {
        return window.ModalHelpers.cleanupModalBackdrop(modalId);
    }
    
    // Fallback implementation if the utility is not available
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
        console.error('Error cleaning up modal backdrop');
    }
}

/**
 * Clear the student modal content to prevent showing previous student's data
 * @param {string} modalId - Optional ID of the modal to clear (defaults to VIEW_STUDENT)
 */
function clearStudentModalContent(modalId = MODAL_IDS.VIEW_STUDENT) {
    // Reset basic student info
    const infoElements = {
        'studentName': '',
        'studentId': '',
        'studentCompany': '',
        'studentStatus': '',
        'studentImage': '/static/images/profile.png'
    };
    
    // Reset each element
    Object.entries(infoElements).forEach(([id, defaultValue]) => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'studentImage') {
                element.src = defaultValue;
            } else {
                element.textContent = defaultValue;
            }
        }
    });
    
    // Clear enrollments
    const enrolledClassesDiv = document.getElementById('enrolledClasses');
    if (enrolledClassesDiv) {
        enrolledClassesDiv.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading enrollments...</p></div>';
    }
    
    // Clear attendance table
    const attendanceContainer = document.getElementById('attendance-records-container');
    if (attendanceContainer) {
        attendanceContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Loading attendance records...</p></div>';
    }
    
    // Reset attendance stats
    updateStudentModalAttendanceStats(0, 0, 0, 0);
    
    // Clear date filters
    const startDateInput = document.getElementById('modalStartDate');
    const endDateInput = document.getElementById('modalEndDate');
    
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    
    // Reset current student ID
    currentStudentId = null;
}

/**
 * Shows the student view modal with data from the API
 * @param {string|object} studentData - Either a student ID string or a student object
 * @param {function} onClose - Optional callback function to execute when the modal is closed
 * @param {string} modalId - Optional modal ID to use (defaults to MODAL_IDS.VIEW_STUDENT)
 */
async function showStudentModalView(studentData, onClose = null, modalId = MODAL_IDS.VIEW_STUDENT) {
    // Extract student ID if an object was passed
    let studentId = studentData;
    let studentObj = null;
    
    if (typeof studentData === 'object' && studentData !== null) {
        studentId = studentData.id || studentData.student_id || studentData.user_id;
        studentObj = studentData; // Save the object for use if valid
    }
    
    // Prevent double initialization
    if (isModalInitializing) {
        console.warn('Modal initialization already in progress');
        return;
    }
    
    isModalInitializing = true;
    
    try {
        // Only clean up stray backdrops, don't remove all backdrops aggressively
        cleanupModalBackdrop();

        const studentModal = document.getElementById(modalId);
        if (!studentModal) {
            showToast('Error: Student view modal not found', 'error');
            isModalInitializing = false;
            return;
        }
        
        // Clear previous content to prevent showing old data
        clearStudentModalContent(modalId);
        
        // Remember current student ID for refreshing
        currentStudentId = studentId;

        // Add attendance table styles to document
        if (typeof addAttendanceTableStyles === 'function') {
            addAttendanceTableStyles();
        }

        // If we have a valid student object, use it directly
        if (studentObj) {
            // Update UI with initial data
            updateStudentInfo(studentObj);
            displayEnrollments(studentObj);
            updateModalFooter(studentId);
        }
        
        // Initialize date pickers for attendance filtering
        setTimeout(() => {
            initializeAttendanceDatePickers('modal');
        }, 100);
        
        // Initialize modal with proper backdrop handling
        let viewModal;
        try {
            // Get existing modal instance
            viewModal = bootstrap.Modal.getInstance(studentModal);
            if (!viewModal) {
                // Create new modal instance with backdrop and keyboard options
                viewModal = new bootstrap.Modal(studentModal, {
                    backdrop: true, // Enable clicking outside to close
                    keyboard: true  // Enable ESC key to close
                });
            }
        } catch (e) {
            viewModal = new bootstrap.Modal(studentModal, {
                backdrop: true,
                keyboard: true
            });
        }
        
        // Add click handler for backdrop
        studentModal.addEventListener('click', function(event) {
            // Check if click was on the modal backdrop (modal-dialog is the inner container)
            if (event.target === studentModal) {
                viewModal.hide();
            }
        });
        
        // Show the modal
        viewModal.show();
        
        // Check that the stats elements are properly initialized
        verifyStatsElements();
        
        // Ensure stats display valid numbers
        setTimeout(ensureValidStatsDisplay, 200);
        
        // Fetch fresh data in the background after showing the modal
        if (studentId) {
            fetch(`/api/users/${studentId}`)
                .then(response => {
                    if (response.ok) return response.json();
                    throw new Error('Failed to fetch fresh student data');
                })
                .then(freshData => {
                    // Only update if modal is still open
                    if (studentModal.classList.contains('show')) {
                        // If we didn't have student data before, now we do
                        if (!studentObj) {
                            studentObj = freshData;
                            updateStudentInfo(freshData);
                            displayEnrollments(freshData);
                            updateModalFooter(studentId);
                        } else {
                            // Just update with fresher data
                            updateStudentInfo(freshData);
                            if (freshData.enrollments || freshData.classes) {
                                displayEnrollments(freshData);
                            }
                        }
                        
                        // Load attendance data for the student - do this every time
                        loadAttendanceForStudent(studentId);
                        
                        // Verify stats elements again after loading data
                        setTimeout(verifyStatsElements, 1000);
                        setTimeout(ensureValidStatsDisplay, 1500);
                        
                        // Also check for late badges to update the late count
                        setTimeout(updateLateCountFromDOM, 1500);
                        setTimeout(updateLateCountFromDOM, 2500);
                    }
                })
                .catch((error) => {
                    // Silent failure, already showing data from initial payload
                });
        }
        
        // Clean up on modal close - use Bootstrap's event with once:true to prevent multiple handlers
        studentModal.addEventListener('hidden.bs.modal', function() {
            cleanupModalBackdrop(modalId);
            // Remove the click handler to prevent memory leaks
            studentModal.removeEventListener('click', arguments.callee);
            // Execute onClose callback if provided
            if (typeof onClose === 'function') {
                onClose();
            }
        }, { once: true });
        
        // Make the layout responsive using a media query
        adjustEnrollmentLayout();
        window.addEventListener('resize', adjustEnrollmentLayout);
        
        isModalInitializing = false;
    } catch (error) {
        console.error('[STUDENT MODAL] Error:', error);
        showToast('Error: Failed to load student details', 'error');
        isModalInitializing = false;
    }
}

/**
 * Verifies that all stats elements are properly visible and initialized
 */
function verifyStatsElements() {
    try {
        // Only log verification if debug mode is enabled or first run
        if (!window._statsVerificationRun) {
            window._statsVerificationRun = true;
        }
        
        const statsElements = {
            present: document.getElementById('totalPresent'),
            late: document.getElementById('totalLate'),
            absent: document.getElementById('totalAbsence'),
            percentage: document.getElementById('attendancePercentage')
        };
        
        // Check each element and fix issues without excessive logging
        Object.entries(statsElements).forEach(([name, element]) => {
            if (!element) {
                // Only log critical errors
                console.error(`[STUDENT MODAL] ${name} element not found`);
                return;
            }
            
            const computedStyle = window.getComputedStyle(element);
            
            // Force element to be visible without logging
            if (computedStyle.visibility !== 'visible' || computedStyle.display === 'none') {
                element.style.visibility = 'visible';
                element.style.display = 'block';
            }
            
            // For percentage, ensure it has a value without logging
            if (name === 'percentage' && (!element.textContent || element.textContent === '0%')) {
                element.innerHTML = '0%';
            }
        });
        
        // Schedule another check after a delay but don't log the results
        setTimeout(() => {
            try {
                Object.entries(statsElements).forEach(([name, element]) => {
                    if (element) {
                        // Fix any visibility issues that might have occurred after initial check
                        const computedStyle = window.getComputedStyle(element);
                        if (computedStyle.visibility !== 'visible' || computedStyle.display === 'none') {
                            element.style.visibility = 'visible';
                            element.style.display = 'block';
                        }
                    }
                });
            } catch (error) {
                // Silent failure to reduce console noise
            }
        }, 500);
    } catch (error) {
        // Silent failure to reduce console noise
    }
}

/**
 * Update student information in the modal
 * @param {Object} data - The student data
 */
function updateStudentInfo(data) {
    const studentIdElement = document.getElementById('studentId');
    const studentNameElement = document.getElementById('studentName');
    const studentStatusElement = document.getElementById('studentStatus');
    const studentCompanyElement = document.getElementById('studentCompany');
    const studentImageElement = document.getElementById('studentImage');
    
    if (studentNameElement) studentNameElement.textContent = `${data.first_name} ${data.last_name}` || data.name || '';
    
    // Improved student ID display with better formatting
    if (studentIdElement) {
        const studentId = data.id || data.user_id || data.studentId || '';
        studentIdElement.textContent = studentId;
    }
    
    if (studentCompanyElement) {
        studentCompanyElement.innerHTML = '<small><i>Loading company info...</i></small>';
        
        if (data.company_data) {
            const companyName = data.company_data.name || 'Unknown Company';
            const companyId = data.company_data.id || data.company_data.company_id;
            
            if (companyId) {
                studentCompanyElement.innerHTML = `
                    <a href="/admin/company-management?company_id=${companyId}" class="company-link" title="View company details">
                        ${companyName}
                    </a>
                    <span class="company-badge">${data.company_data.industry || ''}</span>
                `;
            } else {
                studentCompanyElement.innerHTML = `<span>${companyName}</span>`;
            }
            
            let tooltipContent = '';
            if (data.company_data.address) tooltipContent += `Address: ${data.company_data.address}<br>`;
            if (data.company_data.email) tooltipContent += `Email: ${data.company_data.email}<br>`;
            
            if (tooltipContent) {
                try {
                    const tooltip = new bootstrap.Tooltip(studentCompanyElement, {
                        title: tooltipContent,
                        html: true,
                        placement: 'bottom'
                    });
                } catch (e) {
                    studentCompanyElement.setAttribute('title', tooltipContent.replace(/<br>/g, ', '));
                }
            }
            
            // Update company tooltip if it exists
            if (data.company_data && Object.keys(data.company_data).length > 0) {
                const companyData = data.company_data;
                let tooltipContent = `<strong>${companyData.name || 'Company'}</strong><br>`;
                if (companyData.address) tooltipContent += `Address: ${companyData.address}`;
                
                // Set tooltip if there's meaningful content
                const companyElement = document.getElementById('studentCompany');
                if (companyElement) {
                    if (tooltipContent.includes('Address:')) {
                        new bootstrap.Tooltip(companyElement, {
                            title: tooltipContent,
                            html: true,
                            placement: 'top'
                        });
                    }
                }
            }
            
            return;
        }
        
        let companyId = null;
        
        if (data.company_id) {
            companyId = data.company_id;
        } else if (data.companyId) {
            companyId = data.companyId;
        } else if (data.company) {
            if (typeof data.company === 'object') {
                companyId = data.company.id || data.company.company_id || data.company.companyId;
            } else if (typeof data.company === 'string') {
                const looksLikeId = /^[0-9a-zA-Z_-]+$/.test(data.company) && data.company.length < 20;
                if (looksLikeId) {
                    companyId = data.company;
                } else {
                    studentCompanyElement.innerHTML = `<span class="text-muted">${data.company}</span>`;
                    return;
                }
            }
        }
        
        if (companyId) {
            fetch(`/api/companies/${companyId}`)
                .then(response => {
                    if (response.status === 404) {
                        throw new Error('company_not_found');
                    } else if (!response.ok) {
                        throw new Error('api_error');
                    }
                    return response.json();
                })
                .then(companyData => {
                    const companyName = companyData.name || 'Unknown Company';
                    studentCompanyElement.innerHTML = `
                        <a href="/admin/company-management?company_id=${companyId}" class="company-link" title="View company details">
                            ${companyName}
                        </a>
                        <span class="company-badge">${companyData.industry || ''}</span>
                    `;

                    let tooltipContent = '';
                    if (companyData.address) tooltipContent += `Address: ${companyData.address}<br>`;
                    if (companyData.email) tooltipContent += `Email: ${companyData.email}<br>`;
                    
                    if (tooltipContent) {
                        try {
                            const tooltip = new bootstrap.Tooltip(studentCompanyElement, {
                                title: tooltipContent,
                                html: true,
                                placement: 'bottom'
                            });
                        } catch (e) {
                            studentCompanyElement.setAttribute('title', tooltipContent.replace(/<br>/g, ', '));
                        }
                    }
                })
                .catch(error => {
                    // Handle error without logging to console
                    
                    if (error.message === 'company_not_found') {
                        studentCompanyElement.innerHTML = `
                            <span class="text-muted">Unknown Company</span>
                            <span class="company-badge">ID: ${companyId}</span>
                        `;
                    } else if (error.message === 'api_error') {
                        const companyName = extractCompanyName(data);
                        studentCompanyElement.innerHTML = `<span class="text-muted">${companyName || 'Company data unavailable'}</span>`;
                    } else {
                        const companyName = extractCompanyName(data);
                        studentCompanyElement.innerHTML = `<span class="text-muted">${companyName || 'Company ID: ' + companyId}</span>`;
                    }
                });
        } else {
            const directCompanyName = extractCompanyName(data);
            if (directCompanyName) {
                studentCompanyElement.innerHTML = `<span class="text-muted">${directCompanyName}</span>`;
            } else {
                studentCompanyElement.innerHTML = '<span class="text-muted fst-italic">Not Assigned</span>';
            }
        }
    }
    
    if (studentStatusElement) {
        const isActive = data.is_active !== undefined ? data.is_active : (data.status === 'Active');
        studentStatusElement.textContent = isActive ? 'Active' : 'Inactive';
        studentStatusElement.className = isActive
            ? 'badge bg-success-subtle text-success'
            : 'badge bg-danger-subtle text-danger';
    }
    
    if (studentImageElement) {
        let imagePath = '/static/images/profile.png';
        
        if (data.profile_img) {
            if (data.profile_img.startsWith('/')) {
                imagePath = data.profile_img;
            } else if (data.profile_img.startsWith('http')) {
                imagePath = data.profile_img;
            } else {
                imagePath = `/static/images/${data.profile_img}`;
            }
        }
        
        studentImageElement.src = imagePath;
        studentImageElement.style.display = 'block';
        studentImageElement.style.width = '100px';
        studentImageElement.style.height = '100px';
        studentImageElement.style.objectFit = 'cover';
        studentImageElement.classList.add('rounded-circle');
        studentImageElement.alt = `${data.first_name} ${data.last_name}` || data.name || 'Student';
    }
}

/**
 * Display enrollments for the student
 * @param {Object} data - The student data
 */
function displayEnrollments(data) {
    const enrolledClassesDiv = document.getElementById('enrolledClasses');
    if (!enrolledClassesDiv) return;
    
    try {
        // Safety check for null/undefined data
        if (!data) {
            enrolledClassesDiv.innerHTML = `
                <div class="alert alert-info mb-0">
                    <i class="bi bi-info-circle me-2"></i>
                    No student data available.
                </div>
            `;
            return;
        }
        
        // Display message if no enrollment data available
        if (!data.enrollments && !data.classes) {
            enrolledClassesDiv.innerHTML = `
                <div class="alert alert-info mb-0">
                    <i class="bi bi-info-circle me-2"></i>
                    No enrollment information available.
                </div>
            `;
            return;
        }
        
        // Use available enrollment data - get active and historical enrollments
        const enrollments = data.enrollments || data.classes || [];
        
        // Clear the container
        enrolledClassesDiv.innerHTML = '';
        
        // Create a container for better organization
        const enrollmentsContainer = document.createElement('div');
        enrollmentsContainer.className = 'enrollment-sections';
        
        // Display enrollments
        if (enrollments.length > 0) {
            // Get active enrollments - handle both object formats
            const activeEnrollments = enrollments.filter(e => {
                // Handle potential different data formats
                const status = e.status?.toLowerCase?.() || '';
                const isActive = status === 'active' || e.is_active === true;
                return isActive;
            });
            
            // Sort active enrollments by name
            const sortedActive = [...activeEnrollments].sort((a, b) => {
                const aName = a.class_name || a.name || '';
                const bName = b.class_name || b.name || '';
                return aName.localeCompare(bName);
            });
            
            // Add active enrollments header if there are any
            if (sortedActive.length > 0) {
                const activeSection = document.createElement('div');
                activeSection.className = 'mb-3';
                
                const activeHeader = document.createElement('div');
                activeHeader.className = 'mb-3 border-bottom pb-2';
                activeHeader.innerHTML = '<h6 class="m-0"><i class="bi bi-circle-fill text-success me-2" style="font-size: 10px;"></i>Active Enrollments</h6>';
                activeSection.appendChild(activeHeader);
                
                // Create a grid for active enrollments
                const activeGrid = document.createElement('div');
                activeGrid.className = 'active-enrollments';
                activeGrid.style.display = 'grid';
                activeGrid.style.gap = '10px';
                activeGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                
                // Display active enrollments
                sortedActive.forEach(enrollment => {
                    // Safety check for enrollment object
                    if (!enrollment) return;
                    
                    enrollment.is_active = true;
                    appendClassCard(activeGrid, enrollment);
                });
                
                activeSection.appendChild(activeGrid);
                enrollmentsContainer.appendChild(activeSection);
            }
            
            // Get pending enrollments (previously called past enrollments)
            const pendingEnrollments = enrollments.filter(e => {
                // Handle potential different data formats
                const status = e.status?.toLowerCase?.() || '';
                // Consider 'pending' or any non-active status as pending
                const isPending = status === 'pending' || (status !== 'active' && e.is_active !== true);
                return isPending;
            });
            
            // Add pending enrollments section if there are any
            if (pendingEnrollments.length > 0) {
                const pastSection = document.createElement('div');
                pastSection.className = 'mt-4';
                
                // Add Pending Enrollments header
                const pastHeader = document.createElement('div');
                pastHeader.className = 'mb-3 border-bottom pb-2';
                pastHeader.innerHTML = '<h6 class="m-0"><i class="bi bi-circle-fill text-warning me-2" style="font-size: 10px;"></i>Pending Enrollments</h6>';
                pastSection.appendChild(pastHeader);
                
                // Create a grid for pending enrollments
                const pendingGrid = document.createElement('div');
                pendingGrid.className = 'pending-enrollments';
                pendingGrid.style.display = 'grid';
                pendingGrid.style.gap = '10px';
                pendingGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                
                // Sort pending enrollments by name
                const sortedPending = [...pendingEnrollments].sort((a, b) => {
                    const aName = a.class_name || a.name || '';
                    const bName = b.class_name || b.name || '';
                    return aName.localeCompare(bName);
                });
                
                // Display pending enrollments
                sortedPending.forEach(enrollment => {
                    // Safety check for enrollment object
                    if (!enrollment) return;
                    
                    enrollment.is_active = false;
                    enrollment.is_pending = true; // Mark as pending for styling
                    appendClassCard(pendingGrid, enrollment);
                });
                
                pastSection.appendChild(pendingGrid);
                enrollmentsContainer.appendChild(pastSection);
            }
            
            // Add the container to the main div
            enrolledClassesDiv.appendChild(enrollmentsContainer);
            
            // If no enrollments were displayed, show empty message
            if (activeEnrollments.length === 0 && pendingEnrollments.length === 0) {
                enrolledClassesDiv.innerHTML = `
                    <div class="alert alert-info mb-0">
                        <i class="bi bi-info-circle me-2"></i>
                        This student is not enrolled in any classes.
                    </div>
                `;
            }
        } else {
            enrolledClassesDiv.innerHTML = `
                <div class="alert alert-info mb-0">
                    <i class="bi bi-info-circle me-2"></i>
                    This student is not enrolled in any classes.
                </div>
            `;
        }
        
        // Make the layout responsive using a media query
        adjustEnrollmentLayout();
        window.addEventListener('resize', adjustEnrollmentLayout);
        
    } catch (error) {
        console.error('[STUDENT MODAL] Error displaying enrollments:', error);
        
        // Provide more specific error message based on the error type
        let errorMessage = 'Error loading enrollment data.';
        
        if (error.message === 'Cannot read properties of undefined' || 
            error.message.includes('null') || 
            error.message.includes('undefined')) {
            errorMessage = 'Unable to read enrollment data structure.';
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
            errorMessage = 'Network error while loading enrollment data.';
        }
        
        // Show a more helpful error message
        enrolledClassesDiv.innerHTML = `
            <div class="alert alert-warning mb-0">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${errorMessage} 
                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="refreshStudentData(currentStudentId)">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>
        `;
    }
}

/**
 * Refresh student data when retry button is clicked
 * @param {string} studentId - The student ID to refresh
 */
function refreshStudentData(studentId) {
    if (!studentId) {
        console.error('[STUDENT MODAL] Cannot refresh data: No student ID provided');
        return;
    }
    
    console.log(`[STUDENT MODAL] Refreshing data for student: ${studentId}`);
    
    // Show loading indicator in the enrollments section
    const enrolledClassesDiv = document.getElementById('enrolledClasses');
    if (enrolledClassesDiv) {
        enrolledClassesDiv.innerHTML = `
            <div class="d-flex justify-content-center my-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
    
    // Fetch fresh data from the API
    fetch(`/api/users/${studentId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Update student info with fresh data
            updateStudentInfo(data);
            
            // Update enrollments with fresh data
            displayEnrollments(data);
            
            // Refresh attendance data
            loadAttendanceForStudent(studentId);
        })
        .catch(error => {
            console.error('[STUDENT MODAL] Error refreshing student data:', error);
            
            // Show error message
            if (enrolledClassesDiv) {
                enrolledClassesDiv.innerHTML = `
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Failed to refresh student data. 
                        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="refreshStudentData('${studentId}')">
                            <i class="bi bi-arrow-clockwise"></i> Try Again
                        </button>
                    </div>
                `;
            }
        });
}

/**
 * Adjust enrollment layout based on screen size
 */
function adjustEnrollmentLayout() {
    const activeGrid = document.querySelector('.active-enrollments');
    const pendingGrid = document.querySelector('.pending-enrollments');
    
    if (window.innerWidth < 768) {
        // Switch to single column for small screens
        if (activeGrid) activeGrid.style.gridTemplateColumns = '1fr';
        if (pendingGrid) pendingGrid.style.gridTemplateColumns = '1fr';
    } else {
        // Use responsive grid for larger screens
        const columns = window.innerWidth < 992 ? 'repeat(auto-fill, minmax(250px, 1fr))' : 'repeat(auto-fill, minmax(300px, 1fr))';
        if (activeGrid) activeGrid.style.gridTemplateColumns = columns;
        if (pendingGrid) pendingGrid.style.gridTemplateColumns = columns;
    }
}

/**
 * Append a class card to the container
 * @param {HTMLElement} container - The container to append to
 * @param {Object} enrollment - The enrollment data
 */
function appendClassCard(container, enrollment) {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    card.style.overflow = 'hidden'; // Prevent content overflow
    card.style.width = '100%'; // Ensure card takes full width
    
    // Apply different styling for pending enrollments
    if (enrollment.is_active === false) {
        if (enrollment.is_pending) {
            // Pending enrollment styling
            card.style.backgroundColor = '#fff3cd'; // Light yellow background
            card.style.borderColor = '#ffeeba';
            card.style.opacity = '1';
        } else {
            // Past/historical enrollment styling
            card.style.backgroundColor = '#f8f9fa';
            card.style.borderColor = '#dee2e6';
            card.style.opacity = '0.9';
        }
    }
    
    // Get class information
    const className = enrollment.class_name || (enrollment.class ? enrollment.class.name : 'Unnamed Class');
    
    // Enhanced schedule retrieval - fetch from class model with fallbacks
    let schedule = '';
    
    // Try to get schedule from various data structures
    if (enrollment.schedule) {
        // Direct schedule property
        schedule = enrollment.schedule;
    } else if (enrollment.class && enrollment.class.schedule) {
        // From class.schedule
        schedule = enrollment.class.schedule;
    } else {
        // Try to construct from individual fields
        const dayOfWeek = enrollment.day_of_week || 
                        enrollment.day || 
                        (enrollment.class ? (enrollment.class.day_of_week || enrollment.class.day) : '');
                        
        const startTime = enrollment.start_time || 
                        (enrollment.class ? enrollment.class.start_time : '') || 
                        (enrollment.class_details ? enrollment.class_details.start_time : '');
                        
        const endTime = enrollment.end_time || 
                      (enrollment.class ? enrollment.class.endTime || enrollment.class.end_time : '') || 
                      (enrollment.class_details ? enrollment.class_details.end_time : '');
        
        // Try different combinations of fields
        if (dayOfWeek && startTime && endTime) {
            schedule = `${dayOfWeek}, ${startTime} - ${endTime}`;
        } else if (dayOfWeek && startTime) {
            schedule = `${dayOfWeek}, ${startTime}`;
        } else if (dayOfWeek) {
            schedule = dayOfWeek;
        } else if (startTime && endTime) {
            schedule = `${startTime} - ${endTime}`;
        } else {
            // Fallback to a database query if we have class_id
            if (enrollment.class_id || (enrollment.class && enrollment.class.id)) {
                const classId = enrollment.class_id || (enrollment.class && enrollment.class.id);
                
                // To avoid blocking, set a placeholder and update it later
                schedule = 'Fetching schedule...';
                
                // Fetch class details asynchronously
                fetchClassSchedule(classId).then(scheduleData => {
                    // Find the card that needs updating
                    const scheduleElement = card.querySelector('.schedule-text');
                    if (scheduleElement && scheduleData) {
                        scheduleElement.textContent = scheduleData;
                    } else if (scheduleElement) {
                        scheduleElement.textContent = 'Schedule not available';
                    }
                }).catch(err => {
                    console.error('Error fetching class schedule');
                    const scheduleElement = card.querySelector('.schedule-text');
                    if (scheduleElement) {
                        scheduleElement.textContent = 'Schedule not available';
                    }
                });
            } else {
                schedule = 'Schedule not available';
            }
        }
    }
    
    // Get status
    let status = enrollment.status || 'Pending';
    if (enrollment.unenrollment_date && status.toLowerCase() === 'active') {
        status = 'Unenrolled';
    }
    
    // Create badge class based on status
    let badgeClass = 'bg-secondary-subtle text-secondary';
    if (status.toLowerCase() === 'active') {
        badgeClass = 'bg-success-subtle text-success';
    } else if (status.toLowerCase() === 'pending') {
        badgeClass = 'bg-warning-subtle text-warning';
    } else if (status.toLowerCase() === 'completed') {
        badgeClass = 'bg-info-subtle text-info';
    } else if (status.toLowerCase().includes('unenroll')) {
        badgeClass = 'bg-secondary-subtle text-secondary';
    }
    
    // Get instructor name with enhanced fallbacks
    const instructor = enrollment.instructor_name || 
                     enrollment.instructor || 
                     (enrollment.class ? (enrollment.class.instructor_name || enrollment.class.instructor) : '') ||
                     'Not assigned';
    
    // Format dates for display
    let enrolledDate = '';
    let unenrolledDate = '';
    
    if (enrollment.enrollment_date) {
        try {
            // Parse the date (handling both YYYY-MM-DD and MM/DD/YYYY formats)
            const dateParts = enrollment.enrollment_date.split(/[-\/]/);
            const dateObj = dateParts.length === 3 && dateParts[0].length === 4 
                ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])  // YYYY-MM-DD format
                : new Date(enrollment.enrollment_date);  // Try direct parsing
            
            // Format to MM/DD/YYYY if valid date
            if (!isNaN(dateObj.getTime())) {
                enrolledDate = `<p class="text-muted small mb-0">Enrolled: ${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}/${dateObj.getFullYear()}</p>`;
            } else {
                enrolledDate = `<p class="text-muted small mb-0">Enrolled: ${enrollment.enrollment_date}</p>`;
            }
        } catch (e) {
            // Fallback to original if parsing fails
            enrolledDate = `<p class="text-muted small mb-0">Enrolled: ${enrollment.enrollment_date}</p>`;
        }
    }
    
    if (enrollment.unenrollment_date) {
        try {
            // Parse the date (handling both YYYY-MM-DD and MM/DD/YYYY formats)
            const dateParts = enrollment.unenrollment_date.split(/[-\/]/);
            const dateObj = dateParts.length === 3 && dateParts[0].length === 4 
                ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])  // YYYY-MM-DD format
                : new Date(enrollment.unenrollment_date);  // Try direct parsing
            
            // Format to MM/DD/YYYY if valid date
            if (!isNaN(dateObj.getTime())) {
                unenrolledDate = `<p class="text-muted small mb-0">Unenrolled: ${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}/${dateObj.getFullYear()}</p>`;
            } else {
                unenrolledDate = `<p class="text-muted small mb-0">Unenrolled: ${enrollment.unenrollment_date}</p>`;
            }
        } catch (e) {
            // Fallback to original if parsing fails
            unenrolledDate = `<p class="text-muted small mb-0">Unenrolled: ${enrollment.unenrollment_date}</p>`;
        }
    }
    
    // Create card content with improved layout
    card.innerHTML = `
        <div class="card-body py-2 px-3">
            <h6 class="mb-1 text-truncate" title="${className}" style="max-width: 100%;">${className}</h6>
            <div class="d-flex justify-content-between align-items-start">
                <div class="text-muted small" style="max-width: 70%; overflow-wrap: break-word;">
                    <span class="schedule-text">${schedule}</span>
                </div>
                <span class="badge ${badgeClass} ms-1">
                    ${status}
                </span>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-2">
                <div class="text-muted small text-truncate" style="max-width: 100%;" title="${instructor}">
                    ${instructor ? `<i class="bi bi-person-circle me-1"></i>${instructor}` : ''}
                </div>
            </div>
            <div class="mt-1">
                ${enrolledDate}
                ${unenrolledDate}
            </div>
        </div>
    `;
    
    container.appendChild(card);
}

/**
 * Fetch class schedule from the database
 * @param {string|number} classId - The class ID to fetch
 * @returns {Promise<string>} - A promise that resolves with the schedule string
 */
async function fetchClassSchedule(classId) {
    try {
        // API endpoint to fetch class details
        const response = await fetch(`/api/classes/${classId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch class details: ${response.status}`);
        }
        
        const classData = await response.json();
        
        // Extract schedule information
        let schedule = classData.schedule;
        
        // If no direct schedule, try to construct from components
        if (!schedule) {
            const dayOfWeek = classData.day_of_week || classData.day || '';
            const startTime = classData.start_time || '';
            const endTime = classData.end_time || '';
            
            if (dayOfWeek && startTime && endTime) {
                schedule = `${dayOfWeek}, ${startTime} - ${endTime}`;
            } else if (dayOfWeek && startTime) {
                schedule = `${dayOfWeek}, ${startTime}`;
            } else if (dayOfWeek) {
                schedule = dayOfWeek;
            } else if (startTime && endTime) {
                schedule = `${startTime} - ${endTime}`;
            } else {
                schedule = 'Schedule not available';
            }
        }
        
        return schedule;
    } catch (error) {
        console.error('Error fetching class schedule');
        return null;
    }
}

/**
 * Update modal footer with appropriate buttons
 * @param {string} studentId - The student ID
 */
function updateModalFooter(studentId) {
    const viewModalFooter = document.querySelector('#viewStudentModal .modal-footer');
    if (!viewModalFooter) return;
    
    // Clear existing footer content
    viewModalFooter.innerHTML = '';
    
    // Set footer style to flex with space-between
    viewModalFooter.style.display = 'flex';
    viewModalFooter.style.justifyContent = 'space-between';
    
    // Add edit button at the left
    const leftContainer = document.createElement('div');
    viewModalFooter.appendChild(leftContainer);
    
    // Check if we have enrollment edit access
    const hasEnrollmentAccess = document.getElementById('editEnrolmentModal') !== null;
    
    if (hasEnrollmentAccess) {
        const enrollmentButton = document.createElement('button');
        enrollmentButton.className = 'btn btn-primary me-2';
        enrollmentButton.style.backgroundColor = '#191970';
        enrollmentButton.innerHTML = '<i class="bi bi-journal-check me-2"></i>Manage Enrollments';
        
        // Set a custom event handler
        enrollmentButton.addEventListener('click', () => {
            // Close the current modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('viewStudentModal'));
            if (modal) modal.hide();
            
            // Open enrollment management for this student
            setTimeout(() => {
                if (typeof window.viewEnrolment === 'function') {
                    window.viewEnrolment(studentId);
                } else {
                    window.location.href = `/admin/enrollment-management?student_id=${studentId}`;
                }
            }, 300);
        });
        
        leftContainer.appendChild(enrollmentButton);
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

/**
 * Show a toast notification using the toast_notification.html component
 * @param {string} message - The message to display or title if a second parameter is provided
 * @param {string} type - The toast type (success, error, info, warning) or message if a third parameter is provided
 * @param {string} typeOrNull - The toast type if message and type are provided as first two parameters
 */
function showToast(message, type = 'success', typeOrNull = null) {
    // Use the global showToast function if it exists
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        return window.showToast(message, type, typeOrNull);
    }
    
    // Fallback implementation if the global function is not available
    try {
        // Determine if we're using the 2-parameter or 3-parameter version
        let title, content, toastType;
        
        if (typeOrNull === null) {
            // 2-parameter version
            if (type === 'error' || type === 'warning' || type === 'info' || type === 'success') {
                // If type is a valid toast type, use message as both title and content
                title = message;
                content = '';
                toastType = type;
            } else {
                // If type is not a valid toast type, it's probably the content
                title = message;
                content = type;
                toastType = 'info'; // Default type
            }
        } else {
            // 3-parameter version
            title = message;
            content = type;
            toastType = typeOrNull;
        }
        
        // Map type to Bootstrap color class and icon
        const typeConfig = {
            success: { color: 'success', icon: 'bi-check-circle-fill' },
            error: { color: 'danger', icon: 'bi-exclamation-circle-fill' },
            warning: { color: 'warning', icon: 'bi-exclamation-triangle-fill' },
            info: { color: 'info', icon: 'bi-info-circle-fill' }
        };
        
        // Use the mapped config or default to info
        const config = typeConfig[toastType] || typeConfig.info;
        
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        // Create a unique ID for this toast
        const toastId = 'toast-' + Date.now();
        
        // Create toast HTML
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header bg-${config.color} bg-opacity-10">
                    <i class="bi ${config.icon} me-2 text-${config.color}"></i>
                    <strong class="me-auto">${title}</strong>
                    <small>Just now</small>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                ${content ? `<div class="toast-body">${content}</div>` : ''}
            </div>
        `;
        
        // Add toast to container
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        // Initialize and show the toast
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 5000
        });
        
        // Remove toast from DOM after it's hidden
        toastElement.addEventListener('hidden.bs.toast', function() {
            toastElement.remove();
        });
        
        toast.show();
    } catch (error) {
        console.error('Error showing toast notification:', error);
        // Fallback to alert for critical messages
        if (type === 'error') {
            alert(`${message}${type && typeOrNull === null ? ': ' + type : ''}`);
        }
    }
}

/**
 * Helper function to extract company name from various data structures
 * @param {Object} data - The data object that might contain company information
 * @returns {string|null} - The extracted company name or null if not found
 */
function extractCompanyName(data) {
    // Try all possible locations for company name
    if (data.company_name) {
        return data.company_name;
    } else if (data.companyName) {
        return data.companyName;
    } else if (data.company) {
        if (typeof data.company === 'object') {
            return data.company.name || data.company.company_name || data.company.companyName || null;
        } else if (typeof data.company === 'string' && data.company.trim() !== '') {
            return data.company;
        }
    }
    
    return null;
}

/**
 * Initialize date pickers for attendance filtering
 * @param {string} context - The context ('modal' or 'page')
 */
function initializeAttendanceDatePickers(context = 'modal') {
    try {
        // Get the prefix based on context
        const prefix = context === 'modal' ? 'modal' : '';
        
        // Get the date input elements
        const startDateInput = document.getElementById(`${prefix}StartDate`);
        const endDateInput = document.getElementById(`${prefix}EndDate`);
        
        if (!startDateInput || !endDateInput) {
            console.warn(`Date inputs not found for context: ${context}`);
            return;
        }
        
        // Get the filter buttons
        const applyBtn = document.getElementById(`${prefix}ApplyDateFilter`);
        const resetBtn = document.getElementById(`${prefix}ResetDateFilter`);
        
        // Use the shared utility function if available
        if (window.ModalHelpers && window.ModalHelpers.initializeDatePickers) {
            window.ModalHelpers.initializeDatePickers(
                `${prefix}StartDate`, 
                `${prefix}EndDate`, 
                () => {
                    // On change callback
                    if (context === 'modal') {
                        const studentId = document.getElementById('studentId')?.textContent;
                        if (studentId) {
                            // Enable apply button
                            if (applyBtn) applyBtn.disabled = false;
                        }
                    }
                }
            );
        } else {
            // Fallback to original implementation
            if (typeof flatpickr === 'function') {
                // Initialize flatpickr
                initializeFlatpickr(startDateInput, endDateInput, context);
            } else {
                // Load flatpickr dynamically
                loadFlatpickrLibrary().then(() => {
                    initializeFlatpickr(startDateInput, endDateInput, context);
                }).catch(error => {
                    console.error('Failed to load flatpickr:', error);
                    // Use native date inputs as fallback
                    useFallbackDatePicker(startDateInput);
                    useFallbackDatePicker(endDateInput);
                });
            }
        }
            
        // Set up filter buttons
        if (applyBtn && resetBtn) {
            setupFilterButtons(applyBtn, resetBtn, context);
        }
            
        // Ensure we have fallback date inputs if there's an error
        try {
            const startDateInput = document.getElementById(context === 'modal' ? 'modalStartDate' : 'startDate');
            const endDateInput = document.getElementById(context === 'modal' ? 'modalEndDate' : 'endDate');
                
            if (startDateInput && !startDateInput._flatpickr) {
                useFallbackDatePicker(startDateInput);
            }
                
            if (endDateInput && !endDateInput._flatpickr) {
                useFallbackDatePicker(endDateInput);
            }
        } catch (e) {
            console.error('[ATTENDANCE] Error setting up fallback date inputs:', e);
        }
    } catch (error) {
        console.error('[ATTENDANCE] Error initializing attendance date pickers:', error);
    }
}

/**
 * Helper function to initialize Flatpickr on date inputs
 * @param {HTMLElement} startDateInput - Start date input element
 * @param {HTMLElement} endDateInput - End date input element
 * @param {string} context - The context ('modal' or 'page')
 */
function initializeFlatpickr(startDateInput, endDateInput, context) {
    try {
            // Common flatpickr options
            const flatpickrOptions = {
                dateFormat: 'Y-m-d',
                allowInput: true,
                altInput: true,
                altFormat: 'd/m/Y',
            disableMobile: true
            };
            
            // Destroy existing instances to prevent duplicates
            if (startDateInput._flatpickr) {
                startDateInput._flatpickr.destroy();
            }
            
            if (endDateInput._flatpickr) {
                endDateInput._flatpickr.destroy();
            }
            
            // Initialize start date picker
                try {
            flatpickr(startDateInput, {
                ...flatpickrOptions,
                onChange: function(selectedDates) {
                    // If start date is after end date, update end date
                    if (endDateInput._flatpickr && 
                        selectedDates.length > 0 && 
                        endDateInput._flatpickr.selectedDates.length > 0 && 
                        selectedDates[0] > endDateInput._flatpickr.selectedDates[0]) {
                        endDateInput._flatpickr.setDate(selectedDates[0]);
                    }
                }
            });

            } catch (err) {
            console.error(`[ATTENDANCE] Error initializing start date picker:`, err);
                    useFallbackDatePicker(startDateInput);
            }
            
            // Initialize end date picker
                try {
            flatpickr(endDateInput, {
                ...flatpickrOptions,
                onChange: function(selectedDates) {
                    // If end date is before start date, update start date
                    if (startDateInput._flatpickr && 
                        selectedDates.length > 0 && 
                        startDateInput._flatpickr.selectedDates.length > 0 && 
                        selectedDates[0] < startDateInput._flatpickr.selectedDates[0]) {
                        startDateInput._flatpickr.setDate(selectedDates[0]);
                    }
                }
            });
            } catch (err) {
            console.error(`[ATTENDANCE] Error initializing end date picker:`, err);
                    useFallbackDatePicker(endDateInput);
            }
    } catch (error) {
        console.error('[ATTENDANCE] Error in initializeFlatpickr:', error);
    }
}

/**
 * Setup filter buttons with event handlers
 * @param {HTMLElement} applyBtn - Apply filter button
 * @param {HTMLElement} resetBtn - Reset filter button
 * @param {string} context - The context ('modal' or 'page')
 */
function setupFilterButtons(applyBtn, resetBtn, context) {
    // Set up event listeners for the filter buttons (removing existing ones first)
    if (applyBtn) {
        // Clone and replace to remove existing listeners
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
        
        // Add new event listener
        newApplyBtn.addEventListener('click', function() {
            applyDateFilter(context);
        });
    }
    
    if (resetBtn) {
        // Remove existing event listeners to prevent duplicates
        const newResetBtn = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
        
        // Add new event listener
        newResetBtn.addEventListener('click', function() {
            resetDateFilter(context);
        });
    }
}

/**
 * Apply date filter to attendance records
 * @param {string} context - The context ('modal' or 'page')
 */
function applyDateFilter(context) {
    try {
        // Get date input elements based on context
        const startDateInput = document.getElementById(context === 'modal' ? 'modalStartDate' : 'startDate');
        const endDateInput = document.getElementById(context === 'modal' ? 'modalEndDate' : 'endDate');
        
        if (!startDateInput || !endDateInput) {
            showToast('Error: Date filter inputs not found', 'error');
            return;
        }
        
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        
        // Validate dates
        if (!startDate && !endDate) {
            showToast('Please select at least one date', 'warning');
            return;
        }
        
        // Show loading state
        showAttendanceLoading(true);
        
        // Load attendance with date filter
        loadAttendanceForStudent(currentStudentId, startDate, endDate);
    } catch (error) {
        console.error('[ATTENDANCE] Error applying date filter:', error.message);
        showToast('Error applying date filter', 'error');
    }
}

/**
 * Reset date filter and reload attendance data
 * @param {string} context - The context ('modal' or 'page')
 */
function resetDateFilter(context) {
    try {
        // Get date input elements based on context
        const startDateInput = document.getElementById(context === 'modal' ? 'modalStartDate' : 'startDate');
        const endDateInput = document.getElementById(context === 'modal' ? 'modalEndDate' : 'endDate');
        
        if (!startDateInput || !endDateInput) {
            showToast('Error: Date filter inputs not found', 'error');
            return;
        }
        
        // Clear date inputs
        startDateInput.value = '';
        endDateInput.value = '';
        
        // Reset flatpickr instances if they exist
        if (startDateInput._flatpickr) startDateInput._flatpickr.clear();
        if (endDateInput._flatpickr) endDateInput._flatpickr.clear();
        
        // Show loading state
        showAttendanceLoading(true);
        
        // Reload attendance without date filters
        loadAttendanceForStudent(currentStudentId);
    } catch (error) {
        console.error('[ATTENDANCE] Error resetting date filter:', error.message);
        showToast('Error resetting date filter', 'error');
    }
}

/**
 * Helper function to use native date input as fallback
 * @param {HTMLElement} inputElement - The input element to convert to a date field
 */
function useFallbackDatePicker(inputElement) {
    if (!inputElement) return;
    
    inputElement.type = 'date';
    inputElement.classList.add('native-date-input');
    // Remove console log message
}

/**
 * Promise-based function to load Flatpickr library
 * @returns {Promise} Promise that resolves when Flatpickr is loaded
 */
function loadFlatpickrLibrary() {
    return new Promise((resolve, reject) => {
        try {
    // Check if we already have CSS and JS for flatpickr
    const cssExists = document.querySelector('link[href*="flatpickr"]');
    const jsExists = document.querySelector('script[src*="flatpickr"]');
    
            if (typeof flatpickr === 'function') {
                // Flatpickr is already loaded and working
                resolve();
        return;
    }
    
            // Track loading status
            let loaded = {
                css: cssExists ? true : false,
                js: jsExists ? true : false
            };
            
            // Function to check if everything is loaded
            const checkLoaded = () => {
                if (loaded.css && loaded.js && typeof flatpickr === 'function') {
                    resolve();
        }
    };
    
    // Add CSS if needed
    if (!cssExists) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
                link.onload = () => {
                    loaded.css = true;
                    checkLoaded();
                };
        document.head.appendChild(link);
    }
    
    // Add JS if needed
    if (!jsExists) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
                script.onload = () => {
                    loaded.js = true;
                    checkLoaded();
                };
                document.head.appendChild(script);
            }
            
            // Set a timeout in case loading takes too long
    setTimeout(() => {
                if (!loaded.css || !loaded.js || typeof flatpickr !== 'function') {
                    reject(new Error('Timed out waiting for Flatpickr to load'));
                }
            }, 5000);
            
            // If both already exist but flatpickr isn't defined, give it a moment
            if (cssExists && jsExists) {
                setTimeout(() => {
                    if (typeof flatpickr === 'function') {
                        resolve();
                    } else {
                        reject(new Error('Flatpickr failed to initialize'));
                    }
                }, 1000);
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Show or hide loading indicator for attendance records
 * @param {boolean} show - Whether to show or hide the loading state
 */
function showAttendanceLoading(show) {
    const tableContainer = document.getElementById('attendance-records-container');
    if (!tableContainer) {
        console.error('[ATTENDANCE] Container for attendance records not found');
        return;
    }
    
    if (show) {
        tableContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mb-0">Loading attendance records...</p>
            </div>
        `;
    }
}

/**
 * Ensures that the attendance table structure exists
 * @returns {boolean} True if the structure was created or already exists, false on error
 */
function ensureAttendanceTableStructure() {
    try {
        const container = document.getElementById('attendance-records-container');
        if (!container) {
            console.error('[ATTENDANCE] Attendance records container not found');
            return false;
        }
        
        // Check if table exists
        let table = container.querySelector('table');
        let thead = document.getElementById('attendance-headers');
        let tbody = document.getElementById('attendance-data');
        
        // If any element is missing, recreate the entire structure
        if (!table || !thead || !tbody) {
            // Creating attendance table structure
            
            // Clear the container
            container.innerHTML = '';
            
            // Create the table and its structure
            table = document.createElement('table');
            table.className = 'table table-bordered';
            
            thead = document.createElement('thead');
            thead.id = 'attendance-headers';
            
            tbody = document.createElement('tbody');
            tbody.id = 'attendance-data';
            
            // Assemble the table
            table.appendChild(thead);
            table.appendChild(tbody);
            container.appendChild(table);
        }
        
        return true;
    } catch (error) {
        console.error('[ATTENDANCE] Error ensuring table structure:', error);
        return false;
    }
}

/**
 * Scan the attendance table DOM for late badges to ensure accurate count
 */
function updateLateCountFromDOM() {
    try {
        // Get current late count
        const lateElement = document.getElementById('totalLate');
        if (!lateElement) return;
        
        const currentLate = Number(lateElement.textContent) || 0;
        
        // If the current count is already non-zero, it's likely correct
        if (currentLate > 0) {
            return;
        }
    
        // Find all attendance badges in the table
        const allBadges = document.querySelectorAll('.attendance-badge');
        let lateBadges = 0;
        
        // Count badges that have "Late" text or late styling
        allBadges.forEach(badge => {
            const badgeText = badge.textContent.trim().toLowerCase();
            const hasLateClass = badge.classList.contains('bg-warning-subtle') && 
                                badge.classList.contains('text-warning');
            
            if (badgeText === 'late' || hasLateClass) {
                lateBadges++;
            }
        });
        
        // Update the late counter if DOM count is greater than current count
        if (lateBadges > currentLate) {
            lateElement.textContent = lateBadges.toString();
            
            // Also update attendance percentage since it depends on late count
            const presentElement = document.getElementById('totalPresent');
            const absentElement = document.getElementById('totalAbsence');
            const percentageElement = document.getElementById('attendancePercentage');
            
            if (presentElement && absentElement && percentageElement) {
                const present = Number(presentElement.textContent) || 0;
                const absent = Number(absentElement.textContent) || 0;
                const total = present + lateBadges + absent;
                
                if (total > 0) {
                    const percentage = Math.round(((present + lateBadges) / total) * 100);
                    percentageElement.textContent = `${percentage}%`;
                    
                    // Update percentage color
                    let percentageColor = '#dc3545'; // Red for poor
                    if (percentage >= 90) {
                        percentageColor = '#28a745'; // Green for good
                    } else if (percentage >= 75) {
                        percentageColor = '#ffc107'; // Yellow for moderate
                    }
                    percentageElement.style.color = percentageColor;
                }
            }
        }
    } catch (error) {
        console.error('[DEBUG] Error updating late count from DOM:', error);
    }
}

/**
 * Updates the date headers in the attendance table
 * @param {Map} dateMap - Map of date strings to Date objects
 */
function updateDateHeaders(dateMap) {
    try {
        // Updating date headers
        
        // Ensure table structure exists
        if (!ensureAttendanceTableStructure()) {
            showAttendanceError('Could not create attendance table structure');
            return;
        }
        
        // Get header row
        const headerRow = document.getElementById('attendance-headers');
        if (!headerRow) {
            console.error('[ATTENDANCE] Header row not found');
            return;
        }
        
        // Clear existing headers
        headerRow.innerHTML = '';
        
        // Create the header row
        const row = document.createElement('tr');
        
        // Add class name header cell
        const classNameHeader = document.createElement('th');
        classNameHeader.classList.add('lecture-header');
        classNameHeader.textContent = 'Class Details';
        classNameHeader.style.position = 'sticky';
        classNameHeader.style.left = '0';
        classNameHeader.style.zIndex = '2';
        row.appendChild(classNameHeader);
        
        // Convert dateMap to sorted array
        const sortedDates = Array.from(dateMap.keys()).sort();
        
        // Add date header cells
        sortedDates.forEach(dateString => {
            try {
                // Format the date nicely
                const dateObj = new Date(dateString);
                
                // Format date as "DD Mon"
                const day = dateObj.getDate().toString().padStart(2, '0');
                const month = dateObj.toLocaleDateString('en-GB', { month: 'short' });
                const weekday = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
                
                const header = document.createElement('th');
                header.classList.add('attendance-header');
                header.innerHTML = `
                    <div class="d-flex flex-column align-items-center">
                        <span class="small text-nowrap">${day} ${month}</span>
                        <span class="small text-muted">${weekday}</span>
                    </div>
                `;
                row.appendChild(header);
            } catch (e) {
                console.error(`[ATTENDANCE] Error formatting date ${dateString}:`, e);
                const header = document.createElement('th');
                header.classList.add('attendance-header');
                header.textContent = dateString;
                row.appendChild(header);
            }
        });
        
        // Add row to header
        headerRow.appendChild(row);
        // Date headers updated
    } catch (error) {
        console.error('[ATTENDANCE] Error updating date headers:', error);
    }
}

/**
 * Capitalizes the first letter of a string
 * @param {string} string - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Creates the lecture attendance rows in the table
 * @param {Map} classMap - Map of class names to class data
 * @param {Array} dateArray - Array of dates to display
 */
function createAttendanceRows(classMap, dateArray) {
    try {
        // Creating attendance rows
        
        // Ensure table structure exists
        if (!ensureAttendanceTableStructure()) {
            showAttendanceError('Could not create attendance table structure');
        return;
    }
    
        // Get table body and header
        const tableBody = document.getElementById('attendance-data');
        const tableHeader = document.getElementById('attendance-headers');
        
        if (!tableBody || !tableHeader) {
            console.error('[DEBUG] Table body or header not found even after ensuring structure');
            showAttendanceError('Error: Table elements not found in the DOM');
        return;
    }
    
        // Clear existing content
        tableBody.innerHTML = '';
        
        // Skip if no classes
        if (classMap.size === 0) {
            console.warn('[DEBUG] No classes found in classMap');
            showEmptyAttendanceState('No class data found for this student');
        return;
    }
    
        // Create a row for each class
        let isFirstClass = true;
        classMap.forEach((classData, className) => {
            // Safety check for classData
            if (!classData || !(classData instanceof Map)) {
                // Invalid class data, skipping
                return;
            }
            
            // Processing class attendance records
            
            // Add a divider row between classes (except for the first class)
            if (!isFirstClass) {
                const dividerRow = document.createElement('tr');
                dividerRow.classList.add('class-divider-row');
                
                // Create a cell that spans all columns
                const dividerCell = document.createElement('td');
                dividerCell.colSpan = dateArray.length + 1; // +1 for the class name column
                dividerCell.classList.add('class-divider-cell');
                dividerCell.style.padding = '0';
                dividerCell.style.height = '2px';
                
                // Add a div for the divider line
                const dividerLine = document.createElement('div');
                dividerLine.classList.add('class-divider-line');
                dividerLine.style.height = '2px';
                dividerLine.style.backgroundColor = '#dee2e6';
                dividerLine.style.margin = '0';
                
                dividerCell.appendChild(dividerLine);
                dividerRow.appendChild(dividerCell);
                tableBody.appendChild(dividerRow);
            } else {
                isFirstClass = false;
            }
            
            // Create a new row
            const row = document.createElement('tr');
        
            // Class name cell with improved styling
            const classCell = document.createElement('td');
            classCell.classList.add('lecture-cell');
            
            // Format class name for display
            const displayClassName = className === 'Unknown Class' && classData.size > 0
                ? 'Class Details'  // Use a better default label if no specific class name is available
                : className;
                
            classCell.textContent = displayClassName;
            classCell.title = displayClassName; // Add tooltip
        classCell.style.position = 'sticky';
        classCell.style.left = '0';
        classCell.style.zIndex = '1';
            classCell.style.minWidth = '200px';
            classCell.style.backgroundColor = '#f8f9fa';
            classCell.style.fontWeight = '500';
        row.appendChild(classCell);
        
            // Create attendance status cells for each date
            dateArray.forEach(date => {
            const cell = document.createElement('td');
                cell.classList.add('attendance-cell');
                cell.style.textAlign = 'center';
                
                // Get the attendance record for this date
                const record = classData.get(date);
                
                if (record && record.status) {
                    const status = record.status.toLowerCase();
                    
                    // Create badge with appropriate style using the requested format
                const badge = document.createElement('span');
                    badge.classList.add('badge', 'attendance-badge');
                    
                    if (status.includes('present')) {
                        badge.classList.add('bg-success-subtle', 'text-success');
                    badge.textContent = 'Present';
                    } else if (status.includes('late')) {
                        badge.classList.add('bg-warning-subtle', 'text-warning');
                    badge.textContent = 'Late';
                    } else if (status.includes('absent') && !status.includes('excused')) {
                        badge.classList.add('bg-danger-subtle', 'text-danger');
                        badge.textContent = 'Absent';
                    } else if (status.includes('excused')) {
                        badge.classList.add('bg-info-subtle', 'text-info');
                    badge.textContent = 'Excused';
                } else {
                        badge.classList.add('bg-secondary-subtle', 'text-secondary');
                    badge.textContent = capitalizeFirstLetter(status);
                }
                
                    if (record.id) {
                        badge.setAttribute('data-record-id', record.id);
                        badge.title = `Attendance ID: ${record.id}`;
                    }
                    
                    cell.appendChild(badge);
            } else {
                    // Not recorded
                    const noDataSpan = document.createElement('span');
                    noDataSpan.classList.add('text-muted');
                    noDataSpan.textContent = '—';
                    cell.appendChild(noDataSpan);
            }
            
            row.appendChild(cell);
        });
        
            // Add the row to the table
        tableBody.appendChild(row);
    });
    
        // Add horizontal scrolling capability
        const container = document.getElementById('attendance-records-container');
        if (container) {
            container.classList.add('attendance-scrollable-container');
        }
        
        // Attendance rows created
        
        // After table is created, scan for late badges to update count if needed
        setTimeout(updateLateCountFromDOM, 300);
    } catch (error) {
        console.error('[DEBUG] Error creating attendance rows:', error);
        showAttendanceError('Error creating attendance table', error);
    }
}

/**
 * Display a message for empty attendance records
 * @param {string} message - The message to show
 */
function showEmptyAttendanceState(message = 'No attendance records found') {
    const tableContainer = document.getElementById('attendance-records-container');
    if (!tableContainer) {
        console.error('[ATTENDANCE] Container for attendance records not found');
        return;
    }
    
    console.log('[ATTENDANCE] Showing empty state with message:', message);
    
    // Create a reset button if we're filtering
    const hasFilter = document.getElementById('modalStartDate')?.value || 
                     document.getElementById('modalEndDate')?.value;
    
    tableContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                ${message}
            ${hasFilter ? `
            <button id="reset-filter-btn" class="btn btn-sm btn-outline-primary float-end">
                <i class="bi bi-arrow-counterclockwise"></i> Reset Filter
                </button>
            ` : ''}
            </div>
        `;
        
    // Set up reset button if it exists
    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => resetDateFilter('modal'));
    }
}

/**
 * Display an error state in the attendance container
 * @param {string} message - Error message to display
 * @param {Error} error - Optional Error object for logging
 */
function showAttendanceError(message, error = null) {
    const tableContainer = document.getElementById('attendance-records-container');
    if (!tableContainer) {
        console.error('[ATTENDANCE] Container for attendance records not found');
        return;
    }
    
    if (error) {
        console.error('[ATTENDANCE] Error details:', error);
    }
        
                tableContainer.innerHTML = `
                    <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Error:</strong> ${message}
            <button id="retry-attendance-btn" class="btn btn-sm btn-outline-danger float-end">
                    <i class="bi bi-arrow-repeat"></i> Retry
                        </button>
                    </div>
                `;
                
                // Set up retry button
    const retryBtn = document.getElementById('retry-attendance-btn');
    if (retryBtn && currentStudentId) {
        retryBtn.addEventListener('click', function() {
            // Get current filter values
            const startDate = document.getElementById('modalStartDate')?.value || null;
            const endDate = document.getElementById('modalEndDate')?.value || null;
            
            // Show loading state
                tableContainer.innerHTML = `
                <div class="text-center py-3">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-2">Retrying...</p>
                    </div>
                `;
                
            // Attempt to reload the data
            setTimeout(() => loadAttendanceForStudent(currentStudentId, startDate, endDate), 500);
        });
    }
}

/**
 * Organizes attendance data into class and date maps for display
 * @param {Array|Object} data - The raw attendance data from API
 * @returns {Object} Object containing classMap, dateMap, and stats
 */
function organizeAttendanceData(data) {
    // Initialize maps and stats
    const classMap = new Map();
    const dateMap = new Map();
    const stats = {
        present: 0,
        absent: 0,
        late: 0,
        total: 0
    };
    
    try {
        // Organizing attendance data
        
        // Handle different API response formats
        let records = [];
        
        // If data is an object with an 'attendance' property (common API format)
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            // First, check if there are stats in the response and use them directly
            if (data.stats && typeof data.stats === 'object') {
                // Using stats from API response
                // Copy stats from API response
                stats.present = Number(data.stats.present) || 0;
                stats.absent = Number(data.stats.absent) || 0;
                stats.late = Number(data.stats.late) || 0;
                stats.total = Number(data.stats.total) || 0;
                
                // If attendance_rate is provided, log it for debugging
                if ('attendance_rate' in data.stats) {
                    // Using API provided attendance rate
                }
            }
            
            // Extract records array from response
            if (data.attendance && Array.isArray(data.attendance)) {
                records = data.attendance;
            } else if (data.records && Array.isArray(data.records)) {
                records = data.records;
            } else if (data.data && Array.isArray(data.data)) {
                records = data.data;
            } else {
                // Try to extract data from other commonly used properties
                const possibleProps = ['attendanceRecords', 'results', 'items', 'entries'];
                for (const prop of possibleProps) {
                    if (data[prop] && Array.isArray(data[prop]) && data[prop].length > 0) {
                        records = data[prop];
                        break;
                    }
                }
            }
        } else if (Array.isArray(data)) {
            // If data is already an array
            records = data;
        }
        
        // Processing attendance records
        
        // If no valid records found, return empty result
    if (!records || records.length === 0) {
            return { classMap, dateMap, stats };
        }
        
        // Only count stats manually if we didn't get them from the API
        const needToCalculateStats = stats.total === 0 && records.length > 0;
        
        // Process each attendance record
        records.forEach(record => {
            if (!record || typeof record !== 'object') return;
            
            // Get the date from the record, normalize format
            const date = record.date || record.attendance_date || record.attendanceDate;
            if (!date) return;
            
            // Add date to dateMap if not already present
            if (!dateMap.has(date)) {
                dateMap.set(date, new Date(date));
            }
            
            // Get class info from record with better fallbacks
            let className = 'Unknown Class';
            
            // Try various common class name properties
            if (record.class_name) {
                className = record.class_name;
            } else if (record.className) {
                className = record.className;
            } else if (record.lecture_name) {
                className = record.lecture_name;
            } else if (record.lectureName) {
                className = record.lectureName;
            } else if (record.course_name) {
                className = record.course_name;
            } else if (record.courseName) {
                className = record.courseName;
            } else if (record.class && typeof record.class === 'object') {
                // Handle nested class object
                className = record.class.name || record.class.class_name || record.class.title || 'Unknown Class';
            } else if (record.class && typeof record.class === 'string') {
                className = record.class;
            } else if (record.lecture && typeof record.lecture === 'object') {
                className = record.lecture.name || record.lecture.title || 'Unknown Class';
            } else if (record.lecture && typeof record.lecture === 'string') {
                className = record.lecture;
            }
            
            // Initialize class in classMap if not present
            if (!classMap.has(className)) {
                classMap.set(className, new Map());
            }
            
            // Get the class data map
            const classData = classMap.get(className);
            
            // Get status with better fallbacks
            let status = '';
            if (record.status) {
                status = record.status;
            } else if (record.attendanceStatus) {
                status = record.attendanceStatus;
            } else if (record.attendance_status) {
                status = record.attendance_status;
            } else if (record.attendance && typeof record.attendance === 'string') {
                status = record.attendance;
            } else {
                status = 'Unknown';
            }
            
            // Normalize status to lowercase for consistent comparison
            const statusLower = status.toLowerCase();
            
            // Add attendance record for this date
            classData.set(date, {
                status: status,
                id: record.id || '',
                comments: record.comments || record.comment || ''
            });
            
            // Only update stats counters if we need to calculate them manually
            if (needToCalculateStats) {
                stats.total++;
                
                if (statusLower.includes('late')) {
                    stats.late++;
                } else if (statusLower.includes('present')) {
                    stats.present++;
                } else if (statusLower.includes('absent')) {
                    stats.absent++;
                }
            }
        });
        
        // Ensure stats are all numeric values
        stats.present = Number(stats.present) || 0;
        stats.absent = Number(stats.absent) || 0;
        stats.late = Number(stats.late) || 0;
        stats.total = Number(stats.total) || 0;
        
        // Double-check total matches sum of components
        const calculatedTotal = stats.present + stats.absent + stats.late;
        if (stats.total !== calculatedTotal) {
            // Fix total silently without logging
            stats.total = calculatedTotal;
        }
    } catch (error) {
        console.error('[DEBUG] Error in organizeAttendanceData:', error);
        // Reset stats to safe values on error
        stats.present = 0;
        stats.absent = 0;
        stats.late = 0;
        stats.total = 0;
    }
    
    return { classMap, dateMap, stats };
}

/**
 * Load attendance records for a student
 * @param {string} studentId - ID of the student
 * @param {string} startDate - Optional start date filter (YYYY-MM-DD)
 * @param {string} endDate - Optional end date filter (YYYY-MM-DD)
 */
function loadAttendanceForStudent(studentId, startDate = null, endDate = null) {
    if (!studentId) {
        showAttendanceError('Missing student ID', new Error('No student ID provided'));
        return;
    }
    
    // Store current student ID for refresh functionality
    currentStudentId = studentId;
    
    // Ensure table structure exists
    ensureAttendanceTableStructure();
    
    // Show loading indicator
    showAttendanceLoading(true);
    
    // Reset stats initially to prevent stale data
    // Use a direct DOM update instead of calling updateAttendanceStats to avoid race conditions
    const totalPresentEl = document.getElementById('totalPresent');
    const totalLateEl = document.getElementById('totalLate');
    const totalAbsenceEl = document.getElementById('totalAbsence');
    const attendancePercentageEl = document.getElementById('attendancePercentage');
    
    if (totalPresentEl) totalPresentEl.textContent = '0';
    if (totalLateEl) totalLateEl.textContent = '0';
    if (totalAbsenceEl) totalAbsenceEl.textContent = '0';
    if (attendancePercentageEl) {
        attendancePercentageEl.textContent = '0%';
        attendancePercentageEl.style.color = '#6c757d';
    }
    
    // Build query parameters
    let queryParams = {
        student_id: studentId
    };
    
    if (startDate) {
        queryParams.start_date = startDate;
    }
    
    if (endDate) {
        queryParams.end_date = endDate;
    }
    
    // Build URL and query params for date filtering only
    let apiUrl = `/api/students/${studentId}/attendance`;
    let dateParams = [];
    
    if (startDate) {
        dateParams.push(`start_date=${encodeURIComponent(startDate)}`);
    }
    
    if (endDate) {
        dateParams.push(`end_date=${encodeURIComponent(endDate)}`);
    }
    
    // Add date parameters if they exist
    const queryString = dateParams.length > 0 ? '?' + dateParams.join('&') : '';
    
    // Fetch attendance data from API
    fetch(`${apiUrl}${queryString}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            
            try {
                // Handle direct response format where API returns an empty array
                if (Array.isArray(data) && data.length === 0) {
                    showEmptyAttendanceState('No attendance records found for this student.');
                    updateAttendanceStats(0, 0, 0, 0);
                    return;
                }
                
                // Handle direct response format where API returns null or empty object
                if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
                    showEmptyAttendanceState('No attendance data available.');
                    updateAttendanceStats(0, 0, 0, 0);
                    return;
                }
                
                // Process the attendance data
                const { classMap, dateMap, stats } = organizeAttendanceData(data);
                
                // Double check stats is a proper object with numeric values
                let validStats = { present: 0, absent: 0, late: 0, total: 0 };
                
                if (stats && typeof stats === 'object') {
                    // Deep clone the stats and ensure all values are numeric
                    validStats.present = Number(stats.present) || 0;
                    validStats.absent = Number(stats.absent) || 0;
                    validStats.late = Number(stats.late) || 0;
                    validStats.total = Number(stats.total) || 0;
                    
                    // Verify total makes sense
                    if (validStats.total === 0 && (validStats.present > 0 || validStats.absent > 0 || validStats.late > 0)) {
                        validStats.total = validStats.present + validStats.absent + validStats.late;
                    }
                    
                    // Store API-provided attendance rate if available (without logging)
                    if ('attendance_rate' in stats) {
                        validStats.attendance_rate = stats.attendance_rate;
                    }
                }
                
                // Safety check for classMap type to prevent [object Object] issues
                if (!(classMap instanceof Map)) {
                    // If not a Map, show error and reset stats
                    showAttendanceError('Invalid data format received from server');
                    updateAttendanceStats(validStats.present, validStats.absent, validStats.total, validStats.late);
                    return;
                }
                
                // Update the UI based on data availability
                if (validStats.total > 0 || classMap.size > 0) {
                    // Convert dateMap to sorted array of date strings
                    const dateArray = Array.from(dateMap.keys()).sort();
                    
                    // Update date headers
                    updateDateHeaders(dateMap);
                    
                    // Create attendance rows for each class
                    createAttendanceRows(classMap, dateArray);
                    
                    // IMPORTANT: Update attendance statistics directly to avoid race conditions
                    // with other functions that might be updating these values
                    const totalPresentEl = document.getElementById('totalPresent');
                    const totalLateEl = document.getElementById('totalLate');
                    const totalAbsenceEl = document.getElementById('totalAbsence');
                    const attendancePercentageEl = document.getElementById('attendancePercentage');
                    
                    if (totalPresentEl) totalPresentEl.textContent = validStats.present;
                    if (totalLateEl) totalLateEl.textContent = validStats.late;
                    if (totalAbsenceEl) totalAbsenceEl.textContent = validStats.absent;
                    
                    if (attendancePercentageEl) {
                        // Calculate percentage including late as present
                        let percentage = 0;
                        if (validStats.total > 0) {
                            percentage = ((validStats.present + validStats.late) / validStats.total) * 100;
                        }
                        
                        // Format to one decimal place
                        const formattedPercentage = percentage.toFixed(1);
                        attendancePercentageEl.textContent = `${formattedPercentage}%`;
                        
                        // Add color based on percentage
                        if (percentage >= 90) {
                            attendancePercentageEl.style.color = '#28a745'; // Green for good attendance
                        } else if (percentage >= 75) {
                            attendancePercentageEl.style.color = '#ffc107'; // Yellow for moderate
                        } else {
                            attendancePercentageEl.style.color = '#dc3545'; // Red for poor
                        }
                    }
                    
                    // Add the note about late attendance being counted as present
                    setTimeout(injectAttendanceNoteToDOM, 100);
                    
                    // Schedule multiple checks for late badges in case the first one misses them
                    // This helps when the DOM is still being rendered
                    setTimeout(updateLateCountFromDOM, 500);
                    setTimeout(updateLateCountFromDOM, 1000);
                    setTimeout(updateLateCountFromDOM, 2000);
                } else {
                    // Show empty state
                    showEmptyAttendanceState(
                        startDate || endDate
                            ? `No attendance records found in the selected date range.`
                            : 'No attendance records found for this student.'
                    );
                    
                    // Set all stats to zero directly
                    const totalPresentEl = document.getElementById('totalPresent');
                    const totalLateEl = document.getElementById('totalLate');
                    const totalAbsenceEl = document.getElementById('totalAbsence');
                    const attendancePercentageEl = document.getElementById('attendancePercentage');
                    
                    if (totalPresentEl) totalPresentEl.textContent = '0';
                    if (totalLateEl) totalLateEl.textContent = '0';
                    if (totalAbsenceEl) totalAbsenceEl.textContent = '0';
                    if (attendancePercentageEl) {
                        attendancePercentageEl.textContent = '0%';
                        attendancePercentageEl.style.color = '#6c757d';
                    }
                }
            } catch (error) {
                console.error('[DEBUG] Error processing attendance data:', error);
                showAttendanceError('Failed to process attendance data', error);
                updateAttendanceStats(0, 0, 0, 0);
            }
            
            // Initialize date pickers and any other form elements after UI update
            initializeAttendanceDatePickers('modal');
        })
        .catch(error => {
            console.error('[DEBUG] Error fetching attendance data:', error);
            showAttendanceError('Failed to load attendance data', error);
            
            // Set all stats to zero directly on error
            const totalPresentEl = document.getElementById('totalPresent');
            const totalLateEl = document.getElementById('totalLate');
            const totalAbsenceEl = document.getElementById('totalAbsence');
            const attendancePercentageEl = document.getElementById('attendancePercentage');
            
            if (totalPresentEl) totalPresentEl.textContent = '0';
            if (totalLateEl) totalLateEl.textContent = '0';
            if (totalAbsenceEl) totalAbsenceEl.textContent = '0';
            if (attendancePercentageEl) {
                attendancePercentageEl.textContent = '0%';
                attendancePercentageEl.style.color = '#6c757d';
            }
            
            // Initialize date pickers even on error
            initializeAttendanceDatePickers('modal');
        });
}

/**
 * Add necessary styles for the attendance table
 * This ensures the styles are added only once to the document
 */
function addAttendanceTableStyles() {
    // Check if styles already exist
    if (document.getElementById('attendanceTableStyles')) {
                return;
            }
            
    // Create style element
    const styleEl = document.createElement('style');
    styleEl.id = 'attendanceTableStyles';
    
    // Add attendance table styles
    styleEl.textContent = `
        .attendance-scrollable-container {
            overflow-x: auto;
            margin-bottom: 20px;
            max-width: 100%;
            position: relative;
            border: 1px solid #dee2e6;
            border-radius: 0.25rem;
        }
        .class-divider-row {
            height: 2px;
        }
        .class-divider-cell {
            padding: 0 !important;
        }
        .class-divider-line {
            height: 2px;
            background-color: #dee2e6;
            margin: 0;
        }
        .attendance-scrollable-container table {
            margin-bottom: 0;
            width: auto;
            min-width: 100%;
            table-layout: fixed;
        }
        .attendance-header {
            text-align: center;
            min-width: 80px;
            max-width: 100px;
            vertical-align: middle;
            background-color: #f8f9fa;
            position: sticky;
            top: 0;
            z-index: 1;
        }
        .lecture-header {
            background-color: #f8f9fa;
            font-weight: 600;
            min-width: 200px;
            position: sticky;
            left: 0;
            z-index: 2;
            border-right: 2px solid #dee2e6;
        }
        .lecture-cell {
            background-color: #f8f9fa;
            font-weight: 500;
            position: sticky;
            left: 0;
            z-index: 1;
            border-right: 2px solid #dee2e6;
        }
        .attendance-cell {
            text-align: center;
            vertical-align: middle;
            min-width: 80px;
        }
        .attendance-badge {
            padding: 5px 8px;
            font-size: 0.75rem;
            white-space: nowrap;
        }
        /* Add shadow to indicate scrollable content */
        .attendance-scrollable-container::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            height: 100%;
            width: 15px;
            background: linear-gradient(to right, transparent, rgba(0,0,0,0.05));
            pointer-events: none;
        }
    `;
    
    // Add to document head
    document.head.appendChild(styleEl);
}

/**
 * Calculate and update attendance percentage
 * Also adds a note about how late attendance is calculated
 * @param {Object} stats - The attendance stats
 */
function updateAttendancePercentageWithNote(stats) {
    const attendancePercentageElement = document.getElementById('attendancePercentage');
    if (!attendancePercentageElement) return;
    
    let percentageText = '0%';
    let percentageColor = '#6c757d'; // Default gray
    
    // Convert to numbers for calculation
    const present = Number(stats.present) || 0;
    const late = Number(stats.late) || 0;
    const total = Number(stats.total) || 0;
    
    if (total > 0) {
        // Include late as present for percentage calculation
        const percentage = ((present + late) / total) * 100;
        const formattedPercentage = percentage.toFixed(1);
        percentageText = `${formattedPercentage}%`;
        
        // Log for debugging
        console.log('[DEBUG] updateAttendancePercentageWithNote calculation:', {
            present,
            late,
            total,
            percentage,
            formatted: formattedPercentage
        });
        
        // Conditionally style the percentage based on value
        if (percentage >= 90) {
            percentageColor = '#28a745'; // Green for good attendance
        } else if (percentage >= 75) {
            percentageColor = '#ffc107'; // Yellow for moderate
        } else {
            percentageColor = '#dc3545'; // Red for poor
        }
    }
    
    attendancePercentageElement.textContent = percentageText;
    attendancePercentageElement.style.color = percentageColor;
    
    // Add note about calculation method below stats cards
    const statsContainer = attendancePercentageElement.closest('.modal-body');
    if (statsContainer) {
        // Check if the note already exists
        let noteElement = document.getElementById('attendance-calculation-note');
        if (!noteElement) {
            // Create new note element
            noteElement = document.createElement('div');
            noteElement.id = 'attendance-calculation-note';
            noteElement.className = 'small text-muted mt-2 text-center';
            noteElement.innerHTML = '<i class="bi bi-info-circle me-1"></i>Note: Late attendance is counted as present for percentage calculation';
            
            // Find the attendance stats row to place the note after
            const attendanceStatsRow = statsContainer.querySelector('.attendance-stats-row') || 
                                     statsContainer.querySelector('.row:has(#attendancePercentage)') ||
                                     statsContainer.querySelector('.row');
            
            if (attendanceStatsRow) {
                // Insert after the stats row
                if (attendanceStatsRow.nextElementSibling) {
                    attendanceStatsRow.parentNode.insertBefore(noteElement, attendanceStatsRow.nextElementSibling);
                } else {
                    attendanceStatsRow.parentNode.appendChild(noteElement);
                }
            } else {
                // If can't find the row, append to the attendance records container
                const recordsContainer = document.getElementById('attendance-records-container');
                if (recordsContainer) {
                    recordsContainer.appendChild(noteElement);
                } else {
                    // Last resort: Add to the stats container
                    statsContainer.appendChild(noteElement);
                }
            }
        }
    }
}

/**
 * Updates attendance statistics display with provided data
 * This is a wrapper around the global updateAttendanceStats function
 * to ensure consistent behavior across the application
 * 
 * @param {number|Object} present - Number of present attendances or stats object
 * @param {number} absent - Number of absent attendances 
 * @param {number} total - Total number of attendances
 * @param {number} late - Number of late attendances
 */
function updateStudentModalAttendanceStats(present, absent, total, late = 0) {
    try {
        // Throttle updates - don't update more than once every 500ms with the same values
        const now = Date.now();
        
        // Create a hash of the current values to compare with previous update
        const currentValues = `${present}-${absent}-${total}-${late}`;
        
        // Skip update if values haven't changed and it's been less than 500ms
        if (window.lastStatsUpdate && 
            window.lastStatsUpdate.values === currentValues && 
            (now - window.lastStatsUpdate.time) < 500) {
            return;
        }
        
        // Update the last stats update time and values
        window.lastStatsUpdate = {
            time: now,
            values: currentValues
        };
        
        // Enhanced handling for object inputs with stricter type checking
        if (present !== null && typeof present === 'object') {
            const statsObj = present;
            
            // Extract values safely, ensuring they're converted to numbers
            if ('present' in statsObj) present = Number(statsObj.present) || 0;
            if ('absent' in statsObj) absent = Number(statsObj.absent) || 0;
            if ('total' in statsObj) total = Number(statsObj.total) || 0;
            if ('late' in statsObj) late = Number(statsObj.late) || 0;
        }
        
        // Ensure all values are valid numbers
        present = isNaN(Number(present)) ? 0 : Number(present);
        absent = isNaN(Number(absent)) ? 0 : Number(absent);
        total = isNaN(Number(total)) ? 0 : Number(total);
        late = isNaN(Number(late)) ? 0 : Number(late);
        
        // Recalculate total if needed
        if (total === 0 && (present > 0 || absent > 0 || late > 0)) {
            total = present + absent + late;
        }
        
        // Call the global updateAttendanceStats function if it exists
        if (typeof window.updateAttendanceStats === 'function') {
            window.updateAttendanceStats(present, absent, late, total);
        } else {
            // Use fallback implementation silently without logging
            
            // Fallback implementation if the global function is not available
            const totalPresentElement = document.getElementById('totalPresent');
            const totalLateElement = document.getElementById('totalLate');
            const totalAbsenceElement = document.getElementById('totalAbsence');
            const attendancePercentageElement = document.getElementById('attendancePercentage');
            
            if (totalPresentElement) totalPresentElement.textContent = present.toString();
            if (totalLateElement) totalLateElement.textContent = late.toString();
            if (totalAbsenceElement) totalAbsenceElement.textContent = absent.toString();
            
            if (attendancePercentageElement) {
                let percentageText = '0%';
                let percentageColor = '#6c757d'; // Default gray
                
                if (total > 0) {
                    // Ensure we have valid numbers for calculation
                    const presentCount = Number(present) || 0;
                    const lateCount = Number(late) || 0;
                    const totalCount = Number(total) || 0;
                    
                    // Calculate percentage - include late as present
                    let percentage = ((presentCount + lateCount) / totalCount * 100);
                    
                    // Format to 1 decimal place
                    const formattedPercentage = percentage.toFixed(1);
                    percentageText = `${formattedPercentage}%`;
                    
                    // Conditionally style the percentage based on value
                    if (percentage >= 90) {
                        percentageColor = '#28a745'; // Green for good attendance
                    } else if (percentage >= 75) {
                        percentageColor = '#ffc107'; // Yellow for moderate
                    } else {
                        percentageColor = '#dc3545'; // Red for poor
                    }
                }
                
                attendancePercentageElement.textContent = percentageText;
                attendancePercentageElement.style.color = percentageColor;
            }
        }
        
        // Add calculation note - try multiple times with delays to ensure it's added
        setTimeout(injectAttendanceNoteToDOM, 100);
        setTimeout(injectAttendanceNoteToDOM, 500);
        setTimeout(injectAttendanceNoteToDOM, 1000);
        
    } catch (error) {
        // Only log once with a more concise message
        console.error('[ATTENDANCE] Error updating stats:', error.message);
        
        // Fallback to zeros if an error occurs
        const totalPresentElement = document.getElementById('totalPresent');
        const totalLateElement = document.getElementById('totalLate');
        const totalAbsenceElement = document.getElementById('totalAbsence');
        const attendancePercentageElement = document.getElementById('attendancePercentage');
        
        if (totalPresentElement) totalPresentElement.textContent = '0';
        if (totalLateElement) totalLateElement.textContent = '0';
        if (totalAbsenceElement) totalAbsenceElement.textContent = '0';
        if (attendancePercentageElement) {
            attendancePercentageElement.textContent = '0%';
            attendancePercentageElement.style.color = '#6c757d';
        }
    }
}

// This function to be injected directly into the DOM after the modal is shown
function injectAttendanceNoteToDOM() {
    try {
        // Check if note already exists
        if (document.getElementById('attendance-calculation-note')) {
            return; // Already added
        }
        
        // Find stats cards container
        const statsRow = document.querySelector('#viewStudentModal .row');
        if (!statsRow) {
            // Use silent failure to reduce console noise
            return;
        }
        
        // Create the note element
        const noteDiv = document.createElement('div');
        noteDiv.id = 'attendance-calculation-note';
        noteDiv.className = 'small text-muted mt-2 mb-3 text-center w-100';
        noteDiv.innerHTML = '<i class="bi bi-info-circle me-1"></i>Note: Late attendance is counted as present for percentage calculation';
        
        // Insert after the stats row
        statsRow.parentNode.insertBefore(noteDiv, statsRow.nextSibling);
        
        // If the note wasn't successfully added using the above approach, try a different approach
        if (!document.getElementById('attendance-calculation-note')) {
            // Try adding it to the attendance-records-container
            const container = document.getElementById('attendance-records-container');
            if (container) {
                container.insertAdjacentHTML('beforebegin', 
                    '<div id="attendance-calculation-note" class="small text-muted mb-3 text-center"><i class="bi bi-info-circle me-1"></i>Note: Late attendance is counted as present for percentage calculation</div>'
                );
            }
        }
    } catch (error) {
        // Silent failure to reduce console noise
    }
}

/**
 * Ensures that all stats elements display valid numeric values
 * Call this after modal is shown and whenever stats might be inconsistent
 */
function ensureValidStatsDisplay() {
    try {
        // Get all stats elements
        const statsElements = {
            present: document.getElementById('totalPresent'),
            late: document.getElementById('totalLate'),
            absent: document.getElementById('totalAbsence'),
            percentage: document.getElementById('attendancePercentage')
        };
        
        // Check and fix each element
        if (statsElements.present) {
            const currentValue = statsElements.present.textContent;
            // Check if value is not a simple number (could be [object Object] or other invalid text)
            if (!currentValue || isNaN(Number(currentValue)) || currentValue.includes('[object')) {
                console.warn('[STATS FIX] Found invalid totalPresent value:', currentValue);
                statsElements.present.textContent = '0';
            }
        }
        
        if (statsElements.late) {
            const currentValue = statsElements.late.textContent;
            if (!currentValue || isNaN(Number(currentValue)) || currentValue.includes('[object')) {
                console.warn('[STATS FIX] Found invalid totalLate value:', currentValue);
                statsElements.late.textContent = '0';
            }
        }
        
        if (statsElements.absent) {
            const currentValue = statsElements.absent.textContent;
            if (!currentValue || isNaN(Number(currentValue)) || currentValue.includes('[object')) {
                console.warn('[STATS FIX] Found invalid totalAbsence value:', currentValue);
                statsElements.absent.textContent = '0';
            }
        }
        
        if (statsElements.percentage) {
            const currentValue = statsElements.percentage.textContent;
            if (!currentValue || !currentValue.includes('%') || currentValue.includes('[object')) {
                console.warn('[STATS FIX] Found invalid percentage value:', currentValue);
                statsElements.percentage.textContent = '0%';
                statsElements.percentage.style.color = '#6c757d'; // Default gray
            }
        }
        
        // Validation complete - no need to log
    } catch (error) {
        console.error('[STATS FIX] Error ensuring valid stats display:', error);
    }
}
