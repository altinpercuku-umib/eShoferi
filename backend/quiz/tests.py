from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Answer, Category, ExamAttempt, Question

User = get_user_model()


@override_settings(
    EXAM_QUESTION_COUNT=10,
    EXAM_DURATION_MINUTES=30,
    EXAM_PASS_PERCENT=80,
    EXAM_SUBMIT_GRACE_SECONDS=0,
)
class ExamAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username="ana", email="ana@example.com", password="test-pass-123")
        cls.other_user = User.objects.create_user(username="besa", email="besa@example.com", password="test-pass-123")
        cls.category = Category.objects.create(name="Test")
        for i in range(20):
            q = Question.objects.create(category=cls.category, question_text=f"Pyetja {i}")
            Answer.objects.create(question=q, answer_text="E saktë", is_correct=True)
            Answer.objects.create(question=q, answer_text="E gabuar", is_correct=False)

    # ---------- helpers ----------

    def start_exam(self, user=None):
        self.client.force_authenticate(user or self.user)
        response = self.client.post(reverse("exam-list"))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def submit(self, exam_id, answers):
        return self.client.post(reverse("exam-submit", args=[exam_id]), {"answers": answers}, format="json")

    def correct_answers_for(self, exam):
        return [
            {
                "question": q["id"],
                "selected": list(
                    Answer.objects.filter(question_id=q["id"], is_correct=True).values_list("id", flat=True)
                ),
            }
            for q in exam["questions"]
        ]

    # ---------- rule 1: never leak correct answers during an exam ----------

    def test_start_exam_hides_correct_answers(self):
        exam = self.start_exam()
        self.assertEqual(len(exam["questions"]), 10)
        self.assertNotIn("is_correct", str(exam))

    def test_viewing_unfinished_exam_hides_correct_answers(self):
        exam = self.start_exam()
        response = self.client.get(reverse("exam-detail", args=[exam["id"]]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("is_correct", str(response.data))

    # ---------- rule 2: login required, own attempts only ----------

    def test_categories_are_public(self):
        response = self.client.get(reverse("category-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_requires_login(self):
        response = self.client.post(reverse("exam-list"))
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_user_cannot_see_other_users_attempts(self):
        exam = self.start_exam(self.user)
        self.client.force_authenticate(self.other_user)

        self.assertEqual(self.client.get(reverse("exam-list")).data, [])
        self.assertEqual(
            self.client.get(reverse("exam-detail", args=[exam["id"]])).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(self.submit(exam["id"], []).status_code, status.HTTP_404_NOT_FOUND)

    # ---------- rule 3: submit once, and in time ----------

    def test_cannot_submit_twice(self):
        exam = self.start_exam()
        answers = self.correct_answers_for(exam)
        self.assertEqual(self.submit(exam["id"], answers).status_code, status.HTTP_200_OK)
        self.assertEqual(self.submit(exam["id"], answers).status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_submit_after_time_limit(self):
        exam = self.start_exam()
        ExamAttempt.objects.filter(pk=exam["id"]).update(expires_at=timezone.now() - timedelta(minutes=1))
        response = self.submit(exam["id"], self.correct_answers_for(exam))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ---------- rule 4: foreign answer ids are ignored ----------

    def test_foreign_answer_ids_are_ignored(self):
        exam = self.start_exam()
        exam_question_ids = {q["id"] for q in exam["questions"]}
        foreign_answer = Answer.objects.exclude(question_id__in=exam_question_ids).first()

        answers = self.correct_answers_for(exam)
        answers[0]["selected"].append(foreign_answer.id)
        response = self.submit(exam["id"], answers)

        self.assertEqual(response.data["score"], 10)
        self.assertNotIn(foreign_answer.id, response.data["items"][0]["selected"])

    # ---------- scoring ----------

    def test_all_correct_passes(self):
        exam = self.start_exam()
        response = self.submit(exam["id"], self.correct_answers_for(exam))
        self.assertEqual(response.data["score"], 10)
        self.assertEqual(response.data["total"], 10)
        self.assertTrue(response.data["passed"])

    def test_no_answers_fails(self):
        exam = self.start_exam()
        response = self.submit(exam["id"], [])
        self.assertEqual(response.data["score"], 0)
        self.assertFalse(response.data["passed"])

    def test_picking_only_one_of_two_correct_answers_is_wrong(self):
        q = Question.objects.create(category=self.category, question_text="Dy përgjigje të sakta")
        first = Answer.objects.create(question=q, answer_text="A", is_correct=True)
        Answer.objects.create(question=q, answer_text="B", is_correct=True)

        with self.settings(EXAM_QUESTION_COUNT=21):  # all questions, so q is surely included
            exam = self.start_exam()
        answers = self.correct_answers_for(exam)
        for entry in answers:
            if entry["question"] == q.id:
                entry["selected"] = [first.id]

        response = self.submit(exam["id"], answers)
        self.assertEqual(response.data["score"], 20)
