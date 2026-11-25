from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db import transaction

from recommendations.models import RankingWeights, RecommendationPolicy


CATALOG = {
    'products.productimage': ('add', 'view', 'change', 'delete'),
    'products.product': ('add', 'view', 'change'),
    'products.productchange': ('view',),
    'categories.category': ('add', 'view', 'change', 'delete'),
    'seo.productseo': ('add', 'view', 'change', 'delete'),
    'seo.categoryseo': ('add', 'view', 'change'),
}
SUPPORT = {
    'accounts.user': ('view',),
    'core.contactmessage': ('view',),
    'reviews.review': ('view', 'change'),
    'reviews.reviewreply': ('add',),
}
ROLES = {
    'Super Admin': {},
    'Admin': {
        **CATALOG, **SUPPORT, 'accounts.user': ('view', 'change'), 'recommendations.rankingweights': ('view', 'change'),
        'orders.order': ('view', 'change'), 'orders.inventorymovement': ('add', 'view'),
        'payments.payment': ('view',), 'payments.paymenttransaction': ('view',), 'payments.refund': ('add', 'change'),
        'core.auditlog': ('view',), 'recommendations.recommendationpolicy': ('view', 'change'),
    },
    'Product Manager': {**CATALOG, 'recommendations.rankingweights': ('view',),
                        'orders.inventorymovement': ('add', 'view')},
    'Order Manager': {'orders.order': ('view', 'change'), 'orders.inventorymovement': ('view',)},
    'Support Manager': SUPPORT,
}


class Command(BaseCommand):
    help = 'Initialize the Phase 0 roles and the default recommendation popularity settings.'

    @transaction.atomic
    def handle(self, *args, **options):
        RankingWeights.objects.get_or_create(singleton=1)
        RecommendationPolicy.objects.get_or_create(singleton=1)
        for name, models in ROLES.items():
            group, _ = Group.objects.get_or_create(name=name)
            permissions = []
            for label, actions in models.items():
                app, model = label.split('.')
                permissions.extend(Permission.objects.filter(
                    content_type__app_label=app, content_type__model=model,
                    codename__in=[f'{action}_{model}' for action in actions],
                ))
            if name in {'Admin', 'Product Manager'}:
                permissions.append(Permission.objects.get(
                    content_type__app_label='core', codename='view_store_metrics',
                ))
            group.permissions.set(permissions)
        self.stdout.write(self.style.SUCCESS('Phase 0 roles provisioned.'))
