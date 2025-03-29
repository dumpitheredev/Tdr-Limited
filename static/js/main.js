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

/**
 * Updates the page title in the DOM
 * @param {string} title - The title to set
 */
function updatePageTitle(title) {
    const pageTitleElement = document.querySelector('.page-title');
    if (pageTitleElement) {
        pageTitleElement.textContent = title;
    }
}

/**
 * Updates the context instructions shown in the info modal
 * @param {Array} features - Array of feature descriptions
 * @param {Array} instructions - Array of instruction steps
 */
function updateInstructions(features, instructions) {
    // Create or get the modal element
    let modalElement = document.getElementById('pageInfoModal');
    
    if (!modalElement) {
        return;
    }
    
    // Initialize the modal if not already done
    if (!window.modalInstance) {
        window.modalInstance = new bootstrap.Modal(modalElement);
    }
    
    // Update features
    const featureList = modalElement.querySelector('.feature-list');
    if (featureList) {
        featureList.innerHTML = features
            .map(feature => `<li><i class="bi bi-check text-success me-2"></i>${feature}</li>`)
            .join('');
    }
    
    // Update instructions
    const instructionList = modalElement.querySelector('.instruction-list');
    if (instructionList) {
        instructionList.innerHTML = instructions
            .map(instruction => `<li><i class="bi bi-arrow-right text-primary me-2"></i>${instruction}</li>`)
            .join('');
    }
    
    // Update description if available
    const pageKey = getPageKeyFromUrl();
    const pageInfo = window.pageInformation[pageKey];
    if (pageInfo) {
        const description = modalElement.querySelector('.page-description');
        if (description) {
            description.textContent = pageInfo.description;
        }
    }
}

/**
 * Gets the current page key from the URL
 * @returns {string} The page key
 */
function getPageKeyFromUrl() {
    const pathname = window.location.pathname;
    let pageKey = '';
    
    // Handle admin routes
    if (pathname.includes('/admin/')) {
        let adminPath = pathname.split('/admin/')[1];
        
        // Handle cases where the path might include "admin-" already
        if (adminPath === 'admin-profile') {
            pageKey = 'admin-profile'; // Use the correct key directly
        }
        // Special case for admin profile which can have multiple URL patterns
        else if (adminPath === 'profile' || adminPath === 'my-profile') {
            pageKey = 'admin-profile';
        } else {
            // For other admin pages, convert path to key
            pageKey = 'admin-' + (adminPath.replace(/\//g, '-') || 'dashboard');
        }
    } 
    // Handle instructor routes
    else if (pathname.includes('/instructor/')) {
        const instructorPath = pathname.split('/instructor/')[1];
        pageKey = 'instructor-' + (instructorPath.replace(/\//g, '-') || 'dashboard');
    } 
    // Handle student routes
    else if (pathname.includes('/student/')) {
        const studentPath = pathname.split('/student/')[1];
        pageKey = 'student-' + (studentPath.replace(/\//g, '-') || 'dashboard');
    } 
    // Handle other routes
    else {
        // Extract the last part of the URL for standard pages
        const pathParts = pathname.split('/').filter(Boolean);
        pageKey = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'dashboard';
    }
    
    return pageKey;
}

// Set up modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    const modalElement = document.getElementById('pageInfoModal');
    if (!modalElement) return;
    
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
    
    // Initialize the context info
    initializeContextInfo();
});

function initializeContextInfo() {
    // Get the current page from the URL
    const pathname = window.location.pathname;
    
    // Extract the page key from the URL
    let pageKey = '';
    
    // Handle admin routes
    if (pathname.includes('/admin/')) {
        let adminPath = pathname.split('/admin/')[1];
        
        // Handle cases where the path might include "admin-" already
        if (adminPath === 'admin-profile') {
            pageKey = 'admin-profile'; // Use the correct key directly
        }
        // Special case for admin profile which can have multiple URL patterns
        else if (adminPath === 'profile' || adminPath === 'my-profile') {
            pageKey = 'admin-profile';
        } else {
            // For other admin pages, convert path to key
            pageKey = 'admin-' + (adminPath.replace(/\//g, '-') || 'dashboard');
        }
    } 
    // Handle instructor routes
    else if (pathname.includes('/instructor/')) {
        const instructorPath = pathname.split('/instructor/')[1];
        pageKey = 'instructor-' + (instructorPath.replace(/\//g, '-') || 'dashboard');
    } 
    // Handle student routes
    else if (pathname.includes('/student/')) {
        const studentPath = pathname.split('/student/')[1];
        pageKey = 'student-' + (studentPath.replace(/\//g, '-') || 'dashboard');
    } 
    // Handle other routes
    else {
        // Extract the last part of the URL for standard pages
        const pathParts = pathname.split('/').filter(Boolean);
        pageKey = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'dashboard';
    }

    // Get the page information
    const pageInfo = window.pageInformation[pageKey];
    
    if (pageInfo) {
        // Update the context info in the DOM
        updatePageTitle(pageInfo.title);
        updateInstructions(pageInfo.features, pageInfo.instructions);
    } else {
        // Set default context info if none is found
        updatePageTitle('Page');
        updateInstructions(
            ['This page provides system functionality.'],
            ['Navigate using the controls provided on this page.']
        );
    }
}

function handleError(error) {
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
        'admin': {
            title: 'Admin Dashboard',
            description: 'Administrative control panel for managing the system.',
            features: [
                'Access to all admin modules',
                'System-wide configuration options',
                'User and data management tools'
            ],
            instructions: [
                'Use the sidebar to navigate between different admin modules',
                'Click on cards to access specific functionality',
                'Use the search function to find specific records'
            ]
        },
        'admin-dashboard': {
            title: 'Admin Dashboard',
            description: 'Overview of system statistics and key metrics for administrators.',
            features: [
                'View total users, students, and instructors',
                'Monitor active and inactive users',
                'Quick access to all administrative functions',
                'System health indicators and alerts'
            ],
            instructions: [
                'Use the cards to view overall statistics',
                'Click on specific sections to access detailed information',
                'Use the sidebar menu to navigate to other admin functions',
                'Check notifications for important system alerts'
            ]
        },
        'admin-profile': {
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
        // Common definitions that apply to both admin and regular routes
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
        'archive': {
            title: 'System Archives',
            description: 'Central hub for managing and accessing archived records from across the system, including classes, students, instructors, and companies.',
            features: [
                'View archived records by category (classes, students, instructors, companies)',
                'Restore archived items back to active status',
                'Permanently delete archived records when needed',
                'Search across all archive types or within specific categories',
                'Export archived data to CSV for reporting and record-keeping',
                'Track archive statistics with dynamic count cards'
            ],
            instructions: [
                'Click on the archive type cards to filter by record type',
                'Use the dropdown to select a specific archive category',
                'Search across all archives or within a selected category',
                'Click the "Restore" icon to reactivate archived records',
                'Use the "Delete" icon to permanently remove records (use with caution)',
                'Export filtered archives using the CSV export button',
                'Use pagination controls to navigate through archive records'
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
        },
        'view-archive': {
            title: 'View Archive',
            description: 'View and manage archived classes and students.',
            features: [
                'View archived classes and students',
                'Filter by date range',
                'Export archive data',
                'Search for specific records'
            ],
            instructions: [
                'Use filters to find specific records', 
                'Click on the view icon to see detailed class information',
                'Click on the edit icon to modify existing class details'
            ]
        },
        'settings': {
            title: 'System Settings',
            description: 'Configure system-wide settings and preferences.',
            features: [
                'Update system configuration',
                'Manage email templates',
                'Configure notification settings',
                'Set security parameters',
                'Manage backup and restoration'
            ],
            instructions: [
                'Navigate through setting categories using the tabs',
                'Make changes to configuration parameters as needed',
                'Save changes before leaving the page',
                'Test configuration changes in a controlled environment',
                'Review system logs for any configuration-related issues'
            ]
        },
        'instructor-dashboard': {
            title: 'Instructor Dashboard',
            description: 'Overview of your teaching schedule and important announcements from administration.',
            features: [
                'View your weekly teaching schedule organized by day',
                'See room assignments and class times at a glance',
                'Read important announcements from administration',
                'Quick access to all instructor functions',
                'Monitor upcoming classes and schedule changes'
            ],
            instructions: [
                'Review announcements at the top of the dashboard for important updates',
                'Navigate through your weekly schedule organized by day',
                'Click on class cards for more detailed information',
                'Use the sidebar to access other instructor functions',
                'Check room assignments and class times for each scheduled session'
            ]
        },
        'instructor-mark-attendance': {
            title: 'Mark Attendance',
            description: 'Record daily attendance for your assigned classes and students.',
            features: [
                'Mark attendance for your assigned classes',
                'Update student attendance status (present, absent, late)',
                'Record time stamps automatically',
                'Add notes regarding special circumstances',
                'View previous attendance records'
            ],
            instructions: [
                'Select the class from your assigned classes',
                'Choose the date for attendance recording',
                'Mark each student as present, absent, or late',
                'Add any relevant notes about exceptions or issues',
                'Save the attendance record when complete'
            ]
        },
        'instructor-view-attendance': {
            title: 'View Attendance',
            description: 'Review and analyze attendance records for your classes and students.',
            features: [
                'View attendance history for your classes',
                'Filter by date range or specific class',
                'See attendance statistics and patterns',
                'Export attendance data for reporting',
                'Identify students with attendance issues'
            ],
            instructions: [
                'Select a date range to view attendance records',
                'Use filters to narrow down to specific classes or students',
                'Review statistical data about attendance trends',
                'Export data for your records or reporting',
                'Identify students who may need intervention'
            ]
        },
        'instructor-profile': {
            title: 'Instructor Profile',
            description: 'View and manage your personal profile information and settings.',
            features: [
                'View your personal information',
                'Update contact details',
                'Manage teaching preferences',
                'Change password and security settings',
                'View teaching history and statistics'
            ],
            instructions: [
                'Review your current profile information',
                'Click the edit button to update your personal details',
                'Use the security tab to manage password and authentication',
                'Set teaching preferences to improve class assignments',
                'Save all changes before leaving the page'
            ]
        },
        'instructor-classes': {
            title: 'Instructor Classes',
            description: 'View and manage all your assigned classes and schedules.',
            features: [
                'View all your assigned classes',
                'See detailed class schedules and locations',
                'Access student rosters for each class',
                'Review class materials and curriculum',
                'Track class progress and completion status'
            ],
            instructions: [
                'Use filters to view current or past classes',
                'Click on a class to view detailed information',
                'Select the roster tab to see enrolled students',
                'Use the calendar view to see your weekly schedule',
                'Access class management tools through the action buttons'
            ]
        },
        'student-dashboard': {
            title: 'Student Dashboard',
            description: 'Overview of your classes, attendance records, and important announcements.',
            features: [
                'View your enrolled classes',
                'Check your attendance records',
                'Read important announcements',
                'Access class materials',
                'View your academic progress'
            ],
            instructions: [
                'Review announcements at the top for important updates',
                'Check your class schedule in the calendar section',
                'Monitor your attendance percentage for each class',
                'Access class materials through the resources tab',
                'Contact instructors using the messaging feature'
            ]
        },
        'student-classes': {
            title: 'Student Classes',
            description: 'View all your enrolled classes and related information.',
            features: [
                'View all classes you are enrolled in',
                'Check class schedules and locations',
                'Access class materials and assignments',
                'View instructor information',
                'Track your attendance for each class'
            ],
            instructions: [
                'Use the tabs to filter classes by term or status',
                'Click on a class to view detailed information',
                'Download class materials from the resources section',
                'Check your attendance status for each session',
                'Use the contact button to reach out to instructors'
            ]
        },
        'student-attendance': {
            title: 'Student Attendance',
            description: 'View your comprehensive attendance records across all classes.',
            features: [
                'View your attendance by class',
                'Track attendance percentage',
                'See detailed attendance logs',
                'Identify missed classes',
                'View attendance trends over time'
            ],
            instructions: [
                'Select a class to view specific attendance records',
                'Use date filters to check attendance for specific periods',
                'Review your overall attendance percentage',
                'Check absence reasons and documentation',
                'Export your attendance records if needed'
            ]
        },
        'student-profile': {
            title: 'Student Profile',
            description: 'View and manage your personal information and settings.',
            features: [
                'View your personal information',
                'Update contact details',
                'Manage notification preferences',
                'Change password and security settings',
                'View academic history and records'
            ],
            instructions: [
                'Review your current profile information',
                'Click the edit button to update your personal details',
                'Use the security tab to manage password and authentication',
                'Set notification preferences for important updates',
                'Save all changes before leaving the page'
            ]
        },
        'login': {
            title: 'Login Page',
            description: 'Secure access point to the system.',
            features: [
                'User authentication',
                'Password recovery',
                'Remember me functionality',
                'Secure connection',
                'Access control'
            ],
            instructions: [
                'Enter your username/email and password',
                'Click "Forgot Password" if you need to reset',
                'Check "Remember Me" for convenience on personal devices',
                'Contact system administrator if you experience issues',
                'Ensure you logout when using shared computers'
            ]
        },
        'logout': {
            title: 'Logout',
            description: 'Securely exit the system.',
            features: [
                'Secure session termination',
                'Data protection',
                'Session cleanup'
            ],
            instructions: [
                'Click logout to securely end your session',
                'Close your browser for additional security',
                'Log back in when you need to access the system again'
            ]
        },
        'reset-password': {
            title: 'Reset Password',
            description: 'Securely reset your password to regain access to your account.',
            features: [
                'Secure password reset process',
                'Email verification',
                'Strong password guidelines',
                'Account protection measures'
            ],
            instructions: [
                'Enter your registered email address',
                'Check your email for the password reset link',
                'Create a strong password following the guidelines',
                'Submit your new password to update your account',
                'Use your new password to log in'
            ]
        },
        'error': {
            title: 'Error Page',
            description: 'Information about system errors or access issues.',
            features: [
                'Error details',
                'Troubleshooting guidance',
                'Support contact information',
                'Navigation options to return to safety'
            ],
            instructions: [
                'Note the error code or message for reference',
                'Try refreshing the page or clearing browser cache',
                'Use the provided links to return to a working page',
                'Contact support if the issue persists',
                'Report the error with detailed steps to reproduce it'
            ]
        },
        '404': {
            title: 'Page Not Found',
            description: 'The requested page does not exist or is no longer available.',
            features: [
                'Clear error notification',
                'Navigation options',
                'Search functionality',
                'Support contact information'
            ],
            instructions: [
                'Check that the URL is correct',
                'Use the navigation menu to find what you need',
                'Return to the dashboard using the provided link',
                'Contact support if you believe this is an error',
                'Use the search function to find relevant content'
            ]
        }
    };
    
    // Add admin-prefixed aliases for all routes that need them
    // This prevents duplicate definitions while maintaining correct route matching
    const routesToDuplicate = [
        'user-management', 'student-management', 'instructor-management', 
        'company-management', 'class-management', 'enrolment-management', 
        'view-attendance', 'mark-attendance', 'view-archive', 'settings'
    ];
    
    routesToDuplicate.forEach(route => {
        if (window.pageInformation[route]) {
            window.pageInformation[`admin-${route}`] = window.pageInformation[route];
        }
    });
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
        
        // Give the modal time to complete its hiding animation
        setTimeout(() => {
            // Clean up modal remnants
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            
            // Remove backdrop
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
            
            // Remove any inline styles added by Bootstrap
            const modal = document.getElementById('pageInfoModal');
            if (modal) {
                modal.style.display = '';
                modal.style.paddingRight = '';
                modal.classList.remove('show');
                modal.setAttribute('aria-hidden', 'true');
                modal.removeAttribute('aria-modal');
                modal.removeAttribute('role');
            }
        }, 300); // 300ms should be enough for the modal animation to complete
    }
}
