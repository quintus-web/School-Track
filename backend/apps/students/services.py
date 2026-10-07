import csv
import io
from typing import Dict, Any, List
from django.db import transaction
from django.utils.crypto import get_random_string
from apps.schools.models import School, SchoolMembership
from apps.accounts.models import User
from apps.accounts.utils import normalize_kenyan_phone
from apps.routes.models import Route, RouteStop
from .models import Student, Guardian, StudentGuardian, StudentTransportAssignment

REQUIRED_HEADERS = {
    'student_name', 'admission_number', 'guardian_name', 
    'guardian_phone', 'route_name', 'stop_name'
}

def process_student_roster_csv(school: School, file_obj) -> Dict[str, Any]:
    decoded = file_obj.read().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))

    # Header normalization
    fieldnames = {h.strip().lower() for h in (reader.fieldnames or [])}
    missing = REQUIRED_HEADERS - fieldnames
    if missing:
        return {
            "success": False, 
            "error": f"Missing required CSV columns: {', '.join(sorted(missing))}"
        }

    created_students = 0
    updated_students = 0
    errors: List[Dict[str, Any]] = []

    # Cache existing routes and stops for this school to avoid N+1 lookups
    routes_cache = {r.name.lower(): r for r in Route.objects.filter(school=school)}
    stops_cache = {
        (s.route.name.lower(), s.name.lower()): s 
        for s in RouteStop.objects.filter(route__school=school).select_related('route')
    }

    with transaction.atomic():
        for row_idx, raw_row in enumerate(reader, start=2):
            row = {k.strip().lower(): v.strip() for k, v in raw_row.items() if k}
            
            adm_no = row.get('admission_number')
            student_name = row.get('student_name')
            guardian_name = row.get('guardian_name')
            raw_phone = row.get('guardian_phone')
            route_name = row.get('route_name')
            stop_name = row.get('stop_name')
            relationship = row.get('relationship', 'Parent')

            if not adm_no or not student_name or not raw_phone:
                errors.append({"row": row_idx, "error": "Missing essential student or guardian fields."})
                continue

            # 1. Normalize Phone Number
            try:
                norm_phone = normalize_kenyan_phone(raw_phone)
            except Exception as e:
                errors.append({"row": row_idx, "admission_number": adm_no, "error": str(e)})
                continue

            # 2. Resolve Route and Stop
            stop = stops_cache.get((route_name.lower(), stop_name.lower()))
            if not stop:
                route = routes_cache.get(route_name.lower())
                if not route:
                    errors.append({"row": row_idx, "error": f"Route '{route_name}' does not exist for this school."})
                    continue
                errors.append({"row": row_idx, "error": f"Stop '{stop_name}' not found under route '{route.name}'."})
                continue

            # 3. Create or Update Guardian User
            guardian_user, user_created = User.objects.get_or_create(
                phone=norm_phone,
                defaults={
                    'name': guardian_name or "Guardian",
                    'is_active': True
                }
            )
            if user_created:
                # Temporary randomized password; guardian receives activation token/invite later
                guardian_user.set_password(get_random_string(16))
                guardian_user.save()

            SchoolMembership.objects.get_or_create(
                school=school,
                user=guardian_user,
                defaults={'role': 'GUARDIAN'}
            )

            guardian_profile, _ = Guardian.objects.get_or_create(
                school=school,
                user=guardian_user,
                defaults={'relationship': relationship}
            )

            # 4. Upsert Student Record
            student, st_created = Student.objects.update_or_create(
                school=school,
                admission_number=adm_no,
                defaults={'name': student_name, 'is_active': True}
            )
            if st_created:
                created_students += 1
            else:
                updated_students += 1

            # 5. Link Guardian to Student
            StudentGuardian.objects.get_or_create(
                student=student,
                guardian=guardian_profile,
                defaults={
                    'receive_sms': True,
                    'receive_push': True,
                    'pickup_authorized': True
                }
            )

            # 6. Assign Transport Route & Stop
            StudentTransportAssignment.objects.update_or_create(
                student=student,
                defaults={
                    'route': stop.route,
                    'route_stop': stop,
                    'is_active': True
                }
            )

        if errors and created_students == 0 and updated_students == 0:
            transaction.set_rollback(True)
            return {"success": False, "errors": errors}

    return {
        "success": True,
        "created": created_students,
        "updated": updated_students,
        "errors": errors
    }