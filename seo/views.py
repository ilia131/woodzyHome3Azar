from urllib.parse import urlencode
from xml.etree.ElementTree import Element, SubElement, tostring

from django.conf import settings
from django.core.paginator import InvalidPage, Paginator
from django.db.models import Q
from django.http import Http404, HttpResponse
from django.views.decorators.http import require_safe
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from categories.selectors import public_categories, visible_category_ids
from products.models import Product
from .serializers import SEOMetadataSerializer
from .services import SITE_PAGES, category_url, product_url, site_metadata, valid_canonical

BATCH_SIZE = 10000
SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'


class SiteSEO(GenericAPIView):
    serializer_class = SEOMetadataSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(parameters=[
        OpenApiParameter('page', str, enum=list(SITE_PAGES), description='Defaults to home.'),
        OpenApiParameter('filtered', bool),
    ])
    def get(self, request):
        page = request.query_params.get('page', 'home')
        if page not in SITE_PAGES:
            raise Http404
        return Response(site_metadata(page, request.query_params.get('filtered') == '1'))


def candidates():
    indexable = Q(seo__isnull=True) | Q(seo__robots_index=True)
    products = Product.objects.filter(is_active=True, category_id__in=visible_category_ids()).filter(
        indexable).select_related('seo').order_by('pk')
    categories = public_categories().filter(indexable).select_related('seo').order_by('pk')
    return {'products': Paginator(products, BATCH_SIZE), 'categories': Paginator(categories, BATCH_SIZE)}


def xml(root):
    return HttpResponse(tostring(root, encoding='utf-8', xml_declaration=True), content_type='application/xml')


def location(root, tag, url, lastmod=None):
    node = SubElement(root, tag)
    SubElement(node, 'loc').text = url
    if lastmod:
        SubElement(node, 'lastmod').text = lastmod.isoformat()


def add_catalog(root, rows, url_for):
    for item in rows:
        entry = getattr(item, 'seo', None)
        url = url_for(item)
        # Other canonicals are resolved by their owning page, never duplicated under this item.
        if entry and valid_canonical(entry.canonical_url) and entry.canonical_url.rstrip('/') != url:
            continue
        lastmod = max(item.updated_at, entry.updated_at) if entry and isinstance(item, Product) else (
            item.updated_at if isinstance(item, Product) else entry.updated_at if entry else item.created_at
        )
        location(root, 'url', url, lastmod)


@require_safe
def sitemap(request):
    pages = candidates()
    part = request.GET.get('part')
    url_for = {'products': product_url, 'categories': category_url}
    root = Element('urlset', xmlns=SITEMAP_NS)
    if part in pages:
        try:
            entries = pages[part].page(request.GET.get('page', 1))
        except InvalidPage:
            raise Http404
        add_catalog(root, entries.object_list, url_for[part])
    elif part not in (None, 'site'):
        raise Http404
    elif part == 'site' or sum(p.count for p in pages.values()) <= BATCH_SIZE - len(SITE_PAGES):
        for key, (path, _, _) in SITE_PAGES.items():
            if key != 'search':
                location(root, 'url', settings.SITE_URL + path)
        if part is None:
            for key, paginator in pages.items():
                add_catalog(root, paginator.page(1).object_list, url_for[key])
    else:
        root = Element('sitemapindex', xmlns=SITEMAP_NS)
        location(root, 'sitemap', settings.SITE_URL + '/sitemap.xml?part=site')
        for key, paginator in pages.items():
            if paginator.count:
                for page in paginator.page_range:
                    query = urlencode({'part': key, 'page': page})
                    location(root, 'sitemap', f'{settings.SITE_URL}/sitemap.xml?{query}')
    return xml(root)


@require_safe
def robots(request):
    private = ('/admin', '/django-admin/', '/account', '/favorites', '/checkout', '/api/')
    body = '\n'.join(['User-agent: *', 'Allow: /', *(f'Disallow: {path}' for path in private),
                      f'Sitemap: {settings.SITE_URL}/sitemap.xml', ''])
    return HttpResponse(body, content_type='text/plain')
