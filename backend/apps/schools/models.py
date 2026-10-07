from django.db import models
from django.conf import settings

class School(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100, unique=True)
    timezone = models.CharField(max_length=50, default='Africa/Nairobi')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class SchoolMembership(models.Model):
    ROLE_CHOICES = [
        ('ADMIN', 'School Administrator'),
        ('TRANSPORT_STAFF', 'Transport Officer'),
        ('DRIVER', 'Driver'),
        ('GUARDIAN', 'Parent / Guardian'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'user', 'role')

    def __str__(self):
        return f"{self.user.name} - {self.school.name} ({self.role})"