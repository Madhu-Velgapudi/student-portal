from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
from pymongo import MongoClient
from config import Config

mail = Mail()
db = None

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://192.168.1.7:5500"
    ], supports_credentials=True)
    mail.init_app(app)

    global db
    client = MongoClient(Config.MONGO_URI)
    db = client.get_default_database()
    app.db = db

    from routes.auth          import auth_bp
    from routes.courses       import courses_bp
    from routes.timetable     import timetable_bp
    from routes.profile       import profile_bp
    from routes.admin         import admin_bp
    from routes.attendance    import attendance_bp
    from routes.notifications import notifications_bp
    from routes.content       import content_bp
    from routes.marks         import marks_bp
    from routes.announcements import announcements_bp
    from routes.teacher       import teacher_bp

    app.register_blueprint(auth_bp,          url_prefix="/api/auth")
    app.register_blueprint(courses_bp,       url_prefix="/api/courses")
    app.register_blueprint(timetable_bp,     url_prefix="/api/timetable")
    app.register_blueprint(profile_bp,       url_prefix="/api/profile")
    app.register_blueprint(admin_bp,         url_prefix="/api/admin")
    app.register_blueprint(attendance_bp,    url_prefix="/api/attendance")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(content_bp,       url_prefix="/api/content")
    app.register_blueprint(marks_bp,          url_prefix="/api/marks")
    app.register_blueprint(announcements_bp, url_prefix="/api/announcements")
    app.register_blueprint(teacher_bp,       url_prefix="/api/teacher")

    @app.route("/")
    def health():
        return {"status": "Student Portal API running"}, 200

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000, host="0.0.0.0")