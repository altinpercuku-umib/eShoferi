from django.conf import settings
from django.db import models

# Create your models here.


class Category(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        verbose_name = "Category"
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Question(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="questions")
    question_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    explanation = models.TextField(blank=True)

    class Meta:
        verbose_name = "Question"
        verbose_name_plural = "Questions"

    def __str__(self):
        return self.question_text[:50]

class Answer(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")
    answer_text = models.TextField()
    is_correct = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Answer"
        verbose_name_plural = "Answers"

    def __str__(self):
        return self.answer_text[:50]


class ExamAttempt(models.Model):
    """One exam taken by one user."""

    # If a user deletes their account, their attempts go with it.
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_attempts")
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    # These stay empty (NULL) until the exam is submitted.
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    passed = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user} - {self.started_at:%Y-%m-%d %H:%M}"


class AttemptQuestion(models.Model):
    """One question inside one attempt, and what the user answered."""

    attempt = models.ForeignKey(ExamAttempt, on_delete=models.CASCADE, related_name="items")
    # PROTECT: a question that appears in someone's exam history can't be deleted.
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name="attempt_items")
    position = models.PositiveSmallIntegerField()
    # Many-to-many: a user can pick several answers (or none) for one question.
    selected_answers = models.ManyToManyField(Answer, blank=True, related_name="+")
    is_correct = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["attempt", "question"], name="unique_question_per_attempt"),
        ]

    def __str__(self):
        return f"#{self.position + 1} {self.question}"
