from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Answer, AttemptQuestion, Category, ExamAttempt, Question

User = get_user_model()


@override_settings(
    EXAM_QUESTION_COUNT=10,
    EXAM_DURATION_MINUTES=30,
    EXAM_PASS_PERCENT=80,
    EXAM_SUBMIT_GRACE_SECONDS=0,
    PRACTICE_QUESTION_COUNT=4,
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
        cls.small_category = Category.objects.create(name="E vogël")
        for i in range(6):
            q = Question.objects.create(category=cls.small_category, question_text=f"Pyetje e vogël {i}")
            Answer.objects.create(question=q, answer_text="E saktë", is_correct=True)

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

        with self.settings(EXAM_QUESTION_COUNT=27):  # all questions, so q is surely included
            exam = self.start_exam()
        answers = self.correct_answers_for(exam)
        for entry in answers:
            if entry["question"] == q.id:
                entry["selected"] = [first.id]

        response = self.submit(exam["id"], answers)
        self.assertEqual(response.data["score"], 26)

    # ---------- practice by category ----------

    def test_category_practice_uses_only_that_category(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(reverse("exam-list"), {"category": self.small_category.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["questions"]), 4)
        self.assertEqual(response.data["category"]["id"], self.small_category.id)
        allowed = set(self.small_category.questions.values_list("id", flat=True))
        self.assertTrue({q["id"] for q in response.data["questions"]} <= allowed)

    def test_category_practice_can_be_submitted(self):
        # Regression test: submitting a practice round used to crash with a 500 error.
        self.client.force_authenticate(self.user)
        exam = self.client.post(reverse("exam-list"), {"category": self.small_category.id}, format="json").data
        response = self.submit(exam["id"], self.correct_answers_for(exam))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["score"], 4)
        self.assertEqual(response.data["category"]["id"], self.small_category.id)

    def test_unknown_category_is_rejected(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(reverse("exam-list"), {"category": 999999}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_categories_include_question_count(self):
        response = self.client.get(reverse("category-list"))
        counts = {c["name"]: c["question_count"] for c in response.data}
        self.assertEqual(counts["E vogël"], 6)


@override_settings(EXAM_PASS_PERCENT=80, LEADERBOARD_MIN_EXAMS=2)
class StatsAndLeaderboardTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ana = User.objects.create_user(username="ana", email="ana@example.com", password="test-pass-123")
        cls.besa = User.objects.create_user(username="besa", email="besa@example.com", password="test-pass-123")
        cls.cen = User.objects.create_user(username="cen", email="cen@example.com", password="test-pass-123")
        cls.signs = Category.objects.create(name="Shenjat")
        cls.priority = Category.objects.create(name="Përparësia")
        cls.sign_questions = [Question.objects.create(category=cls.signs, question_text=f"S{i}") for i in range(10)]
        cls.priority_questions = [Question.objects.create(category=cls.priority, question_text=f"P{i}") for i in range(10)]

    def make_attempt(self, user, score, practice=False, days_ago=0, minutes=0):
        """A finished attempt. Full exams: 5 sign + 5 priority questions; practice: 5 sign questions.
        The first `score` questions count as correct."""
        questions = self.sign_questions[:5] if practice else self.sign_questions[:5] + self.priority_questions[:5]
        submitted = timezone.now() - timedelta(days=days_ago) + timedelta(minutes=minutes)
        attempt = ExamAttempt.objects.create(
            user=user,
            category=self.signs if practice else None,
            expires_at=submitted,
            submitted_at=submitted,
            total=len(questions),
            score=score,
            passed=score * 100 >= len(questions) * 80,
        )
        for position, question in enumerate(questions):
            AttemptQuestion.objects.create(
                attempt=attempt, question=question, position=position, is_correct=position < score
            )
        return attempt

    # ---------- personal stats ----------

    def test_stats_require_login(self):
        self.assertEqual(self.client.get(reverse("stats")).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stats_for_a_new_user(self):
        self.client.force_authenticate(self.cen)
        data = self.client.get(reverse("stats")).data
        self.assertEqual(data["exams"], 0)
        self.assertIsNone(data["readiness"])
        self.assertIsNone(data["weakest"])
        self.assertEqual(data["recent"], [])

    def test_stats_add_up(self):
        self.make_attempt(self.ana, score=8, minutes=1)  # full exam: signs 5/5, priority 3/5, passed
        self.make_attempt(self.ana, score=6, minutes=2)  # full exam: signs 5/5, priority 1/5, failed
        self.make_attempt(self.ana, score=5, practice=True, minutes=3)  # practice: signs 5/5
        self.make_attempt(self.besa, score=1)  # someone else's exam must not count

        self.client.force_authenticate(self.ana)
        data = self.client.get(reverse("stats")).data

        self.assertEqual(data["exams"], 3)
        self.assertEqual(data["full_exams"], 2)
        self.assertEqual(data["full_passed"], 1)
        self.assertEqual(data["readiness"], 70.0)  # (80 + 60) / 2, practice excluded
        self.assertEqual(data["best_percent"], 80.0)
        self.assertEqual((data["answered"], data["correct"]), (25, 19))
        self.assertEqual([r["percent"] for r in data["recent"]], [80.0, 60.0, 100.0])  # oldest first
        self.assertEqual(data["weakest"]["name"], "Përparësia")
        self.assertEqual(data["weakest"]["accuracy"], 40.0)  # 4 of 10

    # ---------- leaderboard ----------

    def test_leaderboard_ranks_by_average_of_full_exams(self):
        self.make_attempt(self.ana, score=8)
        self.make_attempt(self.ana, score=6)  # average 70
        self.make_attempt(self.besa, score=9)
        self.make_attempt(self.besa, score=9)  # average 90
        self.make_attempt(self.cen, score=10)  # only 1 full exam: not on the board yet
        for _ in range(3):
            self.make_attempt(self.cen, score=5, practice=True)  # practice never counts

        results = self.client.get(reverse("leaderboard")).data["results"]

        self.assertEqual([(r["rank"], r["username"], r["average"]) for r in results], [(1, "besa", 90.0), (2, "ana", 70.0)])

    def test_equal_averages_share_a_rank(self):
        for user in (self.ana, self.besa):
            self.make_attempt(user, score=9)
            self.make_attempt(user, score=7)
        for _ in range(2):
            self.make_attempt(self.cen, score=5)

        ranks = [r["rank"] for r in self.client.get(reverse("leaderboard")).data["results"]]
        self.assertEqual(ranks, [1, 1, 3])

    def test_weekly_leaderboard_ignores_older_exams(self):
        self.make_attempt(self.ana, score=9, days_ago=10)
        self.make_attempt(self.ana, score=9, days_ago=10)
        self.make_attempt(self.besa, score=7)
        self.make_attempt(self.besa, score=7)

        results = self.client.get(reverse("leaderboard"), {"period": "week"}).data["results"]
        self.assertEqual([r["username"] for r in results], ["besa"])

    def test_leaderboard_marks_me_and_never_shows_emails(self):
        for user in (self.ana, self.besa):
            self.make_attempt(user, score=8)
            self.make_attempt(user, score=8)

        self.client.force_authenticate(self.ana)
        data = self.client.get(reverse("leaderboard")).data

        self.assertEqual(data["me"]["username"], "ana")
        self.assertEqual([r["is_me"] for r in data["results"] if r["username"] == "besa"], [False])
        self.assertNotIn("@", str(data))

    def test_leaderboard_tells_me_how_many_exams_i_still_need(self):
        self.make_attempt(self.cen, score=10)
        self.client.force_authenticate(self.cen)
        data = self.client.get(reverse("leaderboard")).data
        self.assertIsNone(data["me"])
        self.assertEqual((data["my_exams"], data["min_exams"]), (1, 2))
