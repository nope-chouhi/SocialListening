from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.services.notification_service import send_email_notification

router = APIRouter()
logger = logging.getLogger(__name__)

class WebinarRegistration(BaseModel):
    name: str
    email: EmailStr
    time: str

def generate_webinar_email_html(name: str, preferred_time: str) -> str:
    # Mimic the ClickMeeting template from the image
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #1a1b20; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #222329; padding-bottom: 40px;">
            <!-- Header -->
            <div style="background-color: #2b9d19; padding: 15px; text-align: center;">
                <h2 style="margin: 0; color: white; font-weight: normal;">ClickMeeting</h2>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 30px;">
                <h1 style="text-align: center; font-weight: normal; margin-bottom: 50px; font-size: 28px;">
                    Confirmation of<br>registration
                </h1>
                
                <p style="color: #bbbbbb; font-size: 16px;">Hello {name},</p>
                <p style="color: #bbbbbb; font-size: 16px; margin-bottom: 30px;">
                    We are pleased to confirm your registration for our event:
                </p>
                
                <h2 style="font-size: 24px; margin-bottom: 40px; font-weight: normal;">
                    Get a Social Listening certificate with Brand24
                </h2>
                
                <div style="text-align: center; margin-bottom: 40px;">
                    <p style="color: #bbbbbb; margin-bottom: 15px;">Add to the calendar:</p>
                    <div style="display: flex; justify-content: center; gap: 15px;">
                        <div style="width: 80px; height: 80px; background-color: #3b82f6; border-radius: 50%; display: inline-block; margin: 0 5px;"></div>
                        <div style="width: 80px; height: 80px; background-color: #60a5fa; border-radius: 50%; display: inline-block; margin: 0 5px;"></div>
                        <div style="width: 80px; height: 80px; background-color: #ef4444; border-radius: 50%; display: inline-block; margin: 0 5px;"></div>
                    </div>
                </div>
                
                <table style="width: 100%; color: #bbbbbb; margin-bottom: 40px; border-collapse: collapse;">
                    <tr>
                        <th style="text-align: left; padding: 10px; border-bottom: 1px solid #333; font-weight: normal; font-size: 12px; text-transform: uppercase;">Date</th>
                        <th style="text-align: left; padding: 10px; border-bottom: 1px solid #333; font-weight: normal; font-size: 12px; text-transform: uppercase;">Time</th>
                        <th style="text-align: right; padding: 10px; border-bottom: 1px solid #333; font-weight: normal; font-size: 12px; text-transform: uppercase;">Event ID</th>
                    </tr>
                    <tr>
                        <td style="padding: 15px 10px;">Wednesday, June 10, 2026</td>
                        <td style="padding: 15px 10px;">{preferred_time}<br><span style="font-size: 12px; color: #888;">Asia/Bangkok</span></td>
                        <td style="text-align: right; padding: 15px 10px;">637473814</td>
                    </tr>
                </table>
                
                <div style="text-align: center;">
                    <a href="#" style="display: inline-block; background-color: #72cc16; color: #000000; font-weight: bold; font-size: 20px; padding: 15px 40px; border-radius: 30px; text-decoration: none;">Join now</a>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

def send_webinar_email_task(db: Session, email: str, name: str, time: str):
    html_content = generate_webinar_email_html(name, time)
    try:
        result = send_email_notification(
            db=db,
            to_email=email,
            subject="Confirmation of registration",
            body_html=html_content
        )
        if not result.get("success"):
            logger.warning(f"Failed to send webinar email to {email}: {result.get('message')}")
        else:
            logger.info(f"Webinar registration email sent to {email}")
    except Exception as e:
        logger.error(f"Error sending webinar email: {e}")

@router.post("/register")
async def register_webinar(
    data: WebinarRegistration,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register for the upcoming webinar and send confirmation email"""
    # In a real scenario, we would save this to the database.
    # For now, we just trigger the email sending in the background.
    background_tasks.add_task(send_webinar_email_task, db, data.email, data.name, data.time)
    
    return {"message": "Registration successful", "status": "success"}
