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
  // Validate required data
  if (!organization || !client || !invoice || !items) {
    throw new Error('Datos requeridos faltantes para generar el PDF');
  }

  try {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height;
    let y = 15; // Initial y position

  // --- Professional Header with Logo ---
  if (organization.logo_url) {
    try {
      const response = await fetch(organization.logo_url);
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => {
          // Professional logo sizing - much larger and better positioned
          const logoSize = 40; // Increased from 25 to 40
          const logoX = 15;
          const logoY = y;
          
          // Add the logo with better quality (no border)
          doc.addImage(reader.result as string, 'JPEG', logoX, logoY, logoSize, logoSize);
          
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Error loading logo:', error);
    }
  }

  // Company information with better typography and spacing
  const companyInfoX = organization.logo_url ? 65 : 15; // Adjust position based on logo presence
  
  // Company name with enhanced styling
  doc.setFontSize(22); // Increased font size
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(44, 62, 80); // Professional dark blue-gray
  doc.text(organization.name || 'Sin nombre', companyInfoX, y + 12);
  
  // Company details with consistent styling
  doc.setFontSize(11); // Slightly larger for better readability
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(52, 73, 94); // Slightly lighter gray
  
  let detailY = y + 20;
  if (organization.settings?.address) {
    doc.text(organization.settings.address, companyInfoX, detailY);
    detailY += 6;
  }
  if (organization.settings?.rnc) {
    doc.text(`RNC: ${organization.settings.rnc}`, companyInfoX, detailY);
    detailY += 6;
  }
  if (organization.settings?.phone) {
    doc.text(`Tel: ${organization.settings.phone}`, companyInfoX, detailY);
    detailY += 6;
  }
  if (organization.settings?.email) {
    doc.text(`Email: ${organization.settings.email}`, companyInfoX, detailY);
    detailY += 6;
  }
  
  // Add a professional separator line
  doc.setDrawColor(255, 140, 0); // Orange color
  doc.setLineWidth(1);
  doc.line(15, y + 50, 195, y + 50);
  
  // Reset text color for the rest of the document
  doc.setTextColor(0, 0, 0);
  
  y += 60; // Increased spacing for better layout

  // --- Invoice Details Section with Professional Styling ---
  // Invoice title with background
  doc.setFillColor(255, 140, 0); // Orange background
  doc.rect(15, y - 2, 80, 18, 'F');
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', 18, y + 8);
  
  // Reset colors and add invoice details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número: ${invoice.invoice_number || 'Sin número'}`, 15, y + 22);
  doc.text(`Fecha de Emisión: ${formatDate(invoice.issue_date)}`, 15, y + 29);
  doc.text(`Fecha de Vencimiento: ${formatDate(invoice.due_date)}`, 15, y + 36);

  // --- Client Details Section with Professional Styling ---
  // Client title with background
  doc.setFillColor(52, 73, 94); // Professional gray background
  doc.rect(110, y - 2, 80, 18, 'F');
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', 113, y + 8);
  
  // Reset colors and add client details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(client.name || 'Sin nombre', 110, y + 22);
  let clientDetailY = y + 29;
  if (client.address) {
    doc.text(client.address, 110, clientDetailY);
    clientDetailY += 7;
  }
  doc.text(client.email || 'Sin email', 110, clientDetailY);
  clientDetailY += 7;
  if (client.rnc) {
    doc.text(`RNC/Cédula: ${client.rnc}`, 110, clientDetailY);
  }

  y += 50; // Increased spacing

  // --- Items Table ---
  const tableColumn = ["Descripción", "Cantidad", "Precio Unit.", "Total"];
  const tableRows: any[] = [];

  items.forEach(item => {
    const itemData = [
      item.product_name || 'Sin nombre',
      item.quantity || 0,
      formatCurrency(item.unit_price || 0),
      formatCurrency(item.total || 0)
    ];
    tableRows.push(itemData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: y,
    theme: 'striped',
    headStyles: {
      fillColor: [255, 140, 0], // Orange color
      textColor: [255, 255, 255], // White text
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 4
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250] // Very light gray for alternate rows
    },
    columnStyles: {
      0: { halign: 'left' }, // Description
      1: { halign: 'center' }, // Quantity
      2: { halign: 'right' }, // Unit Price
      3: { halign: 'right' } // Total
    },
    margin: { left: 15, right: 15 },
    tableWidth: 'auto'
  });

  if (doc.lastAutoTable) {
    y = doc.lastAutoTable.finalY + 10;
  }

  // --- Professional Totals Section ---
  const totalsX = 120;
  const totalsWidth = 75;
  
  // Add background for totals section
  doc.setFillColor(248, 249, 250); // Light gray background
  doc.rect(totalsX - 5, y - 5, totalsWidth + 10, 45, 'F');
  
  // Add border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(totalsX - 5, y - 5, totalsWidth + 10, 45);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(52, 73, 94);
  
  // Subtotal
  doc.text('Subtotal:', totalsX, y);
  const subtotalText = formatCurrency(invoice.subtotal);
  const subtotalWidth = doc.getTextWidth(subtotalText);
  doc.text(subtotalText, totalsX + totalsWidth - subtotalWidth, y);
  
  y += 8;
  // Tax
  doc.text(`ITBIS (${((invoice.tax / invoice.subtotal) * 100 || 0).toFixed(0)}%):`, totalsX, y);
  const taxText = formatCurrency(invoice.tax);
  const taxWidth = doc.getTextWidth(taxText);
  doc.text(taxText, totalsX + totalsWidth - taxWidth, y);
  
  y += 8;
  // Total with emphasis
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0); // Black color
  doc.text('Total:', totalsX, y);
  const totalText = formatCurrency(invoice.total);
  const totalWidth = doc.getTextWidth(totalText);
  doc.text(totalText, totalsX + totalsWidth - totalWidth, y);

  y += 10;
  // Paid amount
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(52, 73, 94);
  doc.text('Pagado:', totalsX, y);
  const paidText = formatCurrency(invoice.total - (invoice.balance ?? invoice.total));
  const paidWidth = doc.getTextWidth(paidText);
  doc.text(paidText, totalsX + totalsWidth - paidWidth, y);

  y += 8;
  // Balance with emphasis if there's a balance
  const balance = invoice.balance ?? 0;
  if (balance > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(231, 76, 60); // Red for pending balance
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(39, 174, 96); // Green for paid
  }
  doc.text('Balance Pendiente:', totalsX, y);
  const balanceText = formatCurrency(balance);
  const balanceWidth = doc.getTextWidth(balanceText);
  doc.text(balanceText, totalsX + totalsWidth - balanceWidth, y);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);

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
    // Removed page numbering as requested
  }

    doc.save(`Factura-${invoice.invoice_number || 'sin-numero'}.pdf`);
  } catch (error) {
    console.error('Error en generateInvoicePdf:', error);
    console.error('Datos recibidos:', { organization, client, invoice, items });
    throw new Error(`Error al generar PDF de factura: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

export const generateQuotePdf = async (
  organization: Organization,
  client: Client,
  quote: Quote,
  items: InvoiceItem[] // Reusing InvoiceItem for simplicity
) => {
  // Validate required data
  if (!organization || !client || !quote || !items) {
    throw new Error('Datos requeridos faltantes para generar el PDF');
  }

  try {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height;
    let y = 15;

  // --- Professional Header with Logo ---
  if (organization.logo_url) {
    try {
      const response = await fetch(organization.logo_url);
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => {
          // Professional logo sizing - much larger and better positioned
          const logoSize = 40; // Increased from 25 to 40
          const logoX = 15;
          const logoY = y;
          
          // Add the logo with better quality (no border)
          doc.addImage(reader.result as string, 'JPEG', logoX, logoY, logoSize, logoSize);
          
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Error loading logo:', error);
    }
  }

  // Company information with better typography and spacing
  const companyInfoX = organization.logo_url ? 65 : 15; // Adjust position based on logo presence
  
  // Company name with enhanced styling
  doc.setFontSize(22); // Increased font size
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(44, 62, 80); // Professional dark blue-gray
  doc.text(organization.name || 'Sin nombre', companyInfoX, y + 12);
  
  // Company details with consistent styling
  doc.setFontSize(11); // Slightly larger for better readability
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(52, 73, 94); // Slightly lighter gray
  
  let detailY = y + 20;
  if (organization.settings?.address) {
    doc.text(organization.settings.address, companyInfoX, detailY);
    detailY += 6;
  }
  if (organization.settings?.rnc) {
    doc.text(`RNC: ${organization.settings.rnc}`, companyInfoX, detailY);
    detailY += 6;
  }
  if (organization.settings?.phone) {
    doc.text(`Tel: ${organization.settings.phone}`, companyInfoX, detailY);
    detailY += 6;
  }
  if (organization.settings?.email) {
    doc.text(`Email: ${organization.settings.email}`, companyInfoX, detailY);
    detailY += 6;
  }
  
  // Add a professional separator line
  doc.setDrawColor(255, 140, 0); // Orange color
  doc.setLineWidth(1);
  doc.line(15, y + 50, 195, y + 50);
  
  // Reset text color for the rest of the document
  doc.setTextColor(0, 0, 0);
  
  y += 60; // Increased spacing for better layout

  // --- Quote Details Section with Professional Styling ---
  // Quote title with background
  doc.setFillColor(255, 140, 0); // Orange background
  doc.rect(15, y - 2, 80, 18, 'F');
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACIÓN', 18, y + 8);
  
  // Reset colors and add quote details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número: ${quote.quote_number || 'Sin número'}`, 15, y + 22);
  doc.text(`Fecha de Emisión: ${formatDate(quote.issue_date)}`, 15, y + 29);
  doc.text(`Válida Hasta: ${formatDate(quote.valid_until)}`, 15, y + 36);

  // --- Client Details Section with Professional Styling ---
  // Client title with background
  doc.setFillColor(52, 73, 94); // Professional gray background
  doc.rect(110, y - 2, 80, 18, 'F');
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', 113, y + 8);
  
  // Reset colors and add client details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(client.name || 'Sin nombre', 110, y + 22);
  let clientDetailY = y + 29;
  if (client.address) {
    doc.text(client.address, 110, clientDetailY);
    clientDetailY += 7;
  }
  doc.text(client.email || 'Sin email', 110, clientDetailY);
  clientDetailY += 7;
  if (client.rnc) {
    doc.text(`RNC/Cédula: ${client.rnc}`, 110, clientDetailY);
  }

  y += 50; // Increased spacing

  // --- Items Table ---
  const tableColumn = ["Descripción", "Cantidad", "Precio Unit.", "Total"];
  const tableRows: any[] = [];

  items.forEach(item => {
    const itemData = [
      item.product_name || 'Sin nombre',
      item.quantity || 0,
      formatCurrency(item.unit_price || 0),
      formatCurrency(item.total || 0)
    ];
    tableRows.push(itemData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: y,
    theme: 'striped',
    headStyles: {
      fillColor: [255, 140, 0], // Orange color
      textColor: [255, 255, 255], // White text
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 4
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250] // Very light gray for alternate rows
    },
    columnStyles: {
      0: { halign: 'left' }, // Description
      1: { halign: 'center' }, // Quantity
      2: { halign: 'right' }, // Unit Price
      3: { halign: 'right' } // Total
    },
    margin: { left: 15, right: 15 },
    tableWidth: 'auto'
  });

  if (doc.lastAutoTable) {
    y = doc.lastAutoTable.finalY + 10;
  }

  // --- Professional Totals Section ---
  const totalsX = 120;
  const totalsWidth = 75;
  
  // Add background for totals section
  doc.setFillColor(248, 249, 250); // Light gray background
  doc.rect(totalsX - 5, y - 5, totalsWidth + 10, 35, 'F');
  
  // Add border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(totalsX - 5, y - 5, totalsWidth + 10, 35);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(52, 73, 94);
  
  // Subtotal
  doc.text('Subtotal:', totalsX, y);
  const quoteSubtotalText = formatCurrency(quote.subtotal);
  const quoteSubtotalWidth = doc.getTextWidth(quoteSubtotalText);
  doc.text(quoteSubtotalText, totalsX + totalsWidth - quoteSubtotalWidth, y);
  
  y += 8;
  // Tax
  doc.text(`ITBIS (${((quote.tax_amount / quote.subtotal) * 100 || 0).toFixed(0)}%):`, totalsX, y);
  const quoteTaxText = formatCurrency(quote.tax_amount);
  const quoteTaxWidth = doc.getTextWidth(quoteTaxText);
  doc.text(quoteTaxText, totalsX + totalsWidth - quoteTaxWidth, y);
  
  y += 8;
  // Total with emphasis
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0); // Black color
  doc.text('Total:', totalsX, y);
  const quoteTotalText = formatCurrency(quote.total);
  const quoteTotalWidth = doc.getTextWidth(quoteTotalText);
  doc.text(quoteTotalText, totalsX + totalsWidth - quoteTotalWidth, y);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);

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
    // Removed page numbering as requested
  }

    doc.save(`Cotizacion-${quote.quote_number || 'sin-numero'}.pdf`);
  } catch (error) {
    console.error('Error en generateQuotePdf:', error);
    console.error('Datos recibidos:', { organization, client, quote, items });
    throw new Error(`Error al generar PDF de cotización: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}