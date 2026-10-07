import procrastinate

app = procrastinate.App(
    connector=procrastinate.contrib.django.django_connector.DjangoConnector()
)