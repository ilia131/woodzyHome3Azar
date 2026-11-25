import logging
from urllib.parse import quote, urlsplit

from django.conf import settings
from django.db import transaction
from django.utils.html import strip_tags
from django.utils.text import Truncator

from .models import CategorySEO, ProductSEO

logger = logging.getLogger(__name__)
SCHEMA = 'https://schema.org'
SITE_PAGES = {
    'home': ('/', 'وودزی هوم | مبلمان و دکور خانه', 'مجموعه مبلمان و دکور خانه را در وودزی هوم ببینید.'),
    'products': ('/products', 'محصولات وودزی هوم', 'فهرست مبلمان و محصولات دکور خانه را مرور کنید.'),
    'categories': ('/categories', 'دسته‌بندی محصولات وودزی هوم', 'دسته‌بندی‌های مبلمان و دکور خانه را در وودزی هوم ببینید.'),
    'about': ('/about', 'درباره ما و تماس | وودزی هوم', 'با وودزی هوم و راه‌های تماس با فروشگاه آشنا شوید.'),
    'search': ('/search', 'جست‌وجوی محصولات وودزی هوم', 'در کاتالوگ وودزی هوم جست‌وجو کنید.'),
}


def product_url(product):
    return f'{settings.SITE_URL}/products/{quote(product.slug)}'


def category_url(category):
    return f'{settings.SITE_URL}/categories/{quote(category.slug)}'


def clean_text(value, limit):
    return Truncator(' '.join(strip_tags(value).split())).chars(limit)


def generated_metadata(item, product=False):
    if product:
        title = item.title
        copy = clean_text(item.short_description, 155)
        if not copy:
            copy = clean_text(item.description, 155)
        description = copy if title in copy else clean_text(f'{title} — {copy or item.category.name}', 160)
        keywords = [title, item.category.name]
        canonical = product_url(item)
    else:
        title = item.name
        description = clean_text(item.description, 160)
        if not description:
            examples = list(item.products.filter(is_active=True).order_by('pk').values_list('title', flat=True)[:2])
            description = clean_text(
                f'محصولات دستهٔ {title} در فروشگاه وودزی هوم.' +
                (f' از جمله {"، ".join(examples)}.' if examples else ''), 160)

        parent = item.parent
        keywords = [title, parent.name] if parent else [title]
        canonical = category_url(item)
    return {'meta_title': title, 'meta_description': description, 'canonical_url': canonical,
            'focus_keyword': title, 'meta_keywords': '، '.join(dict.fromkeys(keywords)),
            'secondary_keywords': '، '.join(dict.fromkeys(value for value in keywords[1:] if value != title))}


def persist_defaults(item, *, product, using=None):
    model, key = (ProductSEO, 'product') if product else (CategorySEO, 'category')
    generated = generated_metadata(item, product)
    return model.objects.using(using).update_or_create(
        **{key + '_id': item.pk}, defaults={'generated': generated},
        create_defaults={'generated': generated, 'manually_edited': False},
    )


def initialize_defaults(sender, instance, created, raw, using, **kwargs):
    if not created or raw:
        return
    try:
        with transaction.atomic(using=using):
            persist_defaults(instance, product=sender._meta.model_name == 'product', using=using)
    except Exception:
        # The default can be regenerated independently; a failed SEO write must not abort the product transaction.
        logger.exception('Could not initialize SEO for %s pk=%s', sender._meta.label, instance.pk)


def image_url(field, request):
    if not field:
        return None
    url = field.url
    if url.startswith('/media/') and getattr(settings, 'SEO_MEDIA_URL', ''):
        return settings.SEO_MEDIA_URL + url[len('/media'):]
    return request.build_absolute_uri(url)


def breadcrumbs(category=None, product=None):
    rows = [('وودزی هوم', settings.SITE_URL + '/')]
    ancestors = []
    if category:
        from categories.models import Category
        # One query independent of hierarchy depth; no per-node lazy FK reads.
        nodes = {node.pk: node for node in Category.objects.raw(
            """WITH RECURSIVE ancestry(id, parent_id, name, slug) AS (
                SELECT id, parent_id, name, slug FROM categories_category WHERE id = %s
                UNION
                SELECT parent.id, parent.parent_id, parent.name, parent.slug
                FROM categories_category parent JOIN ancestry child ON child.parent_id = parent.id
            ) SELECT id, parent_id, name, slug FROM ancestry""", [category.pk]
        )}
        current = category
        visited = set()
        while current is not None and current.pk not in visited:
            visited.add(current.pk)
            ancestors.append((current.name, category_url(current)))
            current = nodes.get(current.parent_id)
    rows.extend(reversed(ancestors))
    if product:
        rows.append((product.title, product_url(product)))
    return {'@context': SCHEMA, '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': position, 'name': name, 'item': url}
        for position, (name, url) in enumerate(rows, 1)
    ]}


