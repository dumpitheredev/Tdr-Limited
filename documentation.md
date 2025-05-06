# TDR Limited - Attendance Management System
## Documentation

### Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Database Structure](#database-structure)
4. [User Roles and Permissions](#user-roles-and-permissions)
5. [Core Features](#core-features)
6. [API Endpoints](#api-endpoints)
7. [File Structure](#file-structure)
8. [Configuration](#configuration)
9. [Deployment Guide](#deployment-guide)
10. [Maintenance](#maintenance)

---

## Introduction

TDR Limited Attendance Management System is a comprehensive web application built with Flask that manages student attendance, class enrollments, and user management. The system supports three user roles (admin, instructor, and student) with different permissions and features.

### Key Features
- User authentication and role-based access control
- Student attendance tracking and reporting
- Class management and enrollment
- Company/organization management
- Profile management with customizable profile pictures
- Responsive design for desktop and mobile devices
- Offline capabilities with service worker support
- Scheduled maintenance mode

---

## System Architecture

The application follows a Model-View-Controller (MVC) architecture implemented with Flask:

- **Models**: SQLAlchemy ORM models for database interaction
- **Views**: Jinja2 templates for rendering HTML
- **Controllers**: Flask routes organized in blueprints

### Technology Stack
- **Backend**: Python 3.x with Flask framework
- **Database**: MySQL
- **ORM**: SQLAlchemy with Flask-SQLAlchemy
- **Authentication**: Flask-Login
- **Frontend**: HTML, CSS, JavaScript
- **Task Scheduling**: Flask-APScheduler
- **Email**: Flask-Mail
- **Migration**: Flask-Migrate (Alembic)

---

## Database Structure

The database consists of the following main tables:

### User
Stores all user information including students, instructors, and administrators.
- Primary Key: `id` (String, 6 characters)
- Key Fields: `username`, `email`, `role`, `company_id`
- Role Types: 'student', 'instructor', 'admin'
- Password Storage: Securely hashed

### Company
Stores information about organizations/companies that users belong to.
- Primary Key: `id` (String, 6 characters)
- Status Types: 'Active', 'Inactive'

### Class
Represents courses or classes that can be taught by instructors and attended by students.
- Primary Key: `id` (String, 6 characters)
- Related to: `instructor_id` (User)

### Enrollment
Tracks which students are enrolled in which classes.
- Composite Key: `student_id` and `class_id`
- Status Types: 'Active', 'Pending'

### Attendance
Records student attendance for specific class sessions.
- Primary Key: `id` (Integer, auto-increment)
- Related to: `student_id` (User), `class_id` (Class)
- Status Types: 'Present', 'Absent', 'Late'

### AdminSettings
Stores system-wide configuration settings.
- Primary Key: `id` (Integer, auto-increment)
- Includes maintenance mode settings

### LoginAttempt
Tracks user login attempts for security monitoring.
- Primary Key: `id` (Integer, auto-increment)
- Related to: `user_id` (User)

---

## User Roles and Permissions

### Admin
- Full system access
- User management (create, edit, delete)
- Company management
- Class management
- Attendance reporting
- System settings configuration
- Maintenance mode control

### Instructor
- View and manage assigned classes
- Mark attendance for students in their classes
- View student profiles and attendance records
- Generate attendance reports
- Manage their own profile

### Student
- View their class schedule
- View their attendance records
- View their enrollment status
- Manage their own profile

---

## Core Features

### Authentication System
- Secure login with password hashing
- Password reset functionality
- First-time login password change requirement
- Login attempt tracking
- Session management

### User Management
- Create, edit, and archive users
- Role assignment
- Profile picture management
- Department and qualification tracking

### Attendance Tracking
- Mark attendance by class session
- Multiple attendance statuses (Present, Absent, Late)
- Attendance history and reporting
- Bulk attendance management

### Class Management
- Create and schedule classes
- Assign instructors
- Manage student enrollments
- Class status tracking

### Company Management
- Create and manage companies/organizations
- Assign users to companies
- Track company status

### Reporting
- Attendance reports by class, student, or date range
- Export functionality
- Visual dashboards

### Maintenance Mode
- Scheduled maintenance windows
- Custom maintenance messages
- Automatic activation and deactivation

---

## API Endpoints

The application provides several API endpoints for data access:

### Authentication
- `/auth/login` - User login
- `/auth/logout` - User logout
- `/auth/reset-password` - Password reset

### Admin Routes
- `/admin/dashboard` - Admin dashboard
- `/admin/users` - User management
- `/admin/classes` - Class management
- `/admin/companies` - Company management
- `/admin/attendance` - Attendance management
- `/admin/settings` - System settings

### Instructor Routes
- `/instructor/dashboard` - Instructor dashboard
- `/instructor/classes` - View assigned classes
- `/instructor/attendance` - Mark and view attendance

### Student Routes
- `/student/dashboard` - Student dashboard
- `/student/attendance` - View personal attendance

### API Routes
- `/api/users` - User data
- `/api/classes` - Class data
- `/api/attendance` - Attendance data
- `/api/companies` - Company data

---

## File Structure

```
tdr-project/
├── app.py                 # Main application file
├── models.py              # Database models
├── decorators.py          # Custom decorators
├── requirements.txt       # Python dependencies
├── migrations/            # Database migrations
├── routes/                # Route blueprints
│   ├── __init__.py
│   ├── admin.py           # Admin routes
│   ├── api.py             # API endpoints
│   ├── auth.py            # Authentication routes
│   ├── instructor.py      # Instructor routes
│   └── student.py         # Student routes
├── static/                # Static assets
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript files
│   └── images/            # Images and icons
└── templates/             # HTML templates
    ├── admin/             # Admin templates
    ├── auth/              # Authentication templates
    ├── instructor/        # Instructor templates
    ├── student/           # Student templates
    └── errors/            # Error pages
```

---

## Configuration

The application uses environment variables for configuration, with defaults specified in the code:

### Database Configuration
- `DB_USER` - Database username (default: 'root')
- `DB_PASSWORD` - Database password
- `DB_HOST` - Database host (default: 'localhost')
- `DB_NAME` - Database name (default: 'attendance_system')

### Security Configuration
- `SECRET_KEY` - Flask secret key for session security

### Email Configuration
- `MAIL_SERVER` - SMTP server
- `MAIL_PORT` - SMTP port
- `MAIL_USE_TLS` - Whether to use TLS
- `MAIL_USERNAME` - Email username
- `MAIL_PASSWORD` - Email password
- `MAIL_DEFAULT_SENDER` - Default sender email

### File Upload Configuration
- `UPLOAD_FOLDER` - Path for uploaded files (default: 'static/images')
- `MAX_CONTENT_LENGTH` - Maximum file size (default: 5MB)

---

## Deployment Guide

### Prerequisites
- Python 3.x
- MySQL Server
- Virtual environment (recommended)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tdr-project
   ```

2. **Create and activate virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   Create a `.env` file in the project root with the following variables:
   ```
   SECRET_KEY=your-secret-key
   DB_USER=your-db-user
   DB_PASSWORD=your-db-password
   DB_HOST=your-db-host
   DB_NAME=your-db-name
   ```

5. **Initialize the database**
   ```bash
   flask db upgrade
   ```

6. **Run the application**
   ```bash
   flask run
   ```

---

## Maintenance

### Database Maintenance
- Regular backups recommended
- Use Flask-Migrate for schema changes:
  ```bash
  flask db migrate -m "Description of changes"
  flask db upgrade
  ```

### Image Management
- Profile images are stored in `static/images/`
- Each user's latest profile image is preserved
- Default images are maintained for users without custom images
- Periodic cleanup of unused images is recommended

### System Updates
- Use maintenance mode for system updates
- Schedule maintenance during off-peak hours
- Provide clear messaging to users about maintenance windows

---

*Documentation created for TDR Limited Attendance Management System - May 2025*
