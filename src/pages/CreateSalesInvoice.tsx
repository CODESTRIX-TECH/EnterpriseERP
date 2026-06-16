import { useEffect, useState, useMemo, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Plus,
  Trash2,
  Loader2,
  Search,
  Save,
  ArrowLeft,
  CheckCircle2,
  Check,
  X,
} from "lucide-react"
import { Page } from "@/components/ui/page"
import { Section } from "@/components/ui/section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import axiosClient from "@/Services/axiosClient"
import { usePermissions } from "@/hooks/usePermissions"
import { useAppSelector } from "@/store/hooks"
import { toast } from "sonner"

import type { ProductDto } from "@/types/ProductDto"
import type { WarehouseDto } from "@/types/WarehouseDto"
import type { CustomerDto } from "@/types/CustomerDto"
import type { ProductVariantDto } from "@/types/ProductVariantDto"
import type { ProductBatchDto } from "@/types/ProductBatchDto"
import type { GstDto } from "@/types/GstDto"
import type { SalesInvoiceDto } from "@/types/SalesInvoiceDto"
import type { SalesInvoiceItemDto } from "@/types/SalesInvoiceItemDto"
import type { HSNCodeDto } from "@/types/HSNCodeDto"

interface PaymentDetailItem {
  id: string
  paidAmount: number
  paymentMode: number
}

