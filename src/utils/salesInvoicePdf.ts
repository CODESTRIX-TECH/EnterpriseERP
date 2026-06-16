import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SalesInvoiceDto } from '@/types/SalesInvoiceDto';

export interface CompanyDetails {
  name?: string;
  legalName?: string;
  gstNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export const generateThermalReceipt = (
  invoice: SalesInvoiceDto,
  company?: CompanyDetails,
  action: 'open' | 'return' = 'open'
) => {
  // 1. Calculate dynamic height
  const headerHeight = 25 + (company?.address ? 8 : 0) + (company?.phone || company?.email ? 4 : 0) + (company?.gstNumber ? 4 : 0);
  const detailsHeight = 25; // Invoice No, Date, Customer, Warehouse
  const itemsHeight = (invoice.items || []).reduce((sum, item) => {
    let h = 6; // product name
    const subDetailsPresent = !!(item.variantName || item.batchNumber || item.taxPercentage || item.discountPercentage || item.taxableAmount);
    if (subDetailsPresent) h += 6.5; // average height for 2 sub-lines
    return sum + h + 2.5; // + spacing
  }, 10); // + header
  const totalsHeight = 15 + (invoice.discountAmount > 0 ? 4 : 0) + 4 + (invoice.taxAmount > 0 ? 4 : 0) + 12; // Net, Paid, Due, plus Taxable Value
  const paymentHistoryHeight = (invoice.paymentDetails || []).length * 4 + (invoice.paymentDetails?.length ? 6 : 0);
  const remarksHeight = invoice.remarks ? 10 : 0;
  const footerHeight = 20;

  const calculatedHeight = headerHeight + detailsHeight + itemsHeight + totalsHeight + paymentHistoryHeight + remarksHeight + footerHeight;

  // 2. Initialize doc with 80mm width and calculatedHeight
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, calculatedHeight]
  });

  const margin = 5;
  const contentWidth = 70; // 80 - 2 * margin
  let y = 8;

  // Helper for drawing lines
  const drawSolidLine = (yPos: number, width = 0.2) => {
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(width);
    doc.line(margin, yPos, margin + contentWidth, yPos);
  };

  const drawDottedLine = (yPos: number) => {
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, yPos, margin + contentWidth, yPos);
    doc.setLineDashPattern([], 0); // reset
  };

  const getPaymentModeLabel = (mode: number) => {
    switch (mode) {
      case 1: return 'Cash';
      case 2: return 'Bank Transfer';
      case 3: return 'Card';
      case 4: return 'UPI';
      case 5: return 'Cheque';
      default: return 'Other';
    }
  };

  // ==========================================
  // HEADER SECTION (Centered)
  // ==========================================
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text(company?.legalName || company?.name || 'Enterprise ERP System', 40, y, { align: 'center' });
  y += 4.5;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);

  if (company?.address) {
    const addressLines = doc.splitTextToSize(company.address, contentWidth);
    addressLines.forEach((line: string) => {
      doc.text(line, 40, y, { align: 'center' });
      y += 3.5;
    });
  }

  if (company?.phone || company?.email) {
    const contactInfo = [
      company.phone ? `Ph: ${company.phone}` : null,
      company.email ? `Email: ${company.email}` : null
    ].filter(Boolean).join(' | ');
    doc.text(contactInfo, 40, y, { align: 'center' });
    y += 3.5;
  }

  if (company?.gstNumber) {
    doc.text(`GSTIN: ${company.gstNumber}`, 40, y, { align: 'center' });
    y += 3.5;
  }

  y += 1;
  drawSolidLine(y, 0.3);
  y += 4;

  // ==========================================
  // INVOICE DETAILS
  // ==========================================
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 41, 55);
  doc.text('TAX INVOICE / RECEIPT', margin, y);
  y += 4;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Inv No : ${invoice.invoiceNo}`, margin, y);
  y += 3.5;

  const invoiceDateFormatted = invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
  doc.text(`Date   : ${invoiceDateFormatted}`, margin, y);
  y += 3.5;

  doc.text(`Cust   : ${invoice.customerName || 'Walk-in Customer'}`, margin, y);
  y += 3.5;

  if (invoice.warehouseName) {
    doc.text(`Loc    : ${invoice.warehouseName}`, margin, y);
    y += 3.5;
  }

  y += 1;
  drawSolidLine(y, 0.3);
  y += 4;

  // ==========================================
  // ITEMS TABLE HEADERS
  // ==========================================
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Item Description', margin, y);
  doc.text('Qty', 43, y, { align: 'center' });
  doc.text('Rate', 58, y, { align: 'right' });
  doc.text('Amt', 75, y, { align: 'right' });
  y += 2.5;
  drawSolidLine(y, 0.15);
  y += 4.5;

  // ==========================================
  // ITEMS LIST
  // ==========================================
  (invoice.items || []).forEach((item, index) => {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(31, 41, 55);

    // Render product name (wrapped within 36mm width)
    const nameLines = doc.splitTextToSize(`${index + 1}. ${item.productName}`, 36);
    nameLines.forEach((line: string, lineIdx: number) => {
      doc.text(line, margin, y + (lineIdx * 3.2));
    });

    // Qty, Rate, Amount aligned on the first line
    doc.setFont('Helvetica', 'normal');
    doc.text(item.qty.toString(), 43, y, { align: 'center' });
    doc.text(`Rs. ${item.rate.toFixed(2)}`, 58, y, { align: 'right' });
    doc.text(`Rs. ${(item.amount || 0).toFixed(2)}`, 75, y, { align: 'right' });

    y += nameLines.length * 3.2;

    // Sub-details (Variant, Batch, GST, Discount, Taxable)
    const subDetails = [
      item.variantName ? `Var: ${item.variantName}` : null,
      item.batchNumber ? `Batch: ${item.batchNumber}` : null,
      item.taxPercentage ? `GST: ${item.taxPercentage}% (Rs. ${(item.taxAmount || 0).toFixed(2)})` : null,
      item.discountPercentage ? `Disc: ${item.discountPercentage}%` : null,
      item.taxableAmount ? `Taxable: Rs. ${(item.taxableAmount || 0).toFixed(2)}` : null
    ].filter(Boolean).join(' | ');

    if (subDetails) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(110, 110, 110);
      const subLines = doc.splitTextToSize(subDetails, 68);
      subLines.forEach((line: string) => {
        doc.text(line, margin + 2, y);
        y += 2.8;
      });
    }

    y += 1.5; // spacing between items
  });

  y += 1;
  drawDottedLine(y);
  y += 4.5;

  // ==========================================
  // TOTALS SECTION
  // ==========================================
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);

  const drawTotalRow = (label: string, value: string, isBold = false) => {
    if (isBold) {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
    } else {
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
    }
    doc.text(label, 48, y, { align: 'right' });
    doc.text(value, 75, y, { align: 'right' });
    y += 3.8;
  };

  const totalTaxable = (invoice.items || []).reduce((sum, item) => sum + (item.taxableAmount || 0), 0);

  drawTotalRow('SubTotal:', `Rs. ${invoice.subTotal.toFixed(2)}`);
  if (invoice.discountAmount > 0) {
    drawTotalRow('Discount:', `-Rs. ${invoice.discountAmount.toFixed(2)}`);
  }
  drawTotalRow('Taxable Value:', `Rs. ${totalTaxable.toFixed(2)}`);
  if (invoice.taxAmount > 0) {
    drawTotalRow('Tax (GST):', `+Rs. ${invoice.taxAmount.toFixed(2)}`);
  }
  drawTotalRow('Net Total:', `Rs. ${invoice.netAmount.toFixed(2)}`, true);
  drawTotalRow('Paid Upfront:', `Rs. ${(invoice.paidAmount || 0).toFixed(2)}`);
  const balanceDue = Math.max(0, invoice.netAmount - (invoice.paidAmount || 0));
  drawTotalRow('Balance Due:', `Rs. ${balanceDue.toFixed(2)}`, true);

  // ==========================================
  // PAYMENT LOG SPLITS
  // ==========================================
  if (invoice.paymentDetails && invoice.paymentDetails.length > 0) {
    y += 2;
    drawDottedLine(y);
    y += 4;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(31, 41, 55);
    doc.text('Payment Splits:', margin, y);
    y += 3.2;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    invoice.paymentDetails.forEach(pay => {
      const modeLabel = getPaymentModeLabel(pay.paymentMode);
      const dateStr = pay.createdAt ? new Date(pay.createdAt).toLocaleDateString() : '';
      doc.text(`${modeLabel} (${dateStr})`, margin + 2, y);
      doc.text(`Rs. ${pay.paidAmount.toFixed(2)}`, 75, y, { align: 'right' });
      y += 3.2;
    });
  }

  // ==========================================
  // REMARKS
  // ==========================================
  if (invoice.remarks) {
    y += 2;
    drawDottedLine(y);
    y += 4;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    const remarkLines = doc.splitTextToSize(`Remarks: ${invoice.remarks}`, 70);
    remarkLines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 3.2;
    });
  }

  // ==========================================
  // FOOTER (Centered)
  // ==========================================
  y += 5;
  drawDottedLine(y);
  y += 4.5;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 41, 55);
  doc.text('Thank You for Your Business!', 40, y, { align: 'center' });
  y += 3.8;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(110, 110, 110);
  doc.text('Software Powered by Enterprise ERP', 40, y, { align: 'center' });

  if (action === 'return') {
    return doc;
  }

  // Open PDF in a new tab
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow) {
      doc.save(`Receipt-${invoice.invoiceNo}.pdf`);
    }
  } catch (e) {
    console.error('Failed to open receipt PDF in new tab, downloading instead', e);
    doc.save(`Receipt-${invoice.invoiceNo}.pdf`);
  }

  return doc;
};

export const generateSalesInvoicePdf = (
  invoice: SalesInvoiceDto,
  company?: CompanyDetails,
  action: 'open' | 'return' = 'open',
  format: 'a4' | 'thermal' = 'a4'
) => {
  if (format === 'thermal') {
    return generateThermalReceipt(invoice, company, action);
  }

  // A4 size: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [139, 92, 246]; // Violet hex #8b5cf6 (Sales theme)
  const darkTextColor = [31, 41, 55]; // Charcoal #1f2937
  const grayTextColor = [107, 114, 128]; // Gray #6b7280

  // Helper for text formatting
  const setDarkText = () => doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  const setGrayText = () => doc.setTextColor(grayTextColor[0], grayTextColor[1], grayTextColor[2]);
  const setPrimaryText = () => doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

  let y = 15;

  // ==========================================
  // HEADER SECTION
  // ==========================================

  // Company Information (Left side)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  setPrimaryText();
  doc.text(company?.legalName || company?.name || 'Enterprise ERP System', 15, y);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  setGrayText();
  y += 5;
  if (company?.address) {
    const addressLines = doc.splitTextToSize(company.address, 95);
    addressLines.forEach((line: string) => {
      doc.text(line, 15, y);
      y += 4;
    });
  }
  if (company?.gstNumber) {
    doc.text(`GSTIN: ${company.gstNumber}`, 15, y);
    y += 4;
  }
  if (company?.phone || company?.email) {
    const contactInfo = [
      company.phone ? `Phone: ${company.phone}` : null,
      company.email ? `Email: ${company.email}` : null
    ].filter(Boolean).join(' | ');
    doc.text(contactInfo, 15, y);
  }

  // Reset y for right-aligned invoice details
  let rightY = 15;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  setPrimaryText();
  doc.text('TAX INVOICE / RECEIPT', 195, rightY, { align: 'right' });

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  setDarkText();
  rightY += 8;
  doc.text(`Invoice No: ${invoice.invoiceNo}`, 195, rightY, { align: 'right' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  setGrayText();
  rightY += 5;
  const invoiceDateFormatted = invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
  doc.text(`Invoice Date: ${invoiceDateFormatted}`, 195, rightY, { align: 'right' });

  rightY += 5;
  const getStatusString = (status?: number) => {
    switch (status) {
      case 1: return 'DRAFT';
      case 2: return 'POSTED';
      case 3: return 'CANCELLED';
      case 4: return 'PARTIALLY PAID';
      case 5: return 'RETURNED';
      case 6: return 'PARTIALLY RETURNED';
      default: return 'UNKNOWN';
    }
  };
  doc.text(`Status: ${getStatusString(invoice.status)}`, 195, rightY, { align: 'right' });

  // Draw separator line below header
  y = Math.max(y, rightY) + 8;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(15, y, 195, y);
  y += 8;

  // ==========================================
  // CUSTOMER & WAREHOUSE SECTION (2 Columns)
  // ==========================================
  const col1X = 15;
  const col2X = 110;

  // Column 1: Customer
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  setPrimaryText();
  doc.text('BILLED TO (CUSTOMER)', col1X, y);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  setDarkText();
  doc.text(invoice.customerName || '—', col1X, y + 5);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  setGrayText();
  doc.text('Valued Enterprise Client', col1X, y + 9);

  // Column 2: Dispatch From (Warehouse)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  setPrimaryText();
  doc.text('DISPATCH FROM (WAREHOUSE)', col2X, y);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  setDarkText();
  doc.text(invoice.warehouseName || '—', col2X, y + 5);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  setGrayText();
  doc.text('Fulfillment Location', col2X, y + 9);

  y += 18;

  // ==========================================
  // ITEMS TABLE SECTION
  // ==========================================
  const tableHeaders = [['Sr.', 'Code', 'Product Description', 'Qty', 'Rate', 'Taxable Val', 'GST %', 'GST Amt', 'Disc', 'Amount']];
  
  const tableRows = (invoice.items || []).map((item, index) => {
    const descText = [
      item.productName || '—',
      item.variantName ? `Variant: ${item.variantName}` : null,
      item.batchNumber ? `Batch: ${item.batchNumber}` : null
    ].filter(Boolean).join(' | ');

    return [
      (index + 1).toString(),
      item.productCode || '—',
      descText,
      item.qty.toString(),
      `Rs. ${item.rate.toFixed(2)}`,
      `Rs. ${(item.taxableAmount || 0).toFixed(2)}`,
      `${item.taxPercentage || 0}%`,
      `Rs. ${(item.taxAmount || 0).toFixed(2)}`,
      `${item.discountPercentage || 0}%`,
      `Rs. ${(item.amount || 0).toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHeaders,
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [139, 92, 246] as any, // Violet
      textColor: [255, 255, 255] as any,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 15 },
      2: { cellWidth: 42 },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 18, halign: 'right' },
      8: { cellWidth: 12, halign: 'center' },
      9: { cellWidth: 25, halign: 'right' }
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: darkTextColor as any,
    },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      y = data.cursor?.y || y;
    }
  });

  y += 8;

  // ==========================================
  // TOTALS SECTION (Structured Grid Table)
  // ==========================================
  const balanceDueA4 = Math.max(0, invoice.netAmount - (invoice.paidAmount || 0));
  const totalTaxableA4 = (invoice.items || []).reduce((sum, item) => sum + (item.taxableAmount || 0), 0);

  const totalsBody = [
    [
      { content: 'Subtotal:', styles: { halign: 'right' } },
      { content: `Rs. ${invoice.subTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
    ],
    [
      { content: 'Discount:', styles: { halign: 'right' } },
      { content: invoice.discountAmount > 0 ? `-Rs. ${invoice.discountAmount.toFixed(2)}` : 'Rs. 0.00', styles: { halign: 'right', fontStyle: 'bold', textColor: invoice.discountAmount > 0 ? [239, 68, 68] : darkTextColor } }
    ],
    [
      { content: 'Taxable Value:', styles: { halign: 'right' } },
      { content: `Rs. ${totalTaxableA4.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
    ],
    [
      { content: 'Tax (GST):', styles: { halign: 'right' } },
      { content: `+Rs. ${invoice.taxAmount.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
    ],
    [
      { content: 'Net Total:', styles: { halign: 'right', fontStyle: 'bold', fillColor: [243, 244, 246] } },
      { content: `Rs. ${invoice.netAmount.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: primaryColor as any, fillColor: [243, 244, 246] } }
    ],
    [
      { content: 'Paid Upfront:', styles: { halign: 'right' } },
      { content: `Rs. ${(invoice.paidAmount || 0).toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] } }
    ],
    [
      { content: 'Balance Due:', styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 242, 242] } },
      { content: `Rs. ${balanceDueA4.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: balanceDueA4 > 0 ? [239, 68, 68] : [16, 185, 129], fillColor: [254, 242, 242] } }
    ]
  ];

  autoTable(doc, {
    startY: y + 4,
    body: totalsBody as any,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      textColor: darkTextColor as any,
      lineColor: [229, 231, 235], // light gray border
      lineWidth: 0.15,
      cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'normal' },
      1: { cellWidth: 28, fontStyle: 'bold' }
    },
    margin: { left: 135, right: 15 },
    didDrawPage: (data) => {
      y = data.cursor?.y || y;
    }
  });

  y += 10;

  // ==========================================
  // PAYMENT DETAILS SECTION
  // ==========================================
  if (invoice.paymentDetails && invoice.paymentDetails.length > 0) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    setPrimaryText();
    doc.text('PAYMENT DETAILS HISTORY', 15, y);
    y += 5;

    const payHeaders = [['Payment Date', 'Payment Mode', 'Amount Paid']];
    const payRows = invoice.paymentDetails.map(pay => {
      const getMethodName = (mode: number) => {
        switch (mode) {
          case 1: return 'Cash';
          case 2: return 'Bank Transfer';
          case 3: return 'Card';
          case 4: return 'UPI';
          case 5: return 'Cheque';
          default: return 'Other';
        }
      };

      const dateStr = pay.createdAt ? new Date(pay.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
      return [
        dateStr,
        getMethodName(pay.paymentMode),
        `Rs. ${pay.paidAmount.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: y,
      head: payHeaders,
      body: payRows,
      theme: 'grid',
      headStyles: {
        fillColor: [243, 244, 246] as any,
        textColor: darkTextColor as any,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 55 },
        2: { cellWidth: 55, halign: 'right' }
      },
      bodyStyles: {
        fontSize: 8,
        textColor: darkTextColor as any,
      },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        y = data.cursor?.y || y;
      }
    });

    y += 12;
  }

  if (invoice.remarks) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    setGrayText();
    doc.text(`Remarks: ${invoice.remarks}`, 15, y);
    y += 8;
  }

  // ==========================================
  // SIGNATURE SECTION
  // ==========================================
  if (y > 250) {
    doc.addPage();
    y = 30;
  }

  y += 15;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(135, y, 195, y);
  
  y += 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  setGrayText();
  doc.text('Authorized Seal & Signature', 165, y, { align: 'center' });

  if (action === 'return') {
    return doc;
  }

  // Open PDF in a new tab
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow) {
      doc.save(`Invoice-${invoice.invoiceNo}.pdf`);
    }
  } catch (e) {
    console.error('Failed to open PDF in new tab, downloading instead', e);
    doc.save(`Invoice-${invoice.invoiceNo}.pdf`);
  }

  return doc;
};
