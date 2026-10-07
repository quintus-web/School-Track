import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User
from apps.schools.models import School, SchoolMembership
from apps.routes.models import Route, RouteStop
from apps.students.models import Student, Guardian, StudentGuardian, StudentTransportAssignment

school = School.objects.get(slug="demo-academy")
route = Route.objects.get(school=school, name="Rongai - Galleria Route")
stop_1 = RouteStop.objects.get(route=route, sequence=1)  # Total Rongai

# 1. Create a parent user
parent_user, _ = User.objects.get_or_create(
    phone="0711223344",
    defaults={"name": "Grace Mwangi"}
)
parent_user.set_password("ParentPass@123")
parent_user.save()

SchoolMembership.objects.get_or_create(
    school=school,
    user=parent_user,
    defaults={"role": "GUARDIAN"}
)

# 2. Create Guardian profile
guardian, _ = Guardian.objects.get_or_create(
    school=school,
    user=parent_user,
    defaults={"relationship": "Mother"}
)

# 3. Create Student
student, _ = Student.objects.get_or_create(
    school=school,
    admission_number="ADM-2026-089",
    defaults={"name": "Brian Mwangi"}
)

# 4. Link Student to Guardian
StudentGuardian.objects.get_or_create(
    student=student,
    guardian=guardian,
    defaults={
        "receive_sms": True,
        "receive_push": True,
        "pickup_authorized": True
    }
)

# 5. Assign Student to Route and Stop
StudentTransportAssignment.objects.get_or_create(
    student=student,
    route=route,
    route_stop=stop_1,
    defaults={"is_active": True}
)

print(f"Parent & Student linked to Stop 1 ({stop_1.name}).")