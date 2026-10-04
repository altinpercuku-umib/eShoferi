from django.contrib import admin
from .models import Category, Question, Answer

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


admin.site.register(Category, CategoryAdmin)
admin.site.register(Question, QuestionAdmin)