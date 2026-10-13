namespace Application.Common.Models;

/// <summary>Access token JWT đã ký và thời điểm hết hạn (UTC).</summary>
public sealed record AccessTokenResult(string Token, DateTime ExpiresAt);
