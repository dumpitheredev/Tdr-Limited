from flask import Flask, render_template, redirect, url_for, request, flash, session, send_from_directory, make_response, jsonify
from flask_login import LoginManager, current_user, logout_user
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from flask_migrate import Migrate
from flask_apscheduler import APScheduler
from flask_wtf.csrf import CSRFProtect
import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
from urllib.parse import quote_plus
import traceback
import pytz
from decorators import password_change_required

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key')

# Initialize CSRF protection
csrf = CSRFProtect(app)

# Add context processor for cache busting
@app.context_processor
def inject_cache_busting():
    # Return the current timestamp as a string to avoid strftime issues
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return {'cache_buster': timestamp}

# Add route to serve offline page
@app.route('/offline.html')
def offline_page():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'offline.html')

# Apply password change check to all routes
@app.before_request
@password_change_required
def check_password_change_required():
    # This function doesn't need to do anything as the decorator handles the logic
    pass

# Database Configuration
db_config_valid = True

try:
    password = os.environ.get('DB_PASSWORD')
    if not password:
        db_config_valid = False
        app.logger.error("DB_PASSWORD environment variable is not set")
        print("\nERROR: DB_PASSWORD environment variable is not set")
    else:
        password = quote_plus(password)
    
    db_user = os.environ.get('DB_USER')
    if not db_user:
        db_config_valid = False
        app.logger.error("DB_USER environment variable is not set")
        print("\nERROR: DB_USER environment variable is not set")
    
    db_host = os.environ.get('DB_HOST')
    if not db_host:
        db_config_valid = False
        app.logger.error("DB_HOST environment variable is not set")
        print("\nERROR: DB_HOST environment variable is not set")
    
    db_name = os.environ.get('DB_NAME')
    if not db_name:
        db_config_valid = False
        app.logger.error("DB_NAME environment variable is not set")
        print("\nERROR: DB_NAME environment variable is not set")
    
    if not db_config_valid:
        print("\nWARNING: Database configuration is incomplete!")
        print("Please configure your .env file with proper database credentials.")
        print("Application cannot start without proper database configuration.")
        sys.exit(1)  # Exit if database configuration is incomplete

except Exception as e:
    app.logger.error(f"Database configuration error: {str(e)}")
    print(f"\nERROR: {str(e)}\nPlease ensure all database environment variables are set in your .env file.")
    sys.exit(1)  # Exit if we can't even set up the configuration

# Configure database URI
app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{password}@{db_host}/{db_name}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# File upload configurations
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'images')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB max upload size

# Initialize SQLAlchemy with app
from models import db
db.init_app(app)

# Initialize Flask-Migrate
migrate = Migrate(app, db)

# Initialize scheduler with specific configurations
scheduler = APScheduler()
# Configure for more frequent execution with less job misfire tolerance
scheduler.api_enabled = True
scheduler.init_app(app)
scheduler.start()

