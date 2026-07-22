from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite en dev/mock ; pour la prod, mettre la chaîne Postgres de Supabase :
    #   DATABASE_URL=postgresql://postgres:<mot_de_passe>@<host>.supabase.co:5432/postgres
    database_url: str = "sqlite:///./vigie.db"
    engine_autostart: bool = True
    engine_tick_seconds: int = 15

    mock_mode: bool = True
    mock_answer_rate: float = 0.7

    # ==== Backend de données ====
    # use_supabase=false -> SqlRepo (SQLAlchemy, SQLite/Postgres via DATABASE_URL) : dev/mock local.
    # use_supabase=true  -> SupabaseRepo (API Supabase + service role key) : prod Lovable Cloud.
    use_supabase: bool = False
    supabase_url: str = ""
    # Clé publique (anon/publishable) — PAS un secret, nécessaire pour l'en-tête "apikey"
    # exigé par la passerelle Supabase, quel que soit le compte connecté ensuite.
    supabase_anon_key: str = ""
    # Compte de service (Supabase Auth, role=admin côté user_roles) : c'est ainsi que le
    # backend s'authentifie, car Lovable Cloud n'expose PAS la service role key.
    supabase_service_email: str = ""
    supabase_service_password: str = ""
    # Conservé pour compatibilité si un jour une vraie service role key est disponible
    # (ex. projet Supabase autogéré) ; sinon laisser vide.
    supabase_service_role_key: str = ""

    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    sip_trunk_id: str = ""
    sip_caller_id: str = "+212XXXXXXXXX"

    # ==== WhatsApp Business Calling via le connecteur LiveKit (chantier 3) ====
    # Désactivé par défaut : Meta doit d'abord activer les appels sortants pour
    # le compte/région et chaque destinataire doit avoir accordé sa permission.
    whatsapp_calls_enabled: bool = False
    whatsapp_calls_access_token: str = ""
    whatsapp_calls_phone_number_id: str = ""
    whatsapp_calls_cloud_api_version: str = "24.0"
    whatsapp_calls_destination_country: str = "MA"
    whatsapp_calls_ringing_timeout_seconds: int = 35
    # Estimations configurables : elles ne remplacent jamais la facture réelle.
    sip_estimated_cost_per_minute_usd: float = 0.0
    whatsapp_estimated_cost_per_minute_usd: float = 0.0

    openai_api_key: str = ""

    # ==== Alertes WhatsApp via notre plateforme M2S API ====
    m2s_whatsapp_api_url: str = ""
    m2s_whatsapp_api_key: str = ""
    m2s_whatsapp_instance_id: str = ""

    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    zineb_whatsapp: str = "+212XXXXXXXXX"
    # Nom et langue du TEMPLATE Meta approuvé (voir app/providers/whatsapp.py
    # pour les instructions de création côté WhatsApp Manager).
    whatsapp_template_name: str = "vigie_handoff_humain"
    whatsapp_template_lang: str = "fr"
    # Chaîne SECRÈTE que TOI seul choisis (ex. secrets.token_urlsafe(24)) —
    # à recopier dans le champ "Verify token" du webhook côté Meta.
    whatsapp_webhook_verify_token: str = ""

    # ==== Sécurité / exploitation ====
    # Jeton protégeant POST /api/engine/tick (indispensable si le tick est déclenché
    # par un cron externe : sans jeton, n'importe qui pourrait l'appeler).
    # Clé partagée obligatoire pour les routes internes /api/*.
    # Acceptée via X-API-Key ou Authorization: Bearer <clé>.
    vigie_api_key: str = ""
    engine_tick_token: str = ""
    # App Secret de l'application Meta : valide la signature des webhooks POST.
    whatsapp_app_secret: str = ""
    # Origines autorisées par le CORS, séparées par des virgules.
    # "*" = tout (prototype). En prod : https://ton-frontend.lovable.app
    cors_origins: str = "*"

    # ==== Générateur automatique de dossiers (en attendant l'API M2S) ====
    # Crée un dossier "frais" toutes les N heures pour un unique constateur de test.
    # À désactiver le jour où l'API M2S est branchée.
    auto_dossier_enabled: bool = False
    auto_dossier_interval_hours: float = 2.0
    auto_dossier_constateur_tel: str = "+212600000000"
    auto_dossier_constateur_nom: str = "Constateur M2S"
    auto_dossier_constateur_zone: str = "Casablanca"
    auto_dossier_ref_prefix: str = "DOS-AUTO"

    # ==== Intégration API M2S (dossiers sinistres) ====
    m2s_dossiers_api_url: str = ""      # URL de l'API m2s à interroger (laisser vide = désactivé)
    m2s_api_token: str = ""             # jeton d'authentification (Bearer), si requis
    m2s_poll_enabled: bool = False      # true = interroge périodiquement l'API m2s
    m2s_poll_interval_seconds: int = 300
    # Secret partagé dédié à la signature HMAC de POST
    # /api/webhooks/m2s/dossier-status. Ne jamais l'exposer dans le frontend.
    m2s_webhook_secret: str = ""
    # TODO(M2S-CONTRACT) : laisser ces valeurs vides jusqu'à confirmation par M2S.
    # Les listes de statuts sont séparées par des virgules.
    m2s_status_field: str = ""
    m2s_validated_status_values: str = ""
    m2s_active_status_values: str = ""


config = AppConfig()
