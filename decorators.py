from functools import wraps
from flask import session, redirect, url_for, flash, request
from flask_login import current_user

def password_change_required(f):
    """
    Decorator to check if a user needs to change their password.
    If they do, redirect them to the appropriate profile page.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip this check for static resources, assets, and essential routes
        if request.endpoint and (
            request.endpoint.startswith('static') or 
            request.endpoint == 'auth.logout' or
            request.endpoint.endswith('.admin_profile') or
            request.endpoint.endswith('.instructor_profile') or
            request.endpoint.endswith('.student_profile') or
            # Allow access to components and sidebar
            'components' in request.path or
            'sidebar' in request.path or
            # Allow access to CSS, JS, and images
            request.path.endswith(('.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'))
        ):
            return f(*args, **kwargs)
        
        # Only apply to GET requests for actual pages
        if request.method != 'GET' or not current_user.is_authenticated:
            return f(*args, **kwargs)
            
        # Check if the user is logged in and needs to change their password
        if current_user.is_authenticated and (current_user.first_login or session.get('password_change_required')):
            # Don't flash multiple times
            if 'password_change_required_flash' not in session:
                flash('You must change your password before continuing.', 'warning')
                session['password_change_required_flash'] = True
            
            # Redirect to the appropriate profile page based on user role
            if current_user.role == 'admin':
                return redirect(url_for('admin.admin_profile', change_password=True))
            elif current_user.role == 'instructor':
                return redirect(url_for('instructor.instructor_profile', change_password=True))
            elif current_user.role == 'student':
                # Assuming there's a student profile route
                return redirect(url_for('student.dashboard', change_password=True))
                
        # Clear the flash flag if no longer needed
        if 'password_change_required_flash' in session and not (current_user.first_login or session.get('password_change_required')):
            session.pop('password_change_required_flash')
                
        return f(*args, **kwargs)
    return decorated_function
