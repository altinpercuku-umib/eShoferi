from django.conf import settings
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError


def enforce_csrf(request):
    """
    Cookies are sent by the browser automatically, so cookie-based auth must be
    protected against CSRF: a write request must carry the X-CSRFToken header.
    (Same check DRF's SessionAuthentication does.)
    """
    check = CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f"CSRF Failed: {reason}")


class CookieJWTAuthentication(JWTAuthentication):
    """Reads the JWT access token from an httpOnly cookie instead of the Authorization header."""

    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
        except (TokenError, AuthenticationFailed):
            # Expired or invalid token: treat the request as anonymous.
            # Protected endpoints then answer 401 and the frontend calls /refresh/.
            return None

        enforce_csrf(request)
        return user, validated_token
