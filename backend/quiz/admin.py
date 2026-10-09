from django.contrib import admin
from .models import Category, Question, Answer, ExamAttempt, AttemptQuestion

# Register your models here.



class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)

class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 4

class QuestionAdmin(admin.ModelAdmin):
    inlines = [AnswerInline]
    list_display = ('category', 'question_text', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('question_text',)


class AttemptQuestionInline(admin.TabularInline):
    model = AttemptQuestion
    extra = 0
    can_delete = False
    fields = ('position', 'question', 'is_correct')
    readonly_fields = fields

class ExamAttemptAdmin(admin.ModelAdmin):
    inlines = [AttemptQuestionInline]
    list_display = ('user', 'started_at', 'submitted_at', 'score', 'passed')
    list_filter = ('passed',)
    readonly_fields = ('user', 'started_at', 'expires_at', 'submitted_at', 'score', 'passed')

    # Attempts are created by the API only, never by hand.
    def has_add_permission(self, request):
        return False


admin.site.register(Category, CategoryAdmin)
admin.site.register(Question, QuestionAdmin)
admin.site.register(ExamAttempt, ExamAttemptAdmin)
