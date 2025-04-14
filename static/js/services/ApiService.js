/**
 * ApiService - Base service for making API calls
 */
class ApiService {
    /**
     * Constructor
     * @param {string} baseUrl - Base URL for API calls
     */
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }
    
    /**
     * Make a GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise<any>} - Promise resolving to response data
     */
    async get(endpoint, params = {}) {
        try {
            const url = this._buildUrl(endpoint, params);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`GET request failed for ${endpoint}:`, error);
            throw error;
        }
    }
    
    /**
     * Make a POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @returns {Promise<any>} - Promise resolving to response data
     */
    async post(endpoint, data = {}) {
        try {
            const url = this._buildUrl(endpoint);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`POST request failed for ${endpoint}:`, error);
            throw error;
        }
    }
    
    /**
     * Make a PUT request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @returns {Promise<any>} - Promise resolving to response data
     */
    async put(endpoint, data = {}) {
        try {
            const url = this._buildUrl(endpoint);
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`PUT request failed for ${endpoint}:`, error);
            throw error;
        }
    }
    
    /**
     * Make a DELETE request
     * @param {string} endpoint - API endpoint
     * @returns {Promise<any>} - Promise resolving to response data
     */
    async delete(endpoint) {
        try {
            const url = this._buildUrl(endpoint);
            const response = await fetch(url, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`DELETE request failed for ${endpoint}:`, error);
            throw error;
        }
    }
    
    /**
     * Build a URL with query parameters
     * @private
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {string} - Full URL
     */
    _buildUrl(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return url.toString();
    }
}

// Make ApiService available globally
window.ApiService = ApiService; 