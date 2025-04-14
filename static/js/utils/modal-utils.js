/**
 * ModalManager - Utility for managing modal dialogs
 */
export class ModalManager {
    /**
     * Constructor
     * @param {Object} [options] - Configuration options
     * @param {boolean} [options.addBackdrop=true] - Whether to add a backdrop
     * @param {boolean} [options.closeOnBackdropClick=true] - Whether to close modal on backdrop click
     * @param {boolean} [options.closeOnEscape=true] - Whether to close modal on Escape key
     * @param {boolean} [options.animated=true] - Whether to animate modal transitions
     * @param {string} [options.modalClass='modal'] - Additional class for modal element
     * @param {string} [options.backdropClass='modal-backdrop'] - Class for backdrop element
     */
    constructor(options = {}) {
        this.options = {
            addBackdrop: true,
            closeOnBackdropClick: true,
            closeOnEscape: true,
            animated: true,
            modalClass: 'modal',
            backdropClass: 'modal-backdrop',
            ...options
        };
        
        this.activeModals = [];
        this.modalCounter = 0;
        this._setupGlobalEventListeners();
    }
    
    /**
     * Create a new modal
     * @param {Object} options - Modal options
     * @param {string} [options.id] - Modal ID (generated if not provided)
     * @param {string} [options.title] - Modal title
     * @param {string|Element} [options.content] - Modal content
     * @param {string} [options.size='medium'] - Modal size (small, medium, large, xl, fullscreen)
     * @param {boolean} [options.closable=true] - Whether to show close button
     * @param {boolean} [options.centered=false] - Whether to vertically center modal
     * @param {boolean} [options.scrollable=true] - Whether modal body is scrollable
     * @param {boolean} [options.backdrop=true] - Whether to add backdrop
     * @param {Array<Object>} [options.buttons=[]] - Footer buttons
     * @param {Function} [options.onShow] - Callback when modal is shown
     * @param {Function} [options.onHide] - Callback when modal is hidden
     * @param {Function} [options.onConfirm] - Callback when confirm button is clicked
     * @param {Function} [options.onCancel] - Callback when cancel button is clicked
     * @returns {Object} - Modal instance
     */
    create(options = {}) {
        const modalId = options.id || `modal-${++this.modalCounter}`;
        const modalOptions = {
            id: modalId,
            title: '',
            content: '',
            size: 'medium',
            closable: true,
            centered: false,
            scrollable: true,
            backdrop: this.options.addBackdrop,
            buttons: [],
            onShow: null,
            onHide: null,
            onConfirm: null,
            onCancel: null,
            ...options
        };
        
        // Create modal element if it doesn't exist
        let modalElement = document.getElementById(modalId);
        
        if (!modalElement) {
            modalElement = this._createModalElement(modalOptions);
            document.body.appendChild(modalElement);
        } else {
            // Update existing modal
            this._updateModalContent(modalElement, modalOptions);
        }
        
        // Create modal instance
        const modal = {
            id: modalId,
            element: modalElement,
            options: modalOptions,
            isVisible: false,
            show: () => this.show(modalId),
            hide: () => this.hide(modalId),
            update: (newOptions) => this.update(modalId, newOptions)
        };
        
        // Store reference to modal
        this.activeModals.push(modal);
        
        return modal;
    }
    
    /**
     * Show a modal
     * @param {string} modalId - Modal ID
     * @returns {boolean} - Whether modal was shown
     */
    show(modalId) {
        const modal = this._findModal(modalId);
        if (!modal) {
            console.error(`Modal not found: ${modalId}`);
            return false;
        }
        
        // Skip if already visible
        if (modal.isVisible) {
            return true;
        }
        
        const modalElement = modal.element;
        const options = modal.options;
        
        // Add backdrop if needed
        if (options.backdrop && this.options.addBackdrop) {
            this._addBackdrop(modalId);
        }
        
        // Show modal
        document.body.classList.add('modal-open');
        modalElement.style.display = 'block';
        
        if (this.options.animated) {
            // Trigger reflow
            modalElement.offsetHeight;
            
            // Add active class for animation
            modalElement.classList.add('show');
        }
        
        // Set modal as visible
        modal.isVisible = true;
        
        // Call onShow callback
        if (typeof options.onShow === 'function') {
            options.onShow(modal);
        }
        
        // Set focus to first focusable element
        setTimeout(() => {
            const focusable = modalElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length > 0) {
                focusable[0].focus();
            }
        }, 100);
        
