from django.urls import path
from .views import ParentDashboardView, StudentRosterCSVImportView, SchoolStatsView

urlpatterns = [
    path('parent/dashboard/', ParentDashboardView.as_view(), name='parent-dashboard'),
    path('admin/<slug:school_slug>/import-students/', StudentRosterCSVImportView.as_view(), name='admin-csv-import'),
    path('admin/<slug:school_slug>/stats/', SchoolStatsView.as_view(), name='admin-stats'),
]
