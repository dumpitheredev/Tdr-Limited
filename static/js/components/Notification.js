export class Notification {
    static show(options) {
        const {
            message,
            type = 'success',
            duration = 5000,
            position = 'top-right'
        } = options;

        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show notification-toast`;
        notification.setAttribute('role', 'alert');
        
        notification.style.position = 'fixed';
        notification.style.zIndex = '9999';
        
        switch (position) {
            case 'top-right':
                notification.style.top = '1rem';
                notification.style.right = '1rem';
                break;
            case 'top-left':
                notification.style.top = '1rem';
                notification.style.left = '1rem';
                break;
            case 'bottom-right':
                notification.style.bottom = '1rem';
                notification.style.right = '1rem';
                break;
            case 'bottom-left':
                notification.style.bottom = '1rem';
                notification.style.left = '1rem';
                break;
        }

        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        Object.assign(notification.style, {
            maxWidth: '300px',
            margin: '1rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'opacity 0.3s ease-in-out'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    static success(message, duration) {
        this.show({ message, type: 'success', duration });
    }

    static error(message, duration) {
        this.show({ message, type: 'danger', duration });
    }

    static warning(message, duration) {
        this.show({ message, type: 'warning', duration });
    }

    static info(message, duration) {
        this.show({ message, type: 'info', duration });
    }
} 