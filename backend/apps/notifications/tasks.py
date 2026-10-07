import os
import africastalking
from config.procrastinate import app
from apps.tracking.models import Trip
from apps.routes.models import RouteStop
from apps.students.models import StudentTransportAssignment

# Initialize Africa's Talking SMS client
AT_USERNAME = os.getenv('AFRICASTALKING_USERNAME', 'sandbox')
AT_API_KEY = os.getenv('AFRICASTALKING_API_KEY', 'dummy_key')
AT_SENDER_ID = os.getenv('AFRICASTALKING_SENDER_ID', 'SchoolTrack')

africastalking.initialize(AT_USERNAME, AT_API_KEY)
sms_client = africastalking.SMS

@app.task
def send_arrival_notifications(trip_id: int, route_stop_id: int):
    try:
        trip = Trip.objects.select_related('school', 'vehicle').get(id=trip_id)
        stop = RouteStop.objects.get(id=route_stop_id)
    except (Trip.DoesNotExist, RouteStop.DoesNotExist):
        return

    # Find students assigned to this stop
    assignments = StudentTransportAssignment.objects.filter(
        route_stop=stop,
        is_active=True
    ).select_related('student')

    for assignment in assignments:
        student = assignment.student
        links = student.guardian_links.filter(pickup_authorized=True).select_related('guardian__user')

        for link in links:
            guardian_user = link.guardian.user
            text = (
                f"SchoolTrack Alert: The bus ({trip.vehicle.registration_number}) "
                f"is approaching {stop.name} for {student.name}."
            )

            # Africa's Talking SMS Dispatch
            if link.receive_sms and guardian_user.phone:
                try:
                    # In sandbox, destination must be an AT-registered test phone number
                    sms_client.send(text, [guardian_user.phone], AT_SENDER_ID)
                    print(f"[SMS SENT] To {guardian_user.phone}: {text}")
                except Exception as e:
                    print(f"[SMS FAILED] {e}")

            # Push notification placeholder (triggered when web push token exists)
            if link.receive_push:
                print(f"[PUSH SENT] To guardian {guardian_user.name}: {text}")