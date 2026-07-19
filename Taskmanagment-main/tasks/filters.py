import django_filters as filters

from .models import Task


class TaskFilter(filters.FilterSet):
    """Supports filtering tasks by status, priority, and due-date range.

    Example query strings:
      /api/tasks/?status=todo
      /api/tasks/?priority=high
      /api/tasks/?due_before=2026-08-01
      /api/tasks/?due_after=2026-07-01
      /api/tasks/?status=todo&priority=high
    """

    due_before = filters.DateFilter(field_name="due_date", lookup_expr="lte")
    due_after = filters.DateFilter(field_name="due_date", lookup_expr="gte")

    class Meta:
        model = Task
        fields = ["status", "priority", "due_before", "due_after"]
