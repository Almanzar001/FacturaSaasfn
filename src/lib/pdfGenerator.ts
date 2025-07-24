import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { User as SupabaseUser } from '@supabase/supabase-js'

// Extend jsPDF with autoTable properties
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

// Interfaces from invoices-complete.tsx and settings-client.tsx
interface Organization {
  id: string
  name: string
  logo_url: string | null
  settings: {
    rnc?: string
    address?: string
    phone?: string
    email?: string
    pdf_footer_message?: string
  }
}

interface Client {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  rnc?: string
}

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_email: string
  subtotal: number
  tax: number
  total: number
  balance?: number
  status: string
  issue_date: string
  due_date: string
  notes?: string
}

interface InvoiceItem {
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

interface Quote {
  id: string
  quote_number: string
  client_name: string
  client_email: string
  subtotal: number
  tax_amount: number
  total: number
  status: string
  issue_date: string
  valid_until: string
  notes?: string
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP'
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-DO')
}

export const generateInvoicePdf = async (
  organization: Organization,
  client: Client,
  invoice: Invoice,
  items: InvoiceItem[]
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const pageHeight = doc.internal.pageSize.height;
  let y = 15; // Initial y position

  // --- Header ---
  if (organization.logo_url) {
    try {
      const response = await fetch(organization.logo_url);
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => {
          doc.addImage(reader.result as string, 'PNG', 15, y, 25, 25);
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
    }
  }

  doc.setFontSize(18);
  doc.text(organization.name, 50, y + 7);
  doc.setFontSize(10);
  doc.text(organization.settings?.address || '', 50, y + 13);
  doc.text(`RNC: ${organization.settings?.rnc || ''}`, 50, y + 18);
  doc.text(`Tel: ${organization.settings?.phone || ''}`, 50, y + 23);
  
  y += 40;

  // --- Invoice Details ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número: ${invoice.invoice_number}`, 15, y + 7);
  doc.text(`Fecha de Emisión: ${formatDate(invoice.issue_date)}`, 15, y + 14);
  doc.text(`Fecha de Vencimiento: ${formatDate(invoice.due_date)}`, 15, y + 21);

  // --- Client Details ---
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 110, y);
  doc.setFont('helvetica', 'normal');
  doc.text(client.name, 110, y + 7);
  doc.text(client.address || '', 110, y + 14);
  doc.text(client.email, 110, y + 21);
  doc.text(`RNC/Cédula: ${client.rnc || ''}`, 110, y + 28);

  y += 35;

  // --- Items Table ---
  const tableColumn = ["Descripción", "Cantidad", "Precio Unit.", "Total"];
  const tableRows: any[] = [];

  items.forEach(item => {
    const itemData = [
      item.product_name,
      item.quantity,
      formatCurrency(item.unit_price),
      formatCurrency(item.total)
    ];
    tableRows.push(itemData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: y,
    theme: 'striped',
    headStyles: { fillColor: [22, 160, 133] }, // Theme color
  });

  if (doc.lastAutoTable) {
    y = doc.lastAutoTable.finalY + 10;
  }

  // --- Totals ---
  const totalsX = 140;
  doc.setFontSize(10);
  doc.text('Subtotal:', totalsX, y);
  doc.text(formatCurrency(invoice.subtotal), 195, y, { align: 'right' });
  
  y += 7;
  doc.text(`ITBIS (${((invoice.tax / invoice.subtotal) * 100 || 0).toFixed(0)}%):`, totalsX, y);
  doc.text(formatCurrency(invoice.tax), 195, y, { align: 'right' });
  
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', totalsX, y);
  doc.text(formatCurrency(invoice.total), 195, y, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('Pagado:', totalsX, y);
  doc.text(formatCurrency(invoice.total - (invoice.balance ?? invoice.total)), 195, y, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Balance Pendiente:', totalsX, y);
  doc.text(formatCurrency(invoice.balance ?? 0), 195, y, { align: 'right' });

  // --- Notes ---
  if (invoice.notes) {
    y = pageHeight - 40;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas:', 15, y);
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(invoice.notes, 180);
    doc.text(splitNotes, 15, y + 5);
  }

  // --- Footer ---
  const pageCount = doc.internal.pages.length;
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.text(organization.settings?.pdf_footer_message || 'Gracias por su negocio.', 15, footerY);
    doc.text(`Página ${i} de ${pageCount}`, 195, footerY, { align: 'right' });
  }

  doc.save(`Factura-${invoice.invoice_number}.pdf`);
}

export const generateQuotePdf = async (
  organization: Organization,
  client: Client,
  quote: Quote,
  items: InvoiceItem[] // Reusing InvoiceItem for simplicity
) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const pageHeight = doc.internal.pageSize.height;
  let y = 15;

  // --- Header ---
  if (organization.logo_url) {
    try {
      const response = await fetch(organization.logo_url);
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => {
          doc.addImage(reader.result as string, 'PNG', 15, y, 25, 25);
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
    }
  }

  doc.setFontSize(18);
  doc.text(organization.name, 50, y + 7);
  doc.setFontSize(10);
  doc.text(organization.settings?.address || '', 50, y + 13);
  doc.text(`RNC: ${organization.settings?.rnc || ''}`, 50, y + 18);
  doc.text(`Tel: ${organization.settings?.phone || ''}`, 50, y + 23);
  
  y += 40;

  // --- Quote Details ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACIÓN', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número: ${quote.quote_number}`, 15, y + 7);
  doc.text(`Fecha de Emisión: ${formatDate(quote.issue_date)}`, 15, y + 14);
  doc.text(`Válida Hasta: ${formatDate(quote.valid_until)}`, 15, y + 21);

  // --- Client Details ---
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 110, y);
  doc.setFont('helvetica', 'normal');
  doc.text(client.name, 110, y + 7);
  doc.text(client.address || '', 110, y + 14);
  doc.text(client.email, 110, y + 21);
  doc.text(`RNC/Cédula: ${client.rnc || ''}`, 110, y + 28);

  y += 35;

  // --- Items Table ---
  const tableColumn = ["Descripción", "Cantidad", "Precio Unit.", "Total"];
  const tableRows: any[] = [];

  items.forEach(item => {
    const itemData = [
      item.product_name,
      item.quantity,
      formatCurrency(item.unit_price),
      formatCurrency(item.total)
    ];
    tableRows.push(itemData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: y,
    theme: 'striped',
    headStyles: { fillColor: [22, 160, 133] },
  });

  if (doc.lastAutoTable) {
    y = doc.lastAutoTable.finalY + 10;
  }

  // --- Totals ---
  const totalsX = 140;
  doc.setFontSize(10);
  doc.text('Subtotal:', totalsX, y);
  doc.text(formatCurrency(quote.subtotal), 195, y, { align: 'right' });
  
  y += 7;
  doc.text(`ITBIS (${((quote.tax_amount / quote.subtotal) * 100 || 0).toFixed(0)}%):`, totalsX, y);
  doc.text(formatCurrency(quote.tax_amount), 195, y, { align: 'right' });
  
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', totalsX, y);
  doc.text(formatCurrency(quote.total), 195, y, { align: 'right' });

  // --- Notes ---
  if (quote.notes) {
    y = pageHeight - 40;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas:', 15, y);
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(quote.notes, 180);
    doc.text(splitNotes, 15, y + 5);
  }

  // --- Footer ---
  const pageCountQuote = doc.internal.pages.length;
  for(let i = 1; i <= pageCountQuote; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.text(organization.settings?.pdf_footer_message || 'Gracias por su interés.', 15, footerY);
    doc.text(`Página ${i} de ${pageCountQuote}`, 195, footerY, { align: 'right' });
  }

  doc.save(`Cotizacion-${quote.quote_number}.pdf`);
}