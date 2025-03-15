// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Load data
    loadCompanies();
    loadClasses();
    
    // Add event listener for the enroll button
    document.getElementById('enrollStudentsBtn').addEventListener('click', handleEnrolment);
    
    // Load data when modal opens
    document.getElementById('addEnrolmentModal').addEventListener('show.bs.modal', function() {
        loadUnenrolledStudents();
        loadCompanies();
        loadClasses();
    });
});

// Load unenrolled students
async function loadUnenrolledStudents() {
    try {
        const response = await fetch('/api/students/unenrolled');
        if (!response.ok) throw new Error('Failed to fetch students');
        const students = await response.json();

        const studentSelect = document.getElementById('studentSelect');
        studentSelect.innerHTML = '';
        
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.user_id;
            option.textContent = `${student.name} (${student.user_id})`;
            studentSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error:', error);
        showToast('Error loading students', 'error');
    }
}

// Load companies
async function loadCompanies() {
    try {
        const response = await fetch('/api/companies');
        if (!response.ok) throw new Error('Failed to fetch companies');
        const data = await response.json();

        // Ensure we have an array to work with
        const companies = Array.isArray(data) ? data : (data.companies || []);

        const companySelect = document.getElementById('companySelect');
        if (companySelect) {
            companySelect.innerHTML = '<option value="">Choose a company...</option>';
            
            companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.company_id;
                option.textContent = company.name;
                companySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error loading companies', 'error');
    }
}

// Load classes
async function loadClasses() {
    try {
        const response = await fetch('/api/classes');
        if (!response.ok) throw new Error('Failed to fetch classes');
        const classes = await response.json();

        const classCheckboxes = document.getElementById('classCheckboxes');
        classCheckboxes.innerHTML = '';
        
        classes.forEach(cls => {
            const div = document.createElement('div');
            div.className = 'form-check mb-2';
            
            const input = document.createElement('input');
            input.className = 'form-check-input';
            input.type = 'checkbox';
            input.value = cls.class_id;
            input.id = `class${cls.class_id}`;
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `class${cls.class_id}`;
            label.innerHTML = `
                ${cls.name} (${cls.day}, ${cls.time})
                <div class="text-muted small">Instructor: ${cls.instructor}</div>
            `;
            
            div.appendChild(input);
            div.appendChild(label);
            classCheckboxes.appendChild(div);
        });
    } catch (error) {
        console.error('Error:', error);
        showToast('Error loading classes', 'error');
    }
}

// Handle enrolment submission
async function handleEnrolment() {
    const studentSelect = document.getElementById('studentSelect');
    const selectedStudents = Array.from(studentSelect.selectedOptions).map(opt => opt.value);
    
    if (selectedStudents.length === 0) {
        showToast('Please select at least one student', 'error');
        return;
    }

    const formData = {
        student_ids: selectedStudents,
        group: document.getElementById('groupSelect').value,
        company_id: document.getElementById('companySelect').value,
        class_ids: Array.from(document.querySelectorAll('#classCheckboxes input:checked'))
                       .map(cb => cb.value),
        notes: document.getElementById('enrolmentNotes').value
    };

    try {
        const response = await fetch('/api/enrolments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showToast('Enrollment(s) created successfully', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('addEnrolmentModal'));
            modal.hide();
            // Refresh the page or update the table
            location.reload();
        } else {
            throw new Error('Failed to create enrollment');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error creating enrollment', 'error');
    }
}

// View enrollment details
function viewEnrolment(studentId) {
    // In a real application, you would fetch the enrollment details for this student
    // and display them in a modal or redirect to a details page
    console.log(`Viewing enrollment for student: ${studentId}`);
    
    // For now, we'll just show a toast notification
    showToast(`Viewing enrollment for student: ${studentId}`, 'info');
    
    // Optionally, you could open a modal with the enrollment details
    // const viewModal = new bootstrap.Modal(document.getElementById('viewEnrolmentModal'));
    // viewModal.show();
}

// Edit enrollment
function editEnrolment(studentId) {
    // In a real application, you would fetch the enrollment details for this student
    // and populate a form for editing
    console.log(`Editing enrollment for student: ${studentId}`);
    
    // For now, we'll just show a toast notification
    showToast(`Editing enrollment for student: ${studentId}`, 'info');
    
    // Optionally, you could open a modal with the enrollment details for editing
    // const editModal = new bootstrap.Modal(document.getElementById('editEnrolmentModal'));
    // editModal.show();
}

// Show toast notifications
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

