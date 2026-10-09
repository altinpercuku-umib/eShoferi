from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, ExamViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet)
router.register("exams", ExamViewSet, basename="exam")

urlpatterns = router.urls
