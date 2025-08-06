import { Metadata } from 'next'
import IncomeClient from './income-client'

export const metadata: Metadata = {
  title: 'Ingresos - SaaS Facturas',
  description: 'Gestiona los ingresos generales de tu organización',
}

export const dynamic = 'force-dynamic'

export default function IncomeePage() {
  return <IncomeClient />
}