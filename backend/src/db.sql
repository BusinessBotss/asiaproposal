CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'es'
);

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  restaurants TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS command_logs (
  id UUID PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  target TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);