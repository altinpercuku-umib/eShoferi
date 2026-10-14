from datetime import timedelta

from django.conf import settings
from django.db.models import Avg, Count, FloatField, Max, Q
from django.db.models.functions import Cast
from django.utils import timezone
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AttemptQuestion, ExamAttempt

READINESS_EXAMS = 5  # readiness = average of your last 5 full exams
RECENT_EXAMS = 10  # how many exams the progress chart shows
MIN_ANSWERS_FOR_WEAKEST = 3  # don't call a category "weakest" after a single question


def percent():
    """An attempt's score as a percentage, calculated inside the database."""
    return Cast("score", FloatField()) * 100.0 / Cast("total", FloatField())


def finished_attempts():
    return ExamAttempt.objects.filter(submitted_at__isnull=False, total__gt=0)


def leaderboard_rows(since=None):
    """Users ranked by their average score on full exams. Category practice doesn't count."""
    attempts = finished_attempts().filter(category__isnull=True, user__is_active=True)
    if since:
        attempts = attempts.filter(submitted_at__gte=since)

    rows = (
        attempts.values("user_id", "user__username")
        .annotate(
            exams=Count("id"),
            passed=Count("id", filter=Q(passed=True)),
            average=Avg(percent()),
            best=Max(percent()),
        )
        .filter(exams__gte=settings.LEADERBOARD_MIN_EXAMS)
        .order_by("-average", "-exams", "user__username")
    )

    ranked = []
    for position, row in enumerate(rows, start=1):
        average = round(row["average"], 1)
        # Same average = same rank (1, 2, 2, 4), like in sports tables.
        rank = ranked[-1]["rank"] if ranked and ranked[-1]["average"] == average else position
        ranked.append(
            {
                "rank": rank,
                "user_id": row["user_id"],
                "username": row["user__username"],
                "average": average,
                "best": round(row["best"], 1),
                "exams": row["exams"],
                "passed": row["passed"],
            }
        )
    return ranked


class StatsView(APIView):
    """Everything the dashboard needs about the logged-in user, in one request."""

    def get(self, request):
        done = finished_attempts().filter(user=request.user)
        full = done.filter(category__isnull=True)

        counts = done.aggregate(exams=Count("id"))
        full_counts = full.aggregate(
            exams=Count("id"),
            passed=Count("id", filter=Q(passed=True)),
            best=Max(percent()),
        )
        answers = AttemptQuestion.objects.filter(attempt__in=done).aggregate(
            answered=Count("id"),
            correct=Count("id", filter=Q(is_correct=True)),
        )

        latest_full = list(full.order_by("-submitted_at").values_list("score", "total")[:READINESS_EXAMS])
        readiness = (
            round(sum(score * 100 / total for score, total in latest_full) / len(latest_full), 1)
            if latest_full
            else None
        )

        recent = list(done.select_related("category").order_by("-submitted_at")[:RECENT_EXAMS])
        recent.reverse()  # oldest first, for the chart

        per_category = (
            AttemptQuestion.objects.filter(attempt__in=done)
            .values("question__category_id", "question__category__name")
            .annotate(answered=Count("id"), correct=Count("id", filter=Q(is_correct=True)))
            .order_by()
        )
        categories = sorted(
            (
                {
                    "id": row["question__category_id"],
                    "name": row["question__category__name"],
                    "answered": row["answered"],
                    "correct": row["correct"],
                    "accuracy": round(row["correct"] * 100 / row["answered"], 1),
                }
                for row in per_category
            ),
            key=lambda category: (category["accuracy"], -category["answered"]),
        )
        weakest = next((c for c in categories if c["answered"] >= MIN_ANSWERS_FOR_WEAKEST), None)

        board = leaderboard_rows()
        my_row = next((row for row in board if row["user_id"] == request.user.id), None)

        return Response(
            {
                "exams": counts["exams"],
                "full_exams": full_counts["exams"],
                "full_passed": full_counts["passed"],
                "best_percent": round(full_counts["best"], 1) if full_counts["best"] is not None else None,
                "readiness": readiness,
                "readiness_exams": len(latest_full),
                "pass_percent": settings.EXAM_PASS_PERCENT,
                "answered": answers["answered"],
                "correct": answers["correct"],
                "rank": {"position": my_row["rank"], "of": len(board)} if my_row else None,
                "recent": [
                    {
                        "id": attempt.id,
                        "submitted_at": attempt.submitted_at,
                        "category": attempt.category.name if attempt.category else None,
                        "score": attempt.score,
                        "total": attempt.total,
                        "percent": attempt.percent,
                        "passed": attempt.passed,
                    }
                    for attempt in recent
                ],
                "categories": categories,
                "weakest": weakest,
            }
        )


class LeaderboardView(APIView):
    """Public ranking. Shows usernames only - never emails."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period = request.query_params.get("period", "all")
        if period not in ("all", "week"):
            raise ValidationError({"period": "Përdor 'all' ose 'week'."})
        since = timezone.now() - timedelta(days=7) if period == "week" else None

        me_id = request.user.id if request.user.is_authenticated else None
        entries = []
        for row in leaderboard_rows(since):
            entry = {key: value for key, value in row.items() if key != "user_id"}
            entry["is_me"] = row["user_id"] == me_id
            entries.append(entry)

        data = {
            "period": period,
            "min_exams": settings.LEADERBOARD_MIN_EXAMS,
            "results": entries[: settings.LEADERBOARD_SIZE],
            "me": next((entry for entry in entries if entry["is_me"]), None),
        }
        if me_id:
            mine = finished_attempts().filter(user_id=me_id, category__isnull=True)
            if since:
                mine = mine.filter(submitted_at__gte=since)
            data["my_exams"] = mine.count()
        return Response(data)
