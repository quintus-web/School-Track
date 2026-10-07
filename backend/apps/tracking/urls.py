from django.urls import path
from .views import (
    DriverAssignedTripsView,
    TripStartView,
    TripEndView,
    VehicleLocationIngestView,
    BulkVehicleLocationIngestView,
    DriverStopActionView,
)

urlpatterns = [
    path('driver/trips/', DriverAssignedTripsView.as_view(), name='driver-trips'),
    path('driver/trips/<int:trip_id>/location/', VehicleLocationIngestView.as_view(), name='driver-location-ingest'),
    path('driver/trips/<int:trip_id>/bulk-locations/', BulkVehicleLocationIngestView.as_view(), name='driver-bulk-locations'),
    path('driver/trips/<int:trip_id>/start/', TripStartView.as_view(), name='driver-trip-start'),
    path('driver/trips/<int:trip_id>/end/', TripEndView.as_view(), name='driver-trip-end'),
    path('driver/trips/<int:trip_id>/stops/<int:stop_id>/action/', DriverStopActionView.as_view(), name='driver-stop-action'),
]
