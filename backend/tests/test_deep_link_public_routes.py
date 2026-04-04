import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.main import _is_public_read_get_path, auth_middleware


class DeepLinkPublicReadPatternTests(unittest.TestCase):
    def test_exact_public_get_paths_are_allowed(self):
        allowed_paths = [
            "/posts/123",
            "/posts/123/comments",
            "/api/requests/77",
            "/market/42",
            "/users/8/rating",
            "/users/8/public",
        ]

        for path in allowed_paths:
            with self.subTest(path=path):
                self.assertTrue(_is_public_read_get_path("GET", path))

    def test_non_get_or_neighbor_routes_stay_private(self):
        blocked_pairs = [
            ("POST", "/posts/123"),
            ("GET", "/posts/feed"),
            ("POST", "/posts/123/comments"),
            ("POST", "/api/requests/77/respond"),
            ("POST", "/market/42/contact"),
            ("GET", "/market/feed"),
            ("GET", "/users/8/stats"),
        ]

        for method, path in blocked_pairs:
            with self.subTest(method=method, path=path):
                self.assertFalse(_is_public_read_get_path(method, path))


class DeepLinkPublicReadMiddlewareTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_get_skips_auth_requirement(self):
        request = SimpleNamespace(
            method="GET",
            url=SimpleNamespace(path="/posts/123"),
            headers={},
            state=SimpleNamespace(),
        )
        call_next = AsyncMock(return_value="ok")

        response = await auth_middleware(request, call_next)

        self.assertEqual(response, "ok")
        call_next.assert_awaited_once_with(request)
        self.assertFalse(hasattr(request.state, "auth_payload"))

    async def test_neighbor_write_route_without_token_still_returns_401(self):
        request = SimpleNamespace(
            method="POST",
            url=SimpleNamespace(path="/market/42/contact"),
            headers={},
            state=SimpleNamespace(),
        )
        call_next = AsyncMock(return_value="should-not-run")

        response = await auth_middleware(request, call_next)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(json.loads(response.body.decode("utf-8")), {"detail": "Missing bearer token"})
        call_next.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
