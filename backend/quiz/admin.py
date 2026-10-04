from django.contrib import admin
from .models import Category, Question, Answer

# Register your models here.


admin.site.register(Category)
admin.site.register(Question)
admin.site.register(Answer)

class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name')

class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 4

class QuestionAdmin(admin.ModelAdmin):
    inlines = [AnswerInline]
    list_display = ('category', 'question_text', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('question_text',)