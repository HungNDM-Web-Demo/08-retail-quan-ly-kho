namespace Infrastructure.Options;

public enum DatabaseProvider
{
    /// <summary>PostgreSQL (mặc định cho máy dev và server), tạo bảng bằng migration trong Infrastructure/Migrations.</summary>
    Postgres,

    /// <summary>SQL Server (chỉ khi khách yêu cầu), tạo bảng bằng EnsureCreated (không dùng migration).</summary>
    SqlServer,

    /// <summary>SQLite cho demo mang đi, tạo bảng bằng EnsureCreated (không dùng migration).</summary>
    Sqlite
}
