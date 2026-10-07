from django.contrib.gis.db import models as gis_models
from django.db import models
from apps.schools.models import School

class Route(models.Model):
    DIRECTION_CHOICES = [
        ('AM', 'Morning Pickup'),
        ('PM', 'Evening Dropoff'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='routes')
    name = models.CharField(max_length=120)
    direction = models.CharField(max_length=2, choices=DIRECTION_CHOICES, default='AM')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_direction_display()}) - {self.school.name}"

class RouteStop(gis_models.Model):
    route = gis_models.ForeignKey(Route, on_delete=models.CASCADE, related_name='stops')
    name = gis_models.CharField(max_length=150)
    location = gis_models.PointField(srid=4326)
    sequence = gis_models.PositiveIntegerField()
    alert_radius_meters = gis_models.PositiveIntegerField(default=1000)

    class Meta:
        ordering = ['sequence']
        unique_together = ('route', 'sequence')

    def __str__(self):
        return f"Stop {self.sequence}: {self.name} ({self.route.name})"