# Function to check maintenance status (will be scheduled)
@scheduler.task('interval', id='check_maintenance_status', seconds=6, misfire_grace_time=60)
def check_maintenance_status():
    with app.app_context():
        try:
            from models import AdminSettings
            # Get admin settings
            settings = AdminSettings.query.first()
            
            if not settings:
                app.logger.warning("[SCHEDULER] No admin settings found")
                return
                
            # Get current time in UK timezone
            uk_tz = pytz.timezone('Europe/London')
            now = datetime.now(uk_tz)
            app.logger.debug(f"[SCHEDULER] Maintenance check at {now.strftime('%Y-%m-%d %H:%M:%S')} UK time")
            
            # AUTOMATIC TIMER START: Check if scheduled maintenance time has arrived
            if settings.maintenance_start_time and not settings.maintenance_mode:
                try:
                    # Make sure we're comparing datetime objects
                    maintenance_start = settings.maintenance_start_time
                    
                    # Ensure datetime has timezone info
                    if isinstance(maintenance_start, str):
                        # If it's a string, parse it
                        try:
                            maintenance_start = datetime.strptime(maintenance_start, '%Y-%m-%dT%H:%M')
                        except ValueError:
                            maintenance_start = datetime.strptime(maintenance_start, '%Y-%m-%d %H:%M:%S')
                    
                    # If the datetime has no timezone, assume UK time
                    if maintenance_start.tzinfo is None:
                        maintenance_start = uk_tz.localize(maintenance_start)
                        
                    # Compare datetimes directly
                    app.logger.debug(f"[SCHEDULER] Start time check: now={now}, start={maintenance_start}")
                    
                    # Check if we've reached or passed the start time
                    if now >= maintenance_start:
                        # Automatically enable maintenance mode
                        settings.maintenance_mode = True
                        db.session.commit()
                        app.logger.warning(f"[SCHEDULER] MAINTENANCE ACTIVATED at {now}")
                        app.logger.info(f"[SCHEDULER] Scheduled for: {maintenance_start}")
                        app.logger.info(f"[SCHEDULER] Message: {settings.maintenance_message}")
                except Exception as e:
                    app.logger.error(f"[SCHEDULER] Error checking start time: {str(e)}")
                    app.logger.error(traceback.format_exc())
                    
            # AUTOMATIC TIMER END: Check if maintenance end time has passed
            if settings.maintenance_end_time and settings.maintenance_mode:
                try:
                    # Make sure we're comparing datetime objects
                    maintenance_end = settings.maintenance_end_time
                    
                    # Ensure datetime has timezone info
                    if isinstance(maintenance_end, str):
                        # If it's a string, parse it
                        try:
                            maintenance_end = datetime.strptime(maintenance_end, '%Y-%m-%dT%H:%M')
                        except ValueError:
                            maintenance_end = datetime.strptime(maintenance_end, '%Y-%m-%d %H:%M:%S')
                    
                    # If the datetime has no timezone, assume UK time
                    if maintenance_end.tzinfo is None:
                        maintenance_end = uk_tz.localize(maintenance_end)
                    
                    # Compare datetimes directly
                    app.logger.debug(f"[SCHEDULER] End time check: now={now}, end={maintenance_end}")
                    
                    # Check if we've reached or passed the end time
                    if now >= maintenance_end:
                        # Automatically disable maintenance mode
                        settings.maintenance_mode = False
                        # Clear the maintenance times to prevent future confusion
                        settings.maintenance_start_time = None
                        settings.maintenance_end_time = None
                        db.session.commit()
                        app.logger.warning(f"[SCHEDULER] MAINTENANCE DEACTIVATED at {now}")
                except Exception as e:
                    app.logger.error(f"[SCHEDULER] Error checking end time: {str(e)}")
                    app.logger.error(traceback.format_exc())
        except Exception as e:
            app.logger.error(f"[SCHEDULER] General error in maintenance check: {str(e)}")
            app.logger.error(traceback.format_exc())

