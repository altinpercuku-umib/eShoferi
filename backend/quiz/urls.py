from django.urls import path
from rest_framework.routers import DefaultRouter

from .stats import LeaderboardView, StatsView
from .views import CategoryViewSet, ExamViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet)
router.register("exams", ExamViewSet, basename="exam")

urlpatterns = router.urls + [
    path("stats/", StatsView.as_view(), name="stats"),
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
]
