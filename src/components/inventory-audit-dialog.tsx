'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { auditInventory, fixInventoryDiscrepancies, type AuditSummary, type InventoryAuditResult } from '@/utils/inventory-audit'
import { recalculateAllInventory, type RecalculationResult } from '@/utils/inventory-recalculator'
import { runInventoryDiagnostics, checkInventorySettings, checkUserPermissions, type DiagnosticResult } from '@/utils/inventory-diagnostics'

interface InventoryAuditDialogProps {
  open: boolean
  onClose: () => void
  organizationId: string
  onAuditComplete?: () => void
}

export default function InventoryAuditDialog({ 
  open, 
  onClose, 
  organizationId, 
  onAuditComplete 
}: InventoryAuditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [auditResult, setAuditResult] = useState<AuditSummary | null>(null)
  const [recalcResult, setRecalcResult] = useState<RecalculationResult[] | null>(null)
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult[] | null>(null)
  const { toast } = useToast()

  const runAudit = async () => {
    setLoading(true)
    try {
      const result = await auditInventory(organizationId)
      setAuditResult(result)
      
      toast({
        title: "Auditoría completada",
        description: `${result.discrepancies} discrepancias encontradas de ${result.totalProducts} registros`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Error ejecutando auditoría de inventario",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fixDiscrepancies = async () => {
    if (!auditResult) return
    
    setFixing(true)
    try {
      const discrepantResults = auditResult.results.filter(r => r.hasDiscrepancy)
      const { fixed, errors } = await fixInventoryDiscrepancies(discrepantResults, organizationId)
      
      toast({
        title: "Corrección completada",
        description: `${fixed} discrepancias corregidas. ${errors.length} errores.`,
      })

      if (errors.length > 0) {
        console.error('Errores en corrección:', errors)
      }

      // Re-ejecutar auditoría para ver resultados
      await runAudit()
      
      if (onAuditComplete) {
        onAuditComplete()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error corrigiendo discrepancias",
        variant: "destructive",
      })
    } finally {
      setFixing(false)
    }
  }

  const runRecalculation = async () => {
    setRecalculating(true)
    try {
      const results = await recalculateAllInventory(organizationId)
      setRecalcResult(results)
      
      const corrected = results.filter(r => r.corrected).length
      
      toast({
        title: "Recálculo completado",
        description: `${corrected} registros corregidos de ${results.length} procesados`,
      })
      
      // Re-ejecutar auditoría para ver resultados
      await runAudit()
      
      if (onAuditComplete) {
        onAuditComplete()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error ejecutando recálculo de inventario",
        variant: "destructive",
      })
    } finally {
      setRecalculating(false)
    }
  }

  const runDiagnostics = async () => {
    setDiagnosing(true)
    try {
      const diagnostics = await runInventoryDiagnostics(organizationId)
      const settings = await checkInventorySettings(organizationId)
      const permissions = await checkUserPermissions()
      
      setDiagnosticResult(diagnostics)
      
      console.log('=== INVENTORY DIAGNOSTICS ===')
      console.log('Settings:', settings)
      console.log('Permissions:', permissions)
      console.log('Table Access:', diagnostics)
      console.log('========================')
      
      toast({
        title: "Diagnóstico completado",
        description: "Revisa la consola para detalles completos",
      })
    } catch (error) {
      toast({
        title: "Error en diagnóstico",
        description: "Error ejecutando diagnósticos",
        variant: "destructive",
      })
    } finally {
      setDiagnosing(false)
    }
  }

  const handleClose = () => {
    setAuditResult(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auditoría de Inventario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!auditResult ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                La auditoría revisará todos los movimientos de inventario y detectará inconsistencias.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={runAudit} disabled={loading}>
                  {loading ? 'Ejecutando...' : 'Ejecutar Auditoría'}
                </Button>
                <Button onClick={runDiagnostics} disabled={diagnosing} variant="outline">
                  {diagnosing ? 'Diagnosticando...' : 'Ejecutar Diagnóstico'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">{auditResult.totalProducts}</div>
                  <div className="text-sm text-muted-foreground">Registros</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{auditResult.discrepancies}</div>
                  <div className="text-sm text-muted-foreground">Discrepancias</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{auditResult.totalMovements}</div>
                  <div className="text-sm text-muted-foreground">Movimientos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {auditResult.totalProducts - auditResult.discrepancies}
                  </div>
                  <div className="text-sm text-muted-foreground">Correctos</div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2">
                {auditResult.discrepancies > 0 && (
                  <Button onClick={fixDiscrepancies} disabled={fixing} variant="destructive">
                    {fixing ? 'Corrigiendo...' : 'Corregir Discrepancias'}
                  </Button>
                )}
                <Button onClick={runRecalculation} disabled={recalculating} variant="default">
                  {recalculating ? 'Recalculando...' : 'Recalcular Todo'}
                </Button>
                <Button onClick={runAudit} variant="outline" disabled={loading}>
                  Re-ejecutar Auditoría
                </Button>
              </div>

              {/* Detalles de discrepancias */}
              {auditResult.discrepancies > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Discrepancias Encontradas</h3>
                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    {auditResult.results
                      .filter(r => r.hasDiscrepancy)
                      .map((result, index) => (
                        <DiscrepancyItem key={index} result={result} />
                      ))}
                  </div>
                </div>
              )}

              {/* Resultados correctos (sample) */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  Registros Correctos 
                  <Badge variant="outline" className="ml-2">
                    {auditResult.results.filter(r => !r.hasDiscrepancy).length}
                  </Badge>
                </h3>
                <div className="text-sm text-muted-foreground">
                  Todos los registros restantes tienen stock consistente con sus movimientos.
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DiscrepancyItem({ result }: { result: InventoryAuditResult }) {
  return (
    <div className="p-3 border-b last:border-b-0">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{result.productName}</div>
          <div className="text-sm text-muted-foreground">{result.branchName}</div>
        </div>
        <div className="text-right">
          <div className="text-sm">
            <span className="text-red-600">Stock: {result.currentStock}</span>
            {' → '}
            <span className="text-green-600">Calculado: {result.calculatedStock}</span>
          </div>
          <div className="text-sm font-medium">
            Diferencia: 
            <span className={result.difference > 0 ? 'text-red-600' : 'text-blue-600'}>
              {result.difference > 0 ? '+' : ''}{result.difference}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}