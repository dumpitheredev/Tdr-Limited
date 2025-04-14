/**
 * TableManager - Utility for managing table data, sorting, filtering and pagination
 */
export class TableManager {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     * @param {string} options.tableSelector - CSS selector for table element
     * @param {Function} [options.dataSource] - Function that returns data promise
     * @param {Function} [options.rowRenderer] - Function to render a row from an item
     * @param {Object} [options.pagination] - Pagination options
     * @param {boolean} [options.pagination.enabled=true] - Whether pagination is enabled
     * @param {string} [options.pagination.containerSelector] - Selector for pagination container
     * @param {number} [options.pagination.pageSize=10] - Items per page
     * @param {Function} [options.pagination.template] - Custom pagination template function
     * @param {Object} [options.sorting] - Sorting options
     * @param {boolean} [options.sorting.enabled=true] - Whether sorting is enabled
     * @param {string} [options.sorting.defaultColumn] - Default column to sort by
     * @param {string} [options.sorting.defaultDirection='asc'] - Default sort direction
     * @param {Object} [options.filters={}] - Initial filter values
     * @param {boolean} [options.updateUrlParams=false] - Whether to update URL parameters
     */
    constructor(options) {
        this.options = Object.assign({
            tableSelector: '',
            dataSource: null,
            rowRenderer: null,
            pagination: {
                enabled: true,
                containerSelector: null,
                pageSize: 10,
                template: null
            },
            sorting: {
                enabled: true,
                defaultColumn: null,
                defaultDirection: 'asc'
            },
            filters: {},
            updateUrlParams: false
        }, options);
        
        this.tableElement = document.querySelector(this.options.tableSelector);
        if (!this.tableElement) {
            console.error(`Table element not found: ${this.options.tableSelector}`);
            return;
        }
        
        this.data = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.sortColumn = this.options.sorting.defaultColumn;
        this.sortDirection = this.options.sorting.defaultDirection;
        this.filters = { ...this.options.filters };
        
        // If URL params should be used, initialize from them
        if (this.options.updateUrlParams) {
            this._initFromUrlParams();
        }
        
        this._setupEventListeners();
    }
    
    /**
     * Initialize table with data
     * @param {Array} [data] - Optional data to initialize with
     * @returns {Promise} - Promise resolving when table is initialized
     */
    async initialize(data) {
        try {
            // If data is provided, use it
            if (data) {
                this.data = data;
            } 
            // Otherwise, fetch data from dataSource if available
            else if (typeof this.options.dataSource === 'function') {
                this.data = await this.options.dataSource(this.filters);
            }
            
            this._applyFilters();
            this._applySort();
            this._render();
            
            return this.data;
        } catch (error) {
            console.error('Error initializing table:', error);
            throw error;
        }
    }
    
    /**
     * Refresh table data and re-render
     * @param {boolean} [resetPagination=false] - Whether to reset to first page
     * @returns {Promise} - Promise resolving when table is refreshed
     */
    async refresh(resetPagination = false) {
        try {
            if (resetPagination) {
            this.currentPage = 1;
            }
            
            if (typeof this.options.dataSource === 'function') {
                this.data = await this.options.dataSource(this.filters);
            }
            
            this._applyFilters();
            this._applySort();
            this._render();
            
            // Update URL parameters if enabled
            if (this.options.updateUrlParams) {
                this._updateUrlParams();
            }
            
            return this.data;
        } catch (error) {
            console.error('Error refreshing table:', error);
            throw error;
        }
    }
    
    /**
     * Apply filters to the data
     * @param {Object} filters - Filter values to apply
     * @param {boolean} [refresh=true] - Whether to refresh the table
     */
    applyFilters(filters, refresh = true) {
        this.filters = { ...this.filters, ...filters };
        
        if (refresh) {
            this.refresh(true);
        }
    }
    
    /**
     * Clear all filters
     * @param {boolean} [refresh=true] - Whether to refresh the table
     */
    clearFilters(refresh = true) {
        this.filters = {};
        
        if (refresh) {
            this.refresh(true);
        }
    }
    
