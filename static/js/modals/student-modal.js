/**
 * Student Modal View
 * Handles displaying student details in a modal
 */

// Track if modal is currently being initialized to prevent double initialization
let isModalInitializing = false;

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
        console.error('Error cleaning up modal backdrop');
    }
}

/**
 * Show student details in a modal
 * @param {Object} userData - The student data from the API
 */
async function showStudentModalView(userData) {
    // Prevent double initialization
    if (isModalInitializing) {
        return;
    }
    
    isModalInitializing = true;
    
    try {
        // Only clean up stray backdrops, don't remove all backdrops aggressively
        cleanupModalBackdrop();

        const studentModal = document.getElementById('viewStudentModal');
        if (!studentModal) {
            showToast('Error: Student view modal not found', 'error');
            isModalInitializing = false;
            return;
        }

        const studentData = userData;
        const studentId = studentData.id || studentData.user_id;

        // Update UI with initial data
        updateStudentInfo(studentData);
        displayEnrollments(studentData);
        updateModalFooter(studentId);
        
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
                        updateStudentInfo(freshData);
                        if (freshData.enrollments || freshData.classes) {
                            displayEnrollments(freshData);
                        }
                    }
                })
                .catch(() => {
                    // Silent failure, already showing data from initial payload
                });
        }
        
        // Clean up on modal close - use Bootstrap's event with once:true to prevent multiple handlers
        studentModal.addEventListener('hidden.bs.modal', function() {
            cleanupModalBackdrop('viewStudentModal');
            // Remove the click handler to prevent memory leaks
            studentModal.removeEventListener('click', arguments.callee);
        }, { once: true });
        
        isModalInitializing = false;
    } catch (error) {
        showToast('Error: Failed to load student details', 'error');
        isModalInitializing = false;
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
    if (studentIdElement) studentIdElement.textContent = data.id || data.user_id || '';
    
    if (studentCompanyElement) {
        studentCompanyElement.innerHTML = '<small><i>Loading company info...</i></small>';
        
        if (data.company_data) {
            const companyName = data.company_data.name || 'Unknown Company';
            const companyId = data.company_data.id || data.company_data.company_id;
            
            if (companyId) {
                studentCompanyElement.innerHTML = `
                    <a href="/admin/company-management/${companyId}" class="company-link" title="View company details">
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
            if (data.company_data.phone) tooltipContent += `Phone: ${data.company_data.phone}`;
            
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
                        <a href="/admin/company-details/${companyId}" class="company-link" title="View company details">
                            ${companyName}
                        </a>
                        <span class="company-badge">${companyData.industry || ''}</span>
                    `;

                    let tooltipContent = '';
                    if (companyData.address) tooltipContent += `Address: ${companyData.address}<br>`;
                    if (companyData.email) tooltipContent += `Email: ${companyData.email}<br>`;
                    if (companyData.phone) tooltipContent += `Phone: ${companyData.phone}`;
                    
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
                    enrollment.is_active = true;
                    appendClassCard(activeGrid, enrollment);
                });
                
                activeSection.appendChild(activeGrid);
                enrollmentsContainer.appendChild(activeSection);
            }
            
            // Get historical/past enrollments
            const historicalEnrollments = enrollments.filter(e => {
                // Handle potential different data formats
                const status = e.status?.toLowerCase?.() || '';
                const isActive = status === 'active' || e.is_active === true;
                return !isActive;
            });
            
            // Add past enrollments section if there are any
            if (historicalEnrollments.length > 0) {
                const pastSection = document.createElement('div');
                pastSection.className = 'mt-4';
                
                // Add Past Enrollments header
                const pastHeader = document.createElement('div');
                pastHeader.className = 'mb-3 border-bottom pb-2';
                pastHeader.innerHTML = '<h6 class="m-0"><i class="bi bi-circle-fill text-secondary me-2" style="font-size: 10px;"></i>Past Enrollments</h6>';
                pastSection.appendChild(pastHeader);
                
                // Create a grid for past enrollments
                const pastGrid = document.createElement('div');
                pastGrid.className = 'past-enrollments';
                pastGrid.style.display = 'grid';
                pastGrid.style.gap = '10px';
                pastGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                
                // Sort historical enrollments by name
                const sortedHistorical = [...historicalEnrollments].sort((a, b) => {
                    const aName = a.class_name || a.name || '';
                    const bName = b.class_name || b.name || '';
                    return aName.localeCompare(bName);
                });
                
                // Display historical enrollments
                sortedHistorical.forEach(enrollment => {
                    enrollment.is_active = false;
                    // Set appropriate status
                    if (!enrollment.status) {
                        enrollment.status = 'Inactive';
                    }
                    appendClassCard(pastGrid, enrollment);
                });
                
                pastSection.appendChild(pastGrid);
                enrollmentsContainer.appendChild(pastSection);
            }
            
            // Add the container to the main div
            enrolledClassesDiv.appendChild(enrollmentsContainer);
            
            // If no enrollments were displayed, show empty message
            if (activeEnrollments.length === 0 && historicalEnrollments.length === 0) {
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
        
        // Set attendance statistics from actual data if available
        displayAttendanceStats(data);
        
        // Make the layout responsive using a media query
        adjustEnrollmentLayout();
        window.addEventListener('resize', adjustEnrollmentLayout);
        
    } catch (error) {
        // Show error message without console logging
        enrolledClassesDiv.innerHTML = `
            <div class="alert alert-danger mb-0">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Error loading enrollment data. Please try again.
            </div>
        `;
    }
}

