from django.db import models
from django.conf import settings
from apps.schools.models import School
from apps.routes.models import Route, RouteStop

class Student(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='students')
    admission_number = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    grade = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'admission_number')

    def __str__(self):
        return f"{self.name} ({self.admission_number})"

class Guardian(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='guardians')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='guardian_profiles')
    relationship = models.CharField(max_length=50, default='Parent')

    def __str__(self):
        return f"{self.user.name} ({self.relationship})"

class StudentGuardian(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='guardian_links')
    guardian = models.ForeignKey(Guardian, on_delete=models.CASCADE, related_name='student_links')
    receive_sms = models.BooleanField(default=True)
    receive_push = models.BooleanField(default=True)
    pickup_authorized = models.BooleanField(default=True)

    class Meta:
        unique_together = ('student', 'guardian')

class StudentTransportAssignment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transport_assignments')
    route = models.ForeignKey(Route, on_delete=models.CASCADE)
    route_stop = models.ForeignKey(RouteStop, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.student.name} -> {self.route_stop.name}"
    