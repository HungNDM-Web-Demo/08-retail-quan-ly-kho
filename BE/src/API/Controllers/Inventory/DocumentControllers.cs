using API.Filters;
using Application.Common.Models;
using Application.DTOs.Inventory;
using Application.Interfaces.Services.Inventory;
using Microsoft.AspNetCore.Mvc;
using P = Application.Constants.ProjectPermissions;

namespace API.Controllers.Inventory;

/// <summary>Phiếu nhập (07 §2.4).</summary>
[Route("api/goods-receipts")]
public sealed class GoodsReceiptsController(IGoodsReceiptService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.GoodsReceipts.View)]
    public Task<PaginatedResult<GoodsReceiptListItem>> GetPaged([FromQuery] GoodsReceiptQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.GoodsReceipts.View)]
    public Task<GoodsReceiptDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.GoodsReceipts.Create)]
    public async Task<IActionResult> Create(SaveGoodsReceiptRequest request, CancellationToken ct) => CreatedOrOk(await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.GoodsReceipts.Update)]
    public Task<GoodsReceiptDto> Update(Guid id, SaveGoodsReceiptRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/submit")]
    [AuthorizePermission(P.GoodsReceipts.Update)]
    public Task<GoodsReceiptDto> Submit(Guid id, DocActionRequest request, CancellationToken ct) => service.SubmitAsync(id, request, ct);

    [HttpPatch("{id:guid}/withdraw")]
    [AuthorizePermission(P.GoodsReceipts.Update)]
    public Task<GoodsReceiptDto> Withdraw(Guid id, DocActionRequest request, CancellationToken ct) => service.WithdrawAsync(id, request, ct);

    [HttpPatch("{id:guid}/approve")]
    [AuthorizePermission(P.GoodsReceipts.Approve)]
    public Task<GoodsReceiptDto> Approve(Guid id, DocActionRequest request, CancellationToken ct) => service.ApproveAsync(id, request, ct);

    [HttpPatch("{id:guid}/reject")]
    [AuthorizePermission(P.GoodsReceipts.Approve)]
    public Task<GoodsReceiptDto> Reject(Guid id, RejectRequest request, CancellationToken ct) => service.RejectAsync(id, request, ct);

    [HttpPatch("{id:guid}/cancel")]
    [AuthorizePermission(P.GoodsReceipts.Delete)]
    public Task<GoodsReceiptDto> Cancel(Guid id, DocActionRequest request, CancellationToken ct) => service.CancelAsync(id, request, ct);

    /// <summary>Tạo phiếu ngược: phiếu xuất nháp loại Xuất điều chỉnh (BR-12).</summary>
    [HttpPost("{id:guid}/reverse")]
    [AuthorizePermission(P.GoodsReceipts.Reverse)]
    public async Task<IActionResult> Reverse(Guid id, DocActionRequest request, [FromServices] IGoodsIssueService issues, CancellationToken ct)
    {
        var result = await service.ReverseAsync(id, request, ct);
        return CreatedOrOk(new CreateResult<GoodsIssueDto>(await issues.GetAsync(result.Value, ct), result.Created));
    }
}

/// <summary>Phiếu xuất (07 §2.5).</summary>
[Route("api/goods-issues")]
public sealed class GoodsIssuesController(IGoodsIssueService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.GoodsIssues.View)]
    public Task<PaginatedResult<GoodsIssueListItem>> GetPaged([FromQuery] GoodsIssueQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.GoodsIssues.View)]
    public Task<GoodsIssueDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.GoodsIssues.Create)]
    public async Task<IActionResult> Create(SaveGoodsIssueRequest request, CancellationToken ct) => CreatedOrOk(await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.GoodsIssues.Update)]
    public Task<GoodsIssueDto> Update(Guid id, SaveGoodsIssueRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/submit")]
    [AuthorizePermission(P.GoodsIssues.Update)]
    public Task<GoodsIssueDto> Submit(Guid id, DocActionRequest request, CancellationToken ct) => service.SubmitAsync(id, request, ct);

    [HttpPatch("{id:guid}/withdraw")]
    [AuthorizePermission(P.GoodsIssues.Update)]
    public Task<GoodsIssueDto> Withdraw(Guid id, DocActionRequest request, CancellationToken ct) => service.WithdrawAsync(id, request, ct);

    [HttpPatch("{id:guid}/approve")]
    [AuthorizePermission(P.GoodsIssues.Approve)]
    public Task<GoodsIssueDto> Approve(Guid id, DocActionRequest request, CancellationToken ct) => service.ApproveAsync(id, request, ct);

    [HttpPatch("{id:guid}/reject")]
    [AuthorizePermission(P.GoodsIssues.Approve)]
    public Task<GoodsIssueDto> Reject(Guid id, RejectRequest request, CancellationToken ct) => service.RejectAsync(id, request, ct);

    [HttpPatch("{id:guid}/cancel")]
    [AuthorizePermission(P.GoodsIssues.Delete)]
    public Task<GoodsIssueDto> Cancel(Guid id, DocActionRequest request, CancellationToken ct) => service.CancelAsync(id, request, ct);

    /// <summary>Tạo phiếu ngược: phiếu nhập nháp loại Nhập điều chỉnh (BR-12, TC-20).</summary>
    [HttpPost("{id:guid}/reverse")]
    [AuthorizePermission(P.GoodsIssues.Reverse)]
    public async Task<IActionResult> Reverse(Guid id, DocActionRequest request, [FromServices] IGoodsReceiptService receipts, CancellationToken ct)
    {
        var result = await service.ReverseAsync(id, request, ct);
        return CreatedOrOk(new CreateResult<GoodsReceiptDto>(await receipts.GetAsync(result.Value, ct), result.Created));
    }
}