export default function CreateSalesInvoice() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const isEditMode = !!editId
  usePermissions("/sales-invoice")
  const user = useAppSelector((state) => state.auth.user)

  // Loading states
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [isLoadingDeps, setIsLoadingDeps] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Dependency lists
  const [customers, setCustomers] = useState<CustomerDto[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([])
  const [products, setProducts] = useState<ProductDto[]>([])
  const [allVariants, setAllVariants] = useState<ProductVariantDto[]>([])
  const [taxProfiles, setTaxProfiles] = useState<GstDto[]>([])
  const [inventoryStatus, setInventoryStatus] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [hsnCodes, setHsnCodes] = useState<HSNCodeDto[]>([])

  // Store loaded batches per product dynamically to keep nearest-expiry batch options
  const [productBatches, setProductBatches] = useState<{ [productId: string]: ProductBatchDto[] }>({})

  // Invoice master form state
  const [customerId, setCustomerId] = useState("")
  const [customerSearchText, setCustomerSearchText] = useState("")
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [activeCustomerSearchIndex, setActiveCustomerSearchIndex] = useState(-1)
  const [warehouseId, setWarehouseId] = useState("")
  const [invoiceNo, setInvoiceNo] = useState("")
  const [referenceNo, setReferenceNo] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [remarks, setRemarks] = useState("")
  const [flatDiscountAmount, setFlatDiscountAmount] = useState(0)
  
  // Payments
  const [upfrontPayments, setUpfrontPayments] = useState<PaymentDetailItem[]>([])
  const [currentPaidAmount, setCurrentPaidAmount] = useState<number>(0)
  const [currentPaymentMode, setCurrentPaymentMode] = useState<number>(1)

  // Invoice details items state
  const [items, setItems] = useState<SalesInvoiceItemDto[]>([])

  // Quick product search state
  const [quickSearchText, setQuickSearchText] = useState("")
  const [quickSearchResults, setQuickSearchResults] = useState<ProductDto[]>([])
  const [isQuickSearching, setIsQuickSearching] = useState(false)
  const [activeQuickSearchIndex, setActiveQuickSearchIndex] = useState(-1)
  const quickSearchInputRef = useRef<HTMLInputElement>(null)

  // New Customer Dialog states
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerEmail, setNewCustomerEmail] = useState("")
  const [newCustomerGst, setNewCustomerGst] = useState("")
  const [newCustomerAddress, setNewCustomerAddress] = useState("")
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false)

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomerName.trim()) {
      toast.error("Customer name is required.")
      return
    }
    setIsSubmittingCustomer(true)
    try {
      const payload = {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
        email: newCustomerEmail.trim() || undefined,
        gstNumber: newCustomerGst.trim() || undefined,
        address: newCustomerAddress.trim() || undefined,
        companyId: user?.companyId,
        branchId: user?.branchId,
        openingBalance: 0,
        creditLimit: 0,
      }

      const response: any = await axiosClient.post("/Customer", payload)
      if (response?.success) {
        toast.success("New customer created successfully!")
        
        // Refetch customers list and select the newly created customer
        const resCust: any = await axiosClient.get("/Customer", { params: { pageNumber: 1, pageSize: 10000 } })
        if (resCust?.success) {
          const custs = resCust.data?.items || resCust.data || []
          setCustomers(custs)
          
          // Match the new customer
          const createdCust = response.data || custs.find((c: any) => c.name === payload.name && c.phone === payload.phone)
          if (createdCust) {
            setCustomerId(createdCust.id || "")
            setCustomerSearchText(createdCust.name)
          } else if (custs.length > 0) {
            // fallback
            const lastCust = custs[custs.length - 1]
            setCustomerId(lastCust.id || "")
            setCustomerSearchText(lastCust.name)
          }
        }
        
        // Reset states and close dialog
        setNewCustomerName("")
        setNewCustomerPhone("")
        setNewCustomerEmail("")
        setNewCustomerGst("")
        setNewCustomerAddress("")
        setIsNewCustomerOpen(false)
      } else {
        toast.error(response?.message || "Failed to create customer.")
      }
    } catch (err: any) {
      console.error("Failed to create customer", err)
      toast.error(err?.response?.data?.message || err?.message || "An error occurred while creating customer.")
    } finally {
      setIsSubmittingCustomer(false)
    }
  }

  // Dialog product selection state
  const [selectingProductForIndex, setSelectingProductForIndex] = useState<number | null>(null)
  const [dialogSearch, setDialogSearch] = useState("")
  const [lookupProducts, setLookupProducts] = useState<ProductDto[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)

  const filteredCustomers = useMemo(() => {
    if (!customerSearchText.trim()) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(customerSearchText.toLowerCase()) ||
        (c.phone && c.phone.includes(customerSearchText)) ||
        (c.code && c.code.toLowerCase().includes(customerSearchText.toLowerCase()))
    )
  }, [customers, customerSearchText])

  const filteredWarehouses = useMemo(() => {
    if (user?.warehouseId) {
      return warehouses.filter((w) => w.id === user.warehouseId)
    }
    return warehouses
  }, [warehouses, user?.warehouseId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const container = document.getElementById("customer-select-container")
      if (container && !container.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    // Focus on mount
    setTimeout(() => {
      quickSearchInputRef.current?.focus()
    }, 100)

    // Global keyboard listener to redirect typing to quick search
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key === "Tab" ||
        e.key === "Enter" ||
        e.key === "Backspace" ||
        e.key === "Escape" ||
        e.key === "Shift"
      ) {
        return
      }

      const activeEl = document.activeElement
      const isInputActive =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")

      if (!isInputActive && quickSearchInputRef.current) {
        quickSearchInputRef.current.focus()
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  useEffect(() => {
    setActiveCustomerSearchIndex(filteredCustomers.length > 0 ? 0 : -1)
  }, [filteredCustomers, isCustomerDropdownOpen])

  useEffect(() => {
    if (activeCustomerSearchIndex >= 0 && isCustomerDropdownOpen) {
      const container = document.querySelector("#customer-select-container .overflow-y-auto")
      const activeEl = container?.children[activeCustomerSearchIndex] as HTMLElement
      if (activeEl && container) {
        const containerTop = container.scrollTop
        const containerBottom = containerTop + container.clientHeight
        const elemTop = activeEl.offsetTop
        const elemBottom = elemTop + activeEl.clientHeight

        if (elemTop < containerTop) {
          container.scrollTop = elemTop
        } else if (elemBottom > containerBottom) {
          container.scrollTop = elemBottom - container.clientHeight
        }
      }
    }
  }, [activeCustomerSearchIndex, isCustomerDropdownOpen])

  useEffect(() => {
    if (activeQuickSearchIndex >= 0 && quickSearchResults.length > 0) {
      const container = document.querySelector("#product-quick-search-container .overflow-y-auto")
      const activeEl = container?.children[activeQuickSearchIndex] as HTMLElement
      if (activeEl && container) {
        const containerTop = container.scrollTop
        const containerBottom = containerTop + container.clientHeight
        const elemTop = activeEl.offsetTop
        const elemBottom = elemTop + activeEl.clientHeight

        if (elemTop < containerTop) {
          container.scrollTop = elemTop
        } else if (elemBottom > containerBottom) {
          container.scrollTop = elemBottom - container.clientHeight
        }
      }
    }
  }, [activeQuickSearchIndex, quickSearchResults])

  const handleCustomerSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isCustomerDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsCustomerDropdownOpen(true)
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveCustomerSearchIndex((prev) =>
        prev < filteredCustomers.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveCustomerSearchIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activeCustomerSearchIndex >= 0 && activeCustomerSearchIndex < filteredCustomers.length) {
        const c = filteredCustomers[activeCustomerSearchIndex]
        setCustomerId(c.id || "")
        setCustomerSearchText(c.name)
        setIsCustomerDropdownOpen(false)
      }
    } else if (e.key === "Escape") {
      setIsCustomerDropdownOpen(false)
    }
  }

  const warehouseStockMap = useMemo(() => {
    const map: { [productId: string]: number } = {}
    if (!warehouseId) return map

    inventoryStatus.forEach((item: any) => {
      if (item.warehouseId === warehouseId) {
        map[item.productId] = item.currentStock || 0
      }
    })
    return map
  }, [inventoryStatus, warehouseId])

  const getBatchStock = (productId: string, batchId: string | null) => {
    if (!warehouseId) return 0
    const match = inventoryStatus.find(
      (inv: any) =>
        inv.productId === productId &&
        inv.warehouseId === warehouseId &&
        (batchId ? inv.productBatchId === batchId : !inv.productBatchId)
    )
    return match ? match.currentStock : 0
  }

  const isDecimalAllowedForProduct = (productId: string): boolean => {
    const product = products.find((p) => p.id === productId)
    if (!product || !product.unitId) return false

    const unit = units.find((u) => u.id === product.unitId)
    return unit ? !!unit.decimalAllowed : false
  }

  useEffect(() => {
    if (selectingProductForIndex !== null) {
      setDialogSearch("")
    }
  }, [selectingProductForIndex])

  // Debounced search for Customer selection
  useEffect(() => {
    const selectedCustomer = customers.find(c => c.id === customerId)
    if (!isCustomerDropdownOpen && selectedCustomer && selectedCustomer.name === customerSearchText) {
      return
    }

    const delayDebounceFn = setTimeout(() => {
      const fetchCustomerSearch = async () => {
        try {
          const res: any = await axiosClient.get("/Customer", {
            params: { search: customerSearchText, pageNumber: 1, pageSize: 30 }
          })
          if (res?.success) {
            const results = res.data?.items || res.data || []
            setCustomers(prev => {
              const currentSelected = prev.find(c => c.id === customerId)
              const merged = [...results]
              if (currentSelected && !merged.some(c => c.id === customerId)) {
                merged.push(currentSelected)
              }
              return merged
            })
          }
        } catch (error) {
          console.error("Failed to search customers", error)
        }
      }
      fetchCustomerSearch()
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [customerSearchText, isCustomerDropdownOpen, customerId])

  // Debounced search for product selection dialog
  useEffect(() => {
    if (selectingProductForIndex === null) return

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingProducts(true)
      try {
        const res: any = await axiosClient.get("/Product", {
          params: { pageNumber: 1, pageSize: 30, search: dialogSearch }
        })
        if (res?.success) {
          setLookupProducts(res.data?.items || res.data || [])
        }
      } catch (e) {
        console.error("Failed to search products", e)
      } finally {
        setIsSearchingProducts(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [dialogSearch, selectingProductForIndex])

  // Load dependencies
  useEffect(() => {
    const fetchDeps = async () => {
      setIsLoadingDeps(true)
      try {
        const [resCust, resWh, resProd, resVar, resTax, resStock, resUnit, resHsn] = await Promise.all([
          axiosClient.get("/Customer", { params: { pageNumber: 1, pageSize: 30 } }),
          axiosClient.get("/Warehouse", { params: { pageNumber: 1, pageSize: 10000 } }),
          axiosClient.get("/Product", { params: { pageNumber: 1, pageSize: 30 } }),
          axiosClient.get("/ProductVariant"),
          axiosClient.get("/TaxProfile", { params: { pageNumber: 1, pageSize: 10000 } }),
          axiosClient.get("/Inventory/Status"),
          axiosClient.get("/Unit", { params: { pageNumber: 1, pageSize: 10000 } }),
          axiosClient.get("/HSNCode", { params: { pageNumber: 1, pageSize: 10000 } }),
        ]) as any[]

        if (resCust?.success) {
          const custs = resCust.data?.items || resCust.data || []
          setCustomers(custs)
          if (!isEditMode && custs.length > 0) {
            const defaultCash = custs.find((c: any) => {
              const nameLower = (c.name || "").toLowerCase()
              return (
                nameLower === "cash" ||
                nameLower.includes("walk-in") ||
                nameLower.includes("walk in") ||
                nameLower.includes("retail") ||
                nameLower.includes("default")
              )
            })
            if (defaultCash) {
              setCustomerId(defaultCash.id || "")
              setCustomerSearchText(defaultCash.name || "")
            }
          }
        }
        if (resWh?.success) {
          const whData = resWh.data?.items || resWh.data || []
          setWarehouses(whData)
          if (user?.warehouseId) {
            setWarehouseId(user.warehouseId)
          } else if (whData.length > 0) {
            setWarehouseId(whData[0].id || "")
          }
        }
        if (resProd?.success) {
          const initialProds = resProd.data?.items || resProd.data || []
          setProducts(initialProds)
          setLookupProducts(initialProds)
        }
        if (resVar?.success) setAllVariants(resVar.data || [])
        if (resTax?.success) setTaxProfiles(resTax.data?.items || resTax.data || [])
        if (resStock?.success) setInventoryStatus(resStock.data || [])
        if (resUnit?.success) setUnits(resUnit.data?.items || resUnit.data || [])
        if (resHsn?.success) setHsnCodes(resHsn.data?.items || resHsn.data || [])

        // If creating new invoice, fetch the next sequential invoice number
        if (!isEditMode && user?.companyId) {
          const resNum: any = await axiosClient.get("/SalesInvoice/next-number", {
            params: { companyId: user.companyId }
          })
          if (resNum?.success && resNum.data) {
            setInvoiceNo(resNum.data)
          }
        }
      } catch (e) {
        console.error("Failed to load dependencies", e)
        toast.error("Failed to load dependency lists.")
      } finally {
        setIsLoadingDeps(false)
      }
    }

    fetchDeps()
  }, [isEditMode, user?.companyId, user?.warehouseId])

  // Load existing invoice in edit mode
  useEffect(() => {
    if (!isEditMode || !editId) return

    const loadInvoice = async () => {
      setIsLoadingEdit(true)
      try {
        const response: any = await axiosClient.get(`/SalesInvoice/${editId}`)
        if (response?.success && response.data) {
          const inv = response.data
          setCustomerId(inv.customerId || "")
          if (inv.customerId) {
            setCustomers((prev) => {
              if (prev.some((c) => c.id === inv.customerId)) return prev
              return [
                ...prev,
                {
                  id: inv.customerId,
                  name: inv.customerName || "Selected Customer",
                  companyId: "",
                  branchId: "",
                } as CustomerDto,
              ]
            })
          }
          setWarehouseId(inv.warehouseId || "")
          setInvoiceNo(inv.invoiceNo || "")
          setReferenceNo(inv.referenceNo || "")
          setInvoiceDate(
            inv.invoiceDate
              ? new Date(inv.invoiceDate).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0]
          )
          setRemarks(inv.remarks || "")
          
          const dbPaidAmount = inv.paidAmount || 0
          const dbPaymentMode = inv.paymentMode || 1
          if (dbPaidAmount > 0) {
            setUpfrontPayments([
              {
                id: `loaded-${Date.now()}`,
                paidAmount: dbPaidAmount,
                paymentMode: dbPaymentMode,
              },
            ])
          }

          if (inv.items && inv.items.length > 0) {
            // Load batches for each item product
            const batchPromises = inv.items.map((item: any) =>
              axiosClient.get(`/ProductBatch/product/${item.productId}`)
            )
            const batchResponses = await Promise.all(batchPromises)
            const batchesMap: { [productId: string]: ProductBatchDto[] } = {}
            
            inv.items.forEach((item: any, idx: number) => {
              const res = batchResponses[idx] as any
              if (res?.success) {
                batchesMap[item.productId] = res.data || []
              }
            })
            setProductBatches(prev => ({ ...prev, ...batchesMap }))

            setItems(
              inv.items.map((item: any) => ({
                id: item.id,
                productId: item.productId || "",
                productName: item.productName || "",
                productCode: item.productCode || "",
                productVariantId: item.productVariantId || "",
                productBatchId: item.productBatchId || "",
                batchNumber: item.batchNumber || "",
                expiryDate: item.expiryDate ? item.expiryDate.split("T")[0] : "",
                qty: item.qty || 1,
                rate: item.rate || 0,
                taxPercentage: item.taxPercentage || 0,
                taxAmount: item.taxAmount || 0,
                discountPercentage: item.discountPercentage || 0,
                discountAmount: item.discountAmount || 0,
                amount: item.amount || 0,
                isGstInclusive: !!item.isGstInclusive,
                taxableAmount: item.taxableAmount || 0,
              }))
            )

            // Resolve details for products already present in the invoice
            const uniqueProductCodes = Array.from(
              new Set(inv.items.map((item: any) => item.productCode).filter(Boolean))
            ) as string[]

            if (uniqueProductCodes.length > 0) {
              const fetchedProds = await Promise.all(
                uniqueProductCodes.map((code) =>
                  axiosClient
                    .get("/Product", { params: { pageNumber: 1, pageSize: 1, search: code } })
                    .then((res: any) =>
                      res?.success && res.data?.items?.[0] ? res.data.items[0] : null
                    )
                    .catch(() => null)
                )
              )
              const validFetchedProds = fetchedProds.filter(Boolean) as ProductDto[]
              setProducts((prev) => {
                const prevMap = new Map(prev.map((p) => [p.id, p]))
                validFetchedProds.forEach((p) => prevMap.set(p.id, p))
                return Array.from(prevMap.values())
              })
            }
          }

          const lineDiscountsSum = (inv.items || []).reduce(
            (s: number, i: any) => s + (i.discountAmount || 0),
            0
          )
          const flatDisc = (inv.discountAmount || 0) - lineDiscountsSum
          setFlatDiscountAmount(flatDisc > 0 ? flatDisc : 0)
        } else {
          toast.error("Failed to load sales invoice.")
          navigate("/sales-invoice")
        }
      } catch (e) {
        console.error("Failed to load invoice", e)
        toast.error("Failed to load invoice for editing.")
        navigate("/sales-invoice")
      } finally {
        setIsLoadingEdit(false)
      }
    }

    loadInvoice()
  }, [isEditMode, editId])

  // add blank line item row
  const addLineItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        qty: 1,
        rate: 0,
        taxPercentage: 0,
        taxAmount: 0,
        discountPercentage: 0,
        discountAmount: 0,
        amount: 0,
        batchNumber: "",
        expiryDate: "",
      },
    ])
  }

  // remove line item row
  const removeLineItem = (index: number) => {
    const updated = [...items]
    updated.splice(index, 1)
    setItems(updated)
  }

  // fetch and load batches sorted by nearest expiry
  const loadBatchesForProduct = async (productId: string) => {
    try {
      const res: any = await axiosClient.get(`/ProductBatch/product/${productId}`)
      if (res?.success) {
        setProductBatches(prev => ({
          ...prev,
          [productId]: res.data || []
        }))
        return res.data as ProductBatchDto[]
      }
    } catch (e) {
      console.error("Failed to fetch product batches", e)
    }
    return []
  }

  // handle product selection change
  const handleProductChange = async (index: number, prodId: string, productObj?: ProductDto) => {
    const product = productObj || products.find((p) => p.id === prodId)
    if (!product) return

    // Load batches sorted by nearest expiry
    const batches = await loadBatchesForProduct(prodId)

    // Lookup default tax rate
    let defaultTaxRate = 0
    if (product.taxProfileId) {
      const taxProfile = taxProfiles.find((tp) => tp.id === product.taxProfileId)
      if (taxProfile) defaultTaxRate = taxProfile.igst
    }

    // Default select the nearest-expiry batch if any exists
    const defaultBatch = batches.length > 0 ? batches[0] : null

    // Determine initial rate based on:
    // 1. defaultBatch.salesRate > 0
    // 2. defaultBatch.mrp > 0
    // 3. product.mrp > 0
    // 4. product.salesRate || 0
    let initialRate = product.salesRate || 0
    if (defaultBatch && defaultBatch.salesRate && defaultBatch.salesRate > 0) {
      initialRate = defaultBatch.salesRate
    } else if (defaultBatch && defaultBatch.mrp && defaultBatch.mrp > 0) {
      initialRate = defaultBatch.mrp
    } else if (product.mrp && product.mrp > 0) {
      initialRate = product.mrp
    }

    const updated = [...items]
    updated[index] = {
      ...updated[index],
      productId: prodId,
      productVariantId: "", // reset variant
      productBatchId: defaultBatch?.id || "",
      batchNumber: defaultBatch?.batchNo || "",
      expiryDate: defaultBatch?.expiryDate ? defaultBatch.expiryDate.split("T")[0] : "",
      rate: initialRate,
      taxPercentage: defaultTaxRate,
      qty: 1,
      discountPercentage: 0,
      discountAmount: 0,
      unitId: product.unitId || "",
      unitName: product.unitName || "",
      conversionFactor: 1.0,
      isGstInclusive: !!product.isGstInclusive,
      taxableAmount: 0,
    }

    calculateLineTotals(updated, index)
  }

  // handle unit change
  const handleUnitChange = (index: number, unitId: string) => {
    const updated = [...items]
    const item = updated[index]
    const product = products.find(p => p.id === item.productId)
    if (!product) return

    // Get the base rate for base unit
    let baseRate = product.salesRate || 0
    if (item.productBatchId) {
      const batches = productBatches[item.productId] || []
      const batch = batches.find(b => b.id === item.productBatchId)
      if (batch && batch.salesRate && batch.salesRate > 0) {
        baseRate = batch.salesRate
      } else if (batch && batch.mrp && batch.mrp > 0) {
        baseRate = batch.mrp
      } else if (product.mrp && product.mrp > 0) {
        baseRate = product.mrp
      }
    } else if (product.mrp && product.mrp > 0) {
      baseRate = product.mrp
    }

    let conversionFactor = 1.0
    let rate = baseRate

    if (unitId === product.unitId) {
      conversionFactor = 1.0
      rate = baseRate
    } else {
      const rule = product.alternativeUnits?.find(c => c.alternativeUnitId === unitId)
      if (rule) {
        conversionFactor = rule.conversionFactor
        // If batch is selected, we scale the batch MRP by the conversion factor.
        // Otherwise, we check if rule specifies MRP/salesRate, otherwise scale.
        if (item.productBatchId) {
          rate = baseRate * conversionFactor
        } else {
          if (product.mrp && product.mrp > 0 && rule.mrp !== undefined && rule.mrp !== null) {
            rate = rule.mrp
          } else if (rule.salesRate !== undefined && rule.salesRate !== null) {
            rate = rule.salesRate
          } else {
            rate = baseRate * conversionFactor
          }
        }
      }
    }

    updated[index] = {
      ...item,
      unitId: unitId,
      unitName: units.find(u => u.id === unitId)?.name || "",
      unitSymbol: units.find(u => u.id === unitId)?.symbol || "",
      conversionFactor: conversionFactor,
      rate: rate
    }

    calculateLineTotals(updated, index)
  }

  // handle variant selection change
  const handleVariantChange = (index: number, variantId: string) => {
    const updated = [...items]
    updated[index].productVariantId = variantId

    const variant = allVariants.find((v) => v.id === variantId)
    if (variant) {
      updated[index].rate = variant.salesRate || updated[index].rate
    }

    calculateLineTotals(updated, index)
  }

  // handle batch selection change
  const handleBatchChange = (index: number, batchId: string) => {
    const updated = [...items]
    updated[index].productBatchId = batchId

    const productId = updated[index].productId
    const product = products.find((p) => p.id === productId)
    const batches = productBatches[productId] || []
    const selectedBatch = batches.find((b) => b.id === batchId)

    if (selectedBatch) {
      updated[index].batchNumber = selectedBatch.batchNo || ""
      updated[index].expiryDate = selectedBatch.expiryDate ? selectedBatch.expiryDate.split("T")[0] : ""
      
      // Update price based on priority:
      // 1. selectedBatch.salesRate > 0
      // 2. selectedBatch.mrp > 0
      // 3. product.mrp > 0
      // 4. product.salesRate || 0
      if (selectedBatch.salesRate && selectedBatch.salesRate > 0) {
        updated[index].rate = selectedBatch.salesRate
      } else if (selectedBatch.mrp && selectedBatch.mrp > 0) {
        updated[index].rate = selectedBatch.mrp
      } else if (product && product.mrp && product.mrp > 0) {
        updated[index].rate = product.mrp
      } else if (product) {
        updated[index].rate = product.salesRate || 0
      }
    } else {
      updated[index].batchNumber = ""
      updated[index].expiryDate = ""
      // Fallback to product MRP or sales rate when no batch is selected
      if (product && product.mrp && product.mrp > 0) {
        updated[index].rate = product.mrp
      } else if (product) {
        updated[index].rate = product.salesRate || 0
      }
    }

    calculateLineTotals(updated, index)
  }

  // handle generic numeric field update on line item
  const handleNumericFieldChange = (
    index: number,
    field: keyof SalesInvoiceItemDto,
    value: number
  ) => {
    const updated = [...items]
    updated[index] = {
      ...updated[index],
      [field]: value,
    } as any

    calculateLineTotals(updated, index, field === "discountAmount")
  }

  // perform line totals calculations
  const calculateLineTotals = (
    list: SalesInvoiceItemDto[],
    index: number,
    preferDiscVal?: boolean
  ) => {
    const item = list[index]
    const qty = Number(item.qty) || 0
    const rate = Number(item.rate) || 0
    let discPct = Number(item.discountPercentage) || 0
    let discAmt = Number(item.discountAmount) || 0
    const taxPct = Number(item.taxPercentage) || 0
    const isInclusive = !!item.isGstInclusive

    let grossAmount = qty * rate
    let discountAmount = 0

    if (isInclusive) {
      if (preferDiscVal) {
        discountAmount = discAmt
        discPct = grossAmount > 0 ? Number(((discAmt / grossAmount) * 100).toFixed(4)) : 0
      } else {
        discountAmount = Number((grossAmount * (discPct / 100)).toFixed(2))
      }
      const totalAmount = Number((grossAmount - discountAmount).toFixed(2))
      const taxableAmount = Number((totalAmount / (1 + taxPct / 100)).toFixed(2))
      const taxAmount = Number((totalAmount - taxableAmount).toFixed(2))

      list[index] = {
        ...item,
        discountPercentage: Number(discPct.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
        taxableAmount: Number(taxableAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        amount: Number(totalAmount.toFixed(2)),
      }
    } else {
      if (preferDiscVal) {
        discountAmount = discAmt
        discPct = grossAmount > 0 ? Number(((discAmt / grossAmount) * 100).toFixed(4)) : 0
      } else {
        discountAmount = Number((grossAmount * (discPct / 100)).toFixed(2))
      }
      const taxableAmount = Number((grossAmount - discountAmount).toFixed(2))
      const taxAmount = Number((taxableAmount * (taxPct / 100)).toFixed(2))
      const totalAmount = Number((taxableAmount + taxAmount).toFixed(2))

      list[index] = {
        ...item,
        discountPercentage: Number(discPct.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
        taxableAmount: Number(taxableAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        amount: Number(totalAmount.toFixed(2)),
      }
    }

    setItems(list)
  }

  // Quick search and select product logic
  useEffect(() => {
    if (!quickSearchText.trim()) {
      setQuickSearchResults([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsQuickSearching(true)
      try {
        const res: any = await axiosClient.get("/Product", {
          params: { pageNumber: 1, pageSize: 10, search: quickSearchText }
        })
        if (res?.success) {
          const found = res.data?.items || res.data || []
          setQuickSearchResults(found)
          setActiveQuickSearchIndex(found.length > 0 ? 0 : -1)

          // Auto-select exact match for barcode scanner
          const exactMatch = found.find(
            (p: any) =>
              (p.barcode && p.barcode.toLowerCase() === quickSearchText.trim().toLowerCase()) ||
              (p.productCode && p.productCode.toLowerCase() === quickSearchText.trim().toLowerCase())
          )
          if (exactMatch) {
            handleSelectQuickAddProduct(exactMatch)
          }
        }
      } catch (e) {
        console.error("Quick search failed", e)
      } finally {
        setIsQuickSearching(false)
      }
    }, 200)

    return () => clearTimeout(delayDebounceFn)
  }, [quickSearchText])

  const handleQuickSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveQuickSearchIndex((prev) =>
        prev < quickSearchResults.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveQuickSearchIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activeQuickSearchIndex >= 0 && activeQuickSearchIndex < quickSearchResults.length) {
        handleSelectQuickAddProduct(quickSearchResults[activeQuickSearchIndex])
      }
    } else if (e.key === "Escape") {
      setQuickSearchResults([])
    }
  }

  const handleSelectQuickAddProduct = async (product: ProductDto) => {
    setProducts((prev) => {
      if (prev.some((item) => item.id === product.id)) return prev
      return [...prev, product]
    })

    const batches = await loadBatchesForProduct(product.id || "")
    const defaultBatch = batches.length > 0 ? batches[0] : null

    let defaultTaxRate = 0
    if (product.taxProfileId) {
      const taxProfile = taxProfiles.find((tp) => tp.id === product.taxProfileId)
      if (taxProfile) defaultTaxRate = taxProfile.igst
    }

    // Determine initial rate based on:
    // 1. defaultBatch.salesRate > 0
    // 2. defaultBatch.mrp > 0
    // 3. product.mrp > 0
    // 4. product.salesRate || 0
    let initialRate = product.salesRate || 0
    if (defaultBatch && defaultBatch.salesRate && defaultBatch.salesRate > 0) {
      initialRate = defaultBatch.salesRate
    } else if (defaultBatch && defaultBatch.mrp && defaultBatch.mrp > 0) {
      initialRate = defaultBatch.mrp
    } else if (product.mrp && product.mrp > 0) {
      initialRate = product.mrp
    }

    const newItem: SalesInvoiceItemDto = {
      productId: product.id || "",
      productName: product.name || "",
      productCode: product.productCode || "",
      qty: 1,
      rate: initialRate,
      taxPercentage: defaultTaxRate,
      taxAmount: 0,
      discountPercentage: 0,
      discountAmount: 0,
      amount: 0,
      productVariantId: "",
      productBatchId: defaultBatch?.id || "",
      batchNumber: defaultBatch?.batchNo || "",
      expiryDate: defaultBatch?.expiryDate ? defaultBatch.expiryDate.split("T")[0] : "",
      unitId: product.unitId || "",
      unitName: product.unitName || "",
      conversionFactor: 1.0,
      isGstInclusive: !!product.isGstInclusive,
      taxableAmount: 0,
    }

    const updatedItems = [...items, newItem]
    setItems(updatedItems)
    calculateLineTotals(updatedItems, updatedItems.length - 1)

    setQuickSearchText("")
    setQuickSearchResults([])
    setActiveQuickSearchIndex(-1)

    const newIndex = updatedItems.length - 1
    setTimeout(() => {
      const element = document.getElementById(`qty-input-${newIndex}`)
      if (element) {
        ;(element as HTMLInputElement).focus()
        ;(element as HTMLInputElement).select()
      }
    }, 100)
  }

  // global summaries
  const summaries = useMemo(() => {
    let subTotal = 0
    let totalDiscount = flatDiscountAmount
    let totalTax = 0
    let netAmount = 0

    items.forEach((item) => {
      const qty = Number(item.qty) || 0
      const rate = Number(item.rate) || 0
      const taxPct = Number(item.taxPercentage) || 0
      const isInclusive = !!item.isGstInclusive

      const itemGrossBase = isInclusive
        ? Number(((qty * rate) / (1 + taxPct / 100)).toFixed(2))
        : Number((qty * rate).toFixed(2))

      subTotal += itemGrossBase
      totalDiscount += Number(item.discountAmount) || 0
      totalTax += Number(item.taxAmount) || 0
    })

    netAmount = subTotal - totalDiscount + totalTax

    return {
      subTotal: Number(subTotal.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
    }
  }, [items, flatDiscountAmount])

  const totalPaidUpfront = useMemo(() => {
    return upfrontPayments.reduce((sum, p) => sum + p.paidAmount, 0)
  }, [upfrontPayments])

  const remainingPayable = useMemo(() => {
    return Number((summaries.netAmount - totalPaidUpfront).toFixed(2))
  }, [summaries.netAmount, totalPaidUpfront])

  const totalPaidAmount = useMemo(() => {
    if (upfrontPayments.length > 0) {
      return totalPaidUpfront
    }
    return currentPaidAmount
  }, [upfrontPayments, totalPaidUpfront, currentPaidAmount])

  const balanceDue = useMemo(() => {
    return Number((summaries.netAmount - totalPaidAmount).toFixed(2))
  }, [summaries.netAmount, totalPaidAmount])

  // Automatically adjust/clear paid amounts if the net amount decreases or is 0
  useEffect(() => {
    const net = summaries.netAmount
    if (net === 0) {
      if (currentPaidAmount !== 0) {
        setCurrentPaidAmount(0)
      }
      if (upfrontPayments.length > 0) {
        setUpfrontPayments([])
      }
    } else {
      const totalSplit = upfrontPayments.reduce((sum, p) => sum + p.paidAmount, 0)
      if (totalSplit > net) {
        if (upfrontPayments.length > 0) {
          setUpfrontPayments([])
        }
        if (currentPaidAmount !== 0) {
          setCurrentPaidAmount(0)
        }
      } else {
        const targetPaid = Math.min(currentPaidAmount, net - totalSplit)
        if (currentPaidAmount !== targetPaid) {
          setCurrentPaidAmount(targetPaid)
        }
      }
    }
  }, [summaries.netAmount, upfrontPayments, currentPaidAmount])

  // submit handler
  const handleSave = async (status: number) => {
    if (!customerId) {
      toast.error("Please select a customer.")
      return
    }
    if (!warehouseId) {
      toast.error("Please select a warehouse.")
      return
    }
    if (!invoiceNo.trim()) {
      toast.error("Please enter an invoice number.")
      return
    }
    if (items.length === 0) {
      toast.error("Please add at least one item to invoice.")
      return
    }

    const invalidItem = items.some(
      (item) =>
        !item.productId ||
        Number(item.qty) <= 0 ||
        Number(item.rate) < 0
    )
    if (invalidItem) {
      toast.error(
        "Please ensure all items have a product, quantity greater than 0, and rate greater than or equal to 0."
      )
      return
    }

    // Validate unit decimal permissions
    const invalidDecimalItem = items.find(
      (item) => {
        const decimalAllowed = isDecimalAllowedForProduct(item.productId)
        return !decimalAllowed && !Number.isInteger(Number(item.qty))
      }
    )
    if (invalidDecimalItem) {
      const prodName = products.find(p => p.id === invalidDecimalItem.productId)?.name || "Product"
      toast.error(
        `Quantity for "${prodName}" (${invalidDecimalItem.qty}) must be a whole number (decimals not allowed for this unit).`
      )
      return
    }

    // Validate stock limits (prevent negative inventory)
    const stockOutLimitItem = items.find(
      (item) => {
        const availableStock = getBatchStock(item.productId, item.productBatchId || null)
        const itemBaseQty = Number(item.qty) * (item.conversionFactor || 1.0)
        return itemBaseQty > availableStock
      }
    )
    if (stockOutLimitItem) {
      const prodName = products.find(p => p.id === stockOutLimitItem.productId)?.name || "Product"
      const batchName = stockOutLimitItem.batchNumber ? ` (Batch: ${stockOutLimitItem.batchNumber})` : ""
      const availableStock = getBatchStock(stockOutLimitItem.productId, stockOutLimitItem.productBatchId || null)
      toast.error(
        `Quantity for "${prodName}"${batchName} (${stockOutLimitItem.qty} ${stockOutLimitItem.unitSymbol || "pcs"}) exceeds available stock (${availableStock} base units available in warehouse).`
      )
      return
    }

    const finalPayments =
      upfrontPayments.length > 0
        ? upfrontPayments
        : currentPaidAmount > 0
          ? [
              {
                id: "default",
                paidAmount: currentPaidAmount,
                paymentMode: currentPaymentMode,
              },
            ]
          : []

    const finalPaidAmount = finalPayments.reduce((sum, p) => sum + p.paidAmount, 0)

    if (finalPaidAmount < 0) {
      toast.error("Paid amount cannot be negative.")
      return
    }
    if (finalPaidAmount > summaries.netAmount) {
      toast.error("Paid amount cannot exceed the net invoice amount.")
      return
    }

    setIsSaving(true)
    try {
      const payload: SalesInvoiceDto = {
        companyId: user?.companyId || "",
        branchId: user?.branchId || "",
        customerId,
        warehouseId,
        invoiceNo,
        referenceNo,
        invoiceDate: new Date(invoiceDate).toISOString(),
        remarks,
        subTotal: summaries.subTotal,
        discountAmount: summaries.totalDiscount,
        taxAmount: summaries.totalTax,
        netAmount: summaries.netAmount,
        paidAmount: finalPaidAmount,
        paymentMode: finalPayments.length > 0 ? finalPayments[0].paymentMode : undefined,
        paymentDetails: finalPayments.map((p) => ({
          paidAmount: p.paidAmount,
          paymentMode: p.paymentMode,
        })),
        status, // 1 = Draft/Unpaid, 2 = Posted/Paid
        items: items.map((i) => ({
          productId: i.productId,
          productVariantId: i.productVariantId || undefined,
          productBatchId: i.productBatchId || undefined,
          batchNumber: i.batchNumber || undefined,
          expiryDate: i.expiryDate ? new Date(i.expiryDate).toISOString() : undefined,
          qty: Number(i.qty),
          rate: Number(i.rate),
          taxPercentage: Number(i.taxPercentage) || 0,
          taxAmount: Number(i.taxAmount) || 0,
          discountPercentage: Number(i.discountPercentage) || 0,
          discountAmount: Number(i.discountAmount) || 0,
          amount: Number(i.amount) || 0,
          unitId: i.unitId || undefined,
          conversionFactor: i.conversionFactor || 1.0,
          isGstInclusive: !!i.isGstInclusive,
          taxableAmount: Number(i.taxableAmount) || 0,
        })),
      }

      let response: any
      if (isEditMode && editId) {
        response = await axiosClient.put(`/SalesInvoice/${editId}`, payload)
      } else {
        response = await axiosClient.post("/SalesInvoice", payload)
      }

      if (response?.success) {
        toast.success(
          status === 2
            ? "Sales Invoice posted and stock updated!"
            : isEditMode
              ? "Sales Invoice draft updated successfully!"
              : "Sales Invoice saved as draft!"
        )
        const savedId = response.data?.id || response.data?.Id || editId
        navigate("/sales-invoice", { state: { autoViewInvoiceId: savedId } })
      } else {
        toast.error(response?.message || "Failed to save sales invoice.")
      }
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || "An error occurred while saving.")
    } finally {
      setIsSaving(false)
    }
  }

  // filter variants for selected product
  const getVariantsForProduct = (productId: string) => {
    return allVariants.filter((v) => v.productId === productId)
  }

  const getBatchesForProduct = (productId: string) => {
    return productBatches[productId] || []
  }

  if (isLoadingDeps || isLoadingEdit) {
    return (
      <Page>
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading Invoice Details...</span>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      {/* Top Action Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/sales-invoice")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditMode ? "Edit Sales Invoice" : "New Sales Invoice"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isEditMode
                ? "Update the draft invoice details. Only draft invoices can be edited."
                : "Record new sales billing details to a customer."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleSave(1)}
            disabled={isSaving}
            className="h-9 text-xs"
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave(2)}
            disabled={isSaving}
            className="h-9 bg-green-600 text-xs text-white hover:bg-green-700"
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Post & Complete Sale
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Header Metadata Section */}
        <Section className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 shadow-xs md:grid-cols-4">
          <div className="space-y-1" id="customer-select-container">
            <label className="text-zinc-550 block text-xs font-semibold tracking-wider uppercase dark:text-zinc-400">
              Customer *
            </label>
            <div className="relative w-full">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search & Select Customer..."
                  value={
                    isCustomerDropdownOpen
                      ? customerSearchText
                      : (customers.find((c) => c.id === customerId)
                          ? `${customers.find((c) => c.id === customerId)?.name} ${
                              customers.find((c) => c.id === customerId)?.phone
                                ? `(${customers.find((c) => c.id === customerId)?.phone})`
                                : ""
                            }`
                          : "")
                  }
                  onChange={(e) => {
                    setCustomerSearchText(e.target.value)
                    setIsCustomerDropdownOpen(true)
                  }}
                  onFocus={() => {
                    setIsCustomerDropdownOpen(true)
                    setCustomerSearchText("")
                  }}
                  onKeyDown={handleCustomerSearchKeyDown}
                  className="h-9 w-full pr-14 text-xs bg-white dark:bg-zinc-900"
                />
                {customerId && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCustomerId("")
                      setCustomerSearchText("")
                    }}
                    className="absolute top-0 right-8 flex h-9 w-8 items-center justify-center text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="absolute top-0 right-0 flex h-9 w-8 items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>
              {isCustomerDropdownOpen && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 p-1 mb-1">
                    <Button
                      type="button"
                      onClick={() => {
                        setNewCustomerName(customerSearchText)
                        setIsNewCustomerOpen(true)
                        setIsCustomerDropdownOpen(false)
                      }}
                      variant="outline"
                      className="h-8 w-full justify-start text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs font-semibold border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add New Customer {customerSearchText ? `"${customerSearchText}"` : ""}
                    </Button>
                  </div>
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No customers found
                    </div>
                  ) : (
                    filteredCustomers.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(c.id || "")
                          setCustomerSearchText(c.name)
                          setIsCustomerDropdownOpen(false)
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-md p-2 text-left text-xs text-zinc-900 transition-colors duration-100 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-900 ${
                          c.id === customerId || idx === activeCustomerSearchIndex
                            ? "bg-zinc-100 dark:bg-zinc-900"
                            : ""
                        }`}
                      >
                        <div>
                          <div className="font-semibold">
                            {c.name} {c.code ? `(${c.code})` : ""}
                          </div>
                          {c.phone && (
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                              Phone: {c.phone}
                            </div>
                          )}
                        </div>
                        {c.id === customerId && (
                          <Check className="h-3.5 w-3.5 text-indigo-500" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-550 block text-xs font-semibold tracking-wider uppercase dark:text-zinc-400">
              Warehouse *
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={!!user?.warehouseId}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-hidden disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Select Warehouse...</option>
              {filteredWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-555 block text-xs font-semibold tracking-wider uppercase dark:text-zinc-400">
              Invoice No *
            </label>
            <Input
              type="text"
              placeholder="e.g. SI-1001"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-zinc-555 block text-xs font-semibold tracking-wider uppercase dark:text-zinc-400">
              Invoice Date *
            </label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-zinc-555 block text-xs font-semibold tracking-wider uppercase dark:text-zinc-400">
              Reference No / PO Number
            </label>
            <Input
              type="text"
              placeholder="e.g. PO-887766 (optional)"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-zinc-555 block text-xs font-semibold tracking-wider uppercase dark:text-zinc-400">
              Remarks / Notes
            </label>
            <Input
              type="text"
              placeholder="Optional billing details or terms description..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </Section>

        {/* Invoice Items Table Details */}
        <Section className="overflow-hidden rounded-xl border border-border bg-card p-0 shadow-xs">
          <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 shrink-0">
                Invoice Line Items
              </h2>
              <div className="relative w-full max-w-md" id="product-quick-search-container">
                <div className="relative">
                  <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
                  <Input
                    ref={quickSearchInputRef}
                    autoFocus
                    type="text"
                    placeholder="Quick Search & Add Product (Name, Code, or scan Barcode)..."
                    value={quickSearchText}
                    onChange={(e) => setQuickSearchText(e.target.value)}
                    onKeyDown={handleQuickSearchKeyDown}
                    className="h-9 pl-9 text-xs w-full bg-white dark:bg-zinc-900"
                  />
                  {isQuickSearching && (
                    <Loader2 className="absolute top-2.5 right-3 h-4 w-4 animate-spin text-zinc-400" />
                  )}
                </div>
                {quickSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                    {quickSearchResults.map((prod, idx) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelectQuickAddProduct(prod)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-md p-2 text-left text-xs text-zinc-900 transition-colors duration-100 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-900 ${
                          idx === activeQuickSearchIndex ? "bg-zinc-100 dark:bg-zinc-900" : ""
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{prod.name}</div>
                          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            Code: {prod.productCode} {prod.sku ? `• SKU: ${prod.sku}` : ""}
                          </div>
                        </div>
                        <div className="text-right font-mono font-semibold">
                          ₹{(prod.salesRate || 0).toFixed(2)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button
              type="button"
              onClick={addLineItem}
              className="h-8 gap-1 py-1 text-xs shrink-0 self-end sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" /> Add Blank Row
            </Button>
          </div>

          <div className="w-full overflow-x-auto">
            <Table className="min-w-[1050px] w-full table-fixed">
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[30px] px-1 text-center">#</TableHead>
                  <TableHead className="w-[230px] px-1.5">Medicine / Variant</TableHead>
                  <TableHead className="w-[130px] px-1.5">Batch / Expiry</TableHead>
                  <TableHead className="w-[80px] px-1.5">Unit</TableHead>
                  <TableHead className="w-[75px] px-1.5 text-right font-semibold">Qty</TableHead>
                  <TableHead className="w-[85px] px-1.5 text-right font-semibold">Price</TableHead>
                  <TableHead className="w-[75px] px-1.5 text-right font-semibold">Disc %</TableHead>
                  <TableHead className="w-[85px] px-1.5 text-right font-semibold">Disc ₹</TableHead>
                  <TableHead className="w-[85px] px-1.5 text-right font-semibold">GST (%)</TableHead>
                  <TableHead className="w-[115px] px-1.5 text-right font-semibold">Line Total</TableHead>
                  <TableHead className="w-[40px] px-1 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-8 text-center text-xs text-muted-foreground"
                    >
                      No items added yet. Click "Add Line Item" to start adding products.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    const itemVariants = getVariantsForProduct(item.productId)
                    const itemBatches = getBatchesForProduct(item.productId)
                    const selectedProduct = products.find((p) => p.id === item.productId)

                    return (
                      <TableRow key={index} className="align-middle">
                        <TableCell className="px-1 py-2 text-center font-mono text-[10px]">
                          {index + 1}
                        </TableCell>

                        {/* Product Selection & Variant */}
                        <TableCell className="px-1.5 py-2">
                          <div className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectingProductForIndex(index)}
                              className="flex h-8 w-full cursor-pointer items-center justify-between rounded-md border border-zinc-200 bg-white px-2 py-1 text-left text-xs text-zinc-900 transition-colors duration-150 hover:bg-zinc-55/40 hover:bg-zinc-50 focus:ring-1 focus:ring-zinc-900 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                            >
                              {selectedProduct ? (
                                <div className="truncate pr-1">
                                  <div className="truncate font-medium">
                                    {selectedProduct.name}
                                  </div>
                                  <div className="mt-0.5 truncate font-mono text-[9px] leading-none text-zinc-400">
                                    {selectedProduct.productCode}
                                    {selectedProduct.hsnCodeId ? ` • HSN: ${hsnCodes.find((h) => h.id === selectedProduct.hsnCodeId)?.code || ""}` : ""}
                                  </div>
                                </div>
                              ) : item.productId ? (
                                <div className="truncate pr-1">
                                  <div className="truncate font-medium">
                                    {item.productName || "Product Loaded"}
                                  </div>
                                  <div className="mt-0.5 truncate font-mono text-[9px] leading-none text-zinc-400">
                                    {item.productCode || ""}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-500">
                                  Select Medicine...
                                </span>
                              )}
                              <Search className="ml-1.5 h-3 w-3 shrink-0 text-zinc-400" />
                            </button>

                            {/* Variant Dropdown if variants exist */}
                            {item.productId && itemVariants.length > 0 && (
                              <select
                                value={item.productVariantId || ""}
                                onChange={(e) => handleVariantChange(index, e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-1.5 text-[11px] text-zinc-900 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                              >
                                <option value="">No Variant</option>
                                {itemVariants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.variantCombination}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </TableCell>

                        {/* Batch No & Expiry Date */}
                        <TableCell className="px-1.5 py-2">
                          <div className="flex flex-col rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-300 dark:focus-within:ring-zinc-700">
                            <div className="relative w-full flex items-center">
                              <input
                                type="text"
                                list={`batch-list-${index}`}
                                placeholder={itemBatches.length === 0 ? "No Batch" : "Search Batch..."}
                                value={item.batchNumber || ""}
                                onChange={(e) => {
                                  const batchNo = e.target.value
                                  const matchedBatch = itemBatches.find(
                                    (b) => b.batchNo?.toLowerCase() === batchNo.toLowerCase()
                                  )
                                  if (matchedBatch) {
                                    handleBatchChange(index, matchedBatch.id || "")
                                  } else {
                                    const updated = [...items]
                                    updated[index].batchNumber = batchNo
                                    updated[index].productBatchId = ""
                                    updated[index].expiryDate = ""
                                    const product = products.find((p) => p.id === item.productId)
                                    if (product && product.mrp && product.mrp > 0) {
                                      updated[index].rate = product.mrp
                                    } else if (product) {
                                      updated[index].rate = product.salesRate || 0
                                    }
                                    calculateLineTotals(updated, index)
                                  }
                                }}
                                onFocus={(e) => e.target.select()}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setItems((currentItems) => {
                                      const updated = [...currentItems]
                                      const currentItem = updated[index]
                                      if (!currentItem || !currentItem.productId) return currentItems
                                      if (!currentItem.batchNumber) return currentItems
                                      if (!currentItem.productBatchId) {
                                        const batches = productBatches[currentItem.productId] || []
                                        const defaultBatch = batches.length > 0 ? batches[0] : null
                                        if (defaultBatch) {
                                          currentItem.productBatchId = defaultBatch.id || ""
                                          currentItem.batchNumber = defaultBatch.batchNo || ""
                                          currentItem.expiryDate = defaultBatch.expiryDate ? defaultBatch.expiryDate.split("T")[0] : ""
                                          if (defaultBatch.mrp && defaultBatch.mrp > 0) {
                                            currentItem.rate = defaultBatch.mrp
                                          } else {
                                            const product = products.find((p) => p.id === currentItem.productId)
                                            if (product && product.mrp && product.mrp > 0) {
                                              currentItem.rate = product.mrp
                                            } else if (product) {
                                              currentItem.rate = product.salesRate || 0
                                            }
                                          }
                                        }
                                      } else {
                                        const batches = productBatches[currentItem.productId] || []
                                        const originalBatch = batches.find(b => b.id === currentItem.productBatchId)
                                        if (originalBatch) {
                                          currentItem.batchNumber = originalBatch.batchNo || ""
                                        }
                                      }
                                      calculateLineTotals(updated, index)
                                      return updated
                                    })
                                  }, 150)
                                }}
                                disabled={!item.productId || itemBatches.length === 0}
                                className="h-7 w-full border-0 bg-transparent pl-1 pr-7 font-mono text-xs text-zinc-900 focus:outline-hidden disabled:opacity-50 dark:text-zinc-50 appearance-none focus:ring-0 focus-visible:ring-0 shadow-none"
                              />
                              {item.batchNumber && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    const updated = [...items]
                                    updated[index].batchNumber = ""
                                    updated[index].productBatchId = ""
                                    updated[index].expiryDate = ""
                                    const product = products.find((p) => p.id === item.productId)
                                    if (product && product.mrp && product.mrp > 0) {
                                      updated[index].rate = product.mrp
                                    } else if (product) {
                                      updated[index].rate = product.salesRate || 0
                                    }
                                    calculateLineTotals(updated, index)
                                    setItems(updated)
                                  }}
                                  className="absolute right-1 flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-650 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <datalist id={`batch-list-${index}`}>
                              {itemBatches.map((b) => {
                                const expStr = b.expiryDate
                                  ? new Date(b.expiryDate).toLocaleDateString()
                                  : "No Expiry"
                                const avlQty = getBatchStock(item.productId, b.id || null)
                                return (
                                  <option key={b.id} value={b.batchNo}>
                                    {`Avl: ${avlQty} • MRP: ₹${b.mrp || 0} • Exp: ${expStr}`}
                                  </option>
                                )
                              })}
                            </datalist>

                            {/* Expiry Date small text inside the box */}
                            {item.expiryDate && (
                              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pl-1 mt-0.5 border-t border-zinc-100 dark:border-zinc-800/60 pt-0.5">
                                Exp: {new Date(item.expiryDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Unit Selector */}
                        <TableCell className="px-1.5 py-2">
                          <select
                            value={item.unitId || selectedProduct?.unitId || ""}
                            onChange={(e) => handleUnitChange(index, e.target.value)}
                            disabled={!item.productId}
                            className="h-8 w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-1 text-xs text-zinc-900 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                          >
                            {selectedProduct && (
                              <option value={selectedProduct.unitId}>
                                {units.find((u) => u.id === selectedProduct.unitId)?.symbol || selectedProduct.unitName}
                              </option>
                            )}
                            {selectedProduct?.alternativeUnits?.map((alt) => (
                              <option key={alt.alternativeUnitId} value={alt.alternativeUnitId}>
                                {alt.alternativeUnitSymbol || alt.alternativeUnitName}
                              </option>
                            ))}
                          </select>
                        </TableCell>

                        {/* Quantity */}
                        <TableCell className="px-1.5 py-2">
                          {(() => {
                            const decimalAllowed = isDecimalAllowedForProduct(item.productId)
                            return (
                              <Input
                                id={`qty-input-${index}`}
                                type="number"
                                min={decimalAllowed ? "0.001" : "1"}
                                step={decimalAllowed ? "any" : "1"}
                                value={item.qty}
                                onChange={(e) => {
                                  let val = Number(e.target.value)
                                  if (!decimalAllowed) {
                                    val = Math.round(val)
                                  }
                                  handleNumericFieldChange(index, "qty", val)
                                }}
                                disabled={!item.productId}
                                className="h-8 w-full px-1.5 py-1 text-right font-mono text-xs"
                              />
                            )
                          })()}
                        </TableCell>

                        {/* Price */}
                        <TableCell className="px-1.5 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) =>
                              handleNumericFieldChange(index, "rate", Number(e.target.value))
                            }
                            disabled={!item.productId}
                            className="h-8 w-full px-1.5 py-1 text-right font-mono text-xs"
                          />
                        </TableCell>

                        {/* Discount % */}
                        <TableCell className="px-1.5 py-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={item.discountPercentage}
                            onChange={(e) =>
                              handleNumericFieldChange(index, "discountPercentage", Number(e.target.value))
                            }
                            disabled={!item.productId}
                            className="h-8 w-full px-1 py-1 text-right font-mono text-xs"
                          />
                        </TableCell>

                        {/* Discount (₹) */}
                        <TableCell className="px-1.5 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discountAmount}
                            onChange={(e) =>
                              handleNumericFieldChange(index, "discountAmount", Number(e.target.value))
                            }
                            disabled={!item.productId}
                            className="h-8 w-full px-1 py-1 text-right font-mono text-xs"
                          />
                        </TableCell>

                        {/* GST % and computed amount */}
                        <TableCell className="px-1.5 py-2">
                          <div className="flex flex-col rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-300 dark:focus-within:ring-zinc-700">
                            <select
                              value={item.taxPercentage}
                              onChange={(e) =>
                                handleNumericFieldChange(index, "taxPercentage", Number(e.target.value))
                              }
                              disabled={!item.productId}
                              className="h-7 w-full border-0 bg-transparent px-1 text-right font-mono text-xs focus:outline-hidden focus:ring-0 focus-visible:ring-0 shadow-none disabled:opacity-50 appearance-none cursor-pointer"
                            >
                              <option value="0" className="dark:bg-zinc-900">0%</option>
                              {taxProfiles.map((tp) => (
                                <option key={tp.id} value={tp.igst} className="dark:bg-zinc-900">
                                  {tp.name}
                                </option>
                              ))}
                              {item.taxPercentage !== undefined && item.taxPercentage > 0 && !taxProfiles.some(tp => tp.igst === item.taxPercentage) && (
                                <option value={item.taxPercentage} className="dark:bg-zinc-900">
                                  {item.taxPercentage}%
                                </option>
                              )}
                            </select>
                            <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300 font-semibold pr-1 text-right border-t border-zinc-100 dark:border-zinc-800/60 pt-0.5 mt-0.5">
                              ₹{item.taxAmount?.toFixed(2) || "0.00"}
                            </div>
                          </div>
                        </TableCell>

                        {/* Line Total & Taxable Amount */}
                        <TableCell className="px-1.5 py-2 text-right">
                          <div className="flex flex-col rounded-md border border-zinc-200 bg-zinc-550/5 p-1 dark:border-zinc-800 dark:bg-zinc-900/30">
                            <div className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 pr-1 py-0.5">
                              ₹{item.amount?.toFixed(2) || "0.00"}
                            </div>
                            <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300 pr-1 pb-0.5 border-t border-zinc-200 dark:border-zinc-800 pt-1 mt-0.5">
                              Taxable: ₹{item.taxableAmount?.toFixed(2) || "0.00"}
                            </div>
                          </div>
                        </TableCell>

                        {/* Action: Remove */}
                        <TableCell className="px-1 py-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLineItem(index)}
                            className="h-7 w-7 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Section>

        {/* Pricing Summary Layout */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row">
          <div className="w-full space-y-4 md:flex-1">
            {/* Payment Details Card */}
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                  Payment Details
                </h3>
                {remainingPayable > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-sans text-xs font-semibold text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
                    Remaining: ₹{remainingPayable.toFixed(2)}
                  </span>
                )}
                {remainingPayable === 0 && summaries.netAmount > 0 && (
                  <span className="dark:text-emerald-450 rounded-full bg-emerald-50 px-2.5 py-1 font-sans text-xs font-semibold text-emerald-600 dark:bg-emerald-950/20">
                    Fully Paid
                  </span>
                )}
              </div>

              {remainingPayable > 0 && (
                <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border/50 bg-muted/10 p-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <div className="mb-0.5 flex items-center justify-between">
                      <label className="text-zinc-555 block text-xs font-semibold dark:text-zinc-400">
                        Amount to Pay (₹)
                      </label>
                      <button
                        type="button"
                        onClick={() => setCurrentPaidAmount(remainingPayable)}
                        className="dark:text-blue-450 cursor-pointer text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:hover:text-blue-400"
                      >
                        Pay in Full
                      </button>
                    </div>
                    <Input
                      type="number"
                      min="0.01"
                      max={remainingPayable}
                      step="0.01"
                      value={currentPaidAmount || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (val >= 0) {
                          setCurrentPaidAmount(
                            Math.min(val, remainingPayable)
                          )
                        } else if (e.target.value === "") {
                          setCurrentPaidAmount(0)
                        }
                      }}
                      className="h-9 font-mono text-xs"
                      placeholder="Enter amount..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-555 block text-xs font-semibold dark:text-zinc-400">
                      Payment Mode
                    </label>
                    <select
                      value={currentPaymentMode}
                      onChange={(e) =>
                        setCurrentPaymentMode(Number(e.target.value))
                      }
                      className="h-9 w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      <option value={1}>Cash</option>
                      <option value={2}>Bank Transfer</option>
                      <option value={3}>Card</option>
                      <option value={4}>UPI</option>
                      <option value={5}>Cheque</option>
                    </select>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      if (currentPaidAmount <= 0) {
                        toast.error("Please enter a valid paid amount.")
                        return
                      }
                      if (currentPaidAmount > remainingPayable) {
                        toast.error(
                          "Paid amount cannot exceed the remaining due amount."
                        )
                        return
                      }
                      const newPayment: PaymentDetailItem = {
                        id: `pay-${Date.now()}-${Math.random()}`,
                        paidAmount: currentPaidAmount,
                        paymentMode: currentPaymentMode,
                      }
                      setUpfrontPayments([...upfrontPayments, newPayment])
                      setCurrentPaidAmount(0)
                    }}
                    className="h-9 w-full gap-1.5 bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Payment
                  </Button>
                </div>
              )}

              {/* Added Payments List */}
              {upfrontPayments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                    Added Splits
                  </h4>
                  <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {upfrontPayments.map((p) => {
                      const getModeLabel = (mode: number) => {
                        switch (mode) {
                          case 1:
                            return "Cash"
                          case 2:
                            return "Bank Transfer"
                          case 3:
                            return "Card"
                          case 4:
                            return "UPI"
                          case 5:
                            return "Cheque"
                          default:
                            return "Unknown"
                        }
                      }
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between bg-card p-2 px-3 font-mono text-xs transition-colors duration-150 hover:bg-muted/10"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                              ₹{p.paidAmount.toFixed(2)}
                            </span>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground uppercase dark:bg-zinc-800">
                              {getModeLabel(p.paymentMode)}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUpfrontPayments(
                                upfrontPayments.filter(
                                  (item) => item.id !== p.id
                                )
                              )
                            }}
                            className="h-7 w-7 text-zinc-400 hover:bg-red-50 hover:text-red-650 dark:hover:bg-red-950/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {totalPaidAmount > 0 && (
                <div className="flex items-center justify-between border-t border-dashed border-border pt-3 font-mono text-xs font-semibold">
                  <span className="font-sans text-zinc-500">Total Paid:</span>
                  <span className="text-zinc-950 dark:text-zinc-50">
                    ₹{totalPaidAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Invoice Terms & Notes */}
            <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-2xs">
              <h3 className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Invoice Terms & Notes
              </h3>
              <p className="text-[11px] leading-relaxed text-muted-foreground font-sans">
                Saving as a **Draft** stores the sales invoice details for future
                edits without affecting your inventory stock levels. **Posting
                the Invoice** locks the values and immediately performs a
                stock-out transaction, decreasing inventory status across the
                selected warehouse.
              </p>
            </div>
          </div>

          {/* Pricing Summary Side Card */}
          <div className="w-full space-y-3 rounded-xl border border-border bg-card p-5 font-mono text-xs shadow-xs md:max-w-xs">
            <div className="text-zinc-550 flex justify-between dark:text-zinc-400">
              <span>Subtotal:</span>
              <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                ₹{summaries.subTotal.toFixed(2)}
              </span>
            </div>
            <div className="text-zinc-550 flex items-center justify-between dark:text-zinc-400">
              <span>Flat Discount (₹):</span>
              <input
                type="number"
                min="0"
                step="1"
                value={flatDiscountAmount}
                onChange={(e) =>
                  setFlatDiscountAmount(Number(e.target.value) || 0)
                }
                className="h-7 w-[100px] rounded-md border border-zinc-200 bg-white px-2 text-right font-mono text-xs text-zinc-900 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="text-zinc-550 flex justify-between dark:text-zinc-400">
              <span>Line Discounts:</span>
              <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                ₹{(summaries.totalDiscount - flatDiscountAmount).toFixed(2)}
              </span>
            </div>
            <div className="text-zinc-550 flex justify-between dark:text-zinc-400">
              <span>Total Tax (GST):</span>
              <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                ₹{summaries.totalTax.toFixed(2)}
              </span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between text-sm font-bold">
              <span>Net Payable:</span>
              <span className="dark:text-green-450 text-green-600">
                ₹{summaries.netAmount.toFixed(2)}
              </span>
            </div>
            {totalPaidAmount > 0 && (
              <>
                <div className="text-zinc-550 flex justify-between pt-1 dark:text-zinc-400">
                  <span>Total Paid:</span>
                  <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                    ₹{totalPaidAmount.toFixed(2)}
                  </span>
                </div>
                <hr className="border-dashed border-border" />
                <div className="flex justify-between text-sm font-bold">
                  <span>Balance Due:</span>
                  <span className="text-red-500">
                    ₹{balanceDue.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Product Selection Dialog Lookup */}
      <Dialog
        open={selectingProductForIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSelectingProductForIndex(null)
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 p-5 sm:max-w-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Select Product</DialogTitle>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search product by name, code, SKU, or barcode..."
              value={dialogSearch}
              onChange={(e) => setDialogSearch(e.target.value)}
              className="h-9 pl-9 text-xs"
              autoFocus
            />
          </div>

          {/* Product Grid Table */}
          <div className="max-h-[450px] min-h-[300px] flex-1 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="p-2.5 pl-3">Product Details</th>
                  <th className="w-[110px] p-2.5 text-right">Sales Rate</th>
                  <th className="w-[110px] p-2.5 pr-3 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {isSearchingProducts ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-zinc-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin mb-1 text-muted-foreground" />
                      Searching products...
                    </td>
                  </tr>
                ) : (
                  lookupProducts.map((p) => {
                    const stockQty = warehouseStockMap[p.id || ""] || 0;
                    const isOutOfStock = stockQty <= 0;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => {
                          if (isOutOfStock) {
                            toast.error("This product is out of stock in the selected warehouse.");
                            return;
                          }
                          if (selectingProductForIndex !== null) {
                            // Merge into master products list so main table can resolve details
                            setProducts((prev) => {
                              if (prev.some((item) => item.id === p.id)) return prev;
                              return [...prev, p];
                            });
                            handleProductChange(selectingProductForIndex, p.id || "", p)
                            setSelectingProductForIndex(null)
                          }
                        }}
                        className={
                          isOutOfStock
                            ? "opacity-55 cursor-not-allowed bg-zinc-55/30 dark:bg-zinc-900/10"
                            : "cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                        }
                      >
                        <td className="p-2.5 pl-3">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {p.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                            <span>Code: {p.productCode}</span>
                            {p.sku && <span>• SKU: {p.sku}</span>}
                            {p.unitName && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-sans font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                Unit: {p.unitName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="dark:text-zinc-350 p-2.5 text-right font-mono text-zinc-700">
                          ₹{p.salesRate?.toFixed(2) || "0.00"}
                        </td>
                        <td className="p-2.5 pr-3 text-right font-mono font-semibold">
                          {isOutOfStock ? (
                            <span className="text-red-650 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded text-[10px]">
                              Out of Stock
                            </span>
                          ) : (
                            <span className="text-emerald-600">{stockQty.toLocaleString()}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}

                {!isSearchingProducts && lookupProducts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-zinc-400">
                      No products match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <Button
              variant="outline"
              type="button"
              className="h-8 px-3 text-xs"
              onClick={() => setSelectingProductForIndex(null)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={isNewCustomerOpen} onOpenChange={setIsNewCustomerOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Customer Name *</label>
              <Input
                type="text"
                placeholder="e.g. John Doe"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="h-9 text-xs"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Phone Number</label>
              <Input
                type="text"
                placeholder="e.g. 9876543210"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Email Address</label>
              <Input
                type="email"
                placeholder="e.g. john@example.com"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase">GST Number</label>
              <Input
                type="text"
                placeholder="e.g. 27AAAAA1111A1Z1"
                value={newCustomerGst}
                onChange={(e) => setNewCustomerGst(e.target.value)}
                className="h-9 text-xs uppercase"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Billing Address</label>
              <Input
                type="text"
                placeholder="e.g. 123 Street, City"
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-150 dark:border-zinc-800 pt-3 mt-4">
              <Button
                variant="outline"
                type="button"
                className="h-8 px-3 text-xs"
                onClick={() => setIsNewCustomerOpen(false)}
                disabled={isSubmittingCustomer}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8 px-3 text-xs bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={isSubmittingCustomer}
              >
                {isSubmittingCustomer ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Customer"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