/**
 * Adjust enrollment layout based on screen size
 */
function adjustEnrollmentLayout() {
    const activeGrid = document.querySelector('.active-enrollments');
    const pastGrid = document.querySelector('.past-enrollments');
    
    if (window.innerWidth < 768) {
        // Switch to single column for small screens
        if (activeGrid) activeGrid.style.gridTemplateColumns = '1fr';
        if (pastGrid) pastGrid.style.gridTemplateColumns = '1fr';
    } else {
        // Use responsive grid for larger screens
        const columns = window.innerWidth < 992 ? 'repeat(auto-fill, minmax(250px, 1fr))' : 'repeat(auto-fill, minmax(300px, 1fr))';
        if (activeGrid) activeGrid.style.gridTemplateColumns = columns;
        if (pastGrid) pastGrid.style.gridTemplateColumns = columns;
    }
}

/**
 * Display attendance statistics
 * @param {Object} data - The student data
 */
function displayAttendanceStats(data) {
    try {
        // Get attendance statistic elements
        const totalPresent = document.getElementById('totalPresent');
        const totalAbsence = document.getElementById('totalAbsence');
        const attendancePercentage = document.getElementById('attendancePercentage');
        
        if (!totalPresent || !totalAbsence || !attendancePercentage) {
            return;
        }
        
        // Use attendance data if available
        const present = data.attendance?.present || data.present || 0;
        const absent = data.attendance?.absent || data.absent || 0;
        
        // Update DOM elements
        totalPresent.textContent = present.toString();
        totalAbsence.textContent = absent.toString();
        
        // Calculate percentage
        const total = parseInt(present) + parseInt(absent);
        const percentage = total > 0 ? Math.round((parseInt(present) / total) * 100) : 0;
        
        attendancePercentage.textContent = `${percentage}%`;
        
    } catch (error) {
        // Set default values on error without console logging
        if (totalPresent) totalPresent.textContent = '0';
        if (totalAbsence) totalAbsence.textContent = '0';
        if (attendancePercentage) attendancePercentage.textContent = '0%';
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
    
    // Apply different styling for historical enrollments
    if (enrollment.is_active === false) {
        card.style.backgroundColor = '#f8f9fa';
        card.style.borderColor = '#dee2e6';
        card.style.opacity = '0.9';
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
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The toast type (success, error, info, warning)
 */
function showToast(message, type = 'success') {
    try {
        // Always use the global notification system if available
        if (typeof window.getNotificationManager === 'function') {
            const manager = window.getNotificationManager({
                useBootstrapToasts: true
            });
            
            const title = type.charAt(0).toUpperCase() + type.slice(1);
            manager.showBootstrapToast(title, message, {
                type: type
            });
            return;
        }
        
        // Second option: use the global showToast if it's from notification.js
        if (typeof window.showToast === 'function' && window.showToast !== showToast) {
            const title = type.charAt(0).toUpperCase() + type.slice(1);
            window.showToast(title, message, type);
            return;
        }
        
        // Last resort fallback to using the statusToast from toast_notification.html
        const statusToast = document.getElementById('statusToast');
        if (!statusToast) {
            console.error('Toast notification element not found');
            return;
        }
        
        // Get the title and message elements
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toastTitle || !toastMessage) {
            console.error('Toast title or message elements not found');
            return;
        }
        
        // Set the title based on type
        let title = 'Information';
        let icon = '<i class="bi bi-info-circle-fill text-info me-2"></i>';
        
        if (type === 'success') {
            title = 'Success';
            icon = '<i class="bi bi-check-circle-fill text-success me-2"></i>';
        } else if (type === 'error' || type === 'danger') {
            title = 'Error';
            icon = '<i class="bi bi-exclamation-circle-fill text-danger me-2"></i>';
        } else if (type === 'warning') {
            title = 'Warning';
            icon = '<i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>';
        }
        
        // Update toast content
        toastTitle.innerHTML = icon + title;
        toastMessage.innerHTML = message;
        
        // Show the toast
        const toast = new bootstrap.Toast(statusToast);
        toast.show();
        
    } catch (error) {
        console.error('Error showing toast notification');
        // Fallback to console messages
        if (type === 'error' || type === 'danger') {
            console.error(message);
        } else {
            console.log(message);
        }
    }
}

// Helper function to extract company name from various data structures
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

// Make the functions available globally
window.showStudentModalView = showStudentModalView; 
window.cleanupModalBackdrop = cleanupModalBackdrop;