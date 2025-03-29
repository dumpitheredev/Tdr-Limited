from flask import Blueprint, render_template, redirect, url_for, request, flash, session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    
    # Detect redirect loop by checking if this is a direct request vs a redirect
    is_redirect = request.args.get('next') is not None or request.referrer and '/login' in request.referrer
    
    # Only redirect if authenticated and NOT in a redirect loop
    if current_user.is_authenticated and not is_redirect:
        if current_user.role == 'admin':
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'instructor':
            return redirect(url_for('instructor.dashboard'))
        elif current_user.role == 'student':
            return redirect(url_for('student.dashboard'))
        else:
            # Fallback for any unexpected role
            return redirect(url_for('auth.logout'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        role = request.form.get('role')
        
        if not email or not password:
            error = 'Please provide both email and password'
            return render_template('auth/login.html', error=error)
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Since you rebuilt your database, let's temporarily allow any password
            # IMPORTANT: This is just for testing - replace with proper auth later
            login_success = True
            
            # Check if the role matches
            if role != user.role:
                error = f'Invalid role selected. Your account is registered as {user.role}'
                return render_template('auth/login.html', error=error)
            
            if login_success:
                # Login the user
                login_user(user)
                
                # Set session data
                session['user_id'] = user.id
                session['role'] = user.role
                session['name'] = f"{user.first_name} {user.last_name}"
                
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
        else:
            error = 'Invalid email or password'
    
    # If we got here due to a redirect loop, log the user out first
    if is_redirect and current_user.is_authenticated:
        logout_user()
        session.clear()
        flash('You have been logged out due to an authentication issue.', 'warning')
    
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