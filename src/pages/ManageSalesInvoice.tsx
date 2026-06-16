import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  Trash2, 
  Plus, 
  Loader2, 
  Search, 
  CheckCircle2, 
  Eye, 
  X, 
  Ban, 
  Wallet,
  Receipt,
  FileEdit,
  Calendar,
  Warehouse,
  FileText,
  RefreshCw,
  Pencil,
  User,
  Hash,
  AlertCircle,
  Printer
} from 'lucide-react';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

import { generateSalesInvoicePdf } from '@/utils/salesInvoicePdf';

import type { SalesInvoiceDto } from '@/types/SalesInvoiceDto';
import type { WarehouseDto } from '@/types/WarehouseDto';

export default function ManageSalesInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canView, canCreate, canDelete } = usePermissions('/sales-invoice');
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    const stateVal = location.state as { autoViewInvoiceId?: string } | null;
    if (stateVal?.autoViewInvoiceId) {
      handleOpenView(stateVal.autoViewInvoiceId);
      // Clear location state to prevent modal reopening on page refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  if (!canView) {
    return (
      <Page>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view sales modules.</p>
        </div>
      </Page>
    );
  }

  // Core States
  const [invoices, setInvoices] = useState<SalesInvoiceDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
  const [isUpdatingPrintFormat, setIsUpdatingPrintFormat] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(user?.warehouseId || 'all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (user?.warehouseId) {
      setSelectedWarehouseId(user.warehouseId);
    }
  }, [user?.warehouseId]);

  // Pagination States
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal Dialogs
  const [viewingInvoice, setViewingInvoice] = useState<SalesInvoiceDto | null>(null);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<SalesInvoiceDto | null>(null);

  // Record Payment States
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<number>(1);
  const [paymentRemarks, setPaymentRemarks] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useEffect(() => {
    const fetchCompanyPrintFormat = async () => {
      if (!user?.companyId) return;
      try {
        const response: any = await axiosClient.get('/Company');
        if (response?.success) {
          const companies = response.data || [];
          const myCompany = companies.find((c: any) => c.id === user.companyId);
          if (myCompany?.defaultPrintFormat === 'thermal' || myCompany?.defaultPrintFormat === 'a4') {
            setPrintFormat(myCompany.defaultPrintFormat);
          }
        }
      } catch (e) {
        console.error('Failed to fetch default print format from company', e);
      }
    };

    fetchCompanyPrintFormat();
  }, [user?.companyId]);

  const handlePrintFormatChange = async (newFormat: 'a4' | 'thermal') => {
    if (!user?.companyId) return;
    setIsUpdatingPrintFormat(true);
    try {
      const response: any = await axiosClient.put(`/Company/${user.companyId}/print-format?printFormat=${newFormat}`);
      if (response?.success) {
        setPrintFormat(newFormat);
        toast.success(`Default print setting saved: ${newFormat === 'thermal' ? 'Thermal Receipt' : 'A4 Size'}`);
      } else {
        toast.error(response?.message || 'Failed to update print format.');
      }
    } catch (e) {
      console.error('Failed to update print format', e);
      toast.error('An error occurred while updating print format.');
    } finally {
      setIsUpdatingPrintFormat(false);
    }
  };

  const fetchInvoices = async () => {
    if (!user?.companyId) return;
    setIsLoading(true);
    try {
      const response: any = await axiosClient.get('/SalesInvoice', {
        params: { companyId: user.companyId }
      });
      if (response?.success) {
        setInvoices(response.data || []);
      }
    } catch (e) {
      console.error('Failed to load sales invoices', e);
      toast.error('Failed to load sales invoices.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response: any = await axiosClient.get('/Warehouse', { params: { pageNumber: 1, pageSize: 10000 } });
      if (response?.success) {
        setWarehouses(response.data?.items || response.data || []);
      }
    } catch (e) {
      console.error('Failed to load warehouses', e);
    }
  };

  useEffect(() => {
    if (canView && user?.companyId) {
      fetchInvoices();
      fetchWarehouses();
    }
  }, [user?.companyId, canView]);

  // Client-side filtering
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Warehouse filter
      if (selectedWarehouseId !== 'all' && inv.warehouseId !== selectedWarehouseId) {
        return false;
      }
      
      // Status filter
      if (selectedStatus !== 'all' && inv.status.toString() !== selectedStatus) {
        return false;
      }

      // Search invoice details (Customer Name, Invoice No, Reference, Remarks)
      if (search.trim()) {
        const query = search.toLowerCase();
        const customerName = inv.customerName || '';
        const invoiceNo = inv.invoiceNo || '';
        const refNo = inv.referenceNo || '';
        const remarks = inv.remarks || '';

        const matchesSearch = 
          customerName.toLowerCase().includes(query) ||
          invoiceNo.toLowerCase().includes(query) ||
          refNo.toLowerCase().includes(query) ||
          remarks.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      // Date range filter (comparison by date string YYYY-MM-DD)
      if (inv.invoiceDate) {
        const invDateString = inv.invoiceDate.split('T')[0];
        if (fromDate && invDateString < fromDate) {
          return false;
        }
        if (toDate && invDateString > toDate) {
          return false;
        }
      } else if (fromDate || toDate) {
        return false;
      }

      return true;
    });
  }, [invoices, selectedWarehouseId, selectedStatus, search, fromDate, toDate]);

  // Paginated Invoices
  const totalCount = filteredInvoices.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const paginatedInvoices = useMemo(() => {
    const startIndex = (pageNumber - 1) * pageSize;
    return filteredInvoices.slice(startIndex, startIndex + pageSize);
  }, [filteredInvoices, pageNumber, pageSize]);

  useEffect(() => {
    setPageNumber(1);
  }, [search, selectedWarehouseId, selectedStatus, fromDate, toDate, pageSize]);

  // View detail
  const handleOpenView = async (id: string) => {
    setIsLoadingView(true);
    try {
      const response: any = await axiosClient.get(`/SalesInvoice/${id}`);
      if (response?.success && response.data) {
        setViewingInvoice(response.data);
      } else {
        toast.error('Failed to load invoice details.');
      }
    } catch (e) {
      console.error('Failed to load details', e);
      toast.error('An error occurred while loading details.');
    } finally {
      setIsLoadingView(false);
    }
  };

  const handleDownloadPdf = async (invoice: SalesInvoiceDto, forceFormat?: 'a4' | 'thermal') => {
    let fullInvoice = invoice;
    if (!invoice.items || invoice.items.length === 0) {
      try {
        const res: any = await axiosClient.get(`/SalesInvoice/${invoice.id}`);
        if (res?.success && res.data) {
          fullInvoice = res.data;
        } else {
          toast.error('Failed to load invoice items for PDF receipt.');
          return;
        }
        
      } catch (err) {
        console.error('Failed to load full sales invoice details', err);
        toast.error('Error loading invoice items for PDF receipt.');
        return;
      }
    }

    const targetFormat = forceFormat || printFormat;

    try {
      let companyInfo = undefined;
      const response: any = await axiosClient.get('/Company');
      if (response?.success) {
        const companies = response.data || [];
        const warehouseObj = warehouses.find(w => w.id === fullInvoice.warehouseId);
        const targetCompanyId = warehouseObj?.companyId || fullInvoice.companyId || user?.companyId;
        companyInfo = companies.find((c: any) => c.id === targetCompanyId);
      }
      generateSalesInvoicePdf(fullInvoice, companyInfo, 'open', targetFormat);
    } catch (e) {
      console.error('Failed to fetch company details for PDF', e);
      generateSalesInvoicePdf(fullInvoice, undefined, 'open', targetFormat);
    }
  };

  // Delete invoice
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sales invoice?')) return;
    try {
      const response: any = await axiosClient.delete(`/SalesInvoice/${id}`);
      if (response?.success) {
        toast.success('Sales Invoice deleted successfully.');
        fetchInvoices();
      } else {
        toast.error(response?.message || 'Failed to delete invoice.');
      }
    } catch (e) {
      console.error(e);
      toast.error('An error occurred during deletion.');
    }
  };

  // Cancel invoice (reverts stock)
  const handleCancel = async (id: string) => {
    if (!window.confirm('Canceling this invoice will ROLLBACK all stock updates. Are you sure?')) return;
    try {
      const response: any = await axiosClient.post(`/SalesInvoice/${id}/cancel`);
      if (response?.success) {
        toast.success('Sales Invoice cancelled and inventory stock restored.');
        fetchInvoices();
        if (viewingInvoice?.id === id) {
          handleOpenView(id); // Reload modal details
        }
      } else {
        toast.error(response?.message || 'Failed to cancel invoice.');
      }
    } catch (e) {
      console.error(e);
      toast.error('An error occurred during cancellation.');
    }
  };

  // Record payment
  const handleOpenPay = (invoice: SalesInvoiceDto) => {
    setPayingInvoice(invoice);
    const balance = Number((invoice.netAmount - (invoice.paidAmount || 0)).toFixed(2));
    setPaymentAmount(balance.toString());
    setPaymentRemarks('');
    setPaymentMethod(1);
  };

  const handleSavePayment = async () => {
    if (!payingInvoice) return;
    const amount = Number(paymentAmount);
    const balance = Number((payingInvoice.netAmount - (payingInvoice.paidAmount || 0)).toFixed(2));
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid positive payment amount.');
      return;
    }
    if (amount > balance) {
      toast.error(`Payment amount cannot exceed the pending balance: ₹${balance}`);
      return;
    }

    setIsSubmittingPayment(true);
    try {
      // Record payment via the dedicated /pay endpoint
      const response: any = await axiosClient.post(`/SalesInvoice/${payingInvoice.id}/pay`, {
        amount: amount,
        paymentMode: paymentMethod,
        remarks: paymentRemarks,
        paymentDetails: [
          { paidAmount: amount, paymentMode: paymentMethod }
        ]
      });

      if (response?.success) {
        toast.success('Payment recorded successfully!');
        setPayingInvoice(null);
        fetchInvoices();
      } else {
        toast.error(response?.message || 'Failed to record payment.');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'An error occurred.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    let totalInvoices = 0;
    let postedCount = 0;
    let draftCount = 0;
    let totalSalesValue = 0;

    filteredInvoices.forEach(inv => {
      totalInvoices++;
      if (inv.status === 2 || inv.status === 4 || inv.status === 5 || inv.status === 6) {
        postedCount++;
        totalSalesValue += inv.netAmount;
      } else if (inv.status === 1) {
        draftCount++;
      }
    });

    return { totalInvoices, postedCount, draftCount, totalSalesValue };
  }, [filteredInvoices]);

  const getStatusBadge = (status: number, large = false) => {
    const size = large ? 'px-3 py-1 text-sm gap-1.5' : 'px-2.5 py-0.5 text-xs gap-1';
    switch (status) {
      case 1:
        return (
          <span className={`inline-flex items-center ${size} rounded-full font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300`}>
            <FileEdit className={large ? 'h-4 w-4' : 'h-3 w-3'} /> Draft
          </span>
        );
      case 2:
        return (
          <span className={`inline-flex items-center ${size} rounded-full font-semibold bg-green-550 text-green-700 dark:bg-green-950/20 dark:text-green-400`}>
            <CheckCircle2 className={large ? 'h-4 w-4' : 'h-3 w-3'} /> Posted (Stock Out)
          </span>
        );
      case 3:
        return (
          <span className={`inline-flex items-center ${size} rounded-full font-semibold bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400`}>
            <Ban className={large ? 'h-4 w-4' : 'h-3 w-3'} /> Cancelled
          </span>
        );
      case 4:
        return (
          <span className={`inline-flex items-center ${size} rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400`}>
            <Wallet className={large ? 'h-4 w-4' : 'h-3 w-3'} /> Partially Paid
          </span>
        );
      case 5:
        return (
          <span className={`inline-flex items-center ${size} rounded-full font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400`}>
            <Ban className={large ? 'h-4 w-4' : 'h-3 w-3'} /> Returned
          </span>
        );
      case 6:
        return (
          <span className={`inline-flex items-center ${size} rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400`}>
            <AlertCircle className={large ? 'h-4 w-4' : 'h-3 w-3'} /> Partially Returned
          </span>
        );
      default:
        return null;
    }
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

  return (
    <Page>
      {/* Title & Action Header */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Invoices</h1>
          <p className="text-muted-foreground mt-1">Record customer billing, track sales, and accounts receivable.</p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/sales-invoice/create')} className="gap-1.5 shrink-0 h-10 bg-primary hover:bg-primary/95 text-white">
            <Plus className="h-4.5 w-4.5" /> New Sales Invoice
          </Button>
        )}
      </div>

      {/* KPI Analysis Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border p-4 rounded-xl shadow-2xs flex items-center gap-3">
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            <div className="text-xs text-muted-foreground">Total Invoices</div>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-2xs flex items-center gap-3">
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-green-600 dark:text-green-400">
            <span className="font-semibold text-lg">₹</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ₹{stats.totalSalesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">Total Posted Sales Value</div>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-2xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-450">{stats.postedCount}</div>
            <div className="text-xs text-muted-foreground">Posted (Ledger Active)</div>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-2xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-amber-600 dark:text-amber-400">
            <FileEdit className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{stats.draftCount}</div>
            <div className="text-xs text-muted-foreground">Draft Records</div>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <Section className="bg-card border border-border rounded-xl p-4 shadow-xs mb-6 overflow-x-auto">
        <div className="flex items-center gap-3 min-w-max">
          <div className="relative w-[280px] shrink-0">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-400" />
            <Input
              type="search"
              placeholder="Search Customer / Invoice No..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-full"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline-block">From</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-[130px] text-xs px-2"
              title="From Date"
            />
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline-block">To</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-[130px] text-xs px-2"
              title="To Date"
            />
          </div>
          
          {(fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="h-9 px-2 text-xs text-red-650 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20 shrink-0"
            >
              Clear
            </Button>
          )}

          <div className="h-5 w-px bg-border mx-1 shrink-0"></div>

          <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId} disabled={!!user?.warehouseId}>
            <SelectTrigger className="w-[160px] h-9 shrink-0">
              <SelectValue placeholder={user?.warehouseId ? (user.warehouseName || "Warehouse") : "All Warehouses"} />
            </SelectTrigger>
            <SelectContent>
              {!user?.warehouseId && <SelectItem value="all">All Warehouses</SelectItem>}
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id || ''}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[130px] h-9 shrink-0">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="1">Draft</SelectItem>
              <SelectItem value="2">Posted</SelectItem>
              <SelectItem value="3">Cancelled</SelectItem>
              <SelectItem value="4">Partially Paid</SelectItem>
              <SelectItem value="5">Returned</SelectItem>
              <SelectItem value="6">Partially Returned</SelectItem>
            </SelectContent>
          </Select>

          <Select value={printFormat} onValueChange={(val: 'a4' | 'thermal') => handlePrintFormatChange(val)} disabled={isUpdatingPrintFormat}>
            <SelectTrigger className="w-[160px] h-9 shrink-0">
              <span className="text-muted-foreground mr-1 text-[11px] font-medium">Print Default:</span>
              <SelectValue placeholder="Print Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4 Paper</SelectItem>
              <SelectItem value="thermal">Thermal (80mm)</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchInvoices} className="h-9 w-9 shrink-0" title="Refresh List">
            <RefreshCw className={`h-4.5 w-4.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Section>

      {/* Invoices Table */}
      <Section className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[60px]">Sr.</TableHead>
                <TableHead className="w-[120px]">Invoice Date</TableHead>
                <TableHead className="w-[150px]">Invoice No.</TableHead>
                <TableHead className="w-[180px]">Customer</TableHead>
                <TableHead className="w-[150px]">Warehouse</TableHead>
                <TableHead className="w-[100px] text-center">Status</TableHead>
                <TableHead className="w-[120px] text-right font-semibold">Net Amount</TableHead>
                <TableHead className="w-[120px] text-right font-semibold text-emerald-600">Paid</TableHead>
                <TableHead className="w-[120px] text-right font-semibold text-red-650">Due</TableHead>
                <TableHead className="text-center w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : paginatedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No sales invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInvoices.map((inv, index) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{(pageNumber - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        <Calendar className="h-3.5 w-3.5" />
                        {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm">{inv.invoiceNo}</div>
                      {inv.referenceNo && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">Ref: {inv.referenceNo}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{inv.customerName || 'Unknown Customer'}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                        <Warehouse className="h-3.5 w-3.5 opacity-60" />
                        {inv.warehouseName || 'Unknown Warehouse'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center align-middle">{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      ₹{inv.netAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-600 font-semibold">
                      ₹{(inv.paidAmount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-650 font-bold">
                      ₹{Math.max(0, inv.netAmount - (inv.paidAmount || 0)).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* View button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/20 dark:hover:text-violet-400"
                          onClick={() => handleOpenView(inv.id!)}
                          title="View Invoice Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Record Payment — only for Posted/Partially Paid/Partially Returned and not fully paid */}
                        {(inv.status === 2 || inv.status === 4 || inv.status === 6) && (inv.paidAmount || 0) < inv.netAmount && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-400"
                            onClick={() => handleOpenPay(inv)}
                            title="Record Payment"
                          >
                            <Wallet className="h-4.5 w-4.5" />
                          </Button>
                        )}

                        {/* Edit — disabled for non-Drafts */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20 dark:hover:text-blue-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-current"
                          onClick={() => navigate(`/sales-invoice/edit/${inv.id}`)}
                          disabled={inv.status !== 1}
                          title={inv.status === 1 ? "Edit Draft Invoice" : "Only Draft invoices can be edited"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Delete */}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                            onClick={() => handleDelete(inv.id!)}
                            title="Delete & Rollback Stock"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Cancel — not for Cancelled or Fully Returned */}
                        {canDelete && inv.status !== 3 && inv.status !== 5 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-amber-50 hover:text-amber-650 dark:hover:bg-amber-950/20 dark:hover:text-amber-400"
                            onClick={() => handleCancel(inv.id!)}
                            title="Cancel & Rollback Stock"
                          >
                            <Ban className="h-4.5 w-4.5" />
                          </Button>
                        )}
                        
                        {/* Download PDF Invoice */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-zinc-50 hover:text-zinc-650 dark:hover:bg-zinc-950/20 dark:hover:text-zinc-400"
                          onClick={() => handleDownloadPdf(inv)}
                          title={`Print Invoice (${printFormat === 'thermal' ? 'Thermal Receipt' : 'A4 PDF'})`}
                        >
                          <Printer className="h-4 w-4 text-violet-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Pagination */}
        {totalCount > 0 && (
          <div className="py-4 px-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <p>Rows per page</p>
              <Select
                value={pageSize.toString()}
                onValueChange={(val) => setPageSize(Number(val))}
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

      {/* ─── Invoice Detail View Modal (using portal) ─── */}
      {(isLoadingView || viewingInvoice !== null) && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setViewingInvoice(null); setIsLoadingView(false); } }}
        >
          <div
            className="relative bg-popover text-popover-foreground border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
            style={{ width: 'min(92vw, 1100px)', height: 'min(88vh, 860px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-violet-100 dark:bg-violet-950/30 rounded-xl">
                  <Receipt className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {viewingInvoice ? `Invoice: ${viewingInvoice.invoiceNo}` : 'Loading...'}
                  </h2>
                  {viewingInvoice && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {new Date(viewingInvoice.invoiceDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {viewingInvoice && getStatusBadge(viewingInvoice.status, true)}
                <button
                  onClick={() => { setViewingInvoice(null); setIsLoadingView(false); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingView && !viewingInvoice ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                  <span className="text-sm text-muted-foreground">Loading invoice details...</span>
                </div>
              ) : viewingInvoice ? (
                <div className="p-7 space-y-7">
                  {/* Meta Info Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/60">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        <User className="h-3.5 w-3.5" /> Customer
                      </div>
                      <div className="text-base font-bold text-foreground leading-tight">{viewingInvoice.customerName || '—'}</div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 border border-border/60">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        <Warehouse className="h-3.5 w-3.5" /> Warehouse
                      </div>
                      <div className="text-base font-bold text-foreground leading-tight">{viewingInvoice.warehouseName || '—'}</div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 border border-border/60">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        <Hash className="h-3.5 w-3.5" /> Invoice No.
                      </div>
                      <div className="text-base font-bold font-mono text-foreground leading-tight">{viewingInvoice.invoiceNo}</div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 border border-border/60">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                        <Calendar className="h-3.5 w-3.5" /> Invoice Date
                      </div>
                      <div className="text-base font-bold text-foreground leading-tight">
                        {new Date(viewingInvoice.invoiceDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Product</TableHead>
                          <TableHead>Variant</TableHead>
                          <TableHead>Batch Number</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Price (₹)</TableHead>
                          <TableHead className="text-right">Taxable Amount (₹)</TableHead>
                          <TableHead className="text-center">GST %</TableHead>
                          <TableHead className="text-right">GST (₹)</TableHead>
                          <TableHead className="text-right">Amount (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingInvoice.items.map((item, idx) => {
                          const taxableAmt = item.taxableAmount !== undefined && item.taxableAmount !== null
                            ? item.taxableAmount
                            : (item.amount || 0) - (item.taxAmount || 0);
                          return (
                            <TableRow key={idx} className="border-border">
                              <TableCell className="font-medium text-zinc-900 dark:text-white">{item.productName}</TableCell>
                              <TableCell>{item.variantName || '—'}</TableCell>
                              <TableCell>
                                <span className="font-mono text-xs">{item.batchNumber || '—'}</span>
                                {item.expiryDate && (
                                  <span className="text-[10px] text-zinc-400 block mt-0.5">Exp: {new Date(item.expiryDate).toLocaleDateString()}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">{item.qty}</TableCell>
                              <TableCell className="text-right">₹{item.rate.toFixed(2)}</TableCell>
                              <TableCell className="text-right">₹{taxableAmt.toFixed(2)}</TableCell>
                              <TableCell className="text-center">{item.taxPercentage}%</TableCell>
                              <TableCell className="text-right">₹{(item.taxAmount || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-right font-semibold">₹{(item.amount || 0).toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Bottom Splits & Totals Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                    <div className="flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Payment History Log</h4>
                      {viewingInvoice.paymentDetails && viewingInvoice.paymentDetails.length > 0 ? (
                        <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                          {viewingInvoice.paymentDetails.map((pay, i) => (
                            <div key={i} className="flex justify-between items-center text-xs p-2.5 rounded bg-muted/40 font-mono">
                              <div className="flex flex-col">
                                <span className="font-semibold text-zinc-950 dark:text-zinc-50">₹{pay.paidAmount.toFixed(2)}</span>
                                <span className="text-[10px] text-zinc-400 font-sans">{getPaymentModeLabel(pay.paymentMode)}</span>
                              </div>
                              {pay.createdAt && (
                                <span className="text-[10px] text-zinc-400 font-sans">{new Date(pay.createdAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">No payment records linked.</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400 justify-end items-end w-full font-mono">
                      <div className="flex justify-between w-full max-w-[300px]">
                        <span>SubTotal:</span>
                        <span className="font-semibold text-zinc-950 dark:text-zinc-50">₹{viewingInvoice.subTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between w-full max-w-[300px]">
                        <span>Discount:</span>
                        <span className="font-semibold text-red-500">-₹{viewingInvoice.discountAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between w-full max-w-[300px]">
                        <span>Tax (GST):</span>
                        <span className="font-semibold text-zinc-950 dark:text-zinc-50">+₹{viewingInvoice.taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between w-full max-w-[300px] py-1.5 border-t border-dashed border-border mt-1 font-bold">
                        <span className="text-zinc-950 dark:text-zinc-50">Net Total:</span>
                        <span className="text-primary text-base">₹{viewingInvoice.netAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between w-full max-w-[300px] font-semibold text-emerald-600">
                        <span>Paid Upfront:</span>
                        <span>₹{(viewingInvoice.paidAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between w-full max-w-[300px] font-semibold text-red-500">
                        <span>Balance Due:</span>
                        <span>₹{Math.max(0, viewingInvoice.netAmount - (viewingInvoice.paidAmount || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-7 py-4 bg-muted/20 shrink-0">
              {viewingInvoice && viewingInvoice.status === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex items-center gap-2 border-zinc-200 dark:border-zinc-800 text-amber-500 hover:text-amber-700 hover:bg-amber-500/10"
                  onClick={() => handleCancel(viewingInvoice.id!)}
                >
                  <Ban className="h-4 w-4" /> Cancel Invoice (Rollback Stock)
                </Button>
              )}
              {viewingInvoice && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex items-center gap-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-violet-600 dark:text-violet-400 font-semibold"
                    onClick={() => handleDownloadPdf(viewingInvoice)}
                  >
                    <Printer className="h-4 w-4 mr-1.5" /> Print {printFormat === 'thermal' ? 'Thermal' : 'A4'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="px-2.5 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700 text-xs shrink-0"
                    onClick={() => handleDownloadPdf(viewingInvoice, printFormat === 'thermal' ? 'a4' : 'thermal')}
                    title={`Print in ${printFormat === 'thermal' ? 'A4 Size' : 'Thermal (80mm)'} instead`}
                  >
                    Print {printFormat === 'thermal' ? 'A4' : 'Thermal'} instead
                  </Button>
                </div>
              )}
              <Button
                type="button"
                className="ml-auto bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-black"
                onClick={() => { setViewingInvoice(null); setIsLoadingView(false); }}
              >
                Close Receipt
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Record Payment Modal Dialog */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 transition-all duration-300">
            <button
              onClick={() => setPayingInvoice(null)}
              className="absolute right-4 top-4 p-1 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Record Payment</h3>
            <span className="text-xs text-zinc-400 block mb-4">Invoice No: {payingInvoice.invoiceNo}</span>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payment Amount (₹)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="h-10 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payment Mode</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(Number(e.target.value))}
                  className="h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all duration-200"
                >
                  <option value={1}>Cash</option>
                  <option value={2}>Bank Transfer</option>
                  <option value={3}>Card</option>
                  <option value={4}>UPI</option>
                  <option value={5}>Cheque</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Remarks / Reference</label>
                <Input
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="e.g. Txn ID or Cheque No"
                  className="h-10 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="flex items-center justify-between text-xs py-2 border-t border-dashed border-zinc-100 dark:border-zinc-800 mt-2 font-semibold">
                <span className="text-zinc-550">Invoice Net Amount:</span>
                <span className="text-zinc-900 dark:text-white">₹{payingInvoice.netAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-555">Already Paid:</span>
                <span className="text-emerald-500">₹{(payingInvoice.paidAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-555">Remaining Balance:</span>
                <span className="text-red-500">
                  ₹{Math.max(0, payingInvoice.netAmount - (payingInvoice.paidAmount || 0)).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPayingInvoice(null)}
                  className="border-zinc-200 dark:border-zinc-800"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSavePayment}
                  disabled={isSubmittingPayment}
                  className="bg-primary hover:bg-primary/95 text-white"
                >
                  {isSubmittingPayment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Record Payment'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