/// <summary>Chuyển kho (07 §2.6).</summary>
[Route("api/transfers")]
public sealed class TransfersController(ITransferService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Transfers.View)]
    public Task<PaginatedResult<TransferListItem>> GetPaged([FromQuery] TransferQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Transfers.View)]
    public Task<TransferDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.Transfers.Create)]
    public async Task<IActionResult> Create(SaveTransferRequest request, CancellationToken ct) => CreatedOrOk(await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Transfers.Update)]
    public Task<TransferDto> Update(Guid id, SaveTransferRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/submit")]
    [AuthorizePermission(P.Transfers.Update)]
    public Task<TransferDto> Submit(Guid id, DocActionRequest request, CancellationToken ct) => service.SubmitAsync(id, request, ct);

    [HttpPatch("{id:guid}/withdraw")]
    [AuthorizePermission(P.Transfers.Update)]
    public Task<TransferDto> Withdraw(Guid id, DocActionRequest request, CancellationToken ct) => service.WithdrawAsync(id, request, ct);

    [HttpPatch("{id:guid}/approve")]
    [AuthorizePermission(P.Transfers.Approve)]
    public Task<TransferDto> Approve(Guid id, DocActionRequest request, CancellationToken ct) => service.ApproveAsync(id, request, ct);

    [HttpPatch("{id:guid}/reject")]
    [AuthorizePermission(P.Transfers.Approve)]
    public Task<TransferDto> Reject(Guid id, RejectRequest request, CancellationToken ct) => service.RejectAsync(id, request, ct);

    [HttpPatch("{id:guid}/cancel")]
    [AuthorizePermission(P.Transfers.Delete)]
    public Task<TransferDto> Cancel(Guid id, DocActionRequest request, CancellationToken ct) => service.CancelAsync(id, request, ct);

    [HttpPatch("{id:guid}/receive")]
    [AuthorizePermission(P.Transfers.Receive)]
    public Task<TransferDto> Receive(Guid id, ReceiveTransferRequest request, CancellationToken ct) => service.ReceiveAsync(id, request, ct);
}

/// <summary>Phiếu chờ duyệt (07 §2.7).</summary>
[Route("api/approvals")]
public sealed class ApprovalsController(IApprovalService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.GoodsReceipts.Approve, P.GoodsIssues.Approve, P.Transfers.Approve, P.Stocktakes.Approve)]
    public Task<IReadOnlyList<ApprovalItem>> GetPending([FromQuery] ApprovalQuery query, CancellationToken ct) => service.GetPendingAsync(query, ct);
}

/// <summary>Kiểm kê (07 §2.9).</summary>
[Route("api/stocktakes")]
public sealed class StocktakesController(IStocktakeService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Stocktakes.View)]
    public Task<PaginatedResult<StocktakeListItem>> GetPaged([FromQuery] StocktakeQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Stocktakes.View)]
    public Task<StocktakeDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.Stocktakes.Create)]
    public async Task<IActionResult> Create(CreateStocktakeRequest request, CancellationToken ct) => CreatedOrOk(await service.CreateAsync(request, ct));

    [HttpPost("{id:guid}/counts")]
    [AuthorizePermission(P.Stocktakes.Count)]
    public Task<StocktakeDto> SubmitCounts(Guid id, SubmitCountsRequest request, CancellationToken ct) => service.SubmitCountsAsync(id, request, ct);

    [HttpPatch("{id:guid}/fill-uncounted")]
    [AuthorizePermission(P.Stocktakes.Count)]
    public Task<StocktakeDto> FillUncounted(Guid id, DocActionRequest request, CancellationToken ct) => service.FillUncountedAsync(id, request, ct);

    [HttpPatch("{id:guid}/submit")]
    [AuthorizePermission(P.Stocktakes.Count)]
    public Task<StocktakeDto> Submit(Guid id, SubmitStocktakeRequest request, CancellationToken ct) => service.SubmitAsync(id, request, ct);

    [HttpPatch("{id:guid}/approve")]
    [AuthorizePermission(P.Stocktakes.Approve)]
    public Task<StocktakeDto> Approve(Guid id, DocActionRequest request, CancellationToken ct) => service.ApproveAsync(id, request, ct);

    [HttpPatch("{id:guid}/return")]
    [AuthorizePermission(P.Stocktakes.Approve)]
    public Task<StocktakeDto> Return(Guid id, ReturnStocktakeRequest request, CancellationToken ct) => service.ReturnAsync(id, request, ct);

    [HttpPatch("{id:guid}/cancel")]
    [AuthorizePermission(P.Stocktakes.Cancel)]
    public Task<StocktakeDto> Cancel(Guid id, DocActionRequest request, CancellationToken ct) => service.CancelAsync(id, request, ct);
}
