from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from accounts.admin_api import AdminCustomers
from orders.admin_api import AdminMovements, AdminOrders, AdminOrderTransition, AdminStockAdjustment
from core.audit_api import AdminAuditLog
from core.store_api import Contact, Newsletter, NewsletterConfirm
from recommendations.admin_api import AdminRankingWeights, AdminRecommendationPolicy
from analytics.admin_api import AdminMostViewedProducts, AdminPopularCategories, AdminPopularProducts, AdminProductMetrics
from categories.admin_api import AdminCategories
from categories.api import CategoryChildren, CategoryDetail, CategoryList
from favorites.api import FavoriteDetail, FavoriteLookup, Favorites
from products.admin_api import AdminImages, AdminProductHistory, AdminProducts
from products.api import BestDiscounts, BestSellers, MostFavorited, MostViewed, ProductDetail, ProductList
from recommendations.api import FromFavorites, Popular, Recommended, Related, Similar, SuggestedCategories
from reviews.api import AdminReply, AdminReview, AdminReviews, OwnerReview, ProductReviews
from seo.admin_api import AdminCategorySEO, AdminSEO, AdminSEOAudit
from seo.views import SiteSEO, robots, sitemap

admin_router = SimpleRouter()
admin_router.register('products', AdminProducts)
admin_router.register('categories', AdminCategories)
admin_router.register('product-images', AdminImages)
admin_router.register('product-history', AdminProductHistory)
admin_router.register('seo', AdminSEO)
admin_router.register("category-seo", AdminCategorySEO)
admin_router.register('users', AdminCustomers)
admin_router.register('orders', AdminOrders)
admin_router.register('audit-logs', AdminAuditLog)
admin_router.register('ranking-weights', AdminRankingWeights)

api = [
    path("seo/site/", SiteSEO.as_view(), name="seo-site"),
    path("admin/seo-audit/", AdminSEOAudit.as_view(), name="seo-audit"),
    path('store/contact/', Contact.as_view()),
    path('store/newsletter/', Newsletter.as_view()),
    path('store/newsletter/confirm/', NewsletterConfirm.as_view()),
    path('auth/', include('accounts.urls')),
    path('', include('orders.urls')),
    path('', include('payments.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('search/', include('search.urls')),
    path('products/', ProductList.as_view(), name='products'),
    path('products/most-viewed/', MostViewed.as_view(), name='most-viewed'),
    path('products/most-favorited/', MostFavorited.as_view(), name='most-favorited'),
    path('products/best-selling/', BestSellers.as_view(), name='best-selling'),
    path('products/best-discounts/', BestDiscounts.as_view(), name='best-discounts'),
    path('products/popular/', Popular.as_view(), name='popular-products'),
    path('products/recommended/', Recommended.as_view(), name='recommended-products'),
    path('products/<str:slug>/similar/', Similar.as_view(), name='similar-products'),
    path('products/<str:slug>/related/', Related.as_view(), name='related-products'),
    path('recommendations/from-favorites/', FromFavorites.as_view(), name='recommendations-from-favorites'),
    path('products/<int:product_id>/reviews/', ProductReviews.as_view(), name='product-reviews'),
    path('reviews/<int:pk>/', OwnerReview.as_view(), name='owner-review'),
    path('products/<str:slug>/', ProductDetail.as_view(), name='product-detail'),
    path('categories/', CategoryList.as_view(), name='categories'),
    path('categories/<str:slug>/children/', CategoryChildren.as_view(), name='category-children'),
    path('categories/suggested/', SuggestedCategories.as_view(), name='suggested-categories'),
    path('categories/<str:slug>/', CategoryDetail.as_view(), name='category-detail'),
    path('favorites/', Favorites.as_view(), name='favorites'),
    path("favorites/status/", FavoriteLookup.as_view(), name="favorite-status"),
    path('favorites/<int:product_id>/', FavoriteDetail.as_view(), name='favorite-item'),
    path('admin/products/<int:pk>/views/', AdminProductMetrics.as_view(), name='admin-product-metrics'),
    path('admin/reviews/', AdminReviews.as_view(), name='admin-reviews'),
    path('admin/reviews/<int:pk>/', AdminReview.as_view(), name='admin-review'),
    path('admin/reviews/<int:review_id>/replies/', AdminReply.as_view(), name='admin-review-replies'),
    path('admin/recommendation-settings/', AdminRecommendationPolicy.as_view(), name='admin-recommendation-settings'),
    path('admin/reports/popular-products/', AdminPopularProducts.as_view(), name='admin-popular-products'),
    path('admin/reports/most-viewed-products/', AdminMostViewedProducts.as_view(), name='admin-most-viewed-products'),
    path('admin/reports/popular-categories/', AdminPopularCategories.as_view(), name='admin-popular-categories'),
    path('admin/inventory/movements/', AdminMovements.as_view(), name='inventory-movements'),
    path('admin/inventory/products/<int:pk>/adjust/', AdminStockAdjustment.as_view(), name='inventory-adjust'),
    path('admin/orders/<int:pk>/status/', AdminOrderTransition.as_view()),
    path('admin/', include(admin_router.urls)),
]

urlpatterns = [
    path('api/v1/', include(api)),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('django-admin/', admin.site.urls),
    path('sitemap.xml', sitemap),
    path('robots.txt', robots),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
