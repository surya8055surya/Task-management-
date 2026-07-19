from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class RegistrationTests(APITestCase):
    def setUp(self):
        self.url = reverse("auth-register")
        self.valid_payload = {
            "username": "sanjay",
            "email": "sanjay@example.com",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }

    def test_register_success(self):
        response = self.client.post(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="sanjay").exists())
        # password must never be echoed back
        self.assertNotIn("password", response.data["user"])

    def test_register_password_mismatch(self):
        payload = {**self.valid_payload, "password2": "SomethingElse123!"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password2", response.data)

    def test_register_duplicate_email(self):
        User.objects.create_user(username="other", email="sanjay@example.com", password="x")
        response = self.client.post(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_weak_password_rejected(self):
        payload = {**self.valid_payload, "password": "12345678", "password2": "12345678"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="sanjay", email="sanjay@example.com", password="StrongPass123!"
        )
        self.login_url = reverse("auth-login")
        self.me_url = reverse("auth-me")

    def test_login_success_returns_tokens(self):
        response = self.client.post(
            self.login_url,
            {"username": "sanjay", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_wrong_password_rejected(self):
        response = self.client.post(
            self.login_url,
            {"username": "sanjay", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_authentication(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user_with_valid_token(self):
        login_response = self.client.post(
            self.login_url,
            {"username": "sanjay", "password": "StrongPass123!"},
            format="json",
        )
        access = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "sanjay")
