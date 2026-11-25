from django import forms
from django.contrib import admin
from core.native_admin import AuditedAdmin
from .models import CategorySEO, ProductSEO


class SEOForm(forms.ModelForm):
    def clean_structured_data(self):
        data = self.cleaned_data['structured_data']
        if data is None:
            return {}
        if not isinstance(data, dict):
            raise forms.ValidationError('Use a JSON object.')
        return data


@admin.register(ProductSEO)
class SEOAdmin(AuditedAdmin):
    form = SEOForm
    search_fields = ('product__title', 'meta_title')

    def save_model(self, request, obj, form, change):
        obj.manually_edited = True
        super().save_model(request, obj, form, change)


@admin.register(CategorySEO)
class CategorySEOAdmin(AuditedAdmin):
    search_fields = ('category__name', 'meta_title')

    def save_model(self, request, obj, form, change):
        obj.manually_edited = True
        super().save_model(request, obj, form, change)
