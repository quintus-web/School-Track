import csv
import io
import re
from django.db import transaction
from apps.accounts.models import User
from apps.schools.models import SchoolMembership
from apps.routes.models import Route, RouteStop
from .models import Student, Guardian, StudentGuardian, StudentTransportAssignment

REQUIRED_FIELDS = {
    'student_name', 'admission_number', 'guardian_name',
    'guardian_phone', 'route_name', 'stop_name', 'relationship'
}


def normalize_phone(raw):
    """
    Normalize Kenyan phone numbers to 07XXXXXXXX (10 digits).
    Accepts: 07XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX, +254 7XX XXX XXX
    Returns None if the number is invalid.
    """
    digits = re.sub(r'\D', '', raw)

    if digits.startswith('254') and len(digits) == 12:
        digits = '0' + digits[3:]
    elif digits.startswith('0') and len(digits) == 10:
        pass
    else:
        return None

    if not re.match(r'^0[17]\d{8}$', digits):
        return None

    return digits


def process_student_roster_csv(school, file_obj):
    text = file_obj.read().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))

    missing = REQUIRED_FIELDS - set(reader.fieldnames or [])
    if missing:
        return {"success": False, "error": f"CSV missing required columns: {missing}"}

    created, updated, errors = 0, 0, []

    for i, row in enumerate(reader, start=2):  # row 1 is header
        admission_number = row['admission_number'].strip()
        student_name = row['student_name'].strip()
        guardian_name = row['guardian_name'].strip()
        guardian_phone_raw = row['guardian_phone'].strip()
        route_name = row['route_name'].strip()
        stop_name = row['stop_name'].strip()
        relationship = row['relationship'].strip() or 'Parent'

        if not admission_number or not student_name:
            errors.append({"row": i, "error": "Missing admission_number or student_name."})
            continue

        phone = normalize_phone(guardian_phone_raw)
        if not phone:
            errors.append({"row": i, "admission_number": admission_number,
                           "error": f"Invalid phone number: '{guardian_phone_raw}'"})
            continue

        route = Route.objects.filter(school=school, name=route_name).first()
        if not route:
            errors.append({"row": i, "admission_number": admission_number,
                           "error": f"Route not found: '{route_name}'"})
            continue

        stop = RouteStop.objects.filter(route=route, name=stop_name).first()
        if not stop:
            errors.append({"row": i, "admission_number": admission_number,
                           "error": f"Stop not found: '{stop_name}' on route '{route_name}'"})
            continue

        try:
            with transaction.atomic():
                student, was_created = Student.objects.update_or_create(
                    school=school,
                    admission_number=admission_number,
                    defaults={'name': student_name}
                )

                guardian_user, _ = User.objects.get_or_create(
                    phone=phone,
                    defaults={'name': guardian_name}
                )
                SchoolMembership.objects.get_or_create(
                    school=school, user=guardian_user,
                    defaults={'role': 'GUARDIAN'}
                )
                guardian, _ = Guardian.objects.get_or_create(
                    school=school, user=guardian_user,
                    defaults={'relationship': relationship}
                )
                StudentGuardian.objects.get_or_create(
                    student=student, guardian=guardian
                )
                StudentTransportAssignment.objects.update_or_create(
                    student=student,
                    defaults={'route': route, 'route_stop': stop, 'is_active': True}
                )

                if was_created:
                    created += 1
                else:
                    updated += 1

        except Exception as e:
            errors.append({"row": i, "admission_number": admission_number, "error": str(e)})

    return {
        "success": True,
        "created": created,
        "updated": updated,
        "errors": errors
    }
