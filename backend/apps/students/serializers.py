from rest_framework import serializers
from .models import Student, StudentGuardian, StudentTransportAssignment
from apps.tracking.models import Trip, VehicleLocation, TripStopEvent

class ParentStudentTransportSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    stop_name = serializers.SerializerMethodField()
    stop_sequence = serializers.SerializerMethodField()
    stop_location = serializers.SerializerMethodField()
    active_trip = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'admission_number', 'name', 'school_name',
            'stop_name', 'stop_sequence', 'stop_location', 'active_trip'
        ]

    def get_assignment(self, obj):
        return obj.transport_assignments.filter(is_active=True).select_related('route_stop', 'route').first()

    def get_stop_name(self, obj):
        assignment = self.get_assignment(obj)
        return assignment.route_stop.name if assignment else None

    def get_stop_sequence(self, obj):
        assignment = self.get_assignment(obj)
        return assignment.route_stop.sequence if assignment else None

    def get_stop_location(self, obj):
        assignment = self.get_assignment(obj)
        if assignment and assignment.route_stop.location:
            return {
                'latitude': assignment.route_stop.location.y,
                'longitude': assignment.route_stop.location.x,
            }
        return None

    def get_active_trip(self, obj):
        assignment = self.get_assignment(obj)
        if not assignment:
            return None

        # Look for active trip on this route
        trip = Trip.objects.filter(route=assignment.route, status='ACTIVE').select_related('vehicle').first()
        if not trip:
            return None

        latest_loc = trip.locations.order_by('-recorded_at').first()
        has_approached = TripStopEvent.objects.filter(
            trip=trip,
            route_stop=assignment.route_stop,
            event_type='APPROACHING_ALERT'
        ).exists()

        return {
            'trip_id': trip.id,
            'vehicle_plate': trip.vehicle.registration_number,
            'started_at': trip.started_at,
            'approaching_alert_sent': has_approached,
            'last_known_location': {
                'latitude': latest_loc.point.y,
                'longitude': latest_loc.point.x,
                'recorded_at': latest_loc.recorded_at,
                'speed_kph': latest_loc.speed_kph,
            } if latest_loc else None
        }