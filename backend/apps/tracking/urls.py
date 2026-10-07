from django.urls import path
from .views import DriverAssignedTripsView, TripStartEndView, VehicleLocationIngestView
from .views import VehicleLocationIngestView, TripStartView, TripEndView

urlpatterns = [
    path('driver/trips/', DriverAssignedTripsView.as_view(), name='driver-trips'),
    path('driver/trips/<int:trip_id>/location/', VehicleLocationIngestView.as_view(), name='trip-location-ingest'),
    path('driver/trips/<int:trip_id>/<str:action>/', TripStartEndView.as_view(), name='trip-start-end'),
    path('driver/trips/<int:trip_id>/start/', TripStartView.as_view(), name='driver-trip-start'),
    path('driver/trips/<int:trip_id>/end/', TripEndView.as_view(), name='driver-trip-end'),
    path('driver/trips/<int:trip_id>/location/', VehicleLocationIngestView.as_view(), name='driver-location-ingest'),
]