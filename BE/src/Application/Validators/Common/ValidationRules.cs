using System.Text.RegularExpressions;
using Domain.Entities.System.Users;
using FluentValidation;

namespace Application.Validators.Common;

/// <summary>Quy tắc kiểm tra dùng lại ở nhiều validator.</summary>
public static partial class ValidationRules
{
    public const int PasswordMinLength = 8;
    public const int PasswordMaxLength = 100;

    /// <summary>BR-SYS-01: tên đăng nhập 3–50 ký tự, chữ thường không dấu, số, dấu chấm, gạch dưới.</summary>
    public static IRuleBuilderOptions<T, string> ValidUsername<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Tên đăng nhập không được để trống.")
            .Length(User.UsernameMinLength, User.UsernameMaxLength)
            .WithMessage($"Tên đăng nhập dài từ {User.UsernameMinLength} đến {User.UsernameMaxLength} ký tự.")
            .Matches(UsernameRegex())
            .WithMessage("Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm (.) và gạch dưới (_).");

    /// <summary>BR-SYS-02: mật khẩu tối thiểu 8 ký tự, có chữ và số.</summary>
    public static IRuleBuilderOptions<T, string> ValidPassword<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Mật khẩu không được để trống.")
            .MinimumLength(PasswordMinLength).WithMessage($"Mật khẩu tối thiểu {PasswordMinLength} ký tự.")
            .MaximumLength(PasswordMaxLength).WithMessage($"Mật khẩu tối đa {PasswordMaxLength} ký tự.")
            .Matches(LetterRegex()).WithMessage("Mật khẩu phải có cả chữ và số.")
            .Matches(DigitRegex()).WithMessage("Mật khẩu phải có cả chữ và số.");

    public static IRuleBuilderOptions<T, string> ValidFullName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Họ tên không được để trống.")
            .MaximumLength(User.FullNameMaxLength).WithMessage($"Họ tên tối đa {User.FullNameMaxLength} ký tự.");

    /// <summary>Email không bắt buộc; có nhập thì phải đúng định dạng.</summary>
    public static IRuleBuilderOptions<T, string?> OptionalEmail<T>(this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(User.EmailMaxLength).WithMessage($"Email tối đa {User.EmailMaxLength} ký tự.")
            .Must(v => string.IsNullOrWhiteSpace(v) || EmailRegex().IsMatch(v.Trim()))
            .WithMessage("Email không đúng định dạng.");

    /// <summary>Số điện thoại không bắt buộc; có nhập thì gồm số, cho phép khoảng trắng, dấu chấm, gạch ngang.</summary>
    public static IRuleBuilderOptions<T, string?> OptionalPhone<T>(this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(User.PhoneMaxLength).WithMessage($"Số điện thoại tối đa {User.PhoneMaxLength} ký tự.")
            .Must(v => string.IsNullOrWhiteSpace(v) || PhoneRegex().IsMatch(v.Trim()))
            .WithMessage("Số điện thoại không đúng định dạng, vd 0909 123 456.");

    [GeneratedRegex("^[a-z0-9._]+$")]
    private static partial Regex UsernameRegex();

    [GeneratedRegex(@"\p{L}")]
    private static partial Regex LetterRegex();

    [GeneratedRegex(@"\d")]
    private static partial Regex DigitRegex();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"^\+?\d[\d .\-]{7,17}\d$")]
    private static partial Regex PhoneRegex();
}
