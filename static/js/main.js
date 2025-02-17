// static/js/main.js
// Add any custom JavaScript functionality here
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })

    // Sidebar functionality
    const cleanup = initializeSidebar();
    
    // Clean up when navigating away
    window.addEventListener('beforeunload', cleanup);

    // Initialize context-aware info modal
    initializeContextInfo();

    // Add click event to info button
    const infoBtn = document.querySelector('.info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', openInfoModal);
    }

    // Add click event for closing modal when clicking outside
    document.addEventListener('click', function(event) {
        const modal = document.getElementById('pageInfoModal');
        if (event.target.classList.contains('modal') || event.target.classList.contains('modal-backdrop')) {
            closeInfoModal();
        }
    });

    // Initialize modal
    const modalElement = document.getElementById('pageInfoModal');
    if (modalElement && !window.modalInstance) {
        window.modalInstance = new bootstrap.Modal(modalElement);

        // Update modal content when shown
        modalElement.addEventListener('show.bs.modal', function() {
            const currentPath = window.location.pathname.split('/')[1] || 'dashboard';
            const pageKey = currentPath.replace('-', '-');
            const info = window.pageInformation[pageKey];

            if (info) {
                modalElement.querySelector('.page-title').textContent = info.title;
                modalElement.querySelector('.page-description').textContent = info.description;

                const featureList = modalElement.querySelector('.feature-list');
                if (featureList) {
                    featureList.innerHTML = info.features
                        .map(feature => `<li><i class="bi bi-check text-success me-2"></i>${feature}</li>`)
                        .join('');
                }

                const instructionList = modalElement.querySelector('.instruction-list');
                if (instructionList) {
                    instructionList.innerHTML = info.instructions
                        .map(instruction => `<li><i class="bi bi-arrow-right text-primary me-2"></i>${instruction}</li>`)
                        .join('');
                }
            }
        });

        // Add ESC key listener
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && window.modalInstance) {
                window.modalInstance.hide();
                // Additional cleanup
                document.body.classList.remove('modal-open');
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) backdrop.remove();
            }
        });

        // Add click outside listener
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement && window.modalInstance) {
                window.modalInstance.hide();
                // Additional cleanup
                document.body.classList.remove('modal-open');
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) backdrop.remove();
            }
        });
    }
});

function initializeSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    // Always remove any existing overlay first
    document.querySelectorAll('.sidebar-overlay').forEach(el => el.remove());
    
    // Create fresh overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    function toggleSidebar(event) {
        event?.preventDefault();
        
        // Force a browser reflow
        sidebar.offsetHeight;
        
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
        document.body.classList.toggle('sidebar-open');
    }

    function closeSidebar() {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
        document.body.classList.remove('sidebar-open');
    }

    // Remove any existing listeners
    const newSidebarToggle = sidebarToggle.cloneNode(true);
    sidebarToggle.parentNode.replaceChild(newSidebarToggle, sidebarToggle);
    
    // Add fresh event listeners
    newSidebarToggle.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', closeSidebar);
    
    const closeButton = document.querySelector('.close-sidebar');
    if (closeButton) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        newCloseButton.addEventListener('click', closeSidebar);
    }

    // Global events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('show')) {
            closeSidebar();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 992 && sidebar.classList.contains('show')) {
            closeSidebar();
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeSidebar);

function initializeContextInfo() {
    const modalElement = document.getElementById('pageInfoModal');
    if (!modalElement || window.modalInstance) return;

    window.modalInstance = new bootstrap.Modal(modalElement);

    // Update modal content when shown
    modalElement.addEventListener('show.bs.modal', function() {
        const currentPath = window.location.pathname.split('/')[1] || 'dashboard';
        const pageKey = currentPath.replace('_', '-');
        const pageData = window.pageInformation[pageKey];

        if (!pageData) {
            console.warn('No information available for page:', pageKey);
            return;
        }

        // Update modal content
        const modalTitle = this.querySelector('.page-title');
        const description = this.querySelector('.page-description');
        const featureList = this.querySelector('.feature-list');
        const instructionList = this.querySelector('.instruction-list');

        if (modalTitle) modalTitle.textContent = pageData.title;
        if (description) description.textContent = pageData.description;

        // Update features
        if (featureList) {
            featureList.innerHTML = pageData.features
                .map(feature => `<li><i class="bi bi-check text-success me-2"></i>${feature}</li>`)
                .join('');
        }

        // Update instructions
        if (instructionList) {
            instructionList.innerHTML = pageData.instructions
                .map(instruction => `<li><i class="bi bi-arrow-right text-primary me-2"></i>${instruction}</li>`)
                .join('');
        }
    });

    // Add ESC key listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.modalInstance) {
            closeInfoModal();
        }
    });

    // Add click outside listener
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            closeInfoModal();
        }
    });
}

function handleError(error) {
    console.error('Error:', error);
    const tableBody = document.querySelector('tbody');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error loading data</td></tr>';
}

// Use window-level variable to prevent multiple declarations
if (!window.modalInstance) {
    window.modalInstance = null;
}

