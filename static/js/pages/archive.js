document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const archiveTypeFilter = document.getElementById('archiveTypeFilter');
    const searchInput = document.getElementById('searchInput');
    const defaultMessage = document.getElementById('defaultMessage');
    const archiveTables = document.querySelectorAll('.archive-table');
    const rowsPerPage = document.getElementById('rowsPerPage');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    // Mock data counts for each archive type
    const archiveCounts = {
        'student': 24,
        'class': 18,
        'company': 9,
        'instructor': 12
    };
    
    // Current page and items per page
    let currentPage = 1;
    let itemsPerPage = parseInt(rowsPerPage.value);
    let currentArchiveType = '';
    let totalItems = 0;
    
    // Initialize with default message visible
    defaultMessage.style.display = 'block';
    
    // Handle archive type selection
    archiveTypeFilter.addEventListener('change', function() {
        currentArchiveType = this.value;
        
        // Hide all tables first
        defaultMessage.style.display = 'none';
        archiveTables.forEach(table => table.style.display = 'none');
        
        // Show the selected table
        if (currentArchiveType) {
            const selectedTable = document.getElementById(`${currentArchiveType}ArchiveTable`);
            if (selectedTable) {
                selectedTable.style.display = 'block';
                totalItems = archiveCounts[currentArchiveType] || 0;
                currentPage = 1;
                updatePageInfo();
            }
        } else {
            // Show default message if no selection
            defaultMessage.style.display = 'block';
        }
    });
    
    // Handle search functionality
    searchInput.addEventListener('input', function() {
        if (!currentArchiveType) return;
        
        const searchTerm = this.value.toLowerCase();
        const tableBody = document.getElementById(`${currentArchiveType}ArchiveBody`);
        if (!tableBody) return;
        
        const tableRows = tableBody.querySelectorAll('tr');
        let visibleCount = 0;
        
        // Filter the visible table
        tableRows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const isVisible = text.includes(searchTerm);
            row.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        });
        
        // Update pagination info based on search results
        totalItems = visibleCount;
        currentPage = 1;
        updatePageInfo();
    });
    
    // Function to update pagination information
    function updatePageInfo() {
        const start = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
        const end = Math.min(start + itemsPerPage - 1, totalItems);
        pageInfo.textContent = `${start}-${end} of ${totalItems}`;
        
        // Update button states
        prevPage.disabled = currentPage === 1;
        nextPage.disabled = end >= totalItems;
    }
    
    // Handle rows per page change
    rowsPerPage.addEventListener('change', function() {
        itemsPerPage = parseInt(this.value);
        currentPage = 1;
        updatePageInfo();
        
        // In a real application, this would trigger a reload of the data with the new page size
        console.log(`Rows per page changed to: ${itemsPerPage}`);
    });
    
    // Handle pagination clicks
    prevPage.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            updatePageInfo();
            // In a real application, this would load the previous page of data
            console.log(`Navigated to page ${currentPage}`);
        }
    });
    
    nextPage.addEventListener('click', function() {
        const maxPage = Math.ceil(totalItems / itemsPerPage);
        if (currentPage < maxPage) {
            currentPage++;
            updatePageInfo();
            // In a real application, this would load the next page of data
            console.log(`Navigated to page ${currentPage}`);
        }
    });
    
    // Initialize pagination display
    updatePageInfo();
}); 