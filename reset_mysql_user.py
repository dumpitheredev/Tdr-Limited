import pymysql
from urllib.parse import quote_plus
import getpass

print("MySQL User Reset and Test Script")
print("===============================")

# Get root credentials for MySQL
root_password = getpass.getpass("Enter MySQL root password: ")

try:
    # Connect to MySQL as root
    conn = pymysql.connect(
        host="localhost",
        user="root",
        password=root_password
    )
    
    cursor = conn.cursor()
    
    # Check if the database exists
    cursor.execute("SHOW DATABASES LIKE 'attendance_db'")
    if cursor.fetchone():
        print("✓ Database 'attendance_db' exists")
    else:
        print("Creating database 'attendance_db'...")
        cursor.execute("CREATE DATABASE attendance_db")
        print("✓ Database created")
    
    # Drop existing user if exists
    print("Dropping existing user if exists...")
    cursor.execute("DROP USER IF EXISTS 'attendance_user'@'localhost'")
    
    # Create a new user with a simple password (no special characters)
    new_password = "SimplePassword123"
    print(f"Creating user 'attendance_user' with password '{new_password}'...")
    cursor.execute(f"CREATE USER 'attendance_user'@'localhost' IDENTIFIED BY '{new_password}'")
    
    # Grant privileges
    print("Granting privileges...")
    cursor.execute("GRANT ALL PRIVILEGES ON attendance_db.* TO 'attendance_user'@'localhost'")
    cursor.execute("FLUSH PRIVILEGES")
    
    print("✓ User created and privileges granted")
    
    # Test connection with the new user
    print("\nTesting connection with new user...")
    conn.close()
    
    test_conn = pymysql.connect(
        host="localhost",
        user="attendance_user",
        password=new_password,
        database="attendance_db"
    )
    test_conn.close()
    print("✓ Connection test successful!")
    
    print("\n====== IMPORTANT ======")
    print("Update the following files with this connection string:")
    print("app.py and create_db_tables.py")
    print(f"SQLALCHEMY_DATABASE_URI = 'mysql://attendance_user:{new_password}@localhost/attendance_db'")
    print("========================")
    
except Exception as e:
    print(f"! Error: {e}") 