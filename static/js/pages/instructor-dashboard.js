/**
 * Instructor Dashboard JavaScript
 * Handles calendar widget and other dashboard functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    initializeClassHighlighting();
    initializeScheduleBlocks();
    
    // Initialize any announcement content that's too long
    document.querySelectorAll('.announcement-content').forEach(function(el) {
        if (el.scrollHeight > el.clientHeight) {
            el.dataset.expanded = 'false';
        } else {
            // Hide the "Read more" button for short content
            const button = el.nextElementSibling;
            if (button && button.tagName === 'BUTTON') {
                button.style.display = 'none';
            }
        }
    });
});

/**
 * Initialize the calendar widget using flatpickr
 */
function initializeCalendar() {
    const calendarEl = document.getElementById('instructorCalendar');
    if (!calendarEl) return;
    
    // Get class dates from data attribute
    const classDatesStr = calendarEl.getAttribute('data-class-dates');
    const classDates = classDatesStr ? JSON.parse(classDatesStr) : [];
    
    // Initialize flatpickr
    flatpickr(calendarEl, {
        inline: true,
        disable: [
            function(date) {
                // Disable weekends
                return date.getDay() === 0 || date.getDay() === 6;
            }
        ],
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            // Mark dates with classes
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (classDates.includes(dateStr)) {
                dayElem.innerHTML += "<span class='event-dot'></span>";
            }
        }
    });
}

/**
 * Add hover effects and click handlers to class blocks
 */
function initializeClassHighlighting() {
    const classBlocks = document.querySelectorAll('.class-block');
    
    classBlocks.forEach(block => {
        // Add hover effect
        block.addEventListener('mouseenter', function() {
            this.style.boxShadow = '0 0.125rem 0.25rem rgba(0, 0, 0, 0.1)';
            this.style.transform = 'translateY(-2px)';
            this.style.transition = 'all 0.2s ease';
        });
        
        block.addEventListener('mouseleave', function() {
            this.style.boxShadow = '';
            this.style.transform = '';
        });
        
        // Add click handler
        block.addEventListener('click', function() {
            const classId = this.getAttribute('data-class-id');
            if (classId) {
                // For future: Navigate to class details or attendance page
                console.log(`Clicked class: ${classId}`);
                // Example: window.location.href = `/mark-attendance/${classId}`;
            }
        });
    });
}

/**
 * Initialize click handlers for schedule blocks
 */
function initializeScheduleBlocks() {
    // Target all class schedule blocks
    const scheduleBlocks = document.querySelectorAll('.row.g-3.mb-4 .col .p-3.rounded');
    
    scheduleBlocks.forEach(block => {
        // Add hover effect
        block.addEventListener('mouseenter', function() {
            this.style.boxShadow = '0 0.125rem 0.25rem rgba(0, 0, 0, 0.1)';
            this.style.transform = 'translateY(-2px)';
            this.style.transition = 'all 0.2s ease';
            this.style.cursor = 'pointer';
        });
        
        block.addEventListener('mouseleave', function() {
            this.style.boxShadow = '';
            this.style.transform = '';
        });
        
        // Add click handler
        block.addEventListener('click', function() {
            // Get class name and time from the block
            const className = this.querySelector('div[style="color: #191970;"]').textContent;
            const timeSlot = this.querySelector('.small.text-muted').textContent;
            const classId = this.getAttribute('data-class-id');
            
            // Use the status toast component
            showSystemToast('Class Selected', `${className} (${timeSlot})`, 'info');
            
            // Get day from the closest heading
            const dayElement = this.closest('.row.g-3.mb-4').previousElementSibling.querySelector('.h5');
            const day = dayElement ? dayElement.textContent.trim() : '';
            
            // Show class actions in the modal or toast
            showClassActions(className, timeSlot, day, classId);
        });
    });
}

/**
 * Show class actions using the system toast notification
 */
function showClassActions(className, timeSlot, day, classId) {
    // Get the existing toast elements from the toast_notification.html component
    const statusToast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!statusToast || !toastTitle || !toastMessage) {
        console.error('Toast notification components not found');
        return;
    }
    
    // Update toast header
    const toastHeader = statusToast.querySelector('.toast-header i');
    toastHeader.className = 'bi bi-calendar-check text-primary me-2';
    toastTitle.textContent = className;
    
    // Create action buttons with system colors
    let queryParams = '';
    if (classId) {
        queryParams = `?class_id=${classId}`;
    } else {
        queryParams = `?class=${encodeURIComponent(className)}&day=${encodeURIComponent(day)}`;
    }
    
    toastMessage.innerHTML = `
        <div>${timeSlot} (${day})</div>
        <div class="d-flex justify-content-between mt-2">
            <a href="/instructor/mark-attendance${queryParams}" class="btn btn-sm" style="background-color: #191970; color: white;">
                <i class="bi bi-check-circle me-1"></i>Mark Attendance
            </a>
            <a href="/instructor/view-attendance${queryParams}" class="btn btn-sm btn-outline-secondary">
                <i class="bi bi-eye me-1"></i>View Attendance
            </a>
        </div>
    `;
    
    // Show the toast
    const bsToast = new bootstrap.Toast(statusToast, {
        autohide: false
    });
    bsToast.show();
}

/**
 * Show a toast notification using the system component
 */
function showSystemToast(title, message, type = 'success') {
    // Get the toast elements
    const statusToast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastHeader = statusToast.querySelector('.toast-header i');
    
    // Set icon and color based on type
    if (type === 'success') {
        toastHeader.className = 'bi bi-check-circle-fill text-success me-2';
    } else if (type === 'error' || type === 'danger') {
        toastHeader.className = 'bi bi-exclamation-triangle-fill text-danger me-2';
    } else if (type === 'warning') {
        toastHeader.className = 'bi bi-exclamation-circle-fill text-warning me-2';
    } else if (type === 'info') {
        toastHeader.className = 'bi bi-info-circle-fill text-info me-2';
    }
    
    // Set title and message
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Show the toast
    const bsToast = new bootstrap.Toast(statusToast, {
        autohide: true,
        delay: 3000
    });
    bsToast.show();
}

/**
 * Highlight today's classes in the schedule
 */
function highlightTodayClasses() {
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today.getDay()];
    
    const todaySection = document.querySelector(`[data-day="${todayName}"]`);
    if (todaySection) {
        todaySection.classList.add('today-highlight');
        
        // Scroll to today's section
        todaySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Toggle announcement expand/collapse
 */
function toggleAnnouncement(id) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const button = element.nextElementSibling;
    
    if (element.classList.contains('expanded')) {
        element.classList.remove('expanded');
        button.textContent = 'Read more';
    } else {
        element.classList.add('expanded');
        button.textContent = 'Show less';
    }
} 