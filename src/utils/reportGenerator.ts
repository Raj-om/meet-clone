import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

export function exportToPDF(title: string, columns: string[], rows: (string | number)[][], filename: string) {
    const doc = new jsPDF()

    // Title
    doc.setFontSize(18)
    doc.text(title, 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30)

    // Table
    autoTable(doc, {
        startY: 36,
        head: [columns],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [124, 58, 237] }, // Purple accent
        alternateRowStyles: { fillColor: [249, 250, 251] },
        styles: { fontSize: 10, cellPadding: 4 },
    })

    doc.save(`${filename}.pdf`)
}

export function exportToExcel(title: string, data: Record<string, any>[], filename: string) {
    // Create a new workbook
    const wb = XLSX.utils.book_new()
    
    // Convert JSON data to worksheet
    const ws = XLSX.utils.json_to_sheet(data)
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Report Data")
    
    // Save the file
    XLSX.writeFile(wb, `${filename}.xlsx`)
}
