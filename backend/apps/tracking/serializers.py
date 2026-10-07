from rest_framework import serializers
from .models import Trip, VehicleLocation
from apps.routes.models import RouteStop
from rest_framework import serializers

class RouteStopSerializer(serializers.ModelSerializer):
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = RouteStop
        fields = ['id', 'name', 'sequence', 'alert_radius_meters', 'latitude', 'longitude']

    def get_latitude(self, obj):
        return obj.location.y

    def get_longitude(self, obj):
        return obj.location.x

class TripSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source='route.name', read_only=True)
    vehicle_reg = serializers.CharField(source='vehicle.registration_number', read_only=True)
    stops = RouteStopSerializer(source='route.stops', many=True, read_only=True)

    class Meta:
        model = Trip
        fields = ['id', 'status', 'route_name', 'vehicle_reg', 'started_at', 'ended_at', 'stops']

class VehicleLocationIngestSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90.0, max_value=90.0)
    longitude = serializers.FloatField(min_value=-180.0, max_value=180.0)
    speed_kph = serializers.FloatField(required=False, default=0.0)
    accuracy_meters = serializers.FloatField(required=False, default=0.0)
    recorded_at = serializers.DateTimeField()



class BulkLocationItemSerializer(serializers.Serializer):
    client_uuid = serializers.UUIDField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    speed_kph = serializers.FloatField(required=False, default=0.0)
    accuracy_meters = serializers.FloatField(required=False, default=0.0)
    recorded_at = serializers.DateTimeField()