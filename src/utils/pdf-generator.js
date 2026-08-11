// ============================================
// SKYLAND ENERGY — PDF Generator
// ============================================

export async function generateQuotationPDF(element, filename = 'quotation') {
  try {
    const html2pdf = (await import('html2pdf.js')).default;

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    await html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.error('PDF generation failed:', err);
    // Fallback: print
    window.print();
  }
}