// Define pageInformation globally if it doesn't exist
if (typeof window.pageInformation === 'undefined') {
    window.pageInformation = {
        'dashboard': {
            title: 'Dashboard',
            description: 'Overview of system statistics and key metrics.',
            features: [
                'View total users, students, and instructors',
                'Monitor active and inactive users',
                'Quick access to key functions'
            ],
            instructions: [
                'Use the cards to view overall statistics',
                'Click on specific sections to view detailed information',
                'Use the navigation menu to access other pages'
            ]
        },
        'profile': {
            title: 'Profile Management',
            description: 'View and manage your profile information and account settings.',
            features: [
                'View profile information',
                'Update personal details',
                'Change password',
                'Manage notification preferences',
                'View account activity'
            ],
            instructions: [
                'Review your current profile information',
                'Click edit button to update your details',
                'Use the change password option to update your credentials',
                'Save changes after making any updates',
                'Review your recent account activity in the history section'
            ]
        },
        'user-management': {
            title: 'User Management',
            description: 'Manage all system users including administrators, instructors, and students.',
            features: [
                'View all users in the system',
                'Filter users by role and status',
                'Add, edit, or deactivate users',
                'Export user data to CSV'
            ],
            instructions: [
                'Use filters to sort users by role or status',
                'Click the "Add New User" button to create new users',
                'Use action buttons to edit or view user details',
                'Export data using the "Export CSV" button'
            ]
        },
        'student-management': {
            title: 'Student Management',
            description: 'Manage all students in the system.',
            features: [
                'View all students',
                'Filter students by status',
                'Add new students',
                'Edit student information',
                'Export student data to CSV'
            ],
            instructions: [
                'Use the status filter to view active or inactive students',
                'Search students by name or ID',
                'Click action buttons to edit, view, or archive students',
                'Use the pagination controls to navigate through student list'
            ]
        },
        'instructor-management': {
            title: 'Instructor Management',
            description: 'Manage all instructors in the system.',
            features: [
                'View all instructors',
                'Filter instructors by status',
                'Add new instructors',
                'Edit instructor information',
                'Export instructor data to CSV'
            ],
            instructions: [
                'Use the status filter to view active or inactive instructors',
                'Search instructors by name or ID',
                'Click action buttons to edit, view, or archive instructors',
                'Use the pagination controls to navigate through instructor list'
            ]
        },
        'company-management': {
            title: 'Company Management',
            description: 'Manage all company partnerships and information.',
            features: [
                'View all partner companies',
                'Filter companies by status',
                'Add new company partnerships',
                'Edit company information',
                'Export company data to CSV'
            ],
            instructions: [
                'Use the status filter to view active or inactive companies',
                'Search companies by name',
                'Click action buttons to edit, view, or archive company information',
                'Use the pagination controls to navigate through company list'
            ]
        },
        'class-management': {
            title: 'Class Management',
            description: 'Comprehensive system for managing classes, schedules, instructor assignments, and tracking class statuses. This module helps administrators efficiently organize and monitor all class-related activities.',
            features: [
                'View all classes and their schedules in a centralized dashboard',
                'Filter classes by active/inactive status',
                'Add new classes with detailed instructor assignments',
                'Set and manage class schedules with day and time slots',
                'Export class data to CSV for reporting',
                'Track active and inactive classes with real-time statistics',
                'Search functionality for quick access to specific classes',
                'Bulk actions for efficient class management',
                'Detailed class information including schedules and instructor details',
                'Academic year tracking and management'
            ],
            instructions: [
                'Use the status filter dropdown to view active or inactive classes',
                'Click "Add New Class" button to create a new class with all required details',
                'Use the search bar to find specific classes by name or instructor',
                'Utilize action buttons (edit, view, archive) for class management',
                'Export data using the "Export CSV" button for reporting purposes',
                'Monitor class statistics through the info cards at the top',
                'Use pagination controls to navigate through class lists',
                'Adjust rows per page to view more/fewer classes at once',
                'Click view icon to see detailed class information',
                'Use edit icon to modify existing class details'
            ]
        },
        'enrolment-management': {
            title: 'Enrolment Management',
            description: 'Manage student enrolments across different classes and courses.',
            features: [
                'View all enrolments',
                'Add new enrolments',
                'Manage class assignments',
                'Track enrolment status',
                'Export enrolment data'
            ],
            instructions: [
                'Use filters to view specific enrolments',
                'Click "Add New Enrolment" to enroll students',
                'Review and update enrolment status',
                'Export data for reporting',
                'Monitor class capacity and availability'
            ]
        },
        'view-attendance': {
            title: 'View Attendance',
            description: 'View and analyze attendance records for all classes and students.',
            features: [
                'View attendance records',
                'Filter by date range',
                'Export attendance data',
                'View attendance statistics',
                'Track student attendance patterns'
            ],
            instructions: [
                'Select date range to view specific periods',
                'Use filters to find specific records',
                'Export data for reporting purposes',
                'Review attendance statistics',
                'Monitor individual student attendance'
            ]
        },
        'mark-attendance': {
            title: 'Mark Attendance',
            description: 'Record and manage daily attendance for classes and students.',
            features: [
                'Mark daily attendance',
                'Update attendance status',
                'Record time stamps',
                'Add attendance notes',
                'Bulk attendance marking'
            ],
            instructions: [
                'Select the class to mark attendance',
                'Choose the appropriate date',
                'Mark students as present, absent, or late',
                'Add any relevant notes',
                'Save attendance records'
            ]
        }
    };
}

// Modal helper functions
function openInfoModal() {
    if (window.modalInstance) {
        window.modalInstance.show();
    }
}

function closeInfoModal() {
    if (window.modalInstance) {
        window.modalInstance.hide();
        // Additional cleanup
        document.body.classList.remove('modal-open');
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
    }
}
