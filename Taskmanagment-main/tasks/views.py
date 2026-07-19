from django.db.models import Count
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import TaskFilter
from .models import Task
from .permissions import IsOwner
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for tasks, scoped to the authenticated user.

    list:    GET    /api/tasks/
    create:  POST   /api/tasks/
    detail:  GET    /api/tasks/{id}/
    update:  PUT    /api/tasks/{id}/
    partial: PATCH  /api/tasks/{id}/
    delete:  DELETE /api/tasks/{id}/
    stats:   GET    /api/tasks/stats/

    Filtering: ?status=todo|in_progress|done
               ?priority=low|medium|high
               ?due_before=YYYY-MM-DD  &  ?due_after=YYYY-MM-DD
    Search:    ?search=<text>            (matches title & description)
    Ordering:  ?ordering=due_date | -priority | created_at | ...
    """

    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filterset_class = TaskFilter
    search_fields = ["title", "description"]
    ordering_fields = ["due_date", "priority", "status", "created_at", "updated_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Users only ever see their own tasks - never other users' data.
        return Task.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """GET /api/tasks/stats/ -> counts of the caller's tasks by status."""
        qs = self.get_queryset()
        by_status = {row["status"]: row["count"] for row in qs.values("status").annotate(count=Count("id"))}
        data = {
            "total": qs.count(),
            "todo": by_status.get(Task.Status.TODO, 0),
            "in_progress": by_status.get(Task.Status.IN_PROGRESS, 0),
            "done": by_status.get(Task.Status.DONE, 0),
        }
        return Response(data)
