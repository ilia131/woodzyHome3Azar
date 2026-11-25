from rest_framework import serializers


class SEOMetadataSerializer(serializers.Serializer):
    meta_title = serializers.CharField()
    meta_description = serializers.CharField(allow_blank=True)
    meta_keywords = serializers.CharField(allow_blank=True)
    focus_keyword = serializers.CharField(allow_blank=True)
    secondary_keywords = serializers.CharField(allow_blank=True)
    canonical_url = serializers.URLField()
    og_title = serializers.CharField()
    og_description = serializers.CharField(allow_blank=True)
    og_image = serializers.URLField(allow_null=True)
    open_graph = serializers.DictField()
    twitter = serializers.DictField()
    structured_data = serializers.DictField()
    breadcrumb_data = serializers.DictField(required=False)
    robots_index = serializers.BooleanField()
    robots_follow = serializers.BooleanField()