        return true;
    }
    
    /**
     * Hide a modal
     * @param {string} modalId - Modal ID
     * @returns {boolean} - Whether modal was hidden
     */
    hide(modalId) {
        const modal = this._findModal(modalId);
        if (!modal || !modal.isVisible) {
            return false;
        }
        
        const modalElement = modal.element;
        const options = modal.options;
        
        // Trigger hide animation
        if (this.options.animated) {
            modalElement.classList.remove('show');
            
            // Wait for animation
            setTimeout(() => {
                this._finalizeHide(modal);
            }, 300);
        } else {
            this._finalizeHide(modal);
        }
        
        return true;
    }
    
    /**
     * Complete hiding of modal
     * @param {Object} modal - Modal instance
     * @private
     */
    _finalizeHide(modal) {
        const modalElement = modal.element;
        
        modalElement.style.display = 'none';
        modal.isVisible = false;
        
        // Remove backdrop
        this._removeBackdrop(modal.id);
        
        // Remove modal-open class if no visible modals
        if (!this.hasVisibleModals()) {
            document.body.classList.remove('modal-open');
        }
        
        // Call onHide callback
        if (typeof modal.options.onHide === 'function') {
            modal.options.onHide(modal);
        }
    }
    
    /**
     * Update modal content or options
     * @param {string} modalId - Modal ID
     * @param {Object} options - New options
     * @returns {boolean} - Whether modal was updated
     */
    update(modalId, options = {}) {
        const modal = this._findModal(modalId);
        if (!modal) {
            console.error(`Modal not found: ${modalId}`);
            return false;
        }
        
        // Merge new options with existing
        const newOptions = {
            ...modal.options,
            ...options
        };
        
        // Update modal options
        modal.options = newOptions;
        
        // Update DOM
        this._updateModalContent(modal.element, newOptions);
        
        return true;
    }
    
    /**
     * Create confirmation modal with Yes/No buttons
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.message - Confirmation message
     * @param {string} [options.confirmText='Yes'] - Confirm button text
     * @param {string} [options.cancelText='No'] - Cancel button text
     * @param {string} [options.confirmButtonClass='btn-primary'] - Confirm button class
     * @param {string} [options.cancelButtonClass='btn-secondary'] - Cancel button class
     * @param {Function} [options.onConfirm] - Callback when confirmed
     * @param {Function} [options.onCancel] - Callback when canceled
     * @returns {Object} - Modal instance
     */
    confirm(options) {
        const modalOptions = {
            title: options.title || 'Confirm',
            content: `<p>${options.message || 'Are you sure?'}</p>`,
            size: 'small',
            buttons: [
                {
                    text: options.cancelText || 'No',
                    class: options.cancelButtonClass || 'btn-secondary',
                    action: 'cancel'
                },
                {
                    text: options.confirmText || 'Yes',
                    class: options.confirmButtonClass || 'btn-primary',
                    action: 'confirm'
                }
            ],
            onConfirm: options.onConfirm,
            onCancel: options.onCancel
        };
        
        return this.create(modalOptions);
    }
    
    /**
     * Create alert modal with OK button
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.message - Alert message
     * @param {string} [options.buttonText='OK'] - Button text
     * @param {Function} [options.onClose] - Callback when closed
     * @returns {Object} - Modal instance
     */
    alert(options) {
        const modalOptions = {
            title: options.title || 'Alert',
            content: `<p>${options.message || ''}</p>`,
            size: 'small',
            buttons: [
                {
                    text: options.buttonText || 'OK',
                    class: 'btn-primary',
                    action: 'close'
                }
            ],
            onHide: options.onClose
        };
        
        return this.create(modalOptions);
    }
    
    /**
     * Remove a modal
     * @param {string} modalId - Modal ID
     * @returns {boolean} - Whether modal was removed
     */
    remove(modalId) {
        const modal = this._findModal(modalId);
        if (!modal) {
            return false;
        }
        
        // Hide modal if visible
        if (modal.isVisible) {
            this.hide(modalId);
        }
        
        // Remove from DOM
        if (modal.element.parentNode) {
            modal.element.parentNode.removeChild(modal.element);
        }
        
        // Remove from active modals
        const index = this.activeModals.findIndex(m => m.id === modalId);
        if (index !== -1) {
            this.activeModals.splice(index, 1);
        }
        
        return true;
    }
    
    /**
     * Remove all modals
     */
    removeAll() {
        // Clone array to avoid issues with modifying while iterating
        const modals = [...this.activeModals];
        modals.forEach(modal => {
            this.remove(modal.id);
        });
    }
    
    /**
     * Check if there are any visible modals
     * @returns {boolean} - Whether there are visible modals
     */
    hasVisibleModals() {
        return this.activeModals.some(modal => modal.isVisible);
    }
    
    /**
     * Find a modal by ID
     * @param {string} modalId - Modal ID
     * @returns {Object|null} - Modal instance or null if not found
     * @private
     */
    _findModal(modalId) {
        return this.activeModals.find(modal => modal.id === modalId) || null;
    }
    
    /**
     * Create modal element
     * @param {Object} options - Modal options
     * @returns {Element} - Modal element
     * @private
     */
    _createModalElement(options) {
        const modal = document.createElement('div');
        modal.id = options.id;
        modal.className = this.options.modalClass;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', `${options.id}-title`);
        modal.setAttribute('aria-hidden', 'true');
        
        // Add size class
        const sizeClass = this._getSizeClass(options.size);
        if (sizeClass) {
            modal.classList.add(sizeClass);
        }
        
        // Set tabindex for keyboard navigation
        modal.setAttribute('tabindex', '-1');
        
        // Create modal structure
        this._updateModalContent(modal, options);
        
        return modal;
    }
    
    /**
     * Update modal content
     * @param {Element} modalElement - Modal element
     * @param {Object} options - Modal options
     * @private
     */
    _updateModalContent(modalElement, options) {
        // Create dialog element
        let dialogClassName = 'modal-dialog';
        
        if (options.centered) {
            dialogClassName += ' modal-dialog-centered';
        }
        
        if (options.scrollable) {
            dialogClassName += ' modal-dialog-scrollable';
        }
        
        // Set size class
        const sizeClass = this._getSizeClass(options.size);
        if (sizeClass) {
            dialogClassName += ` ${sizeClass}`;
        }
        
        // Build modal HTML
        let headerHtml = '';
        if (options.title || options.closable) {
            headerHtml = `
                <div class="modal-header">
                    <h5 class="modal-title" id="${options.id}-title">${options.title || ''}</h5>
                    ${options.closable ? '<button type="button" class="btn-close" data-action="close" aria-label="Close"></button>' : ''}
                </div>
            `;
        }
        
        let footerHtml = '';
        if (options.buttons && options.buttons.length > 0) {
            const buttonsHtml = options.buttons.map(button => {
                return `<button type="button" class="btn ${button.class || 'btn-secondary'}" data-action="${button.action || 'close'}">${button.text || 'Button'}</button>`;
            }).join('');
            
            footerHtml = `<div class="modal-footer">${buttonsHtml}</div>`;
        }
        
        let contentHtml = '';
        if (typeof options.content === 'string') {
            contentHtml = options.content;
        } else if (options.content instanceof Element) {
            // Clear existing content
            const existingContent = modalElement.querySelector('.modal-body');
            if (existingContent) {
                existingContent.innerHTML = '';
                existingContent.appendChild(options.content);
                contentHtml = existingContent.outerHTML;
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.className = 'modal-body';
                tempDiv.appendChild(options.content);
                contentHtml = tempDiv.outerHTML;
            }
        } else {
            contentHtml = '<div class="modal-body"></div>';
        }
        
        modalElement.innerHTML = `
            <div class="${dialogClassName}">
                <div class="modal-content">
                    ${headerHtml}
                    ${contentHtml}
                    ${footerHtml}
                </div>
            </div>
        `;
        
        // Add event listeners to buttons
        const buttons = modalElement.querySelectorAll('[data-action]');
        buttons.forEach(button => {
            button.addEventListener('click', (event) => {
                const action = button.getAttribute('data-action');
                this._handleButtonAction(action, options.id, event);
            });
        });
    }
    
    /**
     * Handle button actions
     * @param {string} action - Button action
     * @param {string} modalId - Modal ID
     * @param {Event} event - Click event
     * @private
     */
    _handleButtonAction(action, modalId, event) {
        const modal = this._findModal(modalId);
        if (!modal) return;
        
        switch (action) {
            case 'close':
                this.hide(modalId);
                break;
            case 'confirm':
                if (typeof modal.options.onConfirm === 'function') {
                    modal.options.onConfirm(modal, event);
                }
                this.hide(modalId);
                break;
            case 'cancel':
                if (typeof modal.options.onCancel === 'function') {
                    modal.options.onCancel(modal, event);
                }
                this.hide(modalId);
                break;
            default:
                // Custom action - look for handler in buttons
                const buttonConfig = modal.options.buttons.find(b => b.action === action);
                if (buttonConfig && typeof buttonConfig.handler === 'function') {
                    buttonConfig.handler(modal, event);
                }
        }
    }
    
    /**
     * Add backdrop
     * @param {string} modalId - Modal ID
     * @private
     */
    _addBackdrop(modalId) {
        // Check if backdrop already exists
        let backdrop = document.querySelector(`.${this.options.backdropClass}`);
        
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = this.options.backdropClass;
            document.body.appendChild(backdrop);
            
            // Add animation class after a moment
            if (this.options.animated) {
                setTimeout(() => {
                    backdrop.classList.add('show');
                }, 10);
            }
        }
        
        // Set data attribute to track which modal it belongs to
        backdrop.setAttribute('data-modal-id', modalId);
        
        // Add click handler if configured
        if (this.options.closeOnBackdropClick) {
            backdrop.addEventListener('click', () => {
                this.hide(modalId);
            });
        }
    }
    
    /**
     * Remove backdrop
     * @param {string} modalId - Modal ID
     * @private
     */
    _removeBackdrop(modalId) {
        const backdrop = document.querySelector(`.${this.options.backdropClass}[data-modal-id="${modalId}"]`);
        
        if (!backdrop) {
            return;
        }
        
        // If other modals are visible, don't remove the backdrop
        if (this.hasVisibleModals() && this.activeModals.some(m => m.id !== modalId && m.isVisible)) {
            // Update backdrop to belong to the last visible modal
            const lastVisibleModal = this.activeModals.filter(m => m.isVisible).pop();
            if (lastVisibleModal) {
                backdrop.setAttribute('data-modal-id', lastVisibleModal.id);
            }
            return;
        }
        
        // Remove with animation
        if (this.options.animated) {
            backdrop.classList.remove('show');
            
            setTimeout(() => {
                if (backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            }, 300);
        } else {
            // Remove immediately
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
        }
    }
    
    /**
     * Get CSS class for modal size
     * @param {string} size - Modal size
     * @returns {string|null} - CSS class or null
     * @private
     */
    _getSizeClass(size) {
        switch (size) {
            case 'small':
                return 'modal-sm';
            case 'large':
                return 'modal-lg';
            case 'xl':
                return 'modal-xl';
            case 'fullscreen':
                return 'modal-fullscreen';
            case 'medium':
            default:
                return null;
        }
    }
    
    /**
     * Set up global event listeners
     * @private
     */
    _setupGlobalEventListeners() {
        // Close on Escape key
        if (this.options.closeOnEscape) {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.hasVisibleModals()) {
                    // Find the last visible modal
                    const visibleModals = this.activeModals.filter(m => m.isVisible);
                    if (visibleModals.length > 0) {
                        const lastModal = visibleModals[visibleModals.length - 1];
                        this.hide(lastModal.id);
                    }
                }
            });
        }
    }
} 