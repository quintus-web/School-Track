from rest_framework import status, permissions
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.gis.geos import Point
from .models import Trip, VehicleLocation, TripStopEvent
from .serializers import TripSerializer, VehicleLocationIngestSerializer, BulkLocationItemSerializer
from .tasks import evaluate_trip_proximity
from .services import finalize_trip_analytics
from apps.routes.models import RouteStop


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

        return Response({"error": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)


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


class BulkVehicleLocationIngestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, trip_id):
        driver_profile = getattr(request.user, 'driver_profile', None)
        trip = Trip.objects.filter(id=trip_id, driver=driver_profile, status='ACTIVE').first()

        if not trip:
            return Response(
                {"error": "Active trip not found for authenticated driver."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = BulkLocationItemSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        raw_items = serializer.validated_data

        if not raw_items:
            return Response({"synced_uuids": []}, status=status.HTTP_200_OK)

        accepted_uuids = []
        latest_saved_location = None

        for item in raw_items:
            if VehicleLocation.objects.filter(client_uuid=item['client_uuid']).exists():
                accepted_uuids.append(str(item['client_uuid']))
                continue

            point = Point(item['longitude'], item['latitude'], srid=4326)
            loc = VehicleLocation.objects.create(
                trip=trip,
                client_uuid=item['client_uuid'],
                point=point,
                speed_kph=item.get('speed_kph', 0.0),
                accuracy_meters=item.get('accuracy_meters', 0.0),
                recorded_at=item['recorded_at']
            )
            accepted_uuids.append(str(item['client_uuid']))
            latest_saved_location = loc

        if latest_saved_location:
            evaluate_trip_proximity.defer(trip_id=trip.id, location_id=latest_saved_location.id)

        return Response({"synced_uuids": accepted_uuids}, status=status.HTTP_200_OK)


class DriverStopActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, trip_id, stop_id):
        action = request.data.get('action')
        reason = request.data.get('reason')
        notes = request.data.get('notes', '')

        driver_profile = getattr(request.user, 'driver_profile', None)
        trip = Trip.objects.filter(id=trip_id, driver=driver_profile, status='ACTIVE').first()
        if not trip:
            return Response({"error": "Active trip not found."}, status=status.HTTP_404_NOT_FOUND)

        stop = RouteStop.objects.filter(id=stop_id, route=trip.route).first()
        if not stop:
            return Response({"error": "Stop not found on this route."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()

        if action == 'ARRIVED':
            event, _ = TripStopEvent.objects.get_or_create(
                trip=trip, route_stop=stop, event_type='ARRIVED',
                defaults={'occurred_at': now}
            )
            return Response({"status": "stop_arrived", "stop_id": stop.id, "recorded_at": event.occurred_at})

        if action == 'SKIPPED':
            if not reason:
                return Response({"error": "A skip reason is required."}, status=status.HTTP_400_BAD_REQUEST)
            event, _ = TripStopEvent.objects.get_or_create(
                trip=trip, route_stop=stop, event_type='SKIPPED',
                defaults={'skip_reason': reason, 'notes': notes, 'occurred_at': now}
            )
            return Response({"status": "stop_skipped", "stop_id": stop.id, "reason": event.skip_reason})

        return Response({"error": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)
