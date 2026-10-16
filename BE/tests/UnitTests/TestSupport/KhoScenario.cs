using Application.Common.Exceptions;
using Application.DTOs.Inventory;
using Application.Interfaces.Services.Inventory;
using Domain.Common;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Warehouses;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.TestSupport;

/// <summary>Thao tác dùng lại trong test kho: tra Id theo mã, đọc dòng tồn, gọi service như một request.</summary>
public sealed class KhoScenario(KhoTestHost host)
{
    public KhoTestHost Host => host;

    public Task<Guid> Warehouse(string code) =>
        host.QueryAsync<Warehouse, Guid>(q => q.Where(w => w.Code == code).Select(w => w.Id).SingleAsync());

    public Task<Guid> Product(string code) =>
        host.QueryAsync<Product, Guid>(q => q.Where(p => p.Code == code).Select(p => p.Id).SingleAsync());

    public Task<Guid> Unit(string productCode, int factor) =>
        host.QueryAsync<Product, Guid>(q => q.Where(p => p.Code == productCode).SelectMany(p => p.Units).Where(u => u.Factor == factor).Select(u => u.Id).SingleAsync());

    public Task<Guid> Supplier(string code) =>
        host.QueryAsync<Domain.Entities.Inventory.Suppliers.Supplier, Guid>(q => q.Where(s => s.Code == code).Select(s => s.Id).SingleAsync());

    public async Task<StockLevel> Level(string warehouse, string product)
    {
        var w = await Warehouse(warehouse);
        var p = await Product(product);
        return await host.QueryAsync<StockLevel, StockLevel>(q => q.SingleAsync(l => l.WarehouseId == w && l.ProductId == p));
    }

    public Task<T> As<TService, T>(string username, Func<TService, Task<T>> action)
        where TService : notnull =>
        SignedIn(username, () => host.CallAsync(action));

    private async Task<T> SignedIn<T>(string username, Func<Task<T>> action)
    {
        await host.SignInAsync(username);
        return await action();
    }

    public static string Rid() => Guid.NewGuid().ToString();

    public static DocActionRequest Act(int version) => new() { Version = version, ClientRequestId = Rid() };

    public async Task<GoodsReceiptDto> CreateReceiptAsync(string user, string warehouse, string supplier, bool submit, decimal freight,
        params (string Product, int Factor, int Quantity, decimal Price)[] lines)
    {
        var request = new SaveGoodsReceiptRequest
        {
            WarehouseId = await Warehouse(warehouse),
            Type = Domain.Enums.Inventory.ReceiptType.MuaHang,
            SupplierId = await Supplier(supplier),
            SourceDocNo = "0001234",
            SourceDocDate = DateOnly.FromDateTime(KhoTestHost.Start.UtcDateTime),
            FreightCost = freight,
            Submit = submit,
            ClientRequestId = Rid()
        };
        foreach (var (product, factor, quantity, price) in lines)
        {
            request.Lines.Add(new ReceiptLineInput
            {
                ProductId = await Product(product),
                UnitId = factor == 1 ? null : await Unit(product, factor),
                Quantity = quantity,
                UnitPrice = price
            });
        }

        var result = await As<IGoodsReceiptService, CreateResult<GoodsReceiptDto>>(user, s => s.CreateAsync(request));
        return result.Value;
    }

    public async Task<GoodsIssueDto> CreateIssueAsync(string user, string warehouse, bool submit,
        params (string Product, int Factor, int Quantity)[] lines)
    {
        var request = new SaveGoodsIssueRequest
        {
            WarehouseId = await Warehouse(warehouse),
            Type = Domain.Enums.Inventory.IssueType.XuatBan,
            RecipientName = "Đại lý Tạp hóa Thanh Hương",
            Submit = submit,
            ClientRequestId = Rid()
        };
        foreach (var (product, factor, quantity) in lines)
            request.Lines.Add(await LineAsync(product, factor, quantity));

        return (await As<IGoodsIssueService, CreateResult<GoodsIssueDto>>(user, s => s.CreateAsync(request))).Value;
    }

    public async Task<TransferDto> CreateTransferAsync(string user, string from, string to, bool submit,
        params (string Product, int Factor, int Quantity)[] lines)
    {
        var request = new SaveTransferRequest
        {
            FromWarehouseId = await Warehouse(from),
            ToWarehouseId = await Warehouse(to),
            Submit = submit,
            ClientRequestId = Rid()
        };
        foreach (var (product, factor, quantity) in lines)
            request.Lines.Add(await LineAsync(product, factor, quantity));

        return (await As<ITransferService, CreateResult<TransferDto>>(user, s => s.CreateAsync(request))).Value;
    }

    public async Task<DocLineInput> LineAsync(string product, int factor, int quantity) => new()
    {
        ProductId = await Product(product),
        UnitId = factor == 1 ? null : await Unit(product, factor),
        Quantity = quantity
    };

    public static async Task<string?> CodeOf(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (DomainException ex)
        {
            return ex.Extensions.GetValueOrDefault("code") as string;
        }
        catch (ConflictException ex)
        {
            return ex.Extensions.GetValueOrDefault("code") as string ?? "409";
        }
        catch (CodedForbiddenException ex)
        {
            return ex.Code;
        }
        catch (ValidationException)
        {
            return "400";
        }

        return null;
    }
}
