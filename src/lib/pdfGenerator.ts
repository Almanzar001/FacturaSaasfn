import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { User as SupabaseUser } from '@supabase/supabase-js'

// Helper function to load image as base64 with dimensions
const loadImageAsBase64 = async (url: string): Promise<{dataURL: string, width: number, height: number}> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto del canvas'));
        return;
      }
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve({
        dataURL,
        width: img.width,
        height: img.height
      });
    };
    img.onerror = () => reject(new Error('Error al cargar la imagen'));
    img.src = url;
  });
};

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
  digital_signature_url: string | null
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
  discount_percentage?: number
  discount_amount?: number
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

  // Validate organization has required fields
  if (!organization.name) {
    throw new Error('El nombre de la organización es requerido para generar el PDF');
  }

  // Validate client has required fields
  if (!client.name) {
    throw new Error('El nombre del cliente es requerido para generar el PDF');
  }

  // Validate invoice has required fields
  if (!invoice.invoice_number || !invoice.issue_date || !invoice.due_date) {
    throw new Error('Datos de la factura incompletos (número, fecha de emisión o vencimiento)');
  }

  try {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;

    // --- Header ---
    // Company Info (Left)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(organization.name, 15, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (organization.settings?.rnc) {
      doc.text(`RNC: ${organization.settings.rnc}`, 15, y);
      y += 5;
    }
    if (organization.settings?.address) {
      doc.text(organization.settings.address, 15, y);
      y += 5;
    }
    if (organization.settings?.phone) {
      doc.text(organization.settings.phone, 15, y);
      y += 5;
    }
    if (organization.settings?.email) {
      doc.text(organization.settings.email, 15, y);
      y += 5;
    }
    doc.text('Sucursal: Principal', 15, y);


    // Logo and NCF Info (Right)
    let rightColX = pageWidth - 15;
    if (organization.logo_url) {
      try {
        const response = await fetch(organization.logo_url);
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onload = () => {
            const logoSize = 30;
            const logoX = rightColX - logoSize;
            const logoY = 15;
            doc.addImage(reader.result as string, 'JPEG', logoX, logoY, logoSize, logoSize);
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        // Silently ignore logo loading errors
      }
    }

    y = 50; // Reset Y for NCF info below logo
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Show invoice number as document identifier
    const ncfText = `FACTURA ${invoice.invoice_number}`;
    const ncfTextWidth = doc.getTextWidth(ncfText);
    doc.text(ncfText, rightColX - ncfTextWidth, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    const fiscalText = 'Factura de Venta';
    const fiscalTextWidth = doc.getTextWidth(fiscalText);
    doc.text(fiscalText, rightColX - fiscalTextWidth, y);
    y += 5;

    // Use due date or current date
    const ncfDateText = formatDate(invoice.due_date);
    const ncfDateTextWidth = doc.getTextWidth(ncfDateText);
    doc.text(ncfDateText, rightColX - ncfDateTextWidth, y);


    // --- Dates ---
    y = 70;
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA DE EXPEDICIÓN', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(invoice.issue_date), 65, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA DE VENCIMIENTO', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(invoice.due_date), 65, y);

    // --- Client Info Box ---
    y += 10;
    doc.setDrawColor(128, 128, 128); // Gray border
    doc.setLineWidth(0.5);
    doc.rect(14, y, pageWidth - 28, 25); // Box

    const clientY = y;
    // Row 1
    doc.setFillColor(220, 220, 220); // Light gray background
    doc.rect(14, clientY, 25, 8, 'F'); // Box for SEÑOR(ES)
    doc.setFont('helvetica', 'bold');
    doc.text('SEÑOR(ES)', 16, clientY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(client.name, 42, clientY + 6);

    // Row 2
    doc.setFillColor(220, 220, 220);
    doc.rect(14, clientY + 8, 25, 8, 'F'); // Box for DIRECCIÓN
    doc.setFont('helvetica', 'bold');
    doc.text('DIRECCIÓN', 16, clientY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(client.address || '', 42, clientY + 14);

    // Row 3
    doc.setFillColor(220, 220, 220);
    doc.rect(14, clientY + 16, 25, 9, 'F'); // Box for RNC
    doc.setFont('helvetica', 'bold');
    doc.text('RNC', 16, clientY + 22);
    doc.setFont('helvetica', 'normal');
    doc.text(client.rnc || '', 42, clientY + 22);

    doc.setFillColor(220, 220, 220);
    doc.rect(100, clientY + 16, 20, 9, 'F'); // Box for CIUDAD
    doc.setFont('helvetica', 'bold');
    doc.text('CIUDAD', 102, clientY + 22);
    doc.setFont('helvetica', 'normal');
    // Extract city from client address only
    const clientCity = client.address?.split(',').pop()?.trim() || 'N/A';
    doc.text(clientCity, 122, clientY + 22);

    doc.setFillColor(220, 220, 220);
    doc.rect(pageWidth - 68, clientY, 25, 8, 'F'); // Box for TELEFONO
    doc.setFont('helvetica', 'bold');
    doc.text('TELEFONO', pageWidth - 66, clientY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(client.phone || '', pageWidth - 40, clientY + 6);


    y += 35; // Space after client box

    // --- Items Table ---
    const tableColumn = ["Producto/servicio", "Precio", "Cantidad", "Descuento"];
    const tableRows: any[] = [];

    items.forEach(item => {
      const itemData = [
        item.product_name || 'Producto sin nombre',
        formatCurrency(item.unit_price || 0),
        (item.quantity || 0).toString(),
        '0.00%' // Placeholder for discount
      ];
      tableRows.push(itemData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: y,
      theme: 'grid',
      headStyles: {
        fillColor: [60, 60, 60],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineWidth: 0.1,
        lineColor: [128, 128, 128],
        valign: 'top',
        minCellHeight: 12,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 'auto' }, // Producto - auto para ajustarse
        1: { halign: 'center', cellWidth: 40 }, // Precio - centralizado
        2: { halign: 'center', cellWidth: 30 }, // Cantidad - centralizado
        3: { halign: 'center', cellWidth: 35 } // Descuento - centralizado
      },
      margin: { left: 14, right: 14 },
    });

    if (doc.lastAutoTable) {
      y = doc.lastAutoTable.finalY;
    } else {
      y += 50; // Fallback
    }

    // --- Totals Section ---
    const totalsX = pageWidth - 84;
    const valueX = pageWidth - 14;
    y += 15; // Increased space

    // Subtotal
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal', totalsX, y);
    const subtotalText = formatCurrency(invoice.subtotal);
    const subtotalWidth = doc.getTextWidth(subtotalText);
    doc.text(subtotalText, valueX - subtotalWidth, y);
    y += 7;

    // Discount (if applicable)
    if (invoice.discount_amount && invoice.discount_amount > 0) {
      doc.setFont('helvetica', 'normal');
      const discountPercentage = (invoice.discount_percentage || 0).toFixed(2);
      doc.text(`Descuento (${discountPercentage}%)`, totalsX, y);
      const discountText = `-${formatCurrency(invoice.discount_amount)}`;
      const discountWidth = doc.getTextWidth(discountText);
      doc.text(discountText, valueX - discountWidth, y);
      y += 7;
    }

    // ITBIS
    doc.setFillColor(220, 220, 220);
    doc.rect(totalsX - 2, y - 5, 72, 7, 'F');
    doc.setFont('helvetica', 'bold');
    const subtotalAfterDiscount = invoice.subtotal - (invoice.discount_amount || 0);
    const taxPercentage = ((invoice.tax / subtotalAfterDiscount) * 100 || 0).toFixed(2);
    doc.text(`ITBIS (${taxPercentage}%)`, totalsX, y);
    const taxText = formatCurrency(invoice.tax);
    const taxWidth = doc.getTextWidth(taxText);
    doc.text(taxText, valueX - taxWidth, y);
    y += 7;

    // Total
    doc.setFillColor(220, 220, 220);
    doc.rect(totalsX - 2, y - 5, 72, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Total', totalsX, y);
    const totalText = formatCurrency(invoice.total);
    const totalWidth = doc.getTextWidth(totalText);
    doc.text(totalText, valueX - totalWidth, y);
    y += 10;

    // Payment information section
    if (invoice.balance !== undefined && invoice.balance !== invoice.total) {
      const paidAmount = invoice.total - invoice.balance;
      
      // Paid amount
      doc.setFont('helvetica', 'normal');
      doc.text('Pagado', totalsX, y);
      const paidText = formatCurrency(paidAmount);
      const paidWidth = doc.getTextWidth(paidText);
      doc.text(paidText, valueX - paidWidth, y);
      y += 7;

      // Balance remaining
      doc.setFillColor(255, 240, 240);
      doc.rect(totalsX - 2, y - 5, 72, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('Resta', totalsX, y);
      const balanceText = formatCurrency(invoice.balance);
      const balanceWidth = doc.getTextWidth(balanceText);
      doc.text(balanceText, valueX - balanceWidth, y);
    }

    // --- Footer ---
    const footerY = pageHeight - 30;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);

    // Elaborado por
    doc.line(15, footerY, 80, footerY);
    doc.setFontSize(8);
    doc.text('ELABORADO POR', 35, footerY + 4);
    
    // Agregar firma digital si existe
    if (organization.digital_signature_url) {
      try {
        const signatureData = await loadImageAsBase64(organization.digital_signature_url);
        
        // Calcular dimensiones manteniendo proporción
        const maxWidth = 50;  // Ancho máximo en mm
        const maxHeight = 12; // Altura máxima en mm
        
        const originalAspectRatio = signatureData.width / signatureData.height;
        let signatureWidth = maxWidth;
        let signatureHeight = maxWidth / originalAspectRatio;
        
        // Si la altura calculada excede el máximo, ajustar por altura
        if (signatureHeight > maxHeight) {
          signatureHeight = maxHeight;
          signatureWidth = maxHeight * originalAspectRatio;
        }
        
        // Centrar la firma en el área disponible (65mm de ancho)
        const signatureX = 15 + (65 - signatureWidth) / 2;
        const signatureY = footerY - signatureHeight - 2;
        
        doc.addImage(signatureData.dataURL, 'PNG', signatureX, signatureY, signatureWidth, signatureHeight);
      } catch (error) {
        // Silently ignore signature loading errors
      }
    }

    // Aceptada
    doc.line(90, footerY, 155, footerY);
    doc.text('ACEPTADA, FIRMA Y/O SELLO Y FECHA', 95, footerY + 4);

    // Original Cliente
    doc.text('Original: Cliente', pageWidth - 40, footerY + 4);


    doc.save(`Factura-${invoice.invoice_number || 'sin-numero'}.pdf`);
  } catch (error) {
    // Error silently handled
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

  // Validate organization has required fields
  if (!organization.name) {
    throw new Error('El nombre de la organización es requerido para generar el PDF');
  }

  // Validate client has required fields
  if (!client.name) {
    throw new Error('El nombre del cliente es requerido para generar el PDF');
  }

  // Validate quote has required fields
  if (!quote.quote_number || !quote.issue_date || !quote.valid_until) {
    throw new Error('Datos de la cotización incompletos (número, fecha de emisión o validez)');
  }

  try {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let y = 15;

    // --- Header ---
    // Company Info (Left)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(organization.name, 15, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (organization.settings?.rnc) {
      doc.text(`RNC: ${organization.settings.rnc}`, 15, y);
      y += 5;
    }
    if (organization.settings?.address) {
      doc.text(organization.settings.address, 15, y);
      y += 5;
    }
    if (organization.settings?.phone) {
      doc.text(organization.settings.phone, 15, y);
      y += 5;
    }
    if (organization.settings?.email) {
      doc.text(organization.settings.email, 15, y);
      y += 5;
    }
    doc.text('Sucursal: Principal', 15, y);


    // Logo and NCF Info (Right)
    let rightColX = pageWidth - 15;
    if (organization.logo_url) {
      try {
        const response = await fetch(organization.logo_url);
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onload = () => {
            const logoSize = 30;
            const logoX = rightColX - logoSize;
            const logoY = 15;
            doc.addImage(reader.result as string, 'JPEG', logoX, logoY, logoSize, logoSize);
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        // Silently ignore logo loading errors
      }
    }

    y = 50; // Reset Y for NCF info below logo
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const ncfText = 'COTIZACIÓN';
    const ncfTextWidth = doc.getTextWidth(ncfText);
    doc.text(ncfText, rightColX - ncfTextWidth, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    const quoteNumberText = `No. ${quote.quote_number}`;
    const quoteNumberTextWidth = doc.getTextWidth(quoteNumberText);
    doc.text(quoteNumberText, rightColX - quoteNumberTextWidth, y);


    // --- Dates ---
    y = 70;
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA DE EXPEDICIÓN', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(quote.issue_date), 65, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('VÁLIDA HASTA', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(quote.valid_until), 65, y);

    // --- Client Info Box ---
    y += 10;
    doc.setDrawColor(128, 128, 128); // Gray border
    doc.setLineWidth(0.5);
    doc.rect(14, y, pageWidth - 28, 25); // Box

    const clientY = y;
    // Row 1
    doc.setFillColor(220, 220, 220); // Light gray background
    doc.rect(14, clientY, 25, 8, 'F'); // Box for SEÑOR(ES)
    doc.setFont('helvetica', 'bold');
    doc.text('SEÑOR(ES)', 16, clientY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(client.name, 42, clientY + 6);

    // Row 2
    doc.setFillColor(220, 220, 220);
    doc.rect(14, clientY + 8, 25, 8, 'F'); // Box for DIRECCIÓN
    doc.setFont('helvetica', 'bold');
    doc.text('DIRECCIÓN', 16, clientY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(client.address || '', 42, clientY + 14);

    // Row 3
    doc.setFillColor(220, 220, 220);
    doc.rect(14, clientY + 16, 25, 9, 'F'); // Box for RNC
    doc.setFont('helvetica', 'bold');
    doc.text('RNC', 16, clientY + 22);
    doc.setFont('helvetica', 'normal');
    doc.text(client.rnc || '', 42, clientY + 22);

    doc.setFillColor(220, 220, 220);
    doc.rect(100, clientY + 16, 20, 9, 'F'); // Box for CIUDAD
    doc.setFont('helvetica', 'bold');
    doc.text('CIUDAD', 102, clientY + 22);
    doc.setFont('helvetica', 'normal');
    // Extract city from client address only
    const clientCity = client.address?.split(',').pop()?.trim() || 'N/A';
    doc.text(clientCity, 122, clientY + 22);

    doc.setFillColor(220, 220, 220);
    doc.rect(pageWidth - 68, clientY, 25, 8, 'F'); // Box for TELEFONO
    doc.setFont('helvetica', 'bold');
    doc.text('TELEFONO', pageWidth - 66, clientY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(client.phone || '', pageWidth - 40, clientY + 6);


    y += 35; // Space after client box

    // --- Items Table ---
    const tableColumn = ["Producto/servicio", "Precio", "Cantidad", "Descuento"];
    const tableRows: any[] = [];

    items.forEach(item => {
      const itemData = [
        item.product_name || 'Producto sin nombre',
        formatCurrency(item.unit_price || 0),
        (item.quantity || 0).toString(),
        '0.00%' // Placeholder for discount
      ];
      tableRows.push(itemData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: y,
      theme: 'grid',
      headStyles: {
        fillColor: [60, 60, 60],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineWidth: 0.1,
        lineColor: [128, 128, 128],
        valign: 'top',
        minCellHeight: 12,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 'auto' }, // Producto - auto para ajustarse
        1: { halign: 'center', cellWidth: 40 }, // Precio - centralizado
        2: { halign: 'center', cellWidth: 30 }, // Cantidad - centralizado
        3: { halign: 'center', cellWidth: 35 } // Descuento - centralizado
      },
      margin: { left: 14, right: 14 },
    });

    if (doc.lastAutoTable) {
      y = doc.lastAutoTable.finalY;
    } else {
      y += 50; // Fallback
    }

    // --- Totals Section ---
    const totalsX = pageWidth - 84;
    const valueX = pageWidth - 14;
    y += 15; // Increased space

    // Subtotal
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal', totalsX, y);
    const subtotalText = formatCurrency(quote.subtotal);
    const subtotalWidth = doc.getTextWidth(subtotalText);
    doc.text(subtotalText, valueX - subtotalWidth, y);
    y += 7;

    // ITBIS
    doc.setFillColor(220, 220, 220);
    doc.rect(totalsX - 2, y - 5, 72, 7, 'F');
    doc.setFont('helvetica', 'bold');
    const taxPercentage = ((quote.tax_amount / quote.subtotal) * 100 || 0).toFixed(2);
    doc.text(`ITBIS (${taxPercentage}%)`, totalsX, y);
    const taxText = formatCurrency(quote.tax_amount);
    const taxWidth = doc.getTextWidth(taxText);
    doc.text(taxText, valueX - taxWidth, y);
    y += 7;

    // Total
    doc.setFillColor(220, 220, 220);
    doc.rect(totalsX - 2, y - 5, 72, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Total', totalsX, y);
    const totalText = formatCurrency(quote.total);
    const totalWidth = doc.getTextWidth(totalText);
    doc.text(totalText, valueX - totalWidth, y);

    // --- Footer ---
    const footerY = pageHeight - 30;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);

    // Elaborado por
    doc.line(15, footerY, 80, footerY);
    doc.setFontSize(8);
    doc.text('ELABORADO POR', 35, footerY + 4);
    
    // Agregar firma digital si existe
    if (organization.digital_signature_url) {
      try {
        const signatureData = await loadImageAsBase64(organization.digital_signature_url);
        
        // Calcular dimensiones manteniendo proporción
        const maxWidth = 50;  // Ancho máximo en mm
        const maxHeight = 12; // Altura máxima en mm
        
        const originalAspectRatio = signatureData.width / signatureData.height;
        let signatureWidth = maxWidth;
        let signatureHeight = maxWidth / originalAspectRatio;
        
        // Si la altura calculada excede el máximo, ajustar por altura
        if (signatureHeight > maxHeight) {
          signatureHeight = maxHeight;
          signatureWidth = maxHeight * originalAspectRatio;
        }
        
        // Centrar la firma en el área disponible (65mm de ancho)
        const signatureX = 15 + (65 - signatureWidth) / 2;
        const signatureY = footerY - signatureHeight - 2;
        
        doc.addImage(signatureData.dataURL, 'PNG', signatureX, signatureY, signatureWidth, signatureHeight);
      } catch (error) {
        // Silently ignore signature loading errors
      }
    }

    // Aceptada
    doc.line(90, footerY, 155, footerY);
    doc.text('ACEPTADA, FIRMA Y/O SELLO Y FECHA', 95, footerY + 4);

    // Original Cliente
    doc.text('Original: Cliente', pageWidth - 40, footerY + 4);


    doc.save(`Cotizacion-${quote.quote_number || 'sin-numero'}.pdf`);
  } catch (error) {
    // Error silently handled
    throw new Error(`Error al generar PDF de cotización: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}