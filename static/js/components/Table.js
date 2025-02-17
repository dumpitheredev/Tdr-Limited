export class Table {
    constructor(options) {
        this.tableId = options.tableId;
        this.paginationInfoId = options.paginationInfoId;
        this.rowsPerPageId = options.rowsPerPageId || 'rowsPerPage';
        this.searchInputId = options.searchInputId || 'searchInput';
        this.filterSelectId = options.filterSelectId || 'roleFilter';
        this.prevPageId = options.prevPageId || 'prevPage';
        this.nextPageId = options.nextPageId || 'nextPage';
        
        this.currentPage = 1;
        this.rowsPerPage = 5;
        this.allItems = [];
        this.filteredItems = [];
        
        this.init();
    }

    init() {
        this.table = document.getElementById(this.tableId);
        this.tbody = this.table.querySelector('tbody');
        this.rowsPerPageSelect = document.getElementById(this.rowsPerPageId);
        this.searchInput = document.getElementById(this.searchInputId);
        this.filterSelect = document.getElementById(this.filterSelectId);
        this.paginationInfo = document.getElementById(this.paginationInfoId);
        this.prevPageButton = document.getElementById(this.prevPageId);
        this.nextPageButton = document.getElementById(this.nextPageId);

        // Initialize data
        this.allItems = Array.from(this.tbody.getElementsByTagName('tr'));
        this.filteredItems = [...this.allItems];
        
        // Set initial rows per page
        if (this.rowsPerPageSelect) {
            this.rowsPerPage = parseInt(this.rowsPerPageSelect.value);
        }

        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        if (this.rowsPerPageSelect) {
            this.rowsPerPageSelect.addEventListener('change', (e) => {
                this.rowsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.render();
            });
        }

        if (this.prevPageButton) {
            this.prevPageButton.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.render();
                }
            });
        }

        if (this.nextPageButton) {
            this.nextPageButton.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredItems.length / this.rowsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.render();
                }
            });
        }

        // Search and filter handlers
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                this.currentPage = 1;
                this.filterItems();
            });
        }

        if (this.filterSelect) {
            this.filterSelect.addEventListener('change', () => {
                this.currentPage = 1;
                this.filterItems();
            });
        }
    }

    filterItems() {
        const searchTerm = this.searchInput?.value.toLowerCase() || '';
        const filterValue = this.filterSelect?.value || '';

        this.filteredItems = this.allItems.filter(row => {
            const name = row.querySelector('.fw-medium')?.textContent.toLowerCase() || '';
            const userId = row.querySelector('.text-muted.small')?.textContent.toLowerCase() || '';
            const role = row.querySelector('td:nth-child(2)')?.textContent.trim() || '';

            const matchesSearch = !searchTerm || name.includes(searchTerm) || userId.includes(searchTerm);
            const matchesRole = !filterValue || role === filterValue;

            return matchesSearch && matchesRole;
        });

        this.render();
    }

    render() {
        // Always get fresh values
        const currentRowsPerPage = parseInt(this.rowsPerPageSelect?.value || this.rowsPerPage);
        const totalItems = this.filteredItems.length;
        
        // Calculate pagination numbers
        const startIndex = (this.currentPage - 1) * currentRowsPerPage;
        const endIndex = Math.min(startIndex + currentRowsPerPage, totalItems);
        const totalPages = Math.ceil(totalItems / currentRowsPerPage);
        
        // Update pagination display BEFORE modifying the table
        if (this.paginationInfo) {
            const displayStart = startIndex + 1;
            const displayEnd = endIndex;
            this.paginationInfo.textContent = totalItems === 0 
                ? "0-0 of 0" 
                : `${displayStart}-${displayEnd} of ${totalItems}`;
        }
        
        // Update table display
        this.allItems.forEach(row => row.style.display = 'none');
        
        // Show current page items
        for (let i = startIndex; i < endIndex; i++) {
            if (this.filteredItems[i]) {
                this.filteredItems[i].style.display = '';
            }
        }
        
        // Update navigation buttons
        if (this.prevPageButton) {
            this.prevPageButton.disabled = this.currentPage <= 1;
        }
        if (this.nextPageButton) {
            this.nextPageButton.disabled = this.currentPage >= totalPages;
        }
    }

    addItem(newRow) {
        this.tbody.insertBefore(newRow, this.tbody.firstChild);
        this.allItems = Array.from(this.tbody.getElementsByTagName('tr'));
        this.filteredItems = [...this.allItems];
        this.render();
    }

    getFilteredData() {
        return this.filteredItems;
    }
} 