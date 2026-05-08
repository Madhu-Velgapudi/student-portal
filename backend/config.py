import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # MongoDB
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/studentportal")

    # JWT
    JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-this")
    JWT_EXPIRY_HOURS = 24

    # Flask-Mail (Gmail SMTP)
    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")   # your Gmail address
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")   # Gmail App Password
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_USERNAME")

    # App
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5500")