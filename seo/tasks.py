from celery import shared_task
from categories.models import Category
from products.models import Product

from .backfill import backfill_batch


@shared_task(ignore_result=True)
def backfill_seo(entity='product', after=0, batch_size=200, missing_only=False):
    model = {'product': Product, 'category': Category}[entity]
    cursor, _ = backfill_batch(model, after, batch_size, missing_only=missing_only)
    if cursor is not None:
        backfill_seo.delay(entity, cursor, batch_size, missing_only)
