from django.conf import settings
from rest_framework_simplejwt.settings import api_settings


def set_auth_cookies(response, refresh_token):
    """Put a fresh access + refresh token pair into httpOnly cookies."""
    common = {
        "httponly": True,  # JavaScript can't read them, so an XSS bug can't steal them
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
    }
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS,
        str(refresh_token.access_token),
        max_age=int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        path="/",
        **common,
    )
    response.set_cookie(
        settings.AUTH_COOKIE_REFRESH,
        str(refresh_token),
        max_age=int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        path=settings.AUTH_COOKIE_REFRESH_PATH,
        **common,
    )


def clear_auth_cookies(response):
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/", samesite=settings.AUTH_COOKIE_SAMESITE)
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH,
        path=settings.AUTH_COOKIE_REFRESH_PATH,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
