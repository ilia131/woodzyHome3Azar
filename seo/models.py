from django.db import models

from core.images import seo_image_path, validate_image


class SEOMetadata(models.Model):
    meta_title = models.CharField(max_length=200, blank=True)
    meta_description = models.CharField(max_length=500, blank=True)
    meta_keywords = models.CharField(max_length=400, blank=True)
    focus_keyword = models.CharField(max_length=200, blank=True)
    secondary_keywords = models.CharField(max_length=400, blank=True)
    canonical_url = models.URLField(blank=True)
    og_title = models.CharField(max_length=200, blank=True)
    og_description = models.CharField(max_length=500, blank=True)
    og_image = models.ImageField(upload_to=seo_image_path, blank=True, validators=[validate_image])
    robots_index = models.BooleanField(default=True)
    robots_follow = models.BooleanField(default=True)
    generated = models.JSONField(default=dict, blank=True, editable=False)
    manually_edited = models.BooleanField(default=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ProductSEO(SEOMetadata):
    product = models.OneToOneField('products.Product', related_name='seo', on_delete=models.CASCADE)
    main_image_alt_text = models.CharField(max_length=220, blank=True)
    structured_data = models.JSONField(default=dict, blank=True)


class CategorySEO(SEOMetadata):
    category = models.OneToOneField('categories.Category', related_name='seo', on_delete=models.CASCADE)
