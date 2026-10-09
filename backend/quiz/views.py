import random
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import AttemptQuestion, Category, ExamAttempt, Question
from .serializers import (
    CategorySerializer,
    ExamHistorySerializer,
    ExamResultSerializer,
    ExamStartedSerializer,
    SubmitSerializer,
)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]  # anyone can browse categories


class ExamViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ExamHistorySerializer

    def get_queryset(self):
        # Security rule 2: a user only ever sees their own attempts.
        # Anyone else's attempt id simply returns 404.
        return (
            ExamAttempt.objects.filter(user=self.request.user)
            .prefetch_related("items__question__answers", "items__selected_answers")
            .order_by("-started_at")
        )

    def retrieve(self, request, *args, **kwargs):
        attempt = self.get_object()
        # Security rule 1: an unfinished attempt must not show correct answers.
        serializer_class = ExamResultSerializer if attempt.submitted_at else ExamStartedSerializer
        return Response(serializer_class(attempt).data)

    def create(self, request):
        count = settings.EXAM_QUESTION_COUNT
        question_ids = list(Question.objects.values_list("id", flat=True))
        if len(question_ids) < count:
            raise ValidationError(f"Duhen të paktën {count} pyetje për një provim.")

        chosen_ids = random.sample(question_ids, count)
        expires_at = timezone.now() + timedelta(minutes=settings.EXAM_DURATION_MINUTES)

        # Either the attempt AND all its questions are saved, or nothing is.
        with transaction.atomic():
            attempt = ExamAttempt.objects.create(user=request.user, expires_at=expires_at)
            AttemptQuestion.objects.bulk_create(
                AttemptQuestion(attempt=attempt, question_id=qid, position=i)
                for i, qid in enumerate(chosen_ids)
            )

        attempt = self.get_queryset().get(pk=attempt.pk)
        return Response(ExamStartedSerializer(attempt).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        input_serializer = SubmitSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        selected_by_question = {
            entry["question"]: set(entry["selected"])
            for entry in input_serializer.validated_data["answers"]
        }

        with transaction.atomic():
            # select_for_update locks this row until the transaction ends, so two
            # submits sent at the same moment can't both get past the checks below.
            attempt = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)

            # Security rule 3: submit only once, and only in time.
            if attempt.submitted_at is not None:
                raise ValidationError("Ky provim është dorëzuar tashmë.")
            now = timezone.now()
            grace = timedelta(seconds=settings.EXAM_SUBMIT_GRACE_SECONDS)
            if now > attempt.expires_at + grace:
                raise ValidationError("Koha për këtë provim ka mbaruar.")

            items = list(attempt.items.all())
            score = 0
            for item in items:
                answers = list(item.question.answers.all())
                valid_ids = {a.id for a in answers}
                correct_ids = {a.id for a in answers if a.is_correct}

                # Security rule 4: only questions in this attempt are scored (we loop over
                # the attempt's own items), and answer ids from other questions are dropped.
                picked = selected_by_question.get(item.question_id, set()) & valid_ids

                item.selected_answers.set(picked)
                # Correct only if the user picked exactly the correct answers - all of them, nothing extra.
                item.is_correct = picked == correct_ids
                score += item.is_correct

            AttemptQuestion.objects.bulk_update(items, ["is_correct"])
            attempt.score = score
            attempt.passed = score * 100 >= len(items) * settings.EXAM_PASS_PERCENT
            attempt.submitted_at = now
            attempt.save(update_fields=["score", "passed", "submitted_at"])

        attempt = self.get_queryset().get(pk=attempt.pk)
        return Response(ExamResultSerializer(attempt).data)
