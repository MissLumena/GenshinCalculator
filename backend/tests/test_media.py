"""Tests for media proxy routes."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_fandom_constellation_shape_rejects_empty_name() -> None:
    response = client.get('/api/media/fandom-constellation-shape', params={'constellation': '   '})
    assert response.status_code == 422


def test_fandom_constellation_shape_returns_url_for_known_constellation() -> None:
    response = client.get(
        '/api/media/fandom-constellation-shape',
        params={'constellation': 'Turris Venefica'},
    )
    assert response.status_code == 200
    body = response.json()
    assert body['url']
    assert 'Turris_Venefica_Shape' in body['url']


def test_wikia_image_rejects_invalid_path() -> None:
    response = client.get('/api/media/wikia-image', params={'path': '/evil/path.png'})
    assert response.status_code == 400


def test_wikia_image_returns_image_for_known_shape() -> None:
    path = '/gensin-impact/images/d/d1/Turris_Venefica_Shape.png/revision/latest?cb=20260520080345'
    response = client.get('/api/media/wikia-image', params={'path': path})
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('image/')
    assert len(response.content) > 1000


def test_wikia_image_rejects_oversized_response() -> None:
    path = '/gensin-impact/images/d/d1/Turris_Venefica_Shape.png/revision/latest?cb=20260520080345'
    mock_response = MagicMock()
    mock_response.read.return_value = b'x' * (5 * 1024 * 1024 + 1)
    mock_response.headers = {'Content-Type': 'image/png'}
    mock_response.__enter__.return_value = mock_response
    mock_response.__exit__.return_value = False

    with patch('app.routers.media.urllib.request.urlopen', return_value=mock_response):
        response = client.get('/api/media/wikia-image', params={'path': path})

    assert response.status_code == 413


def test_wikia_image_rejects_unsupported_content_type() -> None:
    path = '/gensin-impact/images/d/d1/Turris_Venefica_Shape.png/revision/latest?cb=20260520080345'
    mock_response = MagicMock()
    mock_response.read.return_value = b'fake-image'
    mock_response.headers = {'Content-Type': 'text/html'}
    mock_response.__enter__.return_value = mock_response
    mock_response.__exit__.return_value = False

    with patch('app.routers.media.urllib.request.urlopen', return_value=mock_response):
        response = client.get('/api/media/wikia-image', params={'path': path})

    assert response.status_code == 502
    assert response.json()['detail'] == 'Unsupported remote media type'
