"""Unit tests for core.config — validates env loading and masking."""
import pytest
from unittest.mock import patch

import core.config as config_mod


class TestConfig:
    def test_config_dict_has_required_keys(self):
        keys = {"MONGODB_URI", "MONGODB_DB_NAME", "CHROMA_PERSIST_DIRECTORY",
                "OLLAMA_MODEL", "OLLAMA_BASE_URL"}
        assert keys.issubset(config_mod.config.keys())

    def test_defaults_are_strings(self):
        for key, val in config_mod.config.items():
            assert isinstance(val, str), f"{key} should be str, got {type(val)}"

    def test_mask_uri_hides_credentials(self):
        uri = "mongodb://user:pass@host:27017/dbname"
        masked = config_mod._mask_uri(uri)
        assert "pass" not in masked
        assert "host:27017" in masked

    def test_mask_uri_empty(self):
        assert config_mod._mask_uri("") == "<not set>"
        assert config_mod._mask_uri(None) == "<not set>"

    def test_mask_uri_simple(self):
        masked = config_mod._mask_uri("mongodb://localhost:27017/testdb")
        assert "localhost" in masked
