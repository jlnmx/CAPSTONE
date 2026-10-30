from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    database_url: str = "postgresql://handa:handa_dev_password@localhost:5432/handa"
    cors_origins: str = "http://localhost:8081,http://localhost:19006"
    auth_secret: str = "handa-development-auth-secret-change-me"
    access_token_minutes: int = 480
    password_reset_expiry_minutes: int = 10
    password_reset_max_attempts: int = 3
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    chatbot_api_base_url: str = Field(default="https://api.groq.com/openai/v1", validation_alias=AliasChoices("GROQ_API_BASE_URL", "CHATBOT_API_BASE_URL"))
    chatbot_api_key: str = Field(default="", validation_alias=AliasChoices("GROQ_API_KEY", "CHATBOT_API_KEY"))
    chatbot_model: str = Field(default="", validation_alias=AliasChoices("GROQ_MODEL", "CHATBOT_MODEL"))
    chatbot_timeout_seconds: int = 25

    model_config = SettingsConfigDict(env_file=(BACKEND_DIR / ".env", BACKEND_DIR / ".env.groq"), extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
