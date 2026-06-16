import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, Sparkles, Tag, Layers, Percent, Settings2, Trash2, Scale } from "lucide-react"
import axiosClient from "@/Services/axiosClient"
import { useAppSelector } from "@/store/hooks"
import { toast } from "sonner"
import type { ProductDto, ProductUnitConversionDto } from "@/types/ProductDto"
import type { CategoryDto } from "@/types/CategoryDto"
import type { BrandDto } from "@/types/BrandDto"
import type { ManufacturerDto } from "@/types/ManufacturerDto"
import type { HSNCodeDto } from "@/types/HSNCodeDto"
import type { GstDto } from "@/types/GstDto"
import type { UnitDto } from "@/types/UnitDto"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface QuickAddProductDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newProduct: ProductDto) => void
  initialName?: string
}

export default function QuickAddProductDialog({
  isOpen,
  onClose,
  onSuccess,
  initialName = "",
}: QuickAddProductDialogProps) {
  const user = useAppSelector((state) => state.auth.user)

  // Dependency Lists
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [brands, setBrands] = useState<BrandDto[]>([])
  const [manufacturers, setManufacturers] = useState<ManufacturerDto[]>([])
  const [hsnCodes, setHsnCodes] = useState<HSNCodeDto[]>([])
  const [taxProfiles, setTaxProfiles] = useState<GstDto[]>([])
  const [units, setUnits] = useState<UnitDto[]>([])
  const [isLoadingDeps, setIsLoadingDeps] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [name, setName] = useState(initialName)
  const [productCode, setProductCode] = useState("")
  const [sku, setSku] = useState("")
  const [autoSku, setAutoSku] = useState(true)
  const [barcode, setBarcode] = useState("")
  const [unitId, setUnitId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [brandId, setBrandId] = useState("")
  const [manufacturerId, setManufacturerId] = useState("")
  const [hsnCodeId, setHsnCodeId] = useState("")
  const [taxProfileId, setTaxProfileId] = useState("")
  const [productType, setProductType] = useState<number>(1) // 1 = Physical/Goods
  const [trackInventory, setTrackInventory] = useState(true)
  const [minStock, setMinStock] = useState<number>(0)
  const [reorderLevel, setReorderLevel] = useState<number>(0)
  const [purchaseRate, setPurchaseRate] = useState<number>(0)
  const [salesRate, setSalesRate] = useState<number>(0)
  const [mrp, setMrp] = useState<number>(0)
  const [isActive] = useState(true)
  const [isGstInclusive, setIsGstInclusive] = useState(false)

  // Unit Conversion State
  const [alternativeUnits, setAlternativeUnits] = useState<ProductUnitConversionDto[]>([])
  const [newAltUnitId, setNewAltUnitId] = useState("")
  const [newConversionFactor, setNewConversionFactor] = useState("")
  const [newSalesRate, setNewSalesRate] = useState("")
  const [newPurchaseRate, setNewPurchaseRate] = useState("")
  const [newMrp, setNewMrp] = useState("")

  // Sync initialName when it changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      // Reset SKU and Code for a fresh entry
      setProductCode("")
      setBarcode("")
      setSku("")
      setAutoSku(true)

      // Reset Unit Conversion
      setAlternativeUnits([])
      setNewAltUnitId("")
      setNewConversionFactor("")
      setNewSalesRate("")
      setNewPurchaseRate("")
      setNewMrp("")
      setIsGstInclusive(false)
    }
  }, [initialName, isOpen])

  // Load Dependencies
  useEffect(() => {
    if (!isOpen) return

    const fetchDeps = async () => {
      setIsLoadingDeps(true)
      try {
        const dropdownParams = { params: { pageNumber: 1, pageSize: 10000 } }
        const [resCats, resBrands, resMfrs, resHsn, resTax, resUnits] =
          (await Promise.all([
            axiosClient.get("/Category", dropdownParams),
            axiosClient.get("/Brand", dropdownParams),
            axiosClient.get("/Manufacturer", dropdownParams),
            axiosClient.get("/HSNCode", dropdownParams),
            axiosClient.get("/TaxProfile", dropdownParams),
            axiosClient.get("/Unit", dropdownParams),
          ])) as any[]

        if (resCats?.success) setCategories(resCats.data?.items || resCats.data || [])
        if (resBrands?.success) setBrands(resBrands.data?.items || resBrands.data || [])
        if (resMfrs?.success) setManufacturers(resMfrs.data?.items || resMfrs.data || [])
        if (resHsn?.success) setHsnCodes(resHsn.data?.items || resHsn.data || [])
        
        if (resTax?.success) {
          const taxList = resTax.data?.items || resTax.data || []
          setTaxProfiles(taxList)
          if (taxList.length > 0) setTaxProfileId(taxList[0].id || "")
        }

        if (resUnits?.success) {
          const unitList = resUnits.data?.items || resUnits.data || []
          setUnits(unitList)
          if (unitList.length > 0) setUnitId(unitList[0].id || "")
        }
      } catch (e) {
        console.error("Failed to fetch dependencies for Quick Add Product", e)
        toast.error("Failed to load drop-down lists.")
      } finally {
        setIsLoadingDeps(false)
      }
    }

    fetchDeps()
  }, [isOpen])

  // SKU Auto-generation logic (matching ManageProduct heuristic)
  useEffect(() => {
    if (!autoSku || !isOpen) return

    let prefix = "PRD"
    if (categoryId) {
      const category = categories.find((c) => c.id === categoryId)
      if (category) {
        if (category.code && category.code.trim()) {
          prefix = category.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
        } else if (category.name && category.name.trim()) {
          prefix = category.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)
        }
      }
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString()
    setSku(`${prefix}${randomSuffix}`)
  }, [autoSku, categoryId, categories, isOpen])

  // Generate Barcode
  const generateBarcode = () => {
    const barcodeVal = Math.floor(100000000000 + Math.random() * 900000000000).toString()
    setBarcode(barcodeVal)
    toast.success("Barcode generated successfully!")
  }

  const handleAddConversion = () => {
    if (!newAltUnitId) {
      toast.error("Please select an alternative unit.")
      return
    }
    const factor = parseFloat(newConversionFactor)
    if (isNaN(factor) || factor <= 0) {
      toast.error("Please enter a valid conversion factor greater than 0.")
      return
    }
    
    if (!unitId) {
      toast.error("Please select a Base Unit first.")
      return
    }

    if (newAltUnitId === unitId) {
      toast.error("Alternative unit cannot be the same as the base unit.")
      return
    }

    if (alternativeUnits.some((c) => c.alternativeUnitId === newAltUnitId)) {
      toast.error("A conversion rule already exists for this alternative unit.")
      return
    }

    const altUnit = units.find((u) => u.id === newAltUnitId)
    const baseUnit = units.find((u) => u.id === unitId)

    const newConv: ProductUnitConversionDto = {
      alternativeUnitId: newAltUnitId,
      alternativeUnitName: altUnit?.name || "",
      alternativeUnitSymbol: altUnit?.symbol || "",
      baseUnitId: unitId,
      baseUnitName: baseUnit?.name || "",
      baseUnitSymbol: baseUnit?.symbol || "",
      conversionFactor: factor,
      salesRate: newSalesRate ? parseFloat(newSalesRate) : undefined,
      purchaseRate: newPurchaseRate ? parseFloat(newPurchaseRate) : undefined,
      mrp: newMrp ? parseFloat(newMrp) : undefined,
    }

    setAlternativeUnits([...alternativeUnits, newConv])
    
    setNewAltUnitId("")
    setNewConversionFactor("")
    setNewSalesRate("")
    setNewPurchaseRate("")
    setNewMrp("")
    toast.success("Conversion rule added successfully.")
  }

  const handleRemoveConversion = (index: number) => {
    setAlternativeUnits(alternativeUnits.filter((_, i) => i !== index))
    toast.info("Conversion rule removed.")
  }

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Product Name is required.")
      return
    }
    if (!productCode.trim()) {
      toast.error("Product Code is required.")
      return
    }
    if (!unitId) {
      toast.error("Base Unit is required.")
      return
    }
    if (!categoryId) {
      toast.error("Category is required.")
      return
    }
    if (!brandId) {
      toast.error("Brand is required.")
      return
    }
    if (!taxProfileId) {
      toast.error("GST Slab / Tax Profile is required.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload: ProductDto = {
        companyId: user?.companyId || "00000000-0000-0000-0000-000000000000",
        branchId: user?.branchId || "00000000-0000-0000-0000-000000000000",
        productCode: productCode.trim(),
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
        name: name.trim(),
        unitId,
        categoryId,
        brandId,
        manufacturerId: manufacturerId || undefined,
        hsnCodeId: hsnCodeId || undefined,
        taxProfileId,
        productType,
        trackInventory,
        trackBatch: false,
        trackExpiry: false,
        trackSerial: false,
        minStock: Number(minStock) || 0,
        reorderLevel: Number(reorderLevel) || 0,
        purchaseRate: Number(purchaseRate) || 0,
        salesRate: Number(salesRate) || 0,
        mrp: Number(mrp) || 0,
        isActive,
        alternativeUnits,
        isGstInclusive,
      }

      const response: any = await axiosClient.post("/Product", payload)

      if (response?.success) {
        toast.success("Product created successfully!")
        
        // Resolve UI helper fields for the onSuccess callback so the invoice grid works correctly
        const createdProduct: ProductDto = {
          ...payload,
          id: response.data?.id || response.data?.Id || response.data, // Backend response might contain Guid directly or in Data
          unitName: units.find((u) => u.id === unitId)?.name,
          categoryName: categories.find((c) => c.id === categoryId)?.name,
          brandName: brands.find((b) => b.id === brandId)?.name,
          taxProfileName: taxProfiles.find((t) => t.id === taxProfileId)?.name,
          alternativeUnits: alternativeUnits.map((alt) => ({
            ...alt,
            alternativeUnitName: alt.alternativeUnitName || units.find((u) => u.id === alt.alternativeUnitId)?.name,
            alternativeUnitSymbol: alt.alternativeUnitSymbol || units.find((u) => u.id === alt.alternativeUnitId)?.symbol,
            baseUnitName: alt.baseUnitName || units.find((u) => u.id === alt.baseUnitId)?.name,
            baseUnitSymbol: alt.baseUnitSymbol || units.find((u) => u.id === alt.baseUnitId)?.symbol,
          })),
        }

        onSuccess(createdProduct)
        onClose()
      } else {
        toast.error(response?.message || "Failed to create product.")
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.message || err?.message || "An error occurred while saving product.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-zinc-950 text-zinc-100 border border-zinc-800">
        <DialogHeader className="border-b border-zinc-800 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-50">
            <Plus className="h-5 w-5 text-indigo-500 bg-indigo-500/10 p-0.5 rounded" />
            Quick Add Product
          </DialogTitle>
        </DialogHeader>

        {isLoadingDeps ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="text-xs text-zinc-400">Loading catalog configurations...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 py-2">
            {/* Basic Info Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-zinc-900 pb-1">
                <Tag className="h-3.5 w-3.5" /> Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Product Name *"
                  placeholder="e.g. Wireless Mouse"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9"
                />
                <FormField
                  label="Product Code *"
                  placeholder="e.g. PROD-100"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  required
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9"
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Base Unit *</label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    required
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value="">Select Unit...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Product Type</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(Number(e.target.value))}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value={1}>Physical / Goods</option>
                    <option value={2}>Service / Intangible</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Categorization Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-zinc-900 pb-1">
                <Layers className="h-3.5 w-3.5" /> Categorization
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value="">Select Category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Brand *</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    required
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value="">Select Brand...</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Manufacturer (Optional)</label>
                  <select
                    value={manufacturerId}
                    onChange={(e) => setManufacturerId(e.target.value)}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value="">Select Manufacturer...</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">HSN Code (Optional)</label>
                  <select
                    value={hsnCodeId}
                    onChange={(e) => setHsnCodeId(e.target.value)}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value="">Select HSN Code...</option>
                    {hsnCodes.map((hsn) => (
                      <option key={hsn.id} value={hsn.id}>
                        {hsn.code} - {hsn.gstPercentage}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Code & Scan Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-zinc-900 pb-1">
                <Sparkles className="h-3.5 w-3.5" /> SKUs & Barcodes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="quick-sku" className="text-xs font-semibold text-zinc-400">
                      SKU
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                        {autoSku ? "Auto-Gen" : "Manual"}
                      </span>
                      <Switch
                        id="quick-autoSku"
                        checked={autoSku}
                        onCheckedChange={setAutoSku}
                        className="scale-75 origin-right"
                      />
                    </div>
                  </div>
                  <Input
                    id="quick-sku"
                    placeholder="Stock Keeping Unit"
                    readOnly={autoSku}
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={autoSku ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed font-mono h-9" : "bg-zinc-900 border-zinc-800 text-zinc-100 font-mono h-9"}
                    required
                  />
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <FormField
                      label="Barcode"
                      placeholder="Scan/Type Barcode"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateBarcode}
                    className="shrink-0 mb-[1px] h-9 px-3 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                  >
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            {/* Pricing & Tax Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-zinc-900 pb-1">
                <Percent className="h-3.5 w-3.5" /> Pricing & Tax Slab
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <FormField
                  label="Purchase Rate (₹)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseRate || ""}
                  onChange={(e) => setPurchaseRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono"
                />
                <FormField
                  label="Sales Rate (₹)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salesRate || ""}
                  onChange={(e) => setSalesRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono"
                />
                <FormField
                  label="MRP (₹)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={mrp || ""}
                  onChange={(e) => setMrp(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono"
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">GST Profile *</label>
                  <select
                    value={taxProfileId}
                    onChange={(e) => setTaxProfileId(e.target.value)}
                    required
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value="">GST Profile...</option>
                    {taxProfiles.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.name} ({tp.cgst + tp.sgst}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">GST Type *</label>
                  <select
                    value={isGstInclusive ? "inclusive" : "exclusive"}
                    onChange={(e) => setIsGstInclusive(e.target.value === "inclusive")}
                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  >
                    <option value="exclusive">GST Exclusive</option>
                    <option value="inclusive">GST Inclusive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Inventory Controls */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-zinc-900 pb-1">
                <Settings2 className="h-3.5 w-3.5" /> Inventory Controls
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-900/50 p-4 border border-zinc-900 rounded-lg">
                <div className="flex items-center justify-between">
                  <label htmlFor="quick-trackInventory" className="text-xs font-semibold text-zinc-400">
                    Track Inventory
                  </label>
                  <Switch
                    id="quick-trackInventory"
                    checked={trackInventory}
                    onCheckedChange={setTrackInventory}
                  />
                </div>

                <FormField
                  label="Min Stock"
                  type="number"
                  value={minStock || ""}
                  onChange={(e) => setMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={!trackInventory}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono disabled:opacity-40"
                />

                <FormField
                  label="Reorder Level"
                  type="number"
                  value={reorderLevel || ""}
                  onChange={(e) => setReorderLevel(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={!trackInventory}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono disabled:opacity-40"
                />
              </div>
            </div>

            {/* Unit Conversions Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-zinc-900 pb-1">
                <Scale className="h-3.5 w-3.5" /> Unit Conversions
              </h3>
              <div className="bg-zinc-900/50 p-4 border border-zinc-900 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Alternative Unit</label>
                    <select
                      value={newAltUnitId}
                      onChange={(e) => setNewAltUnitId(e.target.value)}
                      className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                    >
                      <option value="">Select Alt Unit...</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Conversion Factor (Multiplier)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 10"
                      value={newConversionFactor}
                      onChange={(e) => setNewConversionFactor(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Sales Rate Override (₹, Optional)</label>
                    <Input
                      type="number"
                      placeholder="Override rate"
                      value={newSalesRate}
                      onChange={(e) => setNewSalesRate(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Purchase Rate Override (₹, Optional)</label>
                    <Input
                      type="number"
                      placeholder="Override rate"
                      value={newPurchaseRate}
                      onChange={(e) => setNewPurchaseRate(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">MRP Override (₹, Optional)</label>
                    <Input
                      type="number"
                      placeholder="Override MRP"
                      value={newMrp}
                      onChange={(e) => setNewMrp(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 h-9 font-mono"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddConversion}
                  className="w-full text-xs h-9 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/20"
                >
                  Add Conversion Rule
                </Button>

                {/* Rules Table */}
                {alternativeUnits.length > 0 && (
                  <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 mt-4">
                    <Table>
                      <TableHeader className="bg-zinc-900/40">
                        <TableRow className="border-zinc-800 hover:bg-transparent">
                          <TableHead className="text-zinc-400 text-xs py-2">Alt Unit</TableHead>
                          <TableHead className="text-zinc-400 text-xs py-2">Factor</TableHead>
                          <TableHead className="text-zinc-400 text-xs py-2 text-right">Sales Rate</TableHead>
                          <TableHead className="text-zinc-400 text-xs py-2 text-right">Purchase Rate</TableHead>
                          <TableHead className="text-zinc-400 text-xs py-2 text-right">MRP</TableHead>
                          <TableHead className="w-[50px] py-2"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {alternativeUnits.map((conv, idx) => (
                          <TableRow key={idx} className="border-zinc-800 hover:bg-zinc-900/20 text-xs">
                            <TableCell className="font-semibold text-zinc-200 py-2">
                              {conv.alternativeUnitName || units.find((u) => u.id === conv.alternativeUnitId)?.name} (
                              {conv.alternativeUnitSymbol || units.find((u) => u.id === conv.alternativeUnitId)?.symbol})
                            </TableCell>
                            <TableCell className="font-mono text-zinc-300 py-2">
                              1 Alt Unit = {conv.conversionFactor} Base Units
                            </TableCell>
                            <TableCell className="text-right font-mono text-zinc-300 py-2">
                              {conv.salesRate !== undefined && conv.salesRate !== null ? `₹${Number(conv.salesRate).toFixed(2)}` : "Calculated"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-zinc-300 py-2">
                              {conv.purchaseRate !== undefined && conv.purchaseRate !== null ? `₹${Number(conv.purchaseRate).toFixed(2)}` : "Calculated"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-zinc-300 py-2">
                              {conv.mrp !== undefined && conv.mrp !== null ? `₹${Number(conv.mrp).toFixed(2)}` : "Calculated"}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => handleRemoveConversion(idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-zinc-800 pt-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save & Select Product"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
