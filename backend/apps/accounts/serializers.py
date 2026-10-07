from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate

class PhoneTokenObtainPairSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['phone'] = serializers.CharField()
        if 'username' in self.fields:
            del self.fields['username']

    def validate(self, attrs):
        phone = attrs.get('phone')
        password = attrs.get('password')

        user = authenticate(phone=phone, password=password)
        if not user:
            raise serializers.ValidationError('Invalid phone number or password.')
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled.')

        data = super().validate({'phone': phone, 'password': password})
        
        # Add basic profile info to login response
        data['user'] = {
            'id': user.id,
            'name': user.name,
            'phone': user.phone,
            'is_staff': user.is_staff,
            'is_driver': hasattr(user, 'driver_profile'),
        }
        return data