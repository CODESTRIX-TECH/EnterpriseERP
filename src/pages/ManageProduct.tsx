import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Plus, Loader2, Package, Tag, Layers, Percent, Settings2, QrCode, Printer, Barcode } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import axiosClient from '@/Services/axiosClient';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppSelector } from '@/store/hooks';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import type { ProductDto, ProductUnitConversionDto } from '@/types/ProductDto';
import type { CategoryDto } from '@/types/CategoryDto';
import type { BrandDto } from '@/types/BrandDto';
import type { ManufacturerDto } from '@/types/ManufacturerDto';
import type { HSNCodeDto } from '@/types/HSNCodeDto';
import type { GstDto } from '@/types/GstDto';
import type { UnitDto } from '@/types/UnitDto';

export default function ManageProduct() {
  const isMounted = useRef(false);
  const navigate = useNavigate();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('/product');
  const user = useAppSelector((state) => state.auth.user);

  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerDto[]>([]);
  const [hsnCodes, setHsnCodes] = useState<HSNCodeDto[]>([]);
  const [taxProfiles, setTaxProfiles] = useState<GstDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoSku, setAutoSku] = useState(true);

  // Barcode Dialog & Generation State
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<ProductDto | null>(null);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);

  // Barcode Customization and Printing State
  const [showNameOnBarcode, setShowNameOnBarcode] = useState(true);
  const [showCodeOnBarcode, setShowCodeOnBarcode] = useState(true);
  const [showPriceOnBarcode, setShowPriceOnBarcode] = useState(true);
  const [barcodeHeight, setBarcodeHeight] = useState(80);
  const [printCopies, setPrintCopies] = useState(1);
  const [gridColumns, setGridColumns] = useState(3);

  // Callback ref to render barcode when the element mounts in the Dialog DOM
  const barcodeRef = useCallback((node: SVGSVGElement | null) => {
    if (node && selectedProductForBarcode?.barcode) {
      try {
        JsBarcode(node, selectedProductForBarcode.barcode, {
          format: 'CODE128',
          lineColor: '#000',
          width: 2,
          height: barcodeHeight,
          displayValue: true,
        });
      } catch (err) {
        console.error("JsBarcode failed", err);
      }
    }
  }, [selectedProductForBarcode, barcodeHeight]);

  const openBarcodePreview = (p: ProductDto) => {
    setSelectedProductForBarcode(p);
    setPrintCopies(1); // Reset default to 1 copy
    setIsBarcodeOpen(true);
  };

  const handleDownloadBarcode = () => {
    if (!selectedProductForBarcode?.barcode) return;
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, selectedProductForBarcode.barcode, {
        format: 'CODE128',
        lineColor: '#000',
        width: 2,
        height: barcodeHeight,
        displayValue: true,
      });
      
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `barcode_${selectedProductForBarcode.sku || selectedProductForBarcode.productCode || selectedProductForBarcode.name}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Barcode downloaded successfully!');
    } catch (err) {
      console.error('Download failed', err);
      toast.error('Failed to download barcode image.');
    }
  };

  const handlePrintBarcode = () => {
    if (!selectedProductForBarcode?.barcode) return;
    
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, selectedProductForBarcode.barcode, {
      format: 'CODE128',
      lineColor: '#000',
      width: 2,
      height: barcodeHeight,
      displayValue: true,
    });
    const barcodeImgData = canvas.toDataURL('image/png');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked! Please allow pop-ups to print barcodes.');
      return;
    }
    
    const title = `Barcode Labels - ${selectedProductForBarcode.name}`;
    const nameHtml = showNameOnBarcode ? `<div class="label-name">${selectedProductForBarcode.name}</div>` : '';
    const codeHtml = showCodeOnBarcode ? `<div class="label-code">${selectedProductForBarcode.productCode} ${selectedProductForBarcode.sku ? `(${selectedProductForBarcode.sku})` : ''}</div>` : '';
    
    let priceText = '';
    if (showPriceOnBarcode) {
      if (selectedProductForBarcode.mrp && selectedProductForBarcode.mrp > 0) {
        priceText += `MRP: ₹${selectedProductForBarcode.mrp.toFixed(2)} `;
      }
      if (selectedProductForBarcode.salesRate && selectedProductForBarcode.salesRate > 0) {
        priceText += `Rate: ₹${selectedProductForBarcode.salesRate.toFixed(2)}`;
      }
    }
    const priceHtml = priceText ? `<div class="label-price">${priceText}</div>` : '';
    
    let labelsHtml = '';
    for (let i = 0; i < printCopies; i++) {
      labelsHtml += `
        <div class="barcode-card">
          ${nameHtml}
          ${codeHtml}
          <img src="${barcodeImgData}" class="barcode-img" />
          ${priceHtml}
        </div>
      `;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm 10mm 15mm 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #fff;
              color: #000;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(${gridColumns}, 1fr);
              gap: 15px;
              width: 100%;
            }
            .barcode-card {
              border: 1px dashed #ccc;
              border-radius: 4px;
              padding: 10px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              box-sizing: border-box;
              background: #fff;
              page-break-inside: avoid;
              min-height: 120px;
            }
            .label-name {
              font-size: 11px;
              font-weight: bold;
              margin-bottom: 2px;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .label-code {
              font-size: 9px;
              color: #555;
              font-family: monospace;
              margin-bottom: 4px;
            }
            .barcode-img {
              max-width: 100%;
              height: auto;
              max-height: 70px;
              margin: 4px 0;
            }
            .label-price {
              font-size: 10px;
              font-weight: bold;
              margin-top: 2px;
            }
            @media print {
              .barcode-card {
                border: 1px solid #ddd;
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${labelsHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleGenerateBarcodeDirectly = async (p: ProductDto) => {
    const barcodeVal = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const payload = {
      ...p,
      barcode: barcodeVal,
      companyId: user?.companyId || p.companyId,
      branchId: user?.branchId || p.branchId,
      productType: p.productType ? Number(p.productType) : 1,
      minStock: p.minStock ? Number(p.minStock) : 0,
      reorderLevel: p.reorderLevel ? Number(p.reorderLevel) : 0,
      purchaseRate: p.purchaseRate ? Number(p.purchaseRate) : 0,
      salesRate: p.salesRate ? Number(p.salesRate) : 0,
      mrp: p.mrp ? Number(p.mrp) : 0,
    };
    try {
      const response: any = await axiosClient.put('/Product', payload);
      if (response?.success) {
        toast.success(`Barcode generated successfully for ${p.name}!`);
        fetchProducts();
      } else {
        toast.error(response?.message || 'Failed to update barcode');
      }
    } catch (error: any) {
      console.error('Failed to generate barcode', error);
      toast.error('An error occurred while generating barcode.');
    }
  };

  // Pagination & Search state
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / pageSize);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  const [dialogConversions, setDialogConversions] = useState<ProductUnitConversionDto[]>([]);
  const [newAltUnitId, setNewAltUnitId] = useState('');
  const [newConversionFactor, setNewConversionFactor] = useState('');
  const [newSalesRate, setNewSalesRate] = useState('');
  const [newPurchaseRate, setNewPurchaseRate] = useState('');
  const [newMrp, setNewMrp] = useState('');

  const handleAddConversion = () => {
    if (!newAltUnitId) {
      toast.error('Please select an alternative unit.');
      return;
    }
    const factor = parseFloat(newConversionFactor);
    if (isNaN(factor) || factor <= 0) {
      toast.error('Please enter a valid conversion factor greater than 0.');
      return;
    }
    
    const baseUnitId = watch('unitId');
    if (!baseUnitId) {
      toast.error('Please select a Base Unit in the General tab first.');
      return;
    }

    if (newAltUnitId === baseUnitId) {
      toast.error('Alternative unit cannot be the same as the base unit.');
      return;
    }

    if (dialogConversions.some(c => c.alternativeUnitId === newAltUnitId)) {
      toast.error('A conversion rule already exists for this alternative unit.');
      return;
    }

    const altUnit = units.find(u => u.id === newAltUnitId);
    const baseUnit = units.find(u => u.id === baseUnitId);

    const newConv: ProductUnitConversionDto = {
      alternativeUnitId: newAltUnitId,
      alternativeUnitName: altUnit?.name || '',
      alternativeUnitSymbol: altUnit?.symbol || '',
      baseUnitId: baseUnitId,
      baseUnitName: baseUnit?.name || '',
      baseUnitSymbol: baseUnit?.symbol || '',
      conversionFactor: factor,
      salesRate: newSalesRate ? parseFloat(newSalesRate) : undefined,
      purchaseRate: newPurchaseRate ? parseFloat(newPurchaseRate) : undefined,
      mrp: newMrp ? parseFloat(newMrp) : undefined
    };

    setDialogConversions([...dialogConversions, newConv]);
    
    setNewAltUnitId('');
    setNewConversionFactor('');
    setNewSalesRate('');
    setNewPurchaseRate('');
    setNewMrp('');
    toast.success('Conversion rule added successfully.');
  };

  const handleRemoveConversion = (index: number) => {
    setDialogConversions(dialogConversions.filter((_, i) => i !== index));
    toast.info('Conversion rule removed.');
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductDto>();

  const selectedCategoryId = watch('categoryId');

  useEffect(() => {
    if (!autoSku) return;

    let prefix = 'PRD';
    if (selectedCategoryId) {
      const category = categories.find((c) => c.id === selectedCategoryId);
      if (category) {
        if (category.code && category.code.trim()) {
          prefix = category.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        } else if (category.name && category.name.trim()) {
          prefix = category.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        }
      }
    }
    if (!prefix) {
      prefix = 'PRD';
    }

    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
    let maxNum = 0;
    products.forEach((p) => {
      if (p.sku) {
        const match = p.sku.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    const nextNum = maxNum + 1;
    const suffix = nextNum.toString().padStart(4, '0');
    const nextSku = `${prefix}${suffix}`;

    setValue('sku', nextSku);
  }, [autoSku, selectedCategoryId, categories, products, setValue]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response: any = await axiosClient.get('/Product', {
        params: { pageNumber, pageSize, search }
      });
      if (response?.success) {
        if (response.data && response.data.items) {
          setProducts(response.data.items || []);
          setTotalCount(response.data.totalCount || 0);
        } else {
          setProducts(response.data || []);
          setTotalCount((response.data || []).length);
        }
      }
    } catch (error) {
      console.error('Failed to fetch products', error);
      toast.error('Failed to load products.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const dropdownParams = { params: { pageNumber: 1, pageSize: 10000 } };
      const [resCats, resBrands, resMfrs, resHsn, resTax, resUnits] = (await Promise.all([
        axiosClient.get('/Category', dropdownParams),
        axiosClient.get('/Brand', dropdownParams),
        axiosClient.get('/Manufacturer', dropdownParams),
        axiosClient.get('/HSNCode', dropdownParams),
        axiosClient.get('/TaxProfile', dropdownParams),
        axiosClient.get('/Unit', dropdownParams),
      ])) as any[];

      if (resCats?.success) {
        if (resCats.data && resCats.data.items) {
          setCategories(resCats.data.items || []);
        } else {
          setCategories(resCats.data || []);
        }
      }
      if (resBrands?.success) {
        if (resBrands.data && resBrands.data.items) {
          setBrands(resBrands.data.items || []);
        } else {
          setBrands(resBrands.data || []);
        }
      }
      if (resMfrs?.success) {
        if (resMfrs.data && resMfrs.data.items) {
          setManufacturers(resMfrs.data.items || []);
        } else {
          setManufacturers(resMfrs.data || []);
        }
      }
      if (resHsn?.success) {
        if (resHsn.data && resHsn.data.items) {
          setHsnCodes(resHsn.data.items || []);
        } else {
          setHsnCodes(resHsn.data || []);
        }
      }
      if (resTax?.success) {
        if (resTax.data && resTax.data.items) {
          setTaxProfiles(resTax.data.items || []);
        } else {
          setTaxProfiles(resTax.data || []);
        }
      }
      if (resUnits?.success) {
        if (resUnits.data && resUnits.data.items) {
          setUnits(resUnits.data.items || []);
        } else {
          setUnits(resUnits.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch product dependencies', error);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchProducts();
    }
  }, [canView, pageNumber, pageSize]);

  useEffect(() => {
    if (canView) {
      fetchDropdownData();
    }
  }, [canView]);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (canView) {
      const delayDebounceFn = setTimeout(() => {
        if (pageNumber === 1) {
          fetchProducts();
        } else {
          setPageNumber(1);
        }
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [search]);

  const openCreateDialog = () => {
    reset({
      productCode: '',
      sku: '',
      barcode: '',
      name: '',
      shortName: '',
      description: '',
      categoryId: '',
      brandId: '',
      manufacturerId: '',
      hsnCodeId: '',
      taxProfileId: '',
      productType: 1, // Default Physical
      trackInventory: true,
      trackBatch: false,
      trackExpiry: false,
      trackSerial: false,
      minStock: 0,
      reorderLevel: 0,
      purchaseRate: 0,
      salesRate: 0,
      mrp: 0,
      isActive: true,
      unitId: '',
      isGstInclusive: false,
    });
    setAutoSku(true);
    setEditingId(null);
    setDialogConversions([]);
    setActiveTab('general');
    setIsDialogOpen(true);
  };

  const openEditDialog = (p: ProductDto) => {
    reset({
      productCode: p.productCode,
      sku: p.sku || '',
      barcode: p.barcode || '',
      name: p.name,
      shortName: p.shortName || '',
      description: p.description || '',
      categoryId: p.categoryId || '',
      brandId: p.brandId || '',
      manufacturerId: p.manufacturerId || '',
      hsnCodeId: p.hsnCodeId || '',
      taxProfileId: p.taxProfileId || '',
      productType: p.productType || 1,
      trackInventory: p.trackInventory ?? true,
      trackBatch: p.trackBatch ?? false,
      trackExpiry: p.trackExpiry ?? false,
      trackSerial: p.trackSerial ?? false,
      minStock: p.minStock || 0,
      reorderLevel: p.reorderLevel || 0,
      purchaseRate: p.purchaseRate || 0,
      salesRate: p.salesRate || 0,
      mrp: p.mrp || 0,
      isActive: p.isActive,
      unitId: p.unitId || '',
      isGstInclusive: p.isGstInclusive ?? false,
    });
    setAutoSku(false);
    setEditingId(p.id || null);
    setDialogConversions(p.alternativeUnits || []);
    setActiveTab('general');
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: ProductDto) => {
    try {
      const payload = {
        ...data,
        isGstInclusive: !!watch('isGstInclusive'),
        companyId: user?.companyId,
        branchId: user?.branchId,
        // Enforce numeric conversions
        productType: Number(data.productType),
        minStock: Number(data.minStock),
        reorderLevel: Number(data.reorderLevel),
        purchaseRate: Number(data.purchaseRate),
        salesRate: Number(data.salesRate),
        mrp: Number(data.mrp),
        alternativeUnits: dialogConversions,
      };

      let response: any;
      if (editingId) {
        response = await axiosClient.put('/Product', { ...payload, id: editingId });
      } else {
        response = await axiosClient.post('/Product', payload);
      }

      if (response?.success) {
        setIsDialogOpen(false);
        toast.success(editingId ? 'Product updated successfully!' : 'Product created successfully!');
        fetchProducts();
      } else {
        toast.error(response?.message || 'Failed to save product');
      }
    } catch (error: any) {
      console.error('Save error', error);
      toast.error(error?.message || 'An error occurred while saving.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response: any = await axiosClient.delete(`/Product/${id}`);
      if (response?.success) {
        toast.success('Product deleted successfully!');
        fetchProducts();
      } else {
        toast.error(response?.message || 'Failed to delete product');
      }
    } catch (error: any) {
      console.error('Delete error', error);
      toast.error(error?.message || 'An error occurred while deleting.');
    }
  };

  if (!canView) {
    return (
      <Page>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view this module.</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <Section className="mb-4 flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage physical goods, services, rates, and inventory controls.</p>
        </div>
        <div className="flex items-center gap-4 flex-1 justify-end">
          <Input
            type="search"
            placeholder="Search products, codes, categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[300px]"
          />
          <Button 
            variant="outline"
            onClick={() => navigate('/generate-barcode')}
            className="gap-2 shrink-0 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <Barcode className="h-4.5 w-4.5" /> Barcode Generator
          </Button>
          {canCreate && (
            <Button onClick={openCreateDialog} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          )}
        </div>
      </Section>

      <Section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[80px]">Sr. No.</TableHead>
                <TableHead className="w-[200px]">Product Name</TableHead>
                <TableHead className="w-[120px]">Code / SKU</TableHead>
                <TableHead className="w-[180px]">Category & Brand</TableHead>
                <TableHead className="text-right w-[110px]">Purchase Rate</TableHead>
                <TableHead className="text-right w-[110px]">Sales Rate</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                {(canEdit || canDelete) && <TableHead className="text-right w-[120px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p, index) => {
                  const catName = categories.find((c) => c.id === p.categoryId)?.name || '-';
                  const brandName = brands.find((b) => b.id === p.brandId)?.name || '-';
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {(pageNumber - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Package className="h-4 w-4 text-zinc-400 shrink-0" />
                        <div>
                          <div>{p.name}</div>
                          {p.shortName && <div className="text-xs text-muted-foreground">{p.shortName}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold">{p.productCode}</div>
                        {p.sku && <div className="text-xs text-muted-foreground font-mono">SKU: {p.sku}</div>}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {p.barcode ? (
                            <>
                              <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                                {p.barcode}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                onClick={() => openBarcodePreview(p)}
                                title="View/Print Barcode"
                              >
                                <QrCode className="h-3.5 w-3.5 text-zinc-500" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 py-0 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded font-medium border border-blue-200 dark:border-blue-800/30"
                              onClick={() => handleGenerateBarcodeDirectly(p)}
                              title="Quick Generate Barcode"
                            >
                              + Barcode
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs leading-relaxed text-muted-foreground">
                        <div>📁 {catName}</div>
                        <div>🏷️ {brandName}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {p.purchaseRate !== undefined ? `₹${p.purchaseRate.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {p.salesRate !== undefined ? `₹${p.salesRate.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            p.isActive
                              ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {p.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/product-attributes', { state: { productId: p.id, activeTab: 'variants' } })}
                                title="Manage Attributes (Variants, Batches, Serials)"
                              >
                                <Settings2 className="h-4 w-4 text-zinc-500" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(p)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            {canDelete && p.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(p.id!)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalCount > 0 && (
          <div className="py-4 px-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <p>Rows per page</p>
              <Select
                value={pageSize.toString()}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPageNumber(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pageNumber > 1) setPageNumber(pageNumber - 1);
                    }}
                    className={pageNumber === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPageNumber(page);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (pageNumber < totalPages) setPageNumber(pageNumber + 1);
                    }}
                    className={pageNumber >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Product' : 'Create Product'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="py-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-5 w-full mb-6">
                <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Tag className="h-3.5 w-3.5" /> General
                </TabsTrigger>
                <TabsTrigger value="categorization" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Layers className="h-3.5 w-3.5" /> Categorize
                </TabsTrigger>
                <TabsTrigger value="pricing" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Percent className="h-3.5 w-3.5" /> Price & Tax
                </TabsTrigger>
                <TabsTrigger value="inventory" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Settings2 className="h-3.5 w-3.5" /> Inventory
                </TabsTrigger>
                <TabsTrigger value="conversions" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Settings2 className="h-3.5 w-3.5" /> Conversions
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: General */}
              <TabsContent value="general" className="space-y-4 outline-none">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Product Name"
                    placeholder="e.g. Wireless Mouse"
                    {...register('name', { required: 'Product name is required' })}
                  />
                  <FormField
                    label="Product Code"
                    placeholder="e.g. PROD-100"
                    {...register('productCode', { required: 'Product code is required' })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                  {errors.productCode && <span className="text-xs text-red-500">{errors.productCode.message}</span>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="sku" className="text-base leading-none select-none text-zinc-200">
                        SKU
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                          {autoSku ? 'Auto-Gen' : 'Manual'}
                        </span>
                        <Switch
                          id="autoSku"
                          checked={autoSku}
                          onCheckedChange={(checked) => {
                            setAutoSku(checked);
                            if (checked) {
                              toast.info('Auto-generating SKU based on category.');
                            }
                          }}
                          className="scale-75 origin-right"
                        />
                      </div>
                    </div>
                    <Input
                      id="sku"
                      placeholder="Stock Keeping Unit"
                      readOnly={autoSku}
                      className={autoSku ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 cursor-not-allowed font-mono border-zinc-300 dark:border-zinc-700" : ""}
                      {...register('sku', { required: 'SKU is required' })}
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <FormField
                        label="Barcode"
                        placeholder="EAN/UPC Barcode"
                        {...register('barcode')}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const barcodeVal = Math.floor(100000000000 + Math.random() * 900000000000).toString();
                        setValue('barcode', barcodeVal);
                        toast.success("Barcode generated! Don't forget to save the product.");
                      }}
                      className="shrink-0 mb-[1px] h-10 px-3 cursor-pointer"
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {errors.sku && <span className="text-xs text-red-500">{errors.sku.message}</span>}
                  {errors.barcode && <span className="text-xs text-red-500">{errors.barcode.message}</span>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Short Name"
                    placeholder="Display alias"
                    {...register('shortName')}
                  />
                  <div className="space-y-2">
                    <label htmlFor="unitId" className="text-sm font-medium text-foreground">
                      Base Unit
                    </label>
                    <Select
                      value={watch('unitId') || ''}
                      onValueChange={(val) => setValue('unitId', val)}
                    >
                      <SelectTrigger id="unitId">
                        <SelectValue placeholder="Select Unit (e.g. pcs, kg)" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id || ''}>
                            {u.name} ({u.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="productType" className="text-sm font-medium text-foreground">
                      Product Type
                    </label>
                    <Select
                      value={watch('productType')?.toString() || '1'}
                      onValueChange={(val) => setValue('productType', Number(val))}
                    >
                      <SelectTrigger id="productType">
                        <SelectValue placeholder="Product Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Physical / Goods</SelectItem>
                        <SelectItem value="2">Service / Intangible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <FormField
                  label="Description"
                  placeholder="Product description and specs..."
                  {...register('description')}
                />
              </TabsContent>

              {/* Tab 2: Categorization */}
              <TabsContent value="categorization" className="space-y-4 outline-none">
                <div className="space-y-2">
                  <label htmlFor="categoryId" className="text-sm font-medium text-foreground">
                    Category
                  </label>
                  <Select
                    value={watch('categoryId') || ''}
                    onValueChange={(val) => setValue('categoryId', val)}
                  >
                    <SelectTrigger id="categoryId">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id || ''}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="brandId" className="text-sm font-medium text-foreground">
                    Brand
                  </label>
                  <Select
                    value={watch('brandId') || ''}
                    onValueChange={(val) => setValue('brandId', val)}
                  >
                    <SelectTrigger id="brandId">
                      <SelectValue placeholder="Select Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id || ''}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="manufacturerId" className="text-sm font-medium text-foreground">
                    Manufacturer
                  </label>
                  <Select
                    value={watch('manufacturerId') || ''}
                    onValueChange={(val) => setValue('manufacturerId', val)}
                  >
                    <SelectTrigger id="manufacturerId">
                      <SelectValue placeholder="Select Manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      {manufacturers.map((m) => (
                        <SelectItem key={m.id} value={m.id || ''}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Tab 3: Pricing & Tax */}
              <TabsContent value="pricing" className="space-y-4 outline-none">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    label="Purchase Rate (₹)"
                    type="number"
                    step="0.01"
                    {...register('purchaseRate', { min: { value: 0, message: 'Rate cannot be negative' } })}
                  />
                  <FormField
                    label="Sales Rate (₹)"
                    type="number"
                    step="0.01"
                    {...register('salesRate', { min: { value: 0, message: 'Rate cannot be negative' } })}
                  />
                  <FormField
                    label="MRP (₹)"
                    type="number"
                    step="0.01"
                    {...register('mrp', { min: { value: 0, message: 'MRP cannot be negative' } })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {errors.purchaseRate && <span className="text-xs text-red-500">{errors.purchaseRate.message}</span>}
                  {errors.salesRate && <span className="text-xs text-red-500">{errors.salesRate.message}</span>}
                  {errors.mrp && <span className="text-xs text-red-500">{errors.mrp.message}</span>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="taxProfileId" className="text-sm font-medium text-foreground">
                      GST Profile (Tax Profile)
                    </label>
                    <Select
                      value={watch('taxProfileId') || ''}
                      onValueChange={(val) => setValue('taxProfileId', val)}
                    >
                      <SelectTrigger id="taxProfileId">
                        <SelectValue placeholder="Select Tax Slab" />
                      </SelectTrigger>
                      <SelectContent>
                        {taxProfiles.map((tp) => (
                          <SelectItem key={tp.id} value={tp.id || ''}>
                            {tp.name} ({tp.cgst + tp.sgst}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="isGstInclusive" className="text-sm font-medium text-foreground">
                      GST Type
                    </label>
                    <Select
                      value={watch('isGstInclusive') ? 'inclusive' : 'exclusive'}
                      onValueChange={(val) => setValue('isGstInclusive', val === 'inclusive')}
                    >
                      <SelectTrigger id="isGstInclusive">
                        <SelectValue placeholder="Select GST Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exclusive">GST Exclusive</SelectItem>
                        <SelectItem value="inclusive">GST Inclusive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="hsnCodeId" className="text-sm font-medium text-foreground">
                    HSN Code
                  </label>
                  <Select
                    value={watch('hsnCodeId') || ''}
                    onValueChange={(val) => setValue('hsnCodeId', val)}
                  >
                    <SelectTrigger id="hsnCodeId">
                      <SelectValue placeholder="Select HSN Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {hsnCodes.map((hsn) => (
                        <SelectItem key={hsn.id} value={hsn.id || ''}>
                          {hsn.code} - {hsn.gstPercentage}% ({hsn.description || 'No Description'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Tab 4: Inventory Settings */}
              <TabsContent value="inventory" className="space-y-4 outline-none">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-muted/20 p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <label htmlFor="trackInventory" className="text-sm font-medium text-foreground">
                      Track Inventory
                    </label>
                    <Switch
                      id="trackInventory"
                      checked={watch('trackInventory')}
                      onCheckedChange={(checked) => setValue('trackInventory', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="trackBatch" className="text-sm font-medium text-foreground">
                      Track Batch
                    </label>
                    <Switch
                      id="trackBatch"
                      checked={watch('trackBatch')}
                      onCheckedChange={(checked) => setValue('trackBatch', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="trackExpiry" className="text-sm font-medium text-foreground">
                      Track Expiry
                    </label>
                    <Switch
                      id="trackExpiry"
                      checked={watch('trackExpiry')}
                      onCheckedChange={(checked) => setValue('trackExpiry', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="trackSerial" className="text-sm font-medium text-foreground">
                      Track Serial Number
                    </label>
                    <Switch
                      id="trackSerial"
                      checked={watch('trackSerial')}
                      onCheckedChange={(checked) => setValue('trackSerial', checked)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Minimum Stock"
                    type="number"
                    {...register('minStock', { min: 0 })}
                  />
                  <FormField
                    label="Reorder Level"
                    type="number"
                    {...register('reorderLevel', { min: 0 })}
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border mt-4">
                  <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                    Product Status (Active)
                  </label>
                  <Switch
                    id="isActive"
                    checked={watch('isActive')}
                    onCheckedChange={(checked) => setValue('isActive', checked)}
                  />
                </div>
              </TabsContent>

              {/* Tab 5: Unit Conversions */}
              <TabsContent value="conversions" className="space-y-4 outline-none">
                <div className="bg-muted/30 p-4 rounded-lg border border-border">
                  <h3 className="text-sm font-semibold mb-2">Configure Unit Conversions</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Define conversion rates from alternative units (e.g. Strip, Box) to the product's Base Unit. 
                    All physical inventory transactions will be converted to base units.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Alternative Unit</label>
                      <Select
                        value={newAltUnitId}
                        onValueChange={setNewAltUnitId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Alt Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {units
                            .filter(u => u.id !== watch('unitId')) // Exclude selected Base Unit
                            .map((u) => (
                              <SelectItem key={u.id} value={u.id || ''}>
                                {u.name} ({u.symbol})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium">Conversion Factor (Multiplier)</label>
                      <Input
                        type="number"
                        placeholder="e.g. 13"
                        value={newConversionFactor}
                        onChange={(e) => setNewConversionFactor(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Sales Rate Override (₹, Optional)</label>
                      <Input
                        type="number"
                        placeholder="Override rate"
                        value={newSalesRate}
                        onChange={(e) => setNewSalesRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Purchase Rate Override (₹, Optional)</label>
                      <Input
                        type="number"
                        placeholder="Override rate"
                        value={newPurchaseRate}
                        onChange={(e) => setNewPurchaseRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">MRP Override (₹, Optional)</label>
                      <Input
                        type="number"
                        placeholder="Override MRP"
                        value={newMrp}
                        onChange={(e) => setNewMrp(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button type="button" onClick={handleAddConversion} className="w-full text-xs h-9">
                    Add Conversion Rule
                  </Button>
                </div>

                {/* Conversion Rules List */}
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Alt Unit</TableHead>
                        <TableHead>Factor</TableHead>
                        <TableHead className="text-right">Sales Rate</TableHead>
                        <TableHead className="text-right">Purchase Rate</TableHead>
                        <TableHead className="text-right">MRP</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dialogConversions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-xs text-muted-foreground">
                            No conversion rules added yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dialogConversions.map((conv, index) => (
                          <TableRow key={index} className="text-xs">
                            <TableCell className="font-semibold">
                              {conv.alternativeUnitName || units.find(u => u.id === conv.alternativeUnitId)?.name} ({conv.alternativeUnitSymbol || units.find(u => u.id === conv.alternativeUnitId)?.symbol})
                            </TableCell>
                            <TableCell className="font-mono">
                              1 Alt Unit = {conv.conversionFactor} Base Units
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {conv.salesRate !== undefined && conv.salesRate !== null ? `₹${Number(conv.salesRate).toFixed(2)}` : 'Calculated'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {conv.purchaseRate !== undefined && conv.purchaseRate !== null ? `₹${Number(conv.purchaseRate).toFixed(2)}` : 'Calculated'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {conv.mrp !== undefined && conv.mrp !== null ? `₹${Number(conv.mrp).toFixed(2)}` : 'Calculated'}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() => handleRemoveConversion(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-8 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Barcode Dialog */}
      <Dialog open={isBarcodeOpen} onOpenChange={setIsBarcodeOpen}>
        <DialogContent className="sm:max-w-[520px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-md">
          <DialogHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-zinc-900 dark:text-zinc-50">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                <QrCode className="h-5 w-5" />
              </div>
              Barcode Label Generator & Print
            </DialogTitle>
          </DialogHeader>

          {selectedProductForBarcode && (
            <div className="space-y-6 py-4">
              {/* Preview Box */}
              <div className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-900 rounded-xl relative overflow-hidden">
                <div className="absolute top-2 right-2 text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                  Live Preview
                </div>
                
                <div className="bg-white p-5 rounded-lg shadow-md border border-zinc-100 flex flex-col items-center justify-center min-w-[260px] transition-transform duration-200 hover:scale-[1.02]">
                  {/* Label Text Preview */}
                  {showNameOnBarcode && (
                    <div className="text-xs font-bold text-zinc-950 mb-1 max-w-[220px] text-center truncate">
                      {selectedProductForBarcode.name}
                    </div>
                  )}
                  {showCodeOnBarcode && (
                    <div className="text-[10px] text-zinc-500 font-mono mb-1.5">
                      {selectedProductForBarcode.productCode} {selectedProductForBarcode.sku ? `(SKU: ${selectedProductForBarcode.sku})` : ''}
                    </div>
                  )}
                  
                  {/* SVG Barcode */}
                  <div className="bg-white p-1 rounded">
                    <svg ref={barcodeRef} className="max-w-full"></svg>
                  </div>
                  
                  {/* Price Info */}
                  {showPriceOnBarcode && (
                    <div className="text-xs font-extrabold text-zinc-900 mt-2 flex gap-2.5">
                      {selectedProductForBarcode.mrp && selectedProductForBarcode.mrp > 0 && (
                        <span className="text-zinc-500 line-through font-normal">MRP: ₹{selectedProductForBarcode.mrp.toFixed(2)}</span>
                      )}
                      {selectedProductForBarcode.salesRate !== undefined && (
                        <span className="text-blue-600 dark:text-blue-500">Rate: ₹{selectedProductForBarcode.salesRate.toFixed(2)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-4 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-900">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                  Label Customization
                </div>
                
                <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-sm">
                  <div className="flex items-center justify-between">
                    <label htmlFor="showNameOnBarcode" className="font-medium text-zinc-700 dark:text-zinc-300">Show Name</label>
                    <Switch
                      id="showNameOnBarcode"
                      checked={showNameOnBarcode}
                      onCheckedChange={setShowNameOnBarcode}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="showCodeOnBarcode" className="font-medium text-zinc-700 dark:text-zinc-300">Show Code/SKU</label>
                    <Switch
                      id="showCodeOnBarcode"
                      checked={showCodeOnBarcode}
                      onCheckedChange={setShowCodeOnBarcode}
                    />
                  </div>
                  <div className="flex items-center justify-between col-span-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                    <label htmlFor="showPriceOnBarcode" className="font-medium text-zinc-700 dark:text-zinc-300">Show Price Info</label>
                    <Switch
                      id="showPriceOnBarcode"
                      checked={showPriceOnBarcode}
                      onCheckedChange={setShowPriceOnBarcode}
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5 col-span-2 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex justify-between text-xs font-medium text-zinc-500">
                      <span>Barcode Height</span>
                      <span>{barcodeHeight}px</span>
                    </div>
                    <input
                      type="range"
                      id="barcodeHeight"
                      min="40"
                      max="120"
                      value={barcodeHeight}
                      onChange={(e) => setBarcodeHeight(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800 mb-2">
                  Print Layout Configuration
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="printCopies" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Copies to Print</label>
                    <Input
                      id="printCopies"
                      type="number"
                      min="1"
                      max="500"
                      value={printCopies}
                      onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value)))}
                      className="h-9 w-full font-semibold border-zinc-200 dark:border-zinc-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="gridColumns" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Grid Layout Columns</label>
                    <Select
                      value={gridColumns.toString()}
                      onValueChange={(val) => setGridColumns(Number(val))}
                    >
                      <SelectTrigger id="gridColumns" className="h-9 w-full border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="Layout" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Column (Single Roll)</SelectItem>
                        <SelectItem value="2">2 Columns Grid</SelectItem>
                        <SelectItem value="3">3 Columns (Standard A4)</SelectItem>
                        <SelectItem value="4">4 Columns (Dense A4)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBarcodeOpen(false)}
              className="border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors animate-fade-in"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadBarcode}
              className="border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors animate-fade-in"
            >
              Download PNG
            </Button>
            <Button
              type="button"
              onClick={handlePrintBarcode}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 transition-all cursor-pointer animate-fade-in"
            >
              <Printer className="h-4 w-4" /> Print Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
