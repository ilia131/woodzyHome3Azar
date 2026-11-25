from django.apps import AppConfig
from django.db.models.signals import post_save


class SEOConfig(AppConfig):
    name = 'seo'

    def ready(self):
        from .services import initialize_defaults

        for label in ('products.Product', 'categories.Category'):
            post_save.connect(initialize_defaults, sender=label, dispatch_uid=f'seo.initialize.{label}')
