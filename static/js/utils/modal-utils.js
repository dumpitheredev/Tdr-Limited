export class ModalManager {
    constructor(options) {
        this.modalId = options.modalId;
        this.formId = options.formId;
        this.submitButtonId = options.submitButtonId;
        this.onSubmit = options.onSubmit;
        this.onReset = options.onReset;
        
        this.init();
    }

    init() {
        this.modal = document.getElementById(this.modalId);
        this.form = document.getElementById(this.formId);
        this.submitButton = document.getElementById(this.submitButtonId);
        
        if (!this.modal || !this.form) {
            console.error('Modal or form elements not found');
            return;
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle form submission
        this.submitButton.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (!this.form.checkValidity()) {
                this.form.reportValidity();
                return;
            }

            const formData = this.getFormData();
            
            if (this.onSubmit) {
                this.onSubmit(formData);
            }

            this.hide();
        });

        // Reset form when modal is hidden
        this.modal.addEventListener('hidden.bs.modal', () => {
            this.reset();
        });
    }

    getFormData() {
        const formData = {};
        const formElements = this.form.elements;

        for (let element of formElements) {
            if (element.name) {
                formData[element.name] = element.value;
            }
        }

        return formData;
    }

    show() {
        const modalInstance = bootstrap.Modal.getInstance(this.modal);
        if (modalInstance) {
            modalInstance.show();
        } else {
            new bootstrap.Modal(this.modal).show();
        }
    }

    hide() {
        const modalInstance = bootstrap.Modal.getInstance(this.modal);
        if (modalInstance) {
            modalInstance.hide();
        }
    }

    reset() {
        this.form.reset();
        if (this.onReset) {
            this.onReset();
        }
    }
} 