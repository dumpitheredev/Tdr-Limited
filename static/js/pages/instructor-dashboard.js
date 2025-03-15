/**
 * Instructor Dashboard JavaScript
 * Handles calendar widget and other dashboard functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    initializeClassHighlighting();
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
function toggleAnnouncement(announcementId) {
    const announcement = document.getElementById(`announcement-${announcementId}`);
    if (announcement) {
        const content = announcement.querySelector('.announcement-content');
        content.classList.toggle('announcement-expanded');
        
        const toggleIcon = announcement.querySelector('.toggle-icon');
        if (toggleIcon) {
            toggleIcon.classList.toggle('bi-chevron-down');
            toggleIcon.classList.toggle('bi-chevron-up');
        }
    }
} 