def valid_canonical(value):
    try:
        parsed = urlsplit(value)
        return (parsed.scheme in {'http', 'https'} and bool(parsed.hostname)
                and not parsed.username and not parsed.password and not parsed.fragment)
    except ValueError:
        return False


def effective(defaults, entry, image, *, index=True, page_type='website'):
    def value(key):
        return (getattr(entry, key, None) if entry else None) or defaults.get(key, '')

    title, description, canonical = (value(k) for k in ('meta_title', 'meta_description', 'canonical_url'))
    if not valid_canonical(canonical):
        canonical = defaults['canonical_url']
    social_title = value('og_title') or title
    social_description = value('og_description') or description
    return {
        'meta_title': title, 'meta_description': description, 'meta_keywords': value('meta_keywords'),
        'focus_keyword': value('focus_keyword'), 'secondary_keywords': value('secondary_keywords'),
        'canonical_url': canonical, 'og_title': social_title, 'og_description': social_description,
        'og_image': image, 'robots_index': index and (entry is None or entry.robots_index),
        'robots_follow': entry is None or entry.robots_follow,
        'open_graph': {'type': page_type, 'url': canonical, 'title': social_title,
                       'description': social_description, 'image': image},
        'twitter': {'card': 'summary_large_image' if image else 'summary', 'title': social_title,
                    'description': social_description, 'image': image},
    }


def metadata(product, request):
    entry = getattr(product, 'seo', None)
    main = image_url(product.main_image, request)
    images = list(dict.fromkeys(filter(None, [main, *(image_url(item.image, request) for item in product.gallery.all())])))
    result = effective(generated_metadata(product, True), entry,
                       image_url(entry.og_image, request) if entry and entry.og_image else next(iter(images), None),
                       page_type='product')
    structured = {
        '@context': SCHEMA, '@type': 'Product', 'name': product.title, 'sku': product.sku,
        'description': clean_text(product.short_description or product.description, 500),
        'offers': {'@type': 'Offer', 'url': result['canonical_url'], 'price': str(product.effective_price),
                   'priceCurrency': settings.CURRENCY,
                   'availability': f'{SCHEMA}/{"InStock" if product.in_stock else "OutOfStock"}'},
    }
    if images:
        structured['image'] = images
    if entry and isinstance(entry.structured_data, dict):
        brand = entry.structured_data.get('brand')
        if isinstance(brand, dict) and isinstance(brand.get('name'), str) and brand['name'].strip():
            structured['brand'] = {'@type': 'Brand', 'name': clean_text(brand['name'], 200)}
        condition = entry.structured_data.get('itemCondition')
        if condition in (f'{SCHEMA}/NewCondition', f'{SCHEMA}/UsedCondition',
                         f'{SCHEMA}/RefurbishedCondition', f'{SCHEMA}/DamagedCondition'):
            structured['offers']['itemCondition'] = condition
    result['structured_data'] = structured
    result['breadcrumb_data'] = breadcrumbs(product.category, product)
    return result


def category_metadata(category, request):
    entry = getattr(category, 'seo', None)
    result = effective(generated_metadata(category), entry,
                       image_url(entry.og_image or category.image if entry else category.image, request),
                       index=request.query_params.get('filtered') != '1')
    result['structured_data'] = {}
    result['breadcrumb_data'] = breadcrumbs(category)
    return result


def site_metadata(page, filtered):
    path, title, description = SITE_PAGES[page]
    result = effective({'meta_title': title, 'meta_description': description,
                        'canonical_url': settings.SITE_URL + path}, None, None,
                       index=(page != 'search' and not filtered))
    if page == 'home':
        result['structured_data'] = {'@context': SCHEMA, '@graph': [
            {'@type': 'Organization', 'name': 'WoodzyHome', 'url': settings.SITE_URL + '/'},
            {'@type': 'WebSite', 'name': 'WoodzyHome', 'url': settings.SITE_URL + '/', 'inLanguage': 'fa'},
        ]}
        result['breadcrumb_data'] = breadcrumbs()
    else:
        result['structured_data'] = {}
    return result
