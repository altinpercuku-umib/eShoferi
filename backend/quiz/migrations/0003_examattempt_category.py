import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("quiz", "0002_examattempt_attemptquestion"),
    ]

    operations = [
        migrations.AddField(
            model_name="examattempt",
            name="category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="exam_attempts",
                to="quiz.category",
            ),
        ),
    ]
