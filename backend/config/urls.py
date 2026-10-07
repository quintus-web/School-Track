from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import PhoneLoginView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', PhoneLoginView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/tracking/', include('apps.tracking.urls')),
    path('api/students/', include('apps.students.urls')),
]