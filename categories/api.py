from drf_spectacular.utils import extend_schema, extend_schema_field, OpenApiParameter
from seo.serializers import SEOMetadataSerializer
from seo.services import category_metadata
from rest_framework import generics, serializers

from .models import Category
from .selectors import public_categories


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'image', 'parent', 'created_at')


class CategoryList(generics.ListAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return public_categories()


class CategoryDetailSerializer(CategorySerializer):
    seo = serializers.SerializerMethodField()

    class Meta(CategorySerializer.Meta):
        fields = (*CategorySerializer.Meta.fields, 'seo')

    @extend_schema_field(SEOMetadataSerializer)
    def get_seo(self, category):
        return category_metadata(category, self.context['request'])


@extend_schema(parameters=[OpenApiParameter('filtered', bool, description='Suppress indexing of filtered views.')])
class CategoryDetail(generics.RetrieveAPIView):
    serializer_class = CategoryDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return public_categories().select_related('seo', 'parent')


class CategoryChildren(CategoryList):
    def get_queryset(self):
        from django.shortcuts import get_object_or_404

        queryset = super().get_queryset()
        return queryset.filter(parent=get_object_or_404(queryset, slug=self.kwargs['slug']))
