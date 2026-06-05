from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.models.webinar import WebinarRegistration as WebinarRegistrationModel
from app.services.notification_service import send_email_notification

router = APIRouter()
logger = logging.getLogger(__name__)

class WebinarRegistrationRequest(BaseModel):
    name: str
    email: EmailStr
    webinar_title: str
    webinar_time: str
    timezone: str

def generate_webinar_email_html(name: str, webinar_title: str, webinar_time: str, timezone: str) -> str:
    # Mimic the ClickMeeting template from the image
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #1a1b20; color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #222329; padding-bottom: 40px;">
            <!-- Header -->
            <div style="background-color: #2b9d19; padding: 15px; text-align: center;">
                <h2 style="margin: 0; color: white; font-weight: normal;">Confirmation of registration</h2>
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
                    {webinar_title}
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
                        <th style="text-align: left; padding: 10px; border-bottom: 1px solid #333; font-weight: normal; font-size: 12px; text-transform: uppercase;">Time</th>
                        <th style="text-align: right; padding: 10px; border-bottom: 1px solid #333; font-weight: normal; font-size: 12px; text-transform: uppercase;">Event ID</th>
                    </tr>
                    <tr>
                        <td style="padding: 15px 10px;">{webinar_time}<br><span style="font-size: 12px; color: #888;">{timezone}</span></td>
                        <td style="text-align: right; padding: 15px 10px;">Event link will be sent later</td>
                    </tr>
                </table>
                
                <div style="text-align: center;">
                    <span style="display: inline-block; background-color: #555555; color: #dddddd; font-weight: bold; font-size: 20px; padding: 15px 40px; border-radius: 30px;">Link pending</span>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
def generate_webinar_email_text(name: str, webinar_title: str, webinar_time: str, timezone: str) -> str:
    return f"""Confirmation of registration

Hello {name},

We are pleased to confirm your registration for our event:
{webinar_title}

Time: {webinar_time}
Timezone: {timezone}

Event link will be sent later.
"""

@router.post("/register")
async def register_webinar(
    data: WebinarRegistrationRequest,
    db: Session = Depends(get_db)
):
    """Register for the upcoming webinar and send confirmation email synchronously"""
    
    # 1. Validation is mostly handled by Pydantic (EmailStr, non-empty due to str)
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if not data.webinar_title.strip():
        raise HTTPException(status_code=400, detail="Webinar title is required")
    if not data.webinar_time.strip():
        raise HTTPException(status_code=400, detail="Webinar time is required")
        
    # 2. Save to database
    db_registration = WebinarRegistrationModel(
        email=data.email,
        name=data.name,
        webinar_title=data.webinar_title,
        webinar_time=data.webinar_time,
        timezone=data.timezone
    )
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)

    # 3. Generate Email
    html_content = generate_webinar_email_html(
        data.name, data.webinar_title, data.webinar_time, data.timezone
    )
    text_content = generate_webinar_email_text(
        data.name, data.webinar_title, data.webinar_time, data.timezone
    )
    
    # 4. Send Email synchronously
    try:
        result = send_email_notification(
            db=db,
            to_email=data.email,
            subject="Confirmation of registration",
            body_html=html_content,
            body_text=text_content
        )
        
        if not result.get("success"):
            # Do not log full credentials or API key in result
            logger.warning(f"Failed to send webinar email to {data.email}: {result.get('message')}")
            raise HTTPException(status_code=500, detail=result.get("message", "Failed to send email"))
            
        logger.info(f"Webinar registration email sent successfully to {data.email}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending webinar email (exception): {e}")
        raise HTTPException(status_code=500, detail=f"Không gửi được email: {str(e)}")
    
    return {
        "success": True,
        "message": "Registration and email sent successfully",
        "registration_id": db_registration.id
    }
