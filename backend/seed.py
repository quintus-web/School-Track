import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.gis.geos import Point
from apps.accounts.models import User
from apps.schools.models import School, SchoolMembership
from apps.fleet.models import Vehicle, DriverProfile
from apps.routes.models import Route, RouteStop
from apps.tracking.models import Trip

# 1. Fetch user
user = User.objects.get(phone="0701911486")

# 2. Create school
school, _ = School.objects.get_or_create(
    slug="demo-academy",
    defaults={"name": "Demo Academy Nairobi"}
)

# 3. Add school membership and driver profile
SchoolMembership.objects.get_or_create(
    school=school,
    user=user,
    defaults={"role": "DRIVER"}
)

driver_profile, _ = DriverProfile.objects.get_or_create(
    school=school,
    user=user,
    defaults={"license_reference": "DL-98234-KE"}
)

# 4. Create vehicle
vehicle, _ = Vehicle.objects.get_or_create(
    school=school,
    registration_number="KDA 789B",
    defaults={"capacity": 22}
)

# 5. Create route & stops
route, _ = Route.objects.get_or_create(
    school=school,
    name="Rongai - Galleria Route",
    direction="AM"
)

RouteStop.objects.get_or_create(
    route=route,
    sequence=1,
    defaults={
        "name": "TotalEnergies Ongata Rongai",
        "location": Point(36.7582, -1.3965, srid=4326),
        "alert_radius_meters": 1000
    }
)

RouteStop.objects.get_or_create(
    route=route,
    sequence=2,
    defaults={
        "name": "Maasai Mall Gate",
        "location": Point(36.7538, -1.3892, srid=4326),
        "alert_radius_meters": 1000
    }
)

RouteStop.objects.get_or_create(
    route=route,
    sequence=3,
    defaults={
        "name": "Galleria Junction",
        "location": Point(36.7621, -1.3524, srid=4326),
        "alert_radius_meters": 1200
    }
)

# 6. Create scheduled trip
trip, _ = Trip.objects.get_or_create(
    school=school,
    route=route,
    vehicle=vehicle,
    driver=driver_profile,
    status="SCHEDULED"
)

print(f"\n SUCCESS: Trip ID {trip.id} created and assigned to {user.name} ({user.phone}).")