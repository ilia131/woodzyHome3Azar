from urllib.parse import quote
from io import StringIO
from unittest.mock import patch
from xml.etree import ElementTree

from django.core.management import call_command
from categories.models import Category
from products.models import Product, ProductImage

from core.test_catalog import CatalogTestCase
from .models import ProductSEO


class SEOTests(CatalogTestCase):
    def test_fallback_canonical_and_offer_availability(self):
        metadata = self.client.get(self.path).data['seo']
        self.assertEqual(metadata['meta_title'], self.product.title)
        self.assertIn(self.product.short_description, metadata['meta_description'])
        canonical = f'https://store.example/products/{quote(self.product.slug)}'
        self.assertEqual(metadata['canonical_url'], canonical)
        self.assertEqual(metadata['open_graph']['url'], canonical)
        structured = metadata['structured_data']
        self.assertEqual(structured['@type'], 'Product')
        self.assertEqual(structured['offers']['@type'], 'Offer')
        self.assertEqual(structured['offers']['price'], '80.00')
        self.assertTrue(structured['offers']['availability'].endswith('/InStock'))
        self.product.stock = 0
        self.product.save(update_fields=['stock'])
        response = self.client.get(self.path)
        self.assertTrue(response.data['seo']['structured_data']['offers']['availability'].endswith('/OutOfStock'))
        self.assertContains(self.client.get('/sitemap.xml'), canonical)
        self.assertContains(self.client.get('/robots.txt'), 'https://store.example/sitemap.xml')
        self.product.is_active = False
        self.product.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(self.path).status_code, 404)
        self.assertNotContains(self.client.get('/sitemap.xml'), canonical)
        self.product.delete()
        self.assertNotContains(self.client.get('/sitemap.xml'), canonical)

    def test_explicit_metadata_and_noindex(self):
        self.client.force_authenticate(self.user(2, is_staff=True, is_superuser=True))
        url = '/api/v1/admin/seo/'
        payload = {'product': self.product.pk, 'meta_title': 'Custom title', 'meta_description': 'Custom description',
                   'canonical_url': 'https://store.example/custom/', 'og_title': 'Social title',
                   'structured_data': {'brand': {'@type': 'Brand', 'name': 'HomeAksoria'}},
                   'robots_index': False}
        result = self.client.post(url, payload, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        metadata = self.client.get(self.path).data['seo']
        self.assertEqual(metadata['meta_title'], payload['meta_title'])
        self.assertEqual(metadata['meta_description'], payload['meta_description'])
        self.assertEqual(metadata['open_graph']['title'], payload['og_title'])
        self.assertEqual(metadata['canonical_url'], payload['canonical_url'])
        self.assertEqual(metadata['structured_data']['brand']['name'], 'HomeAksoria')
        self.assertFalse(metadata['robots_index'])
        self.assertNotContains(self.client.get('/sitemap.xml'), f'/products/{quote(self.product.slug)}')


    def test_created_defaults_and_backfill_preserve_overrides_and_alt(self):
        entry = ProductSEO.objects.get(product=self.product)
        self.assertFalse(entry.manually_edited)
        self.assertTrue(entry.generated['canonical_url'])
        entry.meta_title = 'Manual SEO'
        entry.robots_follow = False
        entry.save()
        default_image = ProductImage.objects.create(product=self.product, image='gallery/front.jpg')
        custom_image = ProductImage.objects.create(product=self.product, image='gallery/back.jpg', alt_text='Manual image')
        output = StringIO()
        call_command('generate_missing_seo', '--dry-run', '--batch-size=1', stdout=output)
        default_image.refresh_from_db()
        self.assertEqual(default_image.alt_text, '')
        call_command('generate_missing_seo', '--batch-size=1', stdout=output)
        default_image.refresh_from_db()
        custom_image.refresh_from_db()
        entry.refresh_from_db()
        self.assertEqual(default_image.alt_text, self.product.title)
        self.assertEqual(custom_image.alt_text, 'Manual image')
        self.assertEqual(entry.meta_title, 'Manual SEO')
        self.assertFalse(entry.robots_follow)

    def test_category_and_sitemap_index_use_the_visibility_policy(self):
        root = self.product.category
        child = Category.objects.create(name='Child', slug='child', parent=root)
        seo = self.client.get('/api/v1/categories/child/').data['seo']
        levels = seo['breadcrumb_data']['itemListElement']
        self.assertEqual([item['name'] for item in levels][-2:], [root.name, child.name])
        self.assertFalse(self.client.get('/api/v1/categories/child/?filtered=1').data['seo']['robots_index'])
        self.assertTrue(seo['canonical_url'].endswith('/categories/child'))
        self.assertNotIn('generated', seo)
        with patch('seo.views.BATCH_SIZE', 1):
            index = ElementTree.fromstring(self.client.get('/sitemap.xml').content)
            self.assertTrue(index.tag.endswith('sitemapindex'))
            response = self.client.get('/sitemap.xml?part=categories&page=1')
            self.assertEqual(response.status_code, 200)
            self.assertTrue(ElementTree.fromstring(response.content).tag.endswith('urlset'))
            self.assertEqual(self.client.get('/sitemap.xml?part=categories&page=broken').status_code, 404)
        root.is_active = False
        root.save(update_fields=['is_active'])
        self.assertEqual(self.client.get('/api/v1/categories/child/').status_code, 404)
        self.assertNotContains(self.client.get('/sitemap.xml'), '/categories/child')

    def test_runtime_fallback_and_failed_initialization_do_not_break_product(self):
        previous = Product.objects.count()
        with patch('seo.services.persist_defaults', side_effect=RuntimeError('test SEO failure')):
            with self.assertLogs('seo.services', level='ERROR'):
                product = Product.objects.create(title='داده واقعی', slug='seo-failure', sku='SEO-FAILURE',
                                                 category=self.product.category, price=10)
        self.assertEqual(Product.objects.count(), previous + 1)
        self.assertFalse(ProductSEO.objects.filter(product=product).exists())
        self.assertEqual(self.client.get('/api/v1/products/seo-failure/').data['seo']['meta_title'], product.title)
        call_command('generate_missing_seo', '--missing-only', stdout=StringIO())
        self.assertTrue(ProductSEO.objects.filter(product=product).exists())

    def test_regeneration_and_audit_require_staff_permissions(self):
        url = f'/api/v1/admin/seo/{self.product.seo.pk}/regenerate/'
        self.assertEqual(self.client.post(url).status_code, 401)
        self.client.force_authenticate(self.user())
        self.assertEqual(self.client.post(url).status_code, 403)
        self.client.force_authenticate(self.user(2, is_staff=True, is_superuser=True))
        detail = f'/api/v1/admin/seo/{self.product.seo.pk}/'
        self.assertEqual(self.client.patch(detail, {'meta_title': 'Custom audited title'}, format='json').status_code, 200)
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(self.client.get(self.path).data['seo']['meta_title'], 'Custom audited title')
        audit = self.client.get('/api/v1/admin/seo-audit/?page_size=1').data
        self.assertGreaterEqual(audit['summary']['total'], 1)
        self.assertEqual(len(audit['results']), 1)

    def test_site_metadata_is_public_and_search_is_noindex(self):
        payload = self.client.get('/api/v1/seo/site/').data
        self.assertTrue(payload['robots_index'])
        self.assertEqual([item['@type'] for item in payload['structured_data']['@graph']], ['Organization', 'WebSite'])
        self.assertFalse(self.client.get('/api/v1/seo/site/?page=search').data['robots_index'])
        self.assertFalse(self.client.get('/api/v1/seo/site/?page=products&filtered=1').data['robots_index'])
