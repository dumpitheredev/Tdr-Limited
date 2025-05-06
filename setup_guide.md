# TDR Limited Application Setup Guide

This guide provides detailed instructions for setting up and running the TDR Limited Attendance Management System on your local machine.

## Prerequisites

Before starting, ensure you have the following installed on your system:

1. **Python 3.8 or higher**
   - Download from [python.org](https://www.python.org/downloads/)
   - During installation, check "Add Python to PATH"
   - Verify installation with: `python --version`

2. **MySQL 8.0 or higher**
   - Download from [MySQL website](https://dev.mysql.com/downloads/mysql/)
   - Remember the root password you set during installation
   - Alternatively, you can use MySQL Workbench for easier database management

3. **Git** (optional, for cloning the repository)
   - Download from [git-scm.com](https://git-scm.com/downloads)

4. **Text Editor or IDE**
   - Recommended: Visual Studio Code.

## Step 1: Clone or Download the Project

If using Git:
```bash
git clone https://github.com/dumpitheredev/Tdr-Limited
cd Tdr-Limited
```

If not using Git:
- Download the project as a ZIP file
- Extract to a location of your choice
- Open a terminal/command prompt and navigate to the extracted folder

## Step 2: Set Up a Virtual Environment

Creating a virtual environment isolates the project dependencies from your system Python installation.

### Windows:
```powershell
# Navigate to your project directory
cd C:\path\to\Tdr-Limited

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
.\venv\Scripts\activate
```

### macOS/Linux:
```bash
# Navigate to your project directory
cd /path/to/Tdr-Limited

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
source venv/bin/activate
```

Your command prompt should now show `(venv)` at the beginning, indicating the virtual environment is active.

## Step 3: Install Dependencies

With the virtual environment activated, install all required packages:

```bash
pip install -r requirements.txt
```

If the requirements.txt file is missing or incomplete, install these core dependencies:

```bash
pip install flask flask-sqlalchemy flask-login flask-migrate flask-mail flask-wtf flask-apscheduler pymysql python-dotenv
```

## Step 4: Configure the Database

### Create the MySQL Database:

1. Open MySQL command line or MySQL Workbench
2. Create a new database:

```sql
CREATE DATABASE tdr_limited CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Configure Database Connection:

Create a `.env` file in the project root directory with the following content:

```
SECRET_KEY=your_secret_key_here
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_HOST=localhost
DB_NAME=tdr_limited
```

Replace `your_mysql_password` with your actual MySQL root password.

## Step 5: Initialize the Database

Run the following commands to initialize the database schema:

```bash
# Initialize migrations (if not already done)
flask db init

# Create a migration
flask db migrate -m "Initial database setup"

# Apply the migration
flask db upgrade
```

## Step 6: Create Initial Admin User (Optional)

You can create an initial admin user by running a Python script or directly inserting into the database:

### Using MySQL:

```sql
INSERT INTO user (id, username, email, password, first_name, last_name, role, is_active, created_at, first_login)
VALUES (
    'bh9c0j', 
    'admin', 
    'admin@example.com', 
    -- Use a proper hashed password in production
    'pbkdf2:sha256:150000$lLVaVAXk$74e4219a058d6a7e5c3b5e5b1b795c8d7d7d69a6a9a6b6c5d4e3f2g1h0i9j8k7l6m5n4o3p2q1r0s9t8u7v6w5x4y3z2a1b0c9d8e7f6g5h4i3j2k1l0m9n8o7p6q5r4s3t2u1v0w9x8y7z6a5b4c3d2e1f0', 
    'Admin', 
    'User', 
    'admin', 
    1, 
    NOW(), 
    0
);
```

## Step 7: Run the Application

With everything set up, you can now run the application:

```bash
# Make sure your virtual environment is activated
# Windows: .\venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

# Run the Flask application
python run.py
```

The application should start and be accessible at [http://localhost:5000](http://localhost:5000)

## Step 8: Log In to the Application

1. Open your web browser and navigate to [http://localhost:5000](http://localhost:5000)
2. Log in with the admin credentials:
   - Username: `admin`
   - Password: `password`
3. If this is the first login, you may be prompted to change your password

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify your MySQL service is running
2. Check the credentials in your `.env` file
3. Ensure the database exists and is accessible
4. Try connecting to the database using MySQL Workbench or command line

### Missing Dependencies

If you get import errors:

```bash
pip install <missing_package_name>
```

### Port Already in Use

If port 5000 is already in use, you can specify a different port:

```bash
python run.py --port=5001
```

### Migration Errors

If you encounter migration errors:

1. Delete the migrations folder
2. Delete any tables in your database
3. Reinitialize the migrations:
   ```bash
   flask db init
   flask db migrate -m "Fresh start"
   flask db upgrade
   ```

## Additional Configuration (Optional)

### Email Configuration

To enable password reset and email notifications:

```
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_DEFAULT_SENDER=your_email@gmail.com
```

### Custom Secret Key

Generate a secure random key:

```python
import os
os.urandom(24).hex()
```

Use the output as your SECRET_KEY in the .env file.

## Next Steps

After successfully setting up the application:

1. Create companies/organizations
2. Add instructors and students
3. Create classes and enroll students
4. Start tracking attendance

---

*This setup guide was created for TDR Limited Attendance Management System - May 2025*
