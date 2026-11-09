-- Runs once, when the local data volume is first created.
-- A separate database keeps integration tests from touching development data.
CREATE DATABASE portfolio_test OWNER portfolio;
