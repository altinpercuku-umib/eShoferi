from django.db import migrations, models


def fill_totals(apps, schema_editor):
    """Existing attempts get their question count from the questions they contain."""
    ExamAttempt = apps.get_model("quiz", "ExamAttempt")
    for attempt in ExamAttempt.objects.all().iterator():
        attempt.total = attempt.items.count()
        attempt.save(update_fields=["total"])


class Migration(migrations.Migration):

    dependencies = [
        ("quiz", "0003_examattempt_category"),
    ]

    operations = [
        migrations.AddField(
            model_name="examattempt",
            name="total",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.RunPython(fill_totals, migrations.RunPython.noop),
    ]
