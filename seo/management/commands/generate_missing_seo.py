from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from categories.models import Category
from products.models import Product
from seo.backfill import backfill_batch
from seo.tasks import backfill_seo


class Command(BaseCommand):
    help = 'Generate product/category SEO defaults in batches without overwriting manual overrides.'

    def add_arguments(self, parser):
        parser.add_argument('--batch-size', type=int, default=200)
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--enqueue', action='store_true')
        parser.add_argument('--missing-only', action='store_true')

    def handle(self, *, batch_size, dry_run, enqueue, missing_only, **options):
        if not 1 <= batch_size <= 1000 or (dry_run and enqueue):
            raise CommandError('Batch size must be 1–1000. Use --dry-run or --enqueue separately.')
        for entity, model in [('product', Product), ('category', Category)]:
            if enqueue:
                result = backfill_seo.delay(entity, 0, batch_size, missing_only)
                self.stdout.write(f'{entity}: queued {result.id}')
                continue
            after = 0
            totals = Counter()
            while after is not None:
                after, counts = backfill_batch(model, after, batch_size, dry_run, missing_only)
                totals.update(counts)
            self.stdout.write(f'{entity}: {dict(totals)}' + (' (dry run)' if dry_run else ''))
