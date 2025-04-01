/**
 * This file contains the fixed API endpoints for the company management
 * To fix the issue:
 * 1. In company-management.js:
 *    - Change all instances of fetch(`/api/companies/${companyId}`) to fetch(`/api/companies-direct/${companyId}`)
 *    - Change fetch(`/api/companies`) to fetch(`/api/companies-direct`)
 * 
 * 2. In enrolment-management.js:
 *    - Change fetch('/api/companies') to fetch('/api/companies-direct')
 */

// Example of the correct code for handleCompanyAction:
window.handleCompanyAction = function(action, companyId) {
    switch(action) {
        case 'edit':
            fetch(`/api/companies-direct/${companyId}`)
                .then(response => response.json())
                .then(company => {
                    // Rest of code...

                    // In the fetch for updating:
                    fetch(`/api/companies-direct/${companyId}`, {
                        method: 'PUT',
                        // Rest of code...
                    })
                });
            break;
        case 'view':
            fetch(`/api/companies-direct/${companyId}`)
                .then(response => response.json())
                .then(company => {
                    // Rest of code...
                });
            break;
    }
};

// Example of the correct code for loadCompanies in enrolment-management.js:
async function loadCompanies() {
    try {
        const response = await fetch('/api/companies-direct');
        if (!response.ok) throw new Error('Failed to fetch companies');
        const data = await response.json();
        
        // Rest of code...
    } catch (error) {
        console.error('Error:', error);
        showToast('Error loading companies', 'error');
    }
} 