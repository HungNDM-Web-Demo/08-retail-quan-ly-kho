/**
 * Hằng số nghiệp vụ (06 §3 "InventoryRules"; BE `Domain/Entities/Inventory/InventoryRules.cs` cùng giá trị).
 */
export const inventoryRules = {
  /** Tối đa dòng mỗi phiếu (BR-07, NFR-02) */
  maxLines: 200,
  /** Hệ số quy đổi 2–10.000 (BR-01) */
  minFactor: 2,
  maxFactor: 10_000,
  /** Tối đa 2 đơn vị quy đổi (FR-07) */
  maxUnits: 2,
  /** Phiếu chuyển "Trễ" khi đang chuyển quá 3 ngày (BR-13) */
  lateTransferDays: 3,
  /** Lý do từ chối tối thiểu 10 ký tự (BR-06) */
  minRejectReason: 10,
  /** Dòng kiểm kê bắt buộc nguyên nhân khi |giá trị chênh| từ 1.000.000 ₫ … (BR-16) */
  varianceValueThreshold: 1_000_000,
  /** … hoặc chênh từ 5% sổ sách (BR-16) */
  variancePercentThreshold: 5,
  /** Khoảng ngày tối đa 366 ngày (UC-09 E2, UC-13 E1) */
  maxRangeDays: 366,
} as const
