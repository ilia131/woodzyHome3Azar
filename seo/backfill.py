from categories.models import Category
from products.models import Product, ProductImage

from .services import persist_defaults


def backfill_batch(model, after=0, batch_size=200, dry_run=False, missing_only=False):
    size = min(1000, max(1, batch_size))
    product = model is Product
    related = ('seo', 'category') if product else ('seo', 'parent')
    queryset = model.objects.filter(pk__gt=after).order_by('pk').select_related(*related)
    if missing_only:
        from django.db.models import Q
        queryset = queryset.filter(Q(seo__isnull=True) | Q(seo__generated={}))
    rows = list(queryset[:size])
    statistics = {'processed': len(rows), 'missing': 0, 'missing_canonical': 0, 'missing_alt': 0}
    if product:
        gallery = ProductImage.objects.filter(product_id__in=[row.pk for row in rows], alt_text='')
        images = list(gallery.values_list('pk', 'product_id'))
        titles = {row.pk: row.title for row in rows}
        statistics['missing_alt'] = len(images)
        if images and not dry_run:
            for pk, product_id in images:
                ProductImage.objects.filter(pk=pk, alt_text='').update(alt_text=titles[product_id])
    for row in rows:
        entry = getattr(row, 'seo', None)
        statistics['missing'] += int(not entry or not entry.generated)
        statistics['missing_canonical'] += int(not entry or not (entry.canonical_url or entry.generated.get('canonical_url')))
        if not dry_run:
            persist_defaults(row, product=product)
    return rows[-1].pk if rows else None, statistics
