namespace Infrastructure.Options;

/// <summary>Cấu hình DB, nạp từ <c>DB_PROVIDER</c>, <c>CONNECTION_STRING</c> trong .env.</summary>
public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public DatabaseProvider Provider { get; set; } = DatabaseProvider.Postgres;

    public string ConnectionString { get; set; } = string.Empty;
}
