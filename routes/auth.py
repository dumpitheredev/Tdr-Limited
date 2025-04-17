from flask import Blueprint, render_template, redirect, url_for, request, flash, session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User, AdminSettings
from datetime import datetime, timezone
import pytz

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    
    # Check for maintenance mode - but don't redirect for GET requests
    # This allows the login page to be displayed during maintenance
    settings = AdminSettings.query.first()
    maintenance_active = False
    
    # Check if maintenance mode is active
    if settings and settings.maintenance_mode:
        # Use UK timezone for consistency
        uk_tz = pytz.timezone('Europe/London')
        now = datetime.now(uk_tz)
        
        # If no start time (immediate maintenance) or start time has passed
        if not settings.maintenance_start_time:
            maintenance_active = True  # Immediate maintenance
        else:
            # Check if start time has passed
            start_time = settings.maintenance_start_time
            if isinstance(start_time, str):
                try:
                    start_time = datetime.strptime(start_time, '%Y-%m-%dT%H:%M')
                except ValueError:
                    start_time = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S')
            
            # Ensure timezone info - use UK timezone
            if start_time.tzinfo is None:
                start_time = uk_tz.localize(start_time)
            
            # If maintenance has started
            if now >= start_time:
                maintenance_active = True
    
    # Standard redirect check - don't modify this
    is_redirect = request.args.get('next') is not None or request.referrer and '/login' in request.referrer
    
    # Only redirect if authenticated and NOT in a redirect loop
    if current_user.is_authenticated and not is_redirect:
        if current_user.role == 'admin':
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'instructor':
            # If an instructor is logged in and maintenance is active, redirect to maintenance
            if maintenance_active:
                # Check if this is a super admin
                if not (str(current_user.id).endswith('1') or current_user.id in ['bh9c0j', 'bh93dx']):
                    logout_user()
                    return redirect(url_for('maintenance'))
            return redirect(url_for('instructor.dashboard'))
        elif current_user.role == 'student':
            # If a student is logged in and maintenance is active, redirect to maintenance
            if maintenance_active:
                logout_user()
                return redirect(url_for('maintenance'))
            return redirect(url_for('student.dashboard'))
        else:
            # Fallback for any unexpected role
            return redirect(url_for('auth.logout'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        # Validate input
        if not email or not password:
            error = 'Please enter your email and password'
            return render_template('auth/login.html', error=error)
        
        # Check if user exists
        user = User.query.filter_by(email=email).first()
        
        if not user:
            error = 'Invalid email or password'
            return render_template('auth/login.html', error=error)
        
        # Use proper password checking
        login_success = user.check_password(password)
        
        if not login_success:
            error = 'Invalid email or password'
            return render_template('auth/login.html', error=error)
        
        # At this point, login is successful - we already know the user's role from the database
        
        # Check for super admin status
        is_super_admin = user.role == 'admin' and (
            str(user.id).endswith('1') or 
            user.id in ['bh9c0j', 'bh93dx']
        )
        
        # If maintenance is active and user is not a super admin, prevent login
        if maintenance_active and not is_super_admin:
            flash("System is currently in maintenance mode. Only authorized administrators can access the system.", "warning")
            return redirect(url_for('maintenance'))
        
        # Update last login time - use UK timezone for consistency
        uk_tz = pytz.timezone('Europe/London')
        user.last_login = datetime.now(uk_tz)
        db.session.commit()
        
        # Login the user
        login_user(user)
        
        # Set session data
        session['user_id'] = user.id
        session['role'] = user.role
        session['name'] = f"{user.first_name} {user.last_name}"
        session['profile_img'] = user.profile_img
        
        # If maintenance is active and super admin is logging in, show notice
        if maintenance_active and is_super_admin:
            flash('Maintenance mode is active. You have been granted access as a super administrator.', 'warning')
        
        # Redirect based on role
        if user.role == 'admin':
            flash('Welcome, Administrator', 'success')
            return redirect(url_for('admin.dashboard'))
        elif user.role == 'instructor':
            flash('Welcome, Instructor', 'success')
            return redirect(url_for('instructor.dashboard'))
        elif user.role == 'student':
            flash('Welcome, Student', 'success')
            return redirect(url_for('student.dashboard'))
    
    # If we got here due to a redirect loop, log the user out first
    if is_redirect and current_user.is_authenticated:
        logout_user()
        session.clear()
        flash('You have been logged out due to an authentication issue.', 'warning')
    
    # Show maintenance warning on login page if in maintenance mode
    if maintenance_active:
        maintenance_message = settings.maintenance_message if settings and settings.maintenance_message else "The system is currently under maintenance."
        flash(f"Maintenance Mode Active: {maintenance_message} Only authorized administrators can access the system.", "warning")
    
    # Just return the login template for GET requests or failed authentication
    return render_template('auth/login.html', error=error)

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    session.clear()
    flash('You have been successfully logged out.', 'success')
    return redirect(url_for('auth.login'))

@auth_bp.route('/password-reset', methods=['GET', 'POST'])
def password_reset():
    error = None
    success_message = None
    
    if request.method == 'POST':
        email = request.form.get('email')
        
        # Validate email format
        if not email or '@' not in email:
            error = 'Please enter a valid email address.'
        else:
            # Check if email exists in database
            user = User.query.filter_by(email=email).first()
            
            if user:
                # In a real application, you would:
                # 1. Generate a secure token
                # 2. Store the token with an expiration time
                # 3. Send an email with a reset link containing the token
                
                # For now, just show a success message
                success_message = 'If an account exists with this email, you will receive a password reset link shortly.'
            else:
                # Still show success message to prevent email enumeration
                success_message = 'If an account exists with this email, you will receive a password reset link shortly.'
    
    return render_template('auth/password_reset.html', error=error, success_message=success_message) 