from rest_framework import serializers

from .models import Answer, AttemptQuestion, Category, ExamAttempt, Question


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "description"]


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
    questions = serializers.SerializerMethodField()

    class Meta:
        model = ExamAttempt
        fields = ["id", "started_at", "expires_at", "questions"]

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
    total = serializers.SerializerMethodField()

    class Meta:
        model = ExamAttempt
        fields = ["id", "started_at", "submitted_at", "score", "total", "passed"]

    def get_total(self, attempt):
        return attempt.items.count()


class ExamResultSerializer(ExamHistorySerializer):
    items = AttemptItemResultSerializer(many=True, read_only=True)

    class Meta(ExamHistorySerializer.Meta):
        fields = ExamHistorySerializer.Meta.fields + ["items"]
