export interface SalesInvoiceItemDto {
  id?: string;
  salesInvoiceId?: string;
  productId: string;
  productName?: string;
  productCode?: string;
  productVariantId?: string;
  variantName?: string;
  productBatchId?: string;
  batchNumber?: string;
  expiryDate?: string;
  qty: number;
  rate: number;
  taxPercentage?: number;
  taxAmount?: number;
  discountPercentage?: number;
  discountAmount?: number;
  amount?: number;
  unitId?: string;
  unitName?: string;
  unitSymbol?: string;
  conversionFactor?: number;
  isGstInclusive?: boolean;
  taxableAmount?: number;
}
