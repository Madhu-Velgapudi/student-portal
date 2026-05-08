from flask_mail import Message
from app import mail
from config import Config

def send_verification_email(to_email: str, name: str, token: str):
    verify_url = f"{Config.FRONTEND_URL}/verify.html?token={token}"

    msg = Message(
        subject="Verify your Student Portal account",
        recipients=[to_email]
    )
    msg.html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 30px;">
        <h2 style="color: #4f46e5;">Welcome to Student Portal, {name}!</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        <a href="{verify_url}"
           style="display:inline-block; padding:12px 24px; background:#4f46e5;
                  color:#fff; text-decoration:none; border-radius:6px; margin-top:16px;">
            Verify Email
        </a>
        <p style="margin-top:24px; color:#888; font-size:13px;">
            If you didn't sign up, you can safely ignore this email.
        </p>
    </div>
    """
    mail.send(msg)