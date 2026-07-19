from datetime import date, timedelta

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Task


class TaskAPITestCase(APITestCase):
    """Base class: creates two users so we can assert data isolation."""

    def setUp(self):
        self.user = User.objects.create_user(username="sanjay", password="StrongPass123!")
        self.other_user = User.objects.create_user(username="rahul", password="StrongPass123!")

        self.list_url = reverse("task-list")

        self.client.force_authenticate(user=self.user)

    def detail_url(self, task_id):
        return reverse("task-detail", args=[task_id])


class TaskCRUDTests(TaskAPITestCase):
    def test_create_task(self):
        payload = {
            "title": "Write project README",
            "description": "Document setup + API usage",
            "status": "todo",
            "priority": "high",
            "due_date": str(date.today() + timedelta(days=3)),
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Task.objects.count(), 1)
        self.assertEqual(Task.objects.first().owner, self.user)

    def test_create_task_blank_title_rejected(self):
        response = self.client.post(self.list_url, {"title": "   "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_tasks_only_returns_own_tasks(self):
        Task.objects.create(owner=self.user, title="Mine")
        Task.objects.create(owner=self.other_user, title="Not mine")

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if "results" in response.data else response.data
        titles = [t["title"] for t in results]
        self.assertEqual(titles, ["Mine"])

    def test_retrieve_other_users_task_returns_404(self):
        other_task = Task.objects.create(owner=self.other_user, title="Secret")
        response = self.client.get(self.detail_url(other_task.id))
        # get_queryset() already scopes to the caller's own tasks, so a
        # task belonging to someone else simply doesn't exist for this user.
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_own_task(self):
        task = Task.objects.create(owner=self.user, title="Old title", status="todo")
        response = self.client.patch(self.detail_url(task.id), {"status": "done"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.status, "done")

    def test_cannot_update_other_users_task(self):
        other_task = Task.objects.create(owner=self.other_user, title="Not yours")
        response = self.client.patch(self.detail_url(other_task.id), {"status": "done"}, format="json")
        self.assertIn(response.status_code, (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN))

    def test_delete_own_task(self):
        task = Task.objects.create(owner=self.user, title="Delete me")
        response = self.client.delete(self.detail_url(task.id))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Task.objects.filter(id=task.id).exists())

    def test_unauthenticated_request_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TaskFilteringTests(TaskAPITestCase):
    def setUp(self):
        super().setUp()
        Task.objects.create(owner=self.user, title="Fix login bug", status="todo", priority="high",
                             due_date=date.today() + timedelta(days=1))
        Task.objects.create(owner=self.user, title="Write tests", status="in_progress", priority="medium",
                             due_date=date.today() + timedelta(days=5))
        Task.objects.create(owner=self.user, title="Deploy to prod", status="done", priority="low",
                             due_date=date.today() - timedelta(days=1))

    def test_filter_by_status(self):
        response = self.client.get(self.list_url, {"status": "todo"})
        results = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "Fix login bug")

    def test_filter_by_priority(self):
        response = self.client.get(self.list_url, {"priority": "high"})
        results = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["priority"], "high")

    def test_search_by_title(self):
        response = self.client.get(self.list_url, {"search": "login"})
        results = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertIn("login", results[0]["title"].lower())

    def test_ordering_by_due_date(self):
        response = self.client.get(self.list_url, {"ordering": "due_date"})
        results = response.data["results"] if "results" in response.data else response.data
        due_dates = [r["due_date"] for r in results]
        self.assertEqual(due_dates, sorted(due_dates))

    def test_stats_endpoint(self):
        response = self.client.get(reverse("task-stats"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 3)
        self.assertEqual(response.data["todo"], 1)
        self.assertEqual(response.data["in_progress"], 1)
        self.assertEqual(response.data["done"], 1)
