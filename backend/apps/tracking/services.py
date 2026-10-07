from django.db import connection
from django.utils import timezone
from .models import Trip, VehicleLocation

def finalize_trip_analytics(trip: Trip) -> Trip:
    """
    Computes duration, geodetic distance via PostGIS, and speed metrics.
    """
    if not trip.started_at:
        trip.started_at = trip.created_at
    if not trip.ended_at:
        trip.ended_at = timezone.now()

    # 1. Duration in seconds
    duration = int((trip.ended_at - trip.started_at).total_seconds())
    trip.duration_seconds = max(duration, 0)

    # 2. Compute true trajectory length using PostGIS
    # ST_MakeLine aggregates points in chronological order; ::geography calculates meters on the WGS 84 ellipsoid.
    query = """
        SELECT 
            COALESCE(ST_Length(ST_MakeLine(point::geometry ORDER BY recorded_at)::geography), 0.0) AS total_meters,
            COALESCE(MAX(speed_kph), 0.0) AS max_speed,
            COALESCE(AVG(speed_kph), 0.0) AS avg_speed,
            COUNT(id) AS total_pings
        FROM tracking_vehiclelocation
        WHERE trip_id = %s
    """

    with connection.cursor() as cursor:
        cursor.execute(query, [trip.id])
        row = cursor.fetchone()
        total_meters, max_speed, avg_speed, total_pings = row

    trip.distance_meters = round(float(total_meters), 2)
    trip.max_speed_kph = round(float(max_speed), 1)

    # 3. Calculate average speed (prefer distance / time if pings didn't record speed sensor)
    if duration > 0 and trip.distance_meters > 0:
        calculated_avg_kph = (trip.distance_meters / 1000.0) / (duration / 3600.0)
        trip.average_speed_kph = round(calculated_avg_kph, 1)
    else:
        trip.average_speed_kph = round(float(avg_speed), 1)

    trip.status = 'COMPLETED'
    trip.save()
    return trip