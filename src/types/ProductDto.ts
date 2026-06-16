export interface ProductDto {
  id?: string;
  companyId: string;
  branchId: string;
  productCode: string;
  sku?: string;
  barcode?: string;
  name: string;
  shortName?: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  manufacturerId?: string;
  hsnCodeId?: string;
  taxProfileId?: string;
  productType?: number; // 1 = Goods, 2 = Service
  trackInventory?: boolean;
  trackBatch?: boolean;
  trackExpiry?: boolean;
  trackSerial?: boolean;
  minStock?: number;
  reorderLevel?: number;
  purchaseRate?: number;
  salesRate?: number;
  mrp?: number;
  isActive: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  isGstInclusive?: boolean;

  // UI Helper fields if returned (handled safely)
  categoryName?: string;
  brandName?: string;
  manufacturerName?: string;
  hsnCodeName?: string;
  taxProfileName?: string;
  unitId?: string;
  unitName?: string;
  alternativeUnits?: ProductUnitConversionDto[];
}

export interface ProductUnitConversionDto {
  id?: string;
  productId?: string;
  alternativeUnitId: string;
  alternativeUnitName?: string;
  alternativeUnitSymbol?: string;
  baseUnitId: string;
  baseUnitName?: string;
  baseUnitSymbol?: string;
  conversionFactor: number;
  salesRate?: number;
  purchaseRate?: number;
  mrp?: number;
}