# Add function to fix missing columns in admin_settings table
def fix_admin_settings_table():
    try:
        from sqlalchemy import text
        # Check if table exists
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS admin_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(6) NOT NULL,
                email_notifications BOOLEAN DEFAULT TRUE,
                maintenance_mode BOOLEAN DEFAULT FALSE,
                maintenance_message TEXT,
                maintenance_start_time DATETIME,
                maintenance_end_time DATETIME,
                data_retention INT DEFAULT 90,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES user(id)
            )
        """))
        
        # Set default values for NULL fields
        db.session.execute(text("""
            UPDATE admin_settings SET 
            email_notifications = TRUE WHERE email_notifications IS NULL
        """))
        
        db.session.execute(text("""
            UPDATE admin_settings SET 
            maintenance_mode = FALSE WHERE maintenance_mode IS NULL
        """))
        
        db.session.execute(text("""
            UPDATE admin_settings SET 
            data_retention = 90 WHERE data_retention IS NULL
        """))
        
        db.session.commit()
        app.logger.info("Admin settings table fixed successfully")
    except Exception as e:
        app.logger.error(f"Error fixing admin_settings table: {str(e)}")

# Call the function during app setup
with app.app_context():
    fix_admin_settings_table()
    
    # Import and run the function to fix attendance status values
    from models import fix_attendance_status_values
    try:
        app.logger.info("Running fix_attendance_status_values to correct attendance status capitalization...")
        fixed_counts = fix_attendance_status_values()
        if fixed_counts['total'] > 0:
            app.logger.info(f"Successfully fixed {fixed_counts['total']} attendance records with incorrect capitalization:")
            app.logger.info(f"  - Present: {fixed_counts['present']}")
            app.logger.info(f"  - Absent: {fixed_counts['absent']}")
            app.logger.info(f"  - Late: {fixed_counts['late']}")
        else:
            app.logger.info("No attendance records needed capitalization fixes")
    except Exception as e:
        app.logger.error(f"Error fixing attendance status values: {str(e)}")
        app.logger.error(traceback.format_exc())

# Mail Configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.example.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', 'your_email@example.com')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', 'your_password')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'your_email@example.com')
mail = Mail(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

# User loader callback for Flask-Login
from models import User

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, user_id)

# Template context processors
@app.context_processor
def inject_user():
    return {
        'current_user': current_user,
        'is_authenticated': current_user.is_authenticated
    }

@app.context_processor
def inject_current_year():
    return {'current_year': datetime.now().year}

# Add maintenance mode middleware
@app.before_request
def check_maintenance_mode():
    from models import AdminSettings
    from datetime import datetime, timedelta, timezone
    
    # IMPORTANT: EXCLUDE THESE PATHS FROM MAINTENANCE CHECK:
    # - /static/* - Static files must be accessible
    # - /maintenance - Allow access to the maintenance page itself
    # - /auth/logout - Always allow users to logout
    # - /login - Allow access to login page for super admins
    # - /auth/login - Handle both possible login routes
    if (request.path.startswith('/static') or 
        request.path == '/maintenance' or 
        request.path == '/auth/logout' or
        request.path == '/login' or
        request.path == '/auth/login'):
        return None
    
    try:
        # Get admin settings
        settings = AdminSettings.query.first()
        
        if not settings:
            return None
            
        # Get current time in UK timezone
        uk_tz = pytz.timezone('Europe/London')
        now = datetime.now(uk_tz)
        app.logger.info(f"[MIDDLEWARE] Maintenance check at {now.strftime('%Y-%m-%d %H:%M:%S')} UK time")
        
        # Quick bypass check for super admins
        is_super_admin = current_user.is_authenticated and (
            (current_user.role == 'admin' and str(current_user.id).endswith('1')) or 
            current_user.id in ['bh9c0j', 'bh93dx']
        )
        
        if is_super_admin:
            app.logger.info(f"[MIDDLEWARE] Super admin bypass: {current_user.id}")
            return None
        
        # MAINTENANCE CHECK 1: Is maintenance mode active?
        if settings.maintenance_mode:
            # If we have a start time, check if we've reached it
            if settings.maintenance_start_time:
                try:
                    # Parse maintenance start time
                    maintenance_start = settings.maintenance_start_time
                    if isinstance(maintenance_start, str):
                        try:
                            maintenance_start = datetime.strptime(maintenance_start, '%Y-%m-%dT%H:%M')
                        except ValueError:
                            maintenance_start = datetime.strptime(maintenance_start, '%Y-%m-%d %H:%M:%S')
                    
                    # Add timezone if missing - use UK timezone
                    if maintenance_start.tzinfo is None:
                        maintenance_start = uk_tz.localize(maintenance_start)
                    
                    # If current time is BEFORE start time, show warning but allow access
                    if now < maintenance_start:
                        app.logger.info(f"[MIDDLEWARE] Maintenance pending: now={now}, start={maintenance_start}")
                        return None  # Continue with the request - warning banner will show
                    
                    # Otherwise, maintenance is active
                    app.logger.info(f"[MIDDLEWARE] Maintenance active: now={now}, start={maintenance_start}")
                except Exception as e:
                    app.logger.error(f"[MIDDLEWARE] Error checking maintenance time: {str(e)}")
                    # On error, enforce maintenance mode for safety
            
            # At this point, maintenance is active - redirect to maintenance page
            app.logger.info(f"[MIDDLEWARE] Redirecting to maintenance: user={current_user.id if current_user.is_authenticated else 'anonymous'}")
            
            # Logout any non-super admin users
            if current_user.is_authenticated:
                app.logger.info(f"[MIDDLEWARE] Logging out user {current_user.id} for maintenance")
                logout_user()
            
            # Only redirect if not already on the maintenance page
            if request.endpoint != 'maintenance':
                return redirect(url_for('maintenance'))
        
        # MAINTENANCE CHECK 2: Has a scheduled start time been reached?
        # This catches cases where maintenance_mode flag wasn't set by the scheduler
        elif settings.maintenance_start_time:
            try:
                # Parse maintenance start time
                maintenance_start = settings.maintenance_start_time
                if isinstance(maintenance_start, str):
                    try:
                        maintenance_start = datetime.strptime(maintenance_start, '%Y-%m-%dT%H:%M')
                    except ValueError:
                        maintenance_start = datetime.strptime(maintenance_start, '%Y-%m-%d %H:%M:%S')
                
                # Add timezone if missing - use UK timezone
                if maintenance_start.tzinfo is None:
                    maintenance_start = uk_tz.localize(maintenance_start)
                
                # If start time has been reached/passed, enable maintenance & redirect
                if now >= maintenance_start:
                    app.logger.warning(f"[MIDDLEWARE] Start time reached, enabling maintenance: now={now}, start={maintenance_start}")
                    
                    # Enable maintenance mode
                    settings.maintenance_mode = True
                    db.session.commit()
                    
                    # Logout any users except super admins
                    if current_user.is_authenticated:
                        app.logger.info(f"[MIDDLEWARE] Logging out user {current_user.id} for maintenance")
                        logout_user()
                    
                    # Redirect to maintenance page
                    if request.endpoint != 'maintenance':
                        return redirect(url_for('maintenance'))
            except Exception as e:
                app.logger.error(f"[MIDDLEWARE] Error checking start time: {str(e)}")
        
        # MAINTENANCE CHECK 3: Has maintenance end time passed?
        # Clean up settings if end time has passed
        elif settings.maintenance_end_time:
            try:
                maintenance_end = settings.maintenance_end_time
                if isinstance(maintenance_end, str):
                    try:
                        maintenance_end = datetime.strptime(maintenance_end, '%Y-%m-%dT%H:%M')
                    except ValueError:
                        maintenance_end = datetime.strptime(maintenance_end, '%Y-%m-%d %H:%M:%S')
                
                # Add timezone if missing - use UK timezone
                if maintenance_end.tzinfo is None:
                    maintenance_end = uk_tz.localize(maintenance_end)
                
                # If end time has passed, clean up the settings
                if now >= maintenance_end:
                    app.logger.info(f"[MIDDLEWARE] End time passed, cleaning up settings: now={now}, end={maintenance_end}")
                    settings.maintenance_start_time = None
                    settings.maintenance_end_time = None
                    db.session.commit()
            except Exception as e:
                app.logger.error(f"[MIDDLEWARE] Error checking end time: {str(e)}")
        
        # No maintenance active, proceed with request
        return None
    except Exception as e:
        app.logger.error(f"[MIDDLEWARE] Error in maintenance middleware: {str(e)}")
        return None

# Maintenance route
@app.route('/maintenance')
def maintenance():
    try:
        from models import AdminSettings
        # Get admin settings
        settings = AdminSettings.query.first()
        
        # If maintenance mode is turned off, redirect to home
        if settings and not settings.maintenance_mode:
            return redirect(url_for('index'))
        
        # Get maintenance message
        maintenance_message = None
        if settings and settings.maintenance_message:
            maintenance_message = settings.maintenance_message
        
        # Get formatted end time if available
        maintenance_end = None
        if settings and settings.maintenance_end_time:
            # Format the end time for display
            end_time = settings.maintenance_end_time
            
            # Ensure it's a datetime object with timezone
            if isinstance(end_time, str):
                try:
                    end_time = datetime.strptime(end_time, '%Y-%m-%dT%H:%M')
                except ValueError:
                    end_time = datetime.strptime(end_time, '%Y-%m-%d %H:%M:%S')
            
            # Add UK timezone if missing
            uk_tz = pytz.timezone('Europe/London')
            if end_time.tzinfo is None:
                end_time = uk_tz.localize(end_time)
                
            # Format for display - ISO format works well with JavaScript Date
            maintenance_end = end_time.isoformat()
            
        app.logger.info(f"Serving maintenance page with end time: {maintenance_end} and message: {maintenance_message}")
        return render_template('maintenance.html', maintenance_end=maintenance_end, maintenance_message=maintenance_message), 503
    except Exception as e:
        app.logger.error(f"Error rendering maintenance page: {str(e)}")
        return render_template('maintenance.html'), 503

# Register blueprints
from routes.auth import auth_bp
from routes.admin import admin_bp
from routes.instructor import instructor_bp
from routes.student import student_bp
from routes.api import api_bp

app.register_blueprint(auth_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(instructor_bp)
app.register_blueprint(student_bp)
app.register_blueprint(api_bp)

# Root route - redirect to login or appropriate dashboard
@app.route('/')
def index():
    if current_user.is_authenticated:
        if current_user.role == 'admin':
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'instructor':
            return redirect(url_for('instructor.dashboard'))
        else:
            return redirect(url_for('student.dashboard'))
    return redirect(url_for('auth.login'))

# Offline page route
@app.route('/offline')
def offline():
    return render_template('offline.html')

# Favicon route
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static', 'images'),
                               'favicon.ico', mimetype='image/x-icon')

# Service Worker route - simple approach
@app.route('/service-worker.js')
def service_worker():
    return send_from_directory(app.root_path, 'static/service-worker.js', mimetype='application/javascript')

# Offline DB route - simple approach
@app.route('/offline-db.js')
def offline_db():
    return send_from_directory(app.root_path, 'static/offline-db.js', mimetype='application/javascript')

# Error handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('errors/500.html'), 500

# Run the app if executed directly
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 