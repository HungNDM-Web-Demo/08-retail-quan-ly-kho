using API.Configuration;
using API.Middlewares;
using Application;
using Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Cấu hình và bí mật lấy từ src/API/.env (xem .env.example). Không có file .env (chạy trong Docker) thì
// chỉ dùng biến môi trường; biến môi trường luôn được ưu tiên hơn .env.
EnvLoader.Load(builder);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApiPresentation(builder.Configuration);

var app = builder.Build();

// Tạo bảng hoặc chạy migration, đồng bộ dữ liệu nền, nạp dữ liệu mẫu khi DEMO_MODE=true và DB trống.
await app.Services.InitializeDatabaseAsync();

// Sau reverse proxy (BEHIND_PROXY=true): lấy IP khách và scheme từ X-Forwarded-*. Đặt trước mọi middleware khác.
app.UseReverseProxySupport();
app.UseMiddleware<ExceptionMiddleware>();
app.UseStatusCodePages();
app.UseSwaggerDocumentation();
app.UseCors(CorsSetup.PolicyName);
app.UseUploadsStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

await app.RunAsync();
