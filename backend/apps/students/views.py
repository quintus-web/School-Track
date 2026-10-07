from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from apps.schools.models import SchoolMembership
from apps.fleet.models import Vehicle
from apps.routes.models import Route
from .models import Student, Guardian
from .serializers import ParentStudentTransportSerializer
from .utils import process_student_roster_csv


class ParentDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        guardian_profiles = request.user.guardian_profiles.all()
        if not guardian_profiles.exists():
            return Response({"error": "User has no guardian profiles linked."}, status=status.HTTP_403_FORBIDDEN)

        students = Student.objects.filter(
            guardian_links__guardian__in=guardian_profiles
        ).distinct()

        serializer = ParentStudentTransportSerializer(students, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StudentRosterCSVImportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, school_slug):
        membership = SchoolMembership.objects.filter(
            school__slug=school_slug,
            user=request.user,
            role__in=['ADMIN', 'TRANSPORT_STAFF']
        ).select_related('school').first()

        if not membership and not request.user.is_staff:
            return Response(
                {"error": "Unauthorized. Requires School Administrator privileges."},
                status=status.HTTP_403_FORBIDDEN
            )

        if membership:
            school = membership.school
        else:
            from apps.schools.models import School
            school = School.objects.filter(slug=school_slug).first()
            if not school:
                return Response({"error": "School not found."}, status=status.HTTP_404_NOT_FOUND)

        file_obj = request.FILES.get('file')
        if not file_obj or not file_obj.name.endswith('.csv'):
            return Response(
                {"error": "Please provide a valid '.csv' file."},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = process_student_roster_csv(school, file_obj)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


class SchoolStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, school_slug):
        membership = SchoolMembership.objects.filter(
            school__slug=school_slug,
            user=request.user,
            role__in=['ADMIN', 'TRANSPORT_STAFF']
        ).select_related('school').first()

        if not membership and not request.user.is_staff:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        school = membership.school if membership else None
        if not school:
            from apps.schools.models import School
            school = School.objects.filter(slug=school_slug).first()
            if not school:
                return Response({'error': 'School not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'students': Student.objects.filter(school=school, is_active=True).count(),
            'guardians': Guardian.objects.filter(school=school).count(),
            'routes': Route.objects.filter(school=school, is_active=True).count(),
            'vehicles': Vehicle.objects.filter(school=school, is_active=True).count(),
        })
