import uuid
from django.db import migrations, models


def populate_client_uuid(apps, schema_editor):
    VehicleLocation = apps.get_model('tracking', 'VehicleLocation')
    for obj in VehicleLocation.objects.all():
        obj.client_uuid = uuid.uuid4()
        obj.save(update_fields=['client_uuid'])


class Migration(migrations.Migration):

    dependencies = [
        ('tracking', '0002_trip_average_speed_kph_trip_distance_meters_and_more'),
    ]

    operations = [
        # Step 1: add column without unique constraint
        migrations.AddField(
            model_name='vehiclelocation',
            name='client_uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False),
        ),
        # Step 2: populate unique values for existing rows
        migrations.RunPython(populate_client_uuid, migrations.RunPython.noop),
        # Step 3: add the unique constraint
        migrations.AlterField(
            model_name='vehiclelocation',
            name='client_uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
