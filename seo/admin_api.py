from collections import Counter

from django.core.exceptions import ValidationError
from django.core.validators import validate_unicode_slug
from django.db import transaction
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import generics, serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from core.admin_api import CatalogAdminViewSet, StaffModelPermissions, audit
from products.models import Product
from .models import CategorySEO, ProductSEO
from .services import generated_metadata, persist_defaults, product_url, valid_canonical

SEO_FIELDS = ('meta_title', 'meta_description', 'meta_keywords', 'focus_keyword', 'secondary_keywords',
              'canonical_url', 'og_title', 'og_description', 'og_image', 'robots_index', 'robots_follow',
              'generated', 'manually_edited', 'created_at', 'updated_at')


class OverrideSerializer(serializers.ModelSerializer):
    def validate_canonical_url(self, value):
        if value and not valid_canonical(value):
            raise serializers.ValidationError('Use an absolute HTTP(S) URL without credentials or a fragment.')
        return value

    @transaction.atomic
    def create(self, data):
        key = self.Meta.entity
        entity = data[key]
        type(entity).objects.select_for_update().get(pk=entity.pk)
        existing = self.Meta.model.objects.filter(**{key: entity}).first()
        if existing:
            if existing.manually_edited:
                raise serializers.ValidationError({key: 'Edit the existing SEO record.'})
            return self.update(existing, data)
        return super().create(data)

    def update(self, instance, data):
        key = self.Meta.entity
        if key in data and data[key].pk != getattr(instance, key + '_id'):
            raise serializers.ValidationError({key: 'An SEO record cannot be reassigned.'})
        return super().update(instance, {**data, 'manually_edited': True})


class SEOWriteSerializer(OverrideSerializer):
    structured_data = serializers.DictField(required=False)

    class Meta:
        model = ProductSEO
        entity = 'product'
        fields = ('id', 'product', *SEO_FIELDS, 'structured_data', 'main_image_alt_text')
        extra_kwargs = {'product': {'validators': []}}


class CategorySEOWriteSerializer(OverrideSerializer):
    class Meta:
        model = CategorySEO
        entity = 'category'
        fields = ('id', 'category', *SEO_FIELDS)
        extra_kwargs = {'category': {'validators': []}}


class SEOAdminViewSet(CatalogAdminViewSet):
    def get_permissions(self):
        if self.action == 'regenerate':
            return [CanChangeSEO()]
        return super().get_permissions()

    @extend_schema(request=None)
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def regenerate(self, request, pk=None):
        entry = self.get_object()
        entity = getattr(entry, self.serializer_class.Meta.entity)
        entry, _ = persist_defaults(entity, product=isinstance(entry, ProductSEO))
        audit(request.user, 'regenerate_seo', entry)
        return Response(self.get_serializer(entry).data)


class CanChangeSEO(StaffModelPermissions):
    perms_map = {**StaffModelPermissions.perms_map, 'POST': ['%(app_label)s.change_%(model_name)s']}


class AdminSEO(SEOAdminViewSet):
    filterset_fields = ("product",)
    queryset = ProductSEO.objects.select_related('product', 'product__category')
    serializer_class = SEOWriteSerializer
    search_fields = ('product__sku', 'product__title', 'meta_title')


class AdminCategorySEO(SEOAdminViewSet):
    filterset_fields = ("category",)
    queryset = CategorySEO.objects.select_related('category', 'category__parent')
    serializer_class = CategorySEOWriteSerializer
    search_fields = ('category__name', 'category__slug', 'meta_title')


class AuditRow(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    warnings = serializers.ListField(child=serializers.CharField())


class AuditResponse(serializers.Serializer):
    summary = serializers.DictField()
    count = serializers.IntegerField()
    results = AuditRow(many=True)


class AdminSEOAudit(generics.GenericAPIView):
    queryset = ProductSEO.objects.none()
    serializer_class = AuditResponse
    permission_classes = [StaffModelPermissions]

    @extend_schema(parameters=[OpenApiParameter('status', str), OpenApiParameter('search', str),
                               OpenApiParameter('page', int), OpenApiParameter('page_size', int)],
                   responses=AuditResponse)
    def get(self, request):
        products = Product.objects.select_related('seo', 'category').prefetch_related('gallery').order_by('pk')
        # Count effective duplicates globally, before applying UI filters.
        def values(item):
            entry = getattr(item, 'seo', None)
            defaults = generated_metadata(item, True)
            return tuple((getattr(entry, key, '') or defaults[key]).strip()
                         for key in ('meta_title', 'meta_description'))

        titles, descriptions = Counter(), Counter()
        for item in products.prefetch_related(None).iterator(chunk_size=500):
            title, description = values(item)
            titles[title.casefold()] += 1
            descriptions[description.casefold()] += 1

        summary = Counter()
        matching = []
        status = request.query_params.get('status', '')
        search = request.query_params.get('search', '').casefold()
        for item in products.iterator(chunk_size=500):
            entry = getattr(item, 'seo', None)
            title, description = values(item)
            canonical = getattr(entry, 'canonical_url', '') or product_url(item)
            warnings = []
            try:
                validate_unicode_slug(item.slug)
                invalid_slug = not item.slug
            except ValidationError:
                invalid_slug = True
            for condition, warning in [
                (not title, 'missing_title'), (not description, 'missing_description'),
                (not canonical, 'missing_canonical'), (not valid_canonical(canonical), 'invalid_canonical'),
                (bool(title) and titles[title.casefold()] > 1, 'duplicate_title'),
                (bool(description) and descriptions[description.casefold()] > 1, 'duplicate_description'),
                (len(title) > 65, 'long_title'), (len(description) > 170, 'long_description'),
                (not item.main_image and not item.gallery.all(), 'missing_image'),
                (any(not image.alt_text for image in item.gallery.all()), 'missing_alt'),
                (invalid_slug, 'invalid_slug'), (entry is not None and not entry.robots_index, 'noindex'),
                (not entry or not entry.generated, 'not_generated'),
            ]:
                if condition:
                    warnings.append(warning)
            summary.update(warnings)
            summary['total'] += 1
            if not warnings:
                summary['complete'] += 1
            if (not status or status == 'complete' and not warnings or status in warnings) and (
                not search or search in item.title.casefold() or search in item.sku.casefold()
            ):
                matching.append({'id': item.pk, 'title': item.title, 'warnings': warnings})

        keys = ('total', 'complete', 'missing_title', 'missing_description', 'missing_canonical',
                'missing_alt', 'duplicate_title', 'duplicate_description', 'invalid_canonical', 'noindex')
        metrics = {key: summary[key] for key in keys}
        metrics['completion_percentage'] = round(100 * summary['complete'] / summary['total'], 2) if summary['total'] else 0
        page = self.paginate_queryset(matching)
        return Response({'summary': metrics, 'count': len(matching), 'results': page})
