# TDR Limited Attendance Management System

A comprehensive web-based attendance tracking system designed for educational institutions. This application allows administrators, instructors, and students to manage class attendance, with features for tracking, reporting, and analyzing attendance data.

## Features

### Admin Features
- User Management (students, instructors, admins)
- Class Management
- Company Partnership Management
- Enrollment Management
- Archive System for inactive records
- Reporting and Data Export

### Instructor Features
- Dashboard with class overview
- Mark attendance for assigned classes
- View attendance records
- Student performance tracking

### Student Features
- View personal attendance records
- Check class schedules
- View academic progress

## Technologies Used

- **Backend**: Flask (Python)
- **Database**: MySQL
- **Frontend**: 
  - Bootstrap 5.3
  - JavaScript (ES6+)
  - HTML5/CSS3
- **Authentication**: Flask-Login
- **Email Notifications**: Flask-Mail (SMTP)

## Installation

### Prerequisites
- Python 3.8+
- MySQL Server
- SMTP server details (for email functionality)

### Setup Instructions

1. **Clone the repository**
   ```
   git clone <repository-url>
   cd tdr-project
   ```

2. **Create and activate a virtual environment**
   ```
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the project root with the following variables:
   ```
   # Database Configuration (Required)
   DB_HOST=localhost
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=attendance_system  # Make sure this matches your actual database name
   
   # Application Security (Required)
   SECRET_KEY=your_secret_key  # Generate a strong random key
   
   # Mail Configuration (Optional for development)
   MAIL_SERVER=your_smtp_server
   MAIL_PORT=587
   MAIL_USERNAME=your_email
   MAIL_PASSWORD=your_email_password
   MAIL_USE_TLS=True
   MAIL_DEFAULT_SENDER=your_email
   ```
   
   **IMPORTANT SECURITY NOTES:**
   - Never commit the `.env` file to version control
   - Use strong, unique passwords for database and mail accounts
   - In production, ensure all environment variables are properly set
   - The application will not start if required environment variables are missing

5. **Initialize the database**
   
   First, create the database in MySQL:
   ```sql
   CREATE DATABASE attendance_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
   
   Then initialize the database schema with Flask-Migrate:
   ```
   flask db init
   flask db migrate -m "Initial database setup"
   flask db upgrade
   ```
   
   6. **Run the application**
   ```
   python run.py
   ```

## Usage

### Running the Application
```
python run.py
```
Access the application at http://localhost:5000

### First Login
After setting up the application, you'll need to create an admin user through the database or use the registration feature if enabled. The system will prompt new users to change their password on first login.

## Project Structure

```
tdr-project/
├── app.py                # Flask application setup
├── models.py             # Database models
├── run.py                # Application entry point
├── routes/               # Application routes
│   ├── admin.py          # Admin routes
│   ├── api.py            # API endpoints
│   ├── auth.py           # Authentication routes
│   ├── instructor.py     # Instructor routes
│   └── student.py        # Student routes
├── static/               # Static assets
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript files
│   └── images/           # Images and icons
└── templates/            # HTML templates
    ├── admin/            # Admin templates
    ├── auth/             # Authentication templates
    ├── components/       # Reusable components
    ├── instructor/       # Instructor templates
    └── student/          # Student templates
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This software is proprietary and confidential. Unauthorized copying, distribution, modification, 
public display, or public performance of this software is strictly prohibited.

© 2024-2025 Dumpithere/Miracle. All rights reserved.
