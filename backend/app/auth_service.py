"""Сервис регистрации и входа."""

from uuid import UUID

from fastapi import HTTPException, status

from app.auth import create_access_token, hash_password, verify_password
from app.config import Settings
from app.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.storage import UserRecord, store


def register_user(data: RegisterRequest, settings: Settings) -> TokenResponse:
    email = data.email.strip().lower()
    if email in store.users_by_email:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already registered')

    user_id = store.new_id()
    user = UserRecord(
        id=user_id,
        email=email,
        password_hash=hash_password(data.password),
        display_name=data.display_name or email.split('@')[0],
    )
    store.users[user_id] = user
    store.users_by_email[email] = user_id

    token = create_access_token(user_id, settings)
    return TokenResponse(access_token=token)


def login_user(data: LoginRequest, settings: Settings) -> TokenResponse:
    email = data.email.strip().lower()
    user_id = store.users_by_email.get(email)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

    user = store.users[user_id]
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

    return TokenResponse(access_token=create_access_token(user_id, settings))


def get_profile(user_id: UUID) -> UserRecord:
    user = store.users.get(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')
    return user
