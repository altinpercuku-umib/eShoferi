from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import enforce_csrf
from .cookies import clear_auth_cookies, set_auth_cookies
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class PublicAuthView(APIView):
    """Base for endpoints you call while logged out. CSRF is still enforced on writes."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            enforce_csrf(request)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(PublicAuthView):
    """The frontend calls this once on startup to receive the csrftoken cookie."""

    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


class RegisterView(PublicAuthView):
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        set_auth_cookies(response, RefreshToken.for_user(user))
        return response


class LoginView(PublicAuthView):
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        update_last_login(None, user)

        response = Response(UserSerializer(user).data)
        set_auth_cookies(response, RefreshToken.for_user(user))
        return response


class RefreshView(PublicAuthView):
    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not raw_refresh:
            return Response({"detail": "Nuk jeni të kyçur."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            # Checks signature, expiry AND the blacklist.
            old_refresh = RefreshToken(raw_refresh)
            user = User.objects.get(
                **{api_settings.USER_ID_FIELD: old_refresh[api_settings.USER_ID_CLAIM]}, is_active=True
            )
            old_refresh.blacklist()  # rotation: this token can never be used again
        except (TokenError, User.DoesNotExist):
            response = Response({"detail": "Sesioni ka skaduar."}, status=status.HTTP_401_UNAUTHORIZED)
            clear_auth_cookies(response)
            return response

        response = Response(UserSerializer(user).data)
        set_auth_cookies(response, RefreshToken.for_user(user))
        return response


class LogoutView(PublicAuthView):
    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass  # already expired or blacklisted - nothing to do

        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)
