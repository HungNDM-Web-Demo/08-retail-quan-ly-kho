-- Chạy một lần khi Postgres khởi tạo dữ liệu lần đầu (docker-entrypoint-initdb.d), trong DB POSTGRES_DB.
-- unaccent: tìm kiếm không dấu tiếng Việt (ILIKE unaccent(...)). Là extension "trusted" nên chủ DB tạo được.
CREATE EXTENSION IF NOT EXISTS unaccent;
