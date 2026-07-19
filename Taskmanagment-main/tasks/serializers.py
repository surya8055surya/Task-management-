from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.username")
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "owner",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "is_overdue",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")

    def get_is_overdue(self, obj):
        from django.utils import timezone

        if obj.due_date and obj.status != Task.Status.DONE:
            return obj.due_date < timezone.localdate()
        return False

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Title cannot be blank.")
        return value.strip()
