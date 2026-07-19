from django.views.generic import TemplateView


class HomeView(TemplateView):
    """Landing page with Login / Register tabs (Bootstrap)."""
    template_name = "index.html"


class DashboardView(TemplateView):
    """
    Task dashboard. This view does NOT check server-side session auth -
    the page loads for anyone, but dashboard.js immediately checks for a
    JWT access token in localStorage and redirects to '/' if missing.
    """
    template_name = "dashboard.html"
