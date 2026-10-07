from django.contrib.gis.measure import D
from django.db import transaction
from config.procrastinate import app
from .models import Trip, VehicleLocation, TripStopEvent
from apps.students.models import StudentTransportAssignment, StudentGuardian
from apps.notifications.tasks import send_arrival_notifications

@app.task
def evaluate_trip_proximity(trip_id: int, location_id: int):
    try:
        trip = Trip.objects.select_related('route').get(id=trip_id)
        latest_loc = VehicleLocation.objects.get(id=location_id)
    except (Trip.DoesNotExist, VehicleLocation.DoesNotExist):
        return

    # 1. Stops that have already sent an approaching alert for this trip
    already_notified_stop_ids = TripStopEvent.objects.filter(
        trip=trip,
        event_type='APPROACHING_ALERT'
    ).values_list('route_stop_id', flat=True)

    # 2. Candidate stops remaining on this route
    upcoming_stops = trip.route.stops.exclude(
        id__in=already_notified_stop_ids
    ).order_by('sequence')

    for stop in upcoming_stops:
        # Measure distance in meters using PostGIS DWithin on geography
        is_within_radius = VehicleLocation.objects.filter(
            id=latest_loc.id,
            point__distance_lte=(stop.location, D(m=stop.alert_radius_meters))
        ).exists()

        if is_within_radius:
            with transaction.atomic():
                # Enforce idempotency: unique together (trip, route_stop, event_type)
                event, created = TripStopEvent.objects.get_or_create(
                    trip=trip,
                    route_stop=stop,
                    event_type='APPROACHING_ALERT',
                    defaults={'occurred_at': latest_loc.recorded_at}
                )

                if created:
                    # Queue notification dispatch job
                    send_arrival_notifications.defer(
                        trip_id=trip.id,
                        route_stop_id=stop.id
                    )