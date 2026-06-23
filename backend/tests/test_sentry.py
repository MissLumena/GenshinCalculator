"""Тесты настройки Sentry."""

from unittest.mock import patch

from app.config import Settings
from app.sentry import init_sentry


def make_settings(**overrides: object) -> Settings:
    defaults = {
        'jwt_secret': 'test-secret',
        'sentry_dsn': '',
    }
    defaults.update(overrides)
    return Settings(**defaults)


@patch('app.sentry.sentry_sdk.init')
def test_init_sentry_skips_empty_dsn(init_mock) -> None:
    enabled = init_sentry(make_settings())

    assert enabled is False
    init_mock.assert_not_called()


@patch('app.sentry.sentry_sdk.init')
def test_init_sentry_uses_configured_values(init_mock) -> None:
    enabled = init_sentry(
        make_settings(
            app_debug=False,
            sentry_dsn='https://public@sentry.example/1',
            sentry_environment='production',
            sentry_traces_sample_rate=0.25,
        )
    )

    assert enabled is True
    kwargs = init_mock.call_args.kwargs
    assert kwargs['dsn'] == 'https://public@sentry.example/1'
    assert kwargs['environment'] == 'production'
    assert kwargs['traces_sample_rate'] == 0.25
    assert kwargs['send_default_pii'] is False


@patch('app.sentry.sentry_sdk.init')
def test_init_sentry_defaults_environment_from_debug(init_mock) -> None:
    enabled = init_sentry(
        make_settings(
            app_debug=True,
            sentry_dsn='https://public@sentry.example/1',
            sentry_traces_sample_rate=2.0,
        )
    )

    assert enabled is True
    kwargs = init_mock.call_args.kwargs
    assert kwargs['environment'] == 'development'
    assert kwargs['traces_sample_rate'] == 1.0
