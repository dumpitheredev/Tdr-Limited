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
            
            // Show a toast or alert with the class info
            showClassInfoToast(className, timeSlot);
            
            // Optional: Navigate to attendance or class details
            // const dayElement = this.closest('.row.g-3.mb-4').previousElementSibling.querySelector('.h5').textContent;
            // window.location.href = `/instructor/mark-attendance?class=${encodeURIComponent(className)}&day=${encodeURIComponent(dayElement)}`;
        });
    });
}

/**
 * Show a toast notification with class information using the shared toast component
 */
function showClassInfoToast(className, timeSlot) {
    // Get the existing toast elements from toast_notification.html
    const toast = document.getElementById('statusToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toast.querySelector('.toast-header i');
    
    if (!toast || !toastTitle || !toastMessage) {
        console.error('Toast notification elements not found');
        return;
    }
    
    // Set title and icon
    toastTitle.textContent = className;
    toastIcon.className = 'bi bi-calendar-check me-2';
    toastIcon.style.color = '#191970';
    
    // Create custom message with time slot and action buttons
    toastMessage.innerHTML = `
        <p class="mb-2">${timeSlot}</p>
        <div class="d-flex justify-content-between">
            <a href="/instructor/mark-attendance" class="btn btn-sm btn-outline" 
               style="border-color: #191970; color: #191970; transition: all 0.3s ease;"
               onmouseover="this.style.backgroundColor='#191970'; this.style.color='white';"
               onmouseout="this.style.backgroundColor=''; this.style.color='#191970';">
               <i class="bi bi-pencil-square me-1"></i>Mark Attendance
            </a>
            <a href="/instructor/view-attendance" class="btn btn-sm btn-outline" 
               style="border-color: #191970; color: #191970; transition: all 0.3s ease;"
               onmouseover="this.style.backgroundColor='#191970'; this.style.color='white';"
               onmouseout="this.style.backgroundColor=''; this.style.color='#191970';">
               <i class="bi bi-eye me-1"></i>View Attendance
            </a>
        </div>
    `;
    
    // Show the toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
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