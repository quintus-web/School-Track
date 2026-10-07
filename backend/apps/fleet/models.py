from django.db import models
from django.conf import settings
from apps.schools.models import School

class Vehicle(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='vehicles')
    registration_number = models.CharField(max_length=20)
    capacity = models.PositiveIntegerField(default=14)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'registration_number')

    def __str__(self):
        return f"{self.registration_number} ({self.school.name})"

class DriverProfile(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='drivers')
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='driver_profile')
    license_reference = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.name} - {self.school.name}"