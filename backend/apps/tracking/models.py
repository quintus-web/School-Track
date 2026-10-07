import uuid
from django.contrib.gis.db import models as gis_models
from django.db import models
from apps.schools.models import School
from apps.fleet.models import Vehicle, DriverProfile
from apps.routes.models import Route, RouteStop


class Trip(models.Model):
    STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='trips')
    route = models.ForeignKey(Route, on_delete=models.PROTECT, related_name='trips')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name='trips')
    driver = models.ForeignKey(DriverProfile, on_delete=models.PROTECT, related_name='trips')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='SCHEDULED')
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    distance_meters = models.FloatField(null=True, blank=True)
    average_speed_kph = models.FloatField(null=True, blank=True)
    max_speed_kph = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Trip {self.id}: {self.route.name} ({self.status})"


class VehicleLocation(gis_models.Model):
    trip = gis_models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='locations')
    client_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    point = gis_models.PointField(srid=4326)
    speed_kph = gis_models.FloatField(null=True, blank=True)
    accuracy_meters = gis_models.FloatField(default=0.0)
    recorded_at = gis_models.DateTimeField()
    received_at = gis_models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            gis_models.Index(fields=['trip', '-recorded_at']),
        ]


class TripStopEvent(models.Model):
    EVENT_CHOICES = [
        ('APPROACHING_ALERT', 'Bus Approaching Alert'),
        ('ARRIVED', 'Bus Arrived at Stop'),
        ('DEPARTED', 'Bus Departed Stop'),
        ('SKIPPED', 'Stop Skipped'),
    ]
    SKIP_REASON_CHOICES = [
        ('CHILD_ABSENT', 'Student Absent / Called Ahead'),
        ('ROAD_BLOCKAGE', 'Road Blockage / Inaccessible'),
        ('GUARDIAN_DIRECT_PICKUP', 'Picked Up Directly by Parent'),
        ('SAFETY_CONCERN', 'Safety / Emergency Hazard'),
        ('OTHER', 'Other / Operational Decision'),
    ]

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='stop_events')
    route_stop = models.ForeignKey(RouteStop, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=25, choices=EVENT_CHOICES)
    skip_reason = models.CharField(max_length=30, choices=SKIP_REASON_CHOICES, null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    occurred_at = models.DateTimeField()

    class Meta:
        unique_together = ('trip', 'route_stop', 'event_type')
