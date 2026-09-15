"""HTTP routes for users slice: registration, login, and current session."""

from __future__ import annotations

from fastapi import APIRouter, status

from modules.users.api.dependencies import (
    AuthenticateUseCaseDep,
    CurrentUserDep,
    RegisterUseCaseDep,
)
from modules.users.api.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from modules.users.application.dto import (
    AuthenticateUserCommand,
    RegisterUserCommand,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user and return access token",
    responses={409: {"description": "Username already taken"}},
)
async def register(payload: RegisterRequest, use_case: RegisterUseCaseDep) -> AuthResponse:
    result = await use_case.execute(
        RegisterUserCommand(username=payload.username, password=payload.password)
    )
    return AuthResponse.from_auth(access_token=result.access_token, user=result.user)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Authenticate username + password and return access token",
    responses={401: {"description": "Invalid username or password"}},
)
async def login(payload: LoginRequest, use_case: AuthenticateUseCaseDep) -> AuthResponse:
    result = await use_case.execute(
        AuthenticateUserCommand(username=payload.username, password=payload.password)
    )
    return AuthResponse.from_auth(access_token=result.access_token, user=result.user)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Logged in user data",
    responses={401: {"description": "Missing, expired, or invalid token"}},
)
async def me(current_user: CurrentUserDep) -> UserResponse:
    return UserResponse.from_entity(current_user)
