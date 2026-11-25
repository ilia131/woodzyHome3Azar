import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
DEBUG = os.getenv('DJANGO_DEBUG') == '1'
PAYMENT_MODE = os.getenv('PAYMENT_MODE', 'development' if DEBUG else 'production')
if PAYMENT_MODE not in {'production', 'development', 'test'}:
    raise ValueError('Invalid PAYMENT_MODE.')
PAYMENT_MOCK_ENABLED = os.getenv(
    'PAYMENT_MOCK_ENABLED', 'true' if PAYMENT_MODE in {'development', 'test'} else 'false',
).lower() in {'true', '1'}
if PAYMENT_MODE == 'production' and PAYMENT_MOCK_ENABLED:
    raise ValueError('The mock gateway cannot run in production.')
PAYMENT_PROVIDER_FLAGS = {
    name.lower(): os.getenv(f'{name}_ENABLED', 'false').lower() in {'true', '1'}
    for name in ('SNAPP_PAY', 'DIGIPAY', 'TOROB_PAY')
}
PAYMENT_DEFAULT_PROVIDER = os.getenv('PAYMENT_DEFAULT_PROVIDER', 'mock')
if PAYMENT_DEFAULT_PROVIDER != 'mock':
    raise ValueError('No real payment provider is installed.')
PAYMENT_INITIATION_TIMEOUT = int(os.getenv('PAYMENT_INITIATION_TIMEOUT', '15'))
PAYMENT_VERIFICATION_TIMEOUT = int(os.getenv('PAYMENT_VERIFICATION_TIMEOUT', '15'))
if min(PAYMENT_INITIATION_TIMEOUT, PAYMENT_VERIFICATION_TIMEOUT) <= 0:
    raise ValueError('Payment timeouts must be positive.')
PAYMENT_MOCK_SIGNING_KEY = os.getenv('PAYMENT_MOCK_SIGNING_KEY', '')
PAYMENT_PENDING_EXPIRATION_SECONDS = int(os.getenv('PAYMENT_PENDING_EXPIRATION_SECONDS', '900'))
if PAYMENT_PENDING_EXPIRATION_SECONDS <= 0:
    raise ValueError('PAYMENT_PENDING_EXPIRATION_SECONDS must be positive.')
TEST_SQLITE = os.getenv('TEST_SQLITE') == '1'
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'django.contrib.postgres', 'rest_framework', 'rest_framework_simplejwt.token_blacklist',
    'corsheaders', 'django_filters', 'drf_spectacular',
    'core', 'accounts', 'categories', 'products', 'favorites', 'reviews', 'analytics',
    'recommendations', 'search', 'seo', 'dashboard', 'notifications', 'orders', 'payments',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware', 'corsheaders.middleware.CorsMiddleware',
    'core.middleware.PrivateAPICacheMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'APP_DIRS': True,
              'OPTIONS': {'context_processors': ['django.template.context_processors.request',
                  'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': os.getenv('POSTGRES_DB', 'aksoria'),
    'USER': os.getenv('POSTGRES_USER', 'aksoria'), 'PASSWORD': os.getenv('POSTGRES_PASSWORD', ''),
    'HOST': os.getenv('POSTGRES_HOST', 'localhost'), 'PORT': os.getenv('POSTGRES_PORT', '5432')}}
if TEST_SQLITE:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'dev.sqlite3'}}
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': REDIS_URL}}
if TEST_SQLITE:
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/1')
CELERY_IMPORTS = ('accounts.recovery', 'core.store_api', 'core.store_mail')
INVENTORY_RESERVATION_SECONDS = int(os.getenv('INVENTORY_RESERVATION_SECONDS', '900'))
if INVENTORY_RESERVATION_SECONDS < 1:
    raise ValueError('INVENTORY_RESERVATION_SECONDS must be positive.')
CELERY_BEAT_SCHEDULE = {
    'expired-jwt': {'task': 'accounts.tasks.flush_expired_tokens', 'schedule': 86400},
    'reconcile-payments': {'task': 'payments.tasks.reconcile_payments', 'schedule': 60},
    'expire-inventory': {'task': 'orders.tasks.expire_reservations', 'schedule': 60},
}
AUTH_USER_MODEL = 'accounts.User'
AUTH_PASSWORD_VALIDATORS = [{'NAME': f'django.contrib.auth.password_validation.{name}'} for name in (
    'UserAttributeSimilarityValidator', 'MinimumLengthValidator', 'CommonPasswordValidator', 'NumericPasswordValidator')]
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['accounts.authentication.SessionJWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticatedOrReadOnly'],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'core.api.Pagination', 'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle', 'rest_framework.throttling.UserRateThrottle',
                                 'rest_framework.throttling.ScopedRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {'anon': '120/min', 'user': '300/min', 'auth': '10/min', 'search': '90/min', 'review': '10/hour', 'recovery': '5/min', 'recovery_confirm': '8/min', 'store_contact': '8/hour', 'newsletter': '8/hour', 'payments': '30/min', 'payment_callback': '120/min'},
    'NUM_PROXIES': int(os.getenv('TRUSTED_PROXY_COUNT', '0')),
}
SIMPLE_JWT = {'ACCESS_TOKEN_LIFETIME': timedelta(minutes=10), 'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
              'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': True, 'CHECK_REVOKE_TOKEN': True}
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv('SECURE_HSTS_INCLUDE_SUBDOMAINS') == '1'
SECURE_HSTS_PRELOAD = os.getenv('SECURE_HSTS_PRELOAD') == '1'
SPECTACULAR_SETTINGS = {'TITLE': 'HomeAksoria API', 'VERSION': '1.0.0', 'COMPONENT_SPLIT_REQUEST': True,
                        'ENUM_NAME_OVERRIDES': {'OrderStatus': 'orders.models.Order.Status',
                                                'ReservationStatus': 'orders.models.Reservation.Status',
                                                'PaymentStatus': 'payments.models.Payment.Status'}}
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
CSRF_TRUSTED_ORIGINS = [value for value in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if value]
SITE_URL = os.getenv('SITE_URL', 'http://localhost:3000').rstrip('/')
SEO_MEDIA_URL = os.getenv("SEO_MEDIA_URL", "").rstrip("/")
CURRENCY = os.getenv('STORE_CURRENCY', 'IRR')
TIME_ZONE = 'UTC'
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = os.getenv('SECURE_COOKIES', '1') == '1'
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', '0') == '1'
if os.getenv('TRUST_PROXY_HTTPS') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
DATA_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FILES = 20
LOGGING = {'version': 1, 'disable_existing_loggers': False,
           'handlers': {'console': {'class': 'logging.StreamHandler'}},
           'root': {'handlers': ['console'], 'level': os.getenv('LOG_LEVEL', 'INFO')}}

TRANSACTIONAL_EMAIL_ENABLED = os.getenv('TRANSACTIONAL_EMAIL_ENABLED') == '1'
EMAIL_HOST = os.getenv('STORE_EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.getenv('STORE_EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('STORE_EMAIL_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('STORE_EMAIL_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('STORE_EMAIL_TLS', '1') == '1'
DEFAULT_FROM_EMAIL = os.getenv('STORE_FROM_EMAIL', 'webmaster@localhost')
EMAIL_TIMEOUT = 5
PASSWORD_RESET_TIMEOUT = 1800
