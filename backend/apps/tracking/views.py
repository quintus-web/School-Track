from rest_framework import status, permissions
from django.utils import timezone
from .serializers import TripSerializer, VehicleLocationIngestSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.gis.geos import Point
from .models import Trip, VehicleLocation
from .serializers import VehicleLocationIngestSerializer
from .tasks import evaluate_trip_proximity
from .models import Trip
from .services import finalize_trip_analytics

class DriverAssignedTripsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        driver_profile = getattr(request.user, 'driver_profile', None)
        if not driver_profile:
            return Response({"error": "User is not registered as a driver."}, status=status.HTTP_403_FORBIDDEN)

        trips = Trip.objects.filter(
            driver=driver_profile,
            status__in=['SCHEDULED', 'ACTIVE']
        ).select_related('route', 'vehicle')
        
        serializer = TripSerializer(trips, many=True)
        return Response(serializer.data)

class TripStartEndView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, trip_id, action):
        driver_profile = getattr(request.user, 'driver_profile', None)
        trip = Trip.objects.filter(id=trip_id, driver=driver_profile).first()

        if not trip:
            return Response({"error": "Trip not found."}, status=status.HTTP_404_NOT_FOUND)

        if action == 'start':
            trip.status = 'ACTIVE'
            trip.started_at = timezone.now()
            trip.save(update_fields=['status', 'started_at'])
            return Response({"status": "Trip started", "started_at": trip.started_at})

        elif action == 'end':
            trip.status = 'COMPLETED'
            trip.ended_at = timezone.now()
            trip.save(update_fields=['status', 'ended_at'])
            return Response({"status": "Trip completed", "ended_at": trip.ended_at})

        return Response({"error": "Invalid action. Use 'start' or 'end'."}, status=status.HTTP_400_BAD_REQUEST)

class VehicleLocationIngestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, trip_id):
        driver_profile = getattr(request.user, 'driver_profile', None)
        trip = Trip.objects.filter(id=trip_id, driver=driver_profile, status='ACTIVE').first()

        if not trip:
            return Response({"error": "Active trip not found for this driver."}, status=status.HTTP_404_NOT_FOUND)

        serializer = VehicleLocationIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        point = Point(data['longitude'], data['latitude'], srid=4326)

        loc = VehicleLocation.objects.create(
            trip=trip,
            point=point,
            speed_kph=data.get('speed_kph', 0.0),
            accuracy_meters=data.get('accuracy_meters', 0.0),
            recorded_at=data['recorded_at']
        )

        # Defer proximity check to background queue
        evaluate_trip_proximity.defer(trip_id=trip.id, location_id=loc.id)

        return Response({"status": "location_recorded"}, status=status.HTTP_201_CREATED)
    
class TripStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, trip_id):
        driver_profile = getattr(request.user, 'driver_profile', None)
        trip = Trip.objects.filter(id=trip_id, driver=driver_profile).first()

        if not trip:
            return Response({"error": "Trip not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

        if trip.status == 'ACTIVE':
            return Response({"message": "Trip is already active."}, status=status.HTTP_200_OK)

        trip.status = 'ACTIVE'
        trip.started_at = timezone.now()
        trip.save()

        return Response({
            "status": "trip_started",
            "trip_id": trip.id,
            "started_at": trip.started_at
        }, status=status.HTTP_200_OK)

class TripEndView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, trip_id):
        driver_profile = getattr(request.user, 'driver_profile', None)
        trip = Trip.objects.filter(id=trip_id, driver=driver_profile, status='ACTIVE').first()

        if not trip:
            return Response({"error": "No active trip found to end."}, status=status.HTTP_404_NOT_FOUND)

        trip.ended_at = timezone.now()
        trip = finalize_trip_analytics(trip)

        return Response({
            "status": "trip_completed",
            "trip_id": trip.id,
            "summary": {
                "duration_minutes": round(trip.duration_seconds / 60.0, 1),
                "distance_km": round(trip.distance_meters / 1000.0, 2),
                "average_speed_kph": trip.average_speed_kph,
                "max_speed_kph": trip.max_speed_kph,
            }
        }, status=status.HTTP_200_OK)