    /**
     * Sort the table by a column
     * @param {string} column - Column to sort by
     * @param {string} [direction] - Sort direction ('asc' or 'desc')
     * @param {boolean} [refresh=true] - Whether to refresh the table
     */
    sortBy(column, direction, refresh = true) {
        if (direction === undefined) {
            // Toggle direction if sorting by the same column
            if (column === this.sortColumn) {
                direction = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                direction = 'asc';
            }
        }
        
        this.sortColumn = column;
        this.sortDirection = direction;
        
        if (refresh) {
            this._applySort();
            this._render();
            
            // Update URL parameters if enabled
            if (this.options.updateUrlParams) {
                this._updateUrlParams();
            }
        }
    }
    
    /**
     * Go to a specific page
     * @param {number} page - Page number
     * @param {boolean} [refresh=true] - Whether to refresh the table
     */
    goToPage(page, refresh = true) {
        const totalPages = this._getTotalPages();
        this.currentPage = Math.max(1, Math.min(page, totalPages));
        
        if (refresh) {
            this._render();
            
            // Update URL parameters if enabled
            if (this.options.updateUrlParams) {
                this._updateUrlParams();
            }
        }
    }
    
    /**
     * Get the current page data
     * @returns {Array} - Data for current page
     */
    getCurrentPageData() {
        if (!this.options.pagination.enabled) {
            return this.filteredData;
        }
        
        const startIndex = (this.currentPage - 1) * this.options.pagination.pageSize;
        const endIndex = startIndex + this.options.pagination.pageSize;
        return this.filteredData.slice(startIndex, endIndex);
    }
    
    /**
     * Apply filtering to the data
     * @private
     */
    _applyFilters() {
        // If no filter values, use all data
        if (Object.keys(this.filters).length === 0) {
            this.filteredData = [...this.data];
            return;
        }
        
        // Filter data based on filter values
        this.filteredData = this.data.filter(item => {
            // Check each filter
            for (const [key, value] of Object.entries(this.filters)) {
                // Skip empty filter values
                if (value === undefined || value === null || value === '') {
                    continue;
                }
                
                // Get item value (handle nested properties with dot notation)
                const itemValue = key.split('.').reduce((obj, prop) => {
                    return obj && obj[prop] !== undefined ? obj[prop] : null;
                }, item);
                
                // Skip if property doesn't exist
                if (itemValue === null) {
                    return false;
                }
                
                // Different filtering based on value type
                if (typeof value === 'string') {
                    // String: case-insensitive search
                    const stringValue = String(itemValue).toLowerCase();
                    if (!stringValue.includes(value.toLowerCase())) {
                        return false;
                    }
                } else if (Array.isArray(value)) {
                    // Array: check if value is in array
                    if (!value.includes(itemValue)) {
                        return false;
                    }
                } else if (typeof value === 'object' && value !== null) {
                    // Object: could be range or complex filter
                    if (value.min !== undefined && itemValue < value.min) {
                        return false;
                    }
                    if (value.max !== undefined && itemValue > value.max) {
                        return false;
                    }
                } else {
                    // Simple equality for other types
                    if (itemValue != value) { // Use loose equality for type coercion
                        return false;
                    }
                }
            }
            
            return true;
        });
    }
    
    /**
     * Apply sorting to the data
     * @private
     */
    _applySort() {
        // Skip if no sort column
        if (!this.sortColumn) {
            return;
        }
        
        this.filteredData.sort((a, b) => {
            // Get values (handle nested properties with dot notation)
            const aValue = this.sortColumn.split('.').reduce((obj, prop) => {
                return obj && obj[prop] !== undefined ? obj[prop] : null;
            }, a);
            
            const bValue = this.sortColumn.split('.').reduce((obj, prop) => {
                return obj && obj[prop] !== undefined ? obj[prop] : null;
            }, b);
            
            // Handle null/undefined values
            if (aValue === null && bValue === null) return 0;
            if (aValue === null) return this.sortDirection === 'asc' ? -1 : 1;
            if (bValue === null) return this.sortDirection === 'asc' ? 1 : -1;
            
            // Compare based on value type
            let result;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                result = aValue.localeCompare(bValue);
            } else if (aValue instanceof Date && bValue instanceof Date) {
                result = aValue.getTime() - bValue.getTime();
            } else {
                result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            }
            
            // Apply sort direction
            return this.sortDirection === 'asc' ? result : -result;
        });
    }
    
    /**
     * Render the table with current data
     * @private
     */
    _render() {
        const tbody = this.tableElement.querySelector('tbody');
        if (!tbody) {
            console.error('Table body not found');
            return;
        }
        
        // Clear table body
        tbody.innerHTML = '';
        
        // Get data for current page
        const pageData = this.getCurrentPageData();
        
        // If no data, show empty message
        if (pageData.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.setAttribute('colspan', '1000'); // Use large number to span all columns
            emptyCell.textContent = 'No data found';
            emptyCell.classList.add('text-center');
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
            
            // Render pagination if enabled
            if (this.options.pagination.enabled) {
                this._renderPagination();
            }
            return;
        }
        
        // Render rows
        if (typeof this.options.rowRenderer === 'function') {
            // Use custom row renderer
            pageData.forEach(item => {
                const rowHtml = this.options.rowRenderer(item);
                if (typeof rowHtml === 'string') {
                    // If string HTML returned
                    const tr = document.createElement('tr');
                    tr.innerHTML = rowHtml;
                    tbody.appendChild(tr);
                } else if (rowHtml instanceof HTMLElement) {
                    // If DOM element returned
                    tbody.appendChild(rowHtml);
                }
            });
        } else {
            // Default renderer: create a cell for each property
            pageData.forEach(item => {
                const tr = document.createElement('tr');
                for (const key in item) {
                    const td = document.createElement('td');
                    td.textContent = item[key];
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            });
        }
        
        // Update column headers to show sort indicators
        if (this.options.sorting.enabled) {
            this._updateSortIndicators();
        }
        
        // Render pagination if enabled
        if (this.options.pagination.enabled) {
            this._renderPagination();
        }
    }
    
    /**
     * Update sort indicators in table header
     * @private
     */
    _updateSortIndicators() {
        // Remove existing sort indicators
        this.tableElement.querySelectorAll('th').forEach(th => {
            th.classList.remove('sorting', 'sorting-asc', 'sorting-desc');
            
            // Remove existing sort icons
            const icons = th.querySelectorAll('.sort-icon');
            icons.forEach(icon => icon.remove());
        });
        
        // If no sort column, no indicators to add
        if (!this.sortColumn) {
            return;
        }
        
        // Find header cell for sort column
        const headers = Array.from(this.tableElement.querySelectorAll('th'));
        const sortHeader = headers.find(th => th.dataset.sort === this.sortColumn);
        
        if (sortHeader) {
            // Add sort indicator class
            sortHeader.classList.add('sorting', `sorting-${this.sortDirection}`);
            
            // Add sort icon if not exists
            const sortIcon = document.createElement('span');
            sortIcon.classList.add('sort-icon', 'ms-1');
            sortIcon.innerHTML = this.sortDirection === 'asc' ? '↑' : '↓';
            sortHeader.appendChild(sortIcon);
        }
    }
    
    /**
     * Render pagination controls
     * @private
     */
    _renderPagination() {
        if (!this.options.pagination.containerSelector) {
            return;
        }
        
        const paginationContainer = document.querySelector(this.options.pagination.containerSelector);
        if (!paginationContainer) {
            return;
        }
        
        const totalPages = this._getTotalPages();
        const totalItems = this.filteredData.length;
        
        // Use custom template if provided
        if (typeof this.options.pagination.template === 'function') {
            paginationContainer.innerHTML = this.options.pagination.template({
                currentPage: this.currentPage,
                totalPages,
                totalItems,
                pageSize: this.options.pagination.pageSize,
                startItem: Math.min((this.currentPage - 1) * this.options.pagination.pageSize + 1, totalItems),
                endItem: Math.min(this.currentPage * this.options.pagination.pageSize, totalItems)
            });
            
            // Add event listeners
            this._setupPaginationEventListeners(paginationContainer);
            return;
        }
        
        // Otherwise use default template
        let html = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="pagination-info">
                    Showing ${Math.min((this.currentPage - 1) * this.options.pagination.pageSize + 1, totalItems)} to 
                    ${Math.min(this.currentPage * this.options.pagination.pageSize, totalItems)} of ${totalItems} items
                </div>
                <ul class="pagination mb-0">
        `;
        
        // Previous button
        html += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage - 1}" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;
        
        // Page buttons
        const maxPages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(totalPages, startPage + maxPages - 1);
        
        // Adjust start if end is maxed out
        if (endPage === totalPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        // First page button if not at beginning
        if (startPage > 1) {
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">1</a>
                </li>
            `;
            
            if (startPage > 2) {
                html += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
                    </li>
                `;
            }
        }
        
        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Last page button if not at end
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
                    </li>
                `;
            }
            
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
                </li>
            `;
        }
        
        // Next button
        html += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage + 1}" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;
        
        html += `
                </ul>
            </div>
        `;
        
        paginationContainer.innerHTML = html;
        
        // Add event listeners
        this._setupPaginationEventListeners(paginationContainer);
    }
    
    /**
     * Calculate total pages
     * @returns {number} - Total number of pages
     * @private
     */
    _getTotalPages() {
        if (!this.options.pagination.enabled) {
            return 1;
        }
        
        return Math.max(1, Math.ceil(this.filteredData.length / this.options.pagination.pageSize));
    }
    
    /**
     * Set up event listeners for table
     * @private
     */
    _setupEventListeners() {
        // Setup sort headers if sorting is enabled
        if (this.options.sorting.enabled) {
            const headers = this.tableElement.querySelectorAll('th[data-sort]');
            headers.forEach(header => {
                header.style.cursor = 'pointer';
                header.addEventListener('click', () => {
                    const column = header.dataset.sort;
                    this.sortBy(column);
                });
            });
        }
    }
    
    /**
     * Set up event listeners for pagination
     * @param {Element} container - Pagination container
     * @private
     */
    _setupPaginationEventListeners(container) {
        const pageLinks = container.querySelectorAll('.page-link[data-page]');
        pageLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page, 10);
                this.goToPage(page);
            });
        });
    }
    
    /**
     * Initialize table from URL parameters
     * @private
     */
    _initFromUrlParams() {
        const params = new URLSearchParams(window.location.search);
        
        // Get page
        const page = params.get('page');
        if (page) {
            this.currentPage = parseInt(page, 10) || 1;
        }
        
        // Get sort
        const sort = params.get('sort');
        const sortDir = params.get('sortDir');
        if (sort) {
            this.sortColumn = sort;
            this.sortDirection = sortDir || 'asc';
        }
        
        // Get filters
        for (const [key, value] of params.entries()) {
            // Skip pagination and sorting params
            if (['page', 'sort', 'sortDir'].includes(key)) {
                continue;
            }
            
            this.filters[key] = value;
        }
    }
    
    /**
     * Update URL parameters
     * @private
     */
    _updateUrlParams() {
        if (!this.options.updateUrlParams) {
            return;
        }
        
        const params = new URLSearchParams();
        
        // Add page
        params.set('page', this.currentPage.toString());
        
        // Add sort
        if (this.sortColumn) {
            params.set('sort', this.sortColumn);
            params.set('sortDir', this.sortDirection);
        }
        
        // Add filters
        for (const [key, value] of Object.entries(this.filters)) {
            if (value !== null && value !== undefined && value !== '') {
                params.set(key, value.toString());
            }
        }
        
        // Update URL
        const url = new URL(window.location.href);
        url.search = params.toString();
        
        // Replace state
        window.history.replaceState({}, '', url.toString());
    }
} 