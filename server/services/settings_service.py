import os
import traceback
import toml

USER_DATA_DIR = os.getenv("USER_DATA_DIR", os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "user_data"))

# Global settings config
app_settings = {}

DEFAULT_SETTINGS = {
    "proxy": {
        "enable": False,
        "url": ""
    }
}


class SettingsService:
    def __init__(self):
        self.root_dir = os.path.dirname(
            os.path.dirname(os.path.dirname(__file__)))
        self.settings_file = os.getenv(
            "SETTINGS_PATH", os.path.join(USER_DATA_DIR, "settings.toml"))

    async def exists_settings(self):
        return os.path.exists(self.settings_file)

    def get_settings(self):
        try:
            if not os.path.exists(self.settings_file):
                # Create default settings file if it doesn't exist
                self.create_default_settings()

            with open(self.settings_file, 'r', encoding='utf-8') as f:
                settings = toml.load(f)

            # Merge with defaults to ensure all keys exist
            merged_settings = {**DEFAULT_SETTINGS}
            for key, value in settings.items():
                if key in merged_settings and isinstance(merged_settings[key], dict) and isinstance(value, dict):
                    merged_settings[key].update(value)
                else:
                    merged_settings[key] = value

            # Mask sensitive information for API responses
            display_settings = self._mask_sensitive_data(merged_settings)

            global app_settings
            app_settings = merged_settings  # Store unmasked version globally
            return display_settings
        except Exception as e:
            print(f"Error loading settings: {e}")
            traceback.print_exc()
            return DEFAULT_SETTINGS

    def get_raw_settings(self):
        """Get settings without masking sensitive data (for internal use)"""
        try:
            if not os.path.exists(self.settings_file):
                self.create_default_settings()

            with open(self.settings_file, 'r', encoding='utf-8') as f:
                settings = toml.load(f)

            # Merge with defaults
            merged_settings = {**DEFAULT_SETTINGS}
            for key, value in settings.items():
                if key in merged_settings and isinstance(merged_settings[key], dict) and isinstance(value, dict):
                    merged_settings[key].update(value)
                else:
                    merged_settings[key] = value

            global app_settings
            app_settings = merged_settings
            return merged_settings
        except Exception as e:
            print(f"Error loading raw settings: {e}")
            return DEFAULT_SETTINGS

    def create_default_settings(self):
        """Create default settings file"""
        try:
            os.makedirs(os.path.dirname(self.settings_file), exist_ok=True)
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                toml.dump(DEFAULT_SETTINGS, f)
        except Exception as e:
            print(f"Error creating default settings: {e}")

    def _mask_sensitive_data(self, settings):
        """Mask sensitive information in settings"""
        masked_settings = settings.copy()

        # Mask proxy password
        if 'proxy' in masked_settings and 'password' in masked_settings['proxy']:
            if masked_settings['proxy']['password']:
                masked_settings['proxy']['password'] = '********'

        return masked_settings

    async def update_settings(self, data):
        try:
            # Load existing settings
            existing_settings = DEFAULT_SETTINGS.copy()
            if os.path.exists(self.settings_file):
                try:
                    with open(self.settings_file, 'r', encoding='utf-8') as f:
                        existing_settings = toml.load(f)
                except Exception as e:
                    print(f"Error reading existing settings: {e}")

            # Merge new data with existing settings
            for key, value in data.items():
                if key in existing_settings and isinstance(existing_settings[key], dict) and isinstance(value, dict):
                    existing_settings[key].update(value)
                else:
                    existing_settings[key] = value

            # Ensure directory exists
            os.makedirs(os.path.dirname(self.settings_file), exist_ok=True)

            # Save updated settings
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                toml.dump(existing_settings, f)

            # Update global settings
            global app_settings
            app_settings = existing_settings

            return {"status": "success", "message": "Settings updated successfully"}
        except Exception as e:
            traceback.print_exc()
            return {"status": "error", "message": str(e)}


settings_service = SettingsService()

# Initialize settings on import
settings_service.get_raw_settings()
