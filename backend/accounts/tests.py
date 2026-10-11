from unittest import skipUnless

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

User = get_user_model()

ACCESS = settings.AUTH_COOKIE_ACCESS
REFRESH = settings.AUTH_COOKIE_REFRESH
STRONG_PASSWORD = "Shofer-i-mire-2026"


class AuthAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="ana", email="ana@example.com", password=STRONG_PASSWORD)

    def setUp(self):
        cache.clear()  # reset rate limits between tests

    def login(self, email="ana@example.com", password=STRONG_PASSWORD):
        return self.client.post(reverse("auth-login"), {"email": email, "password": password}, format="json")

    # ---------- register ----------

    def test_register_creates_user_and_sets_httponly_cookies(self):
        response = self.client.post(
            reverse("auth-register"),
            {"email": "Besa@Example.com", "username": "besa", "password": STRONG_PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["email"], "besa@example.com")  # stored lowercase
        self.assertNotIn("password", response.data)
        self.assertTrue(response.cookies[ACCESS]["httponly"])
        self.assertTrue(response.cookies[REFRESH]["httponly"])

    def test_register_rejects_weak_password(self):
        response = self.client.post(
            reverse("auth-register"),
            {"email": "besa@example.com", "username": "besa", "password": "12345678"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_register_rejects_duplicate_email_any_case(self):
        response = self.client.post(
            reverse("auth-register"),
            {"email": "ANA@example.com", "username": "ana2", "password": STRONG_PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @skipUnless(settings.ARGON2_AVAILABLE, "argon2 library can't load on this machine")
    def test_password_is_hashed_with_argon2(self):
        self.assertTrue(self.user.password.startswith("argon2"))

    # ---------- login / me ----------

    def test_login_sets_cookies_and_me_works(self):
        self.assertEqual(self.login().status_code, status.HTTP_200_OK)
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "ana")

    def test_login_error_is_same_for_wrong_password_and_unknown_email(self):
        wrong_password = self.login(password="wrong-password")
        unknown_email = self.login(email="nobody@example.com")
        self.assertEqual(wrong_password.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(wrong_password.data, unknown_email.data)

    def test_me_requires_login(self):
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_expired_or_garbage_access_token_counts_as_logged_out(self):
        self.client.cookies[ACCESS] = "not-a-real-token"
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, status.HTTP_401_UNAUTHORIZED)

    # ---------- refresh rotation ----------

    def test_refresh_rotates_and_old_refresh_token_stops_working(self):
        self.login()
        old_refresh = self.client.cookies[REFRESH].value

        response = self.client.post(reverse("auth-refresh"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(self.client.cookies[REFRESH].value, old_refresh)

        # Someone who stole the old refresh token tries to use it:
        self.client.cookies[REFRESH] = old_refresh
        self.assertEqual(self.client.post(reverse("auth-refresh")).status_code, status.HTTP_401_UNAUTHORIZED)

    # ---------- logout ----------

    def test_logout_clears_cookies_and_blacklists_refresh_token(self):
        self.login()
        refresh = self.client.cookies[REFRESH].value

        response = self.client.post(reverse("auth-logout"))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(response.cookies[ACCESS].value, "")

        self.client.cookies[REFRESH] = refresh
        self.assertEqual(self.client.post(reverse("auth-refresh")).status_code, status.HTTP_401_UNAUTHORIZED)

    # ---------- abuse protection ----------

    def test_login_is_rate_limited(self):
        codes = [self.login(password="wrong-password").status_code for _ in range(15)]
        self.assertIn(status.HTTP_429_TOO_MANY_REQUESTS, codes)

    def test_login_requires_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.post(
            reverse("auth-login"), {"email": "ana@example.com", "password": STRONG_PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_login_works_with_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        client.get(reverse("auth-csrf"))
        token = client.cookies["csrftoken"].value
        response = client.post(
            reverse("auth-login"),
            {"email": "ana@example.com", "password": STRONG_PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
