from rest_framework import serializers

from .models import Answer, AttemptQuestion, Category, ExamAttempt, Question


class CategorySerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(read_only=True)  # comes from .annotate() in the view

    class Meta:
        model = Category
        fields = ["id", "name", "description", "question_count"]


class CategoryNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class StartExamSerializer(serializers.Serializer):
    # Leave empty for a full exam, or pass a category id for a practice round.
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)


# ---------- Used DURING an exam: must never reveal correct answers ----------

class AnswerPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ["id", "answer_text"]  # no is_correct, on purpose


class QuestionPublicSerializer(serializers.ModelSerializer):
    answers = AnswerPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ["id", "question_text", "answers"]


class ExamStartedSerializer(serializers.ModelSerializer):
    category = CategoryNameSerializer(read_only=True)
    questions = serializers.SerializerMethodField()

    class Meta:
        model = ExamAttempt
        fields = ["id", "category", "started_at", "expires_at", "questions"]

    def get_questions(self, attempt):
        questions = [item.question for item in attempt.items.all()]
        return QuestionPublicSerializer(questions, many=True).data


# ---------- What the user sends when submitting ----------

class SubmittedAnswerSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    selected = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)


class SubmitSerializer(serializers.Serializer):
    answers = SubmittedAnswerSerializer(many=True)


# ---------- Used AFTER submitting: now it's safe to show everything ----------

class AnswerResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ["id", "answer_text", "is_correct"]


class AttemptItemResultSerializer(serializers.ModelSerializer):
    question = serializers.PrimaryKeyRelatedField(read_only=True)
    question_text = serializers.CharField(source="question.question_text", read_only=True)
    explanation = serializers.CharField(source="question.explanation", read_only=True)
    answers = AnswerResultSerializer(source="question.answers", many=True, read_only=True)
    selected = serializers.PrimaryKeyRelatedField(source="selected_answers", many=True, read_only=True)

    class Meta:
        model = AttemptQuestion
        fields = ["question", "question_text", "explanation", "answers", "selected", "is_correct"]


class ExamHistorySerializer(serializers.ModelSerializer):
    category = CategoryNameSerializer(read_only=True)

    class Meta:
        model = ExamAttempt
        fields = ["id", "category", "started_at", "submitted_at", "score", "total", "percent", "passed"]


class ExamResultSerializer(ExamHistorySerializer):
    items = AttemptItemResultSerializer(many=True, read_only=True)

    class Meta(ExamHistorySerializer.Meta):
        fields = ExamHistorySerializer.Meta.fields + ["items"]
