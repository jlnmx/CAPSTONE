import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware

from app.db import get_connection
from app.main import SecurityHeadersMiddleware, app, asgi_app


class SecurityHeadersTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(asgi_app, raise_server_exceptions=False)

    def test_hsts_is_set_on_normal_responses(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("strict-transport-security"), "max-age=31536000")

    def test_hsts_is_set_on_cors_preflight_responses(self):
        response = self.client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "https://handa-admin-web.vercel.app",
                "Access-Control-Request-Method": "POST",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "https://handa-admin-web.vercel.app")
        self.assertEqual(response.headers.get("strict-transport-security"), "max-age=31536000")

    def test_dispatch_post_allows_the_admin_origin(self):
        def unavailable_connection():
            raise RuntimeError("Simulated database failure")

        app.dependency_overrides[get_connection] = unavailable_connection
        try:
            response = self.client.post(
                "/api/v1/incidents/incident-1/dispatch",
                json={"responderIds": ["responder-1"]},
                headers={"Origin": "https://handa-admin-web.vercel.app"},
            )
        finally:
            app.dependency_overrides.pop(get_connection, None)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "https://handa-admin-web.vercel.app")

    def test_cors_and_hsts_are_present_on_unhandled_api_errors(self):
        test_app = FastAPI()

        @test_app.get("/failure")
        def fail():
            raise RuntimeError("Simulated internal failure")

        wrapped_app = SecurityHeadersMiddleware(
            CORSMiddleware(
                app=test_app,
                allow_origins=["https://handa-admin-web.vercel.app"],
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )
        )
        client = TestClient(wrapped_app, raise_server_exceptions=False)
        response = client.get("/failure", headers={"Origin": "https://handa-admin-web.vercel.app"})

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "https://handa-admin-web.vercel.app")
        self.assertEqual(response.headers.get("strict-transport-security"), "max-age=31536000")


if __name__ == "__main__":
    unittest.main()
