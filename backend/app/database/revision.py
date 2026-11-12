"""The Alembic revision this build of the application requires.

A constant (not read from migrations/ at runtime) so the readiness check works even where the
migration scripts are not deployed. ``tests/test_ready.py`` asserts it equals the Alembic head,
so adding a migration without updating it fails the test suite.
"""

EXPECTED_REVISION = "v3_0001"
