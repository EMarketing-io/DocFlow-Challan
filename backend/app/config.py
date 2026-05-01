from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Local dev: path to JSON file. GCP Cloud Run: leave empty, set GOOGLE_CREDENTIALS_JSON instead.
    google_service_account_path: str = "./credentials/service_account.json"
    google_credentials_json: str = ""   # full JSON string (for Cloud Run / Vercel)
    google_sheet_id: str = ""
    google_drive_folder_id: str = ""
    allowed_origins: str = "http://localhost:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

settings = Settings()
