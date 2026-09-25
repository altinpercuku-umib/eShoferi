from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(['GET'])
def health_check(request):
    """
    Healthcheck endpoint me verifiku statusin e aplikacionit.
    """
    return Response({"status":"ok","message":"Aplikacioni eshte ne gjendje te mire."})