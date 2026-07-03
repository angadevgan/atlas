from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.auth import hash_password, verify_password, create_access_token, get_current_user
from app.db.session import get_db
from app.models.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileResponse(BaseModel):
    id: str
    email: str
    display_name: str | None


class ProfileUpdateRequest(BaseModel):
    display_name: str


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name or body.email.split("@")[0],
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=ProfileResponse)
def get_profile(user: User = Depends(get_current_user)):
    return ProfileResponse(id=user.id, email=user.email, display_name=user.display_name)


@router.put("/me", response_model=ProfileResponse)
def update_profile(body: ProfileUpdateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.display_name = body.display_name
    db.commit()
    db.refresh(user)

    from app.services.activity import log_activity
    from app.models.models import ActivityAction
    log_activity(db, user.id, ActivityAction.UPDATE_PROFILE, "Updated profile")

    return ProfileResponse(id=user.id, email=user.email, display_name=user.display_name)
