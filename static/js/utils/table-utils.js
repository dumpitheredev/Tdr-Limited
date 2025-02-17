export class TableManager {
    constructor(options) {
        // Required options
        this.tableId = options.tableId;
        this.paginationInfoId = options.paginationInfoId;
        
        // Optional options with defaults
        this.rowsPerPageId = options.rowsPerPageId || 'rowsPerPage';
        this.searchInputId = options.searchInputId || 'searchInput';
        this.filterSelectId = options.filterSelectId || 'roleFilter';
        this.prevPageId = options.prevPageId || 'prevPage';
        this.nextPageId = options.nextPageId || 'nextPage';
        
        // State
        this.currentPage = 1;
        this.rowsPerPage = 5;
        this.allItems = [];
        this.filteredItems = [];
        
        // Initialize
        this.init();
    }

    init() {
        // Get DOM elements
        this.tbody = document.getElementById(this.tableId).querySelector('tbody');
        this.rowsPerPageSelect = document.getElementById(this.rowsPerPageId);
        this.searchInput = document.getElementById(this.searchInputId);
        this.filterSelect = document.getElementById(this.filterSelectId);
        this.paginationInfo = document.getElementById(this.paginationInfoId);
        this.prevPageButton = document.getElementById(this.prevPageId);
        this.nextPageButton = document.getElementById(this.nextPageId);

        // Store initial data
        this.allItems = Array.from(this.tbody.getElementsByTagName('tr'));
        this.filteredItems = [...this.allItems];

        this.setupEventListeners();
        this.updateTable();
    }

    setupEventListeners() {
        // Rows per page
        this.rowsPerPageSelect?.addEventListener('change', () => {
            this.rowsPerPage = parseInt(this.rowsPerPageSelect.value);
            this.currentPage = 1;
            this.updateTable();
        });

        // Search and filter
        this.searchInput?.addEventListener('input', () => this.filterItems());
        this.filterSelect?.addEventListener('change', () => this.filterItems());

        // Pagination
        this.prevPageButton?.addEventListener('click', () => this.previousPage());
        this.nextPageButton?.addEventListener('click', () => this.nextPage());
    }

    filterItems() {
        const searchTerm = this.searchInput?.value.toLowerCase() || '';
        const filterValue = this.filterSelect?.value || '';

        this.filteredItems = this.allItems.filter(row => {
            const name = row.querySelector('.fw-medium')?.textContent.toLowerCase() || '';
            const userId = row.querySelector('.text-muted.small')?.textContent.toLowerCase() || '';
            const role = row.querySelector('td:nth-child(2)')?.textContent || '';

            const matchesSearch = searchTerm === '' || 
                                name.includes(searchTerm) || 
                                userId.includes(searchTerm);
            const matchesRole = filterValue === '' || role === filterValue;

            return matchesSearch && matchesRole;
        });

        this.currentPage = 1;
        this.updateTable();
    }

    updateTable() {
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        const totalItems = this.filteredItems.length;

        // Hide all rows
        this.allItems.forEach(row => row.style.display = 'none');

        // Show filtered rows for current page
        this.filteredItems.slice(startIndex, endIndex).forEach(row => row.style.display = '');

        // Update pagination info
        const displayStart = totalItems === 0 ? 0 : startIndex + 1;
        const displayEnd = Math.min(endIndex, totalItems);
        this.paginationInfo.textContent = `${displayStart}-${displayEnd} of ${totalItems}`;

        // Update button states
        this.prevPageButton.disabled = this.currentPage === 1;
        this.nextPageButton.disabled = endIndex >= totalItems;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateTable();
        }
    }

    nextPage() {
        const maxPage = Math.ceil(this.filteredItems.length / this.rowsPerPage);
        if (this.currentPage < maxPage) {
            this.currentPage++;
            this.updateTable();
        }
    }

    addItem(newRow) {
        this.tbody.insertBefore(newRow, this.tbody.firstChild);
        this.allItems = Array.from(this.tbody.getElementsByTagName('tr'));
        this.filterItems();
    }
} 