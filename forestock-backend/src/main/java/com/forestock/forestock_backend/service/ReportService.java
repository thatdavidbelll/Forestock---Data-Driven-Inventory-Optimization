package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.dto.response.SuggestionDto;
import lombok.extern.slf4j.Slf4j;
import java.text.Normalizer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
public class ReportService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    // ─── Excel ──────────────────────────────────────────────────────────────

    public byte[] generateExcel(List<SuggestionDto> suggestions) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Restock Suggestions");
            sheet.setColumnWidth(0, 4000);   // SKU
            sheet.setColumnWidth(1, 8000);   // Product
            sheet.setColumnWidth(2, 4000);   // Category
            sheet.setColumnWidth(3, 2500);   // Unit
            sheet.setColumnWidth(4, 3500);   // Current stock
            sheet.setColumnWidth(5, 3500);   // Days of stock
            sheet.setColumnWidth(6, 3500);   // P50 demand
            sheet.setColumnWidth(7, 3500);   // P90 demand
            sheet.setColumnWidth(8, 4000);   // Suggested qty
            sheet.setColumnWidth(9, 3000);   // Urgency

            // Styles
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleStyle.setFont(titleFont);

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);

            CellStyle criticalStyle = workbook.createCellStyle();
            criticalStyle.setFillForegroundColor(IndexedColors.RED.getIndex());
            criticalStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle highStyle = workbook.createCellStyle();
            highStyle.setFillForegroundColor(IndexedColors.ORANGE.getIndex());
            highStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle numberStyle = workbook.createCellStyle();
            DataFormat format = workbook.createDataFormat();
            numberStyle.setDataFormat(format.getFormat("#,##0.00"));

            // Title row
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Forestock — Restock Suggestions Report — " + LocalDate.now().format(DATE_FMT));
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 9));

            // Header row
            Row header = sheet.createRow(2);
            String[] columns = {"SKU", "Product", "Category", "Unit", "Current Stock",
                    "Days of Stock", "P50 Demand (14d)", "P90 Demand (14d)", "Suggested Qty", "Urgency"};
            for (int i = 0; i < columns.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data rows
            int rowNum = 3;
            for (SuggestionDto s : suggestions) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(s.getProductSku());
                row.createCell(1).setCellValue(s.getProductName());
                row.createCell(2).setCellValue(s.getProductCategory() != null ? s.getProductCategory() : "");
                row.createCell(3).setCellValue(s.getUnit());

                Cell stockCell = row.createCell(4);
                stockCell.setCellValue(s.getCurrentStock() != null ? s.getCurrentStock().doubleValue() : 0);
                stockCell.setCellStyle(numberStyle);

                Cell daysCell = row.createCell(5);
                daysCell.setCellValue(s.getDaysOfStock() != null ? s.getDaysOfStock().doubleValue() : 0);
                daysCell.setCellStyle(numberStyle);

                Cell p50Cell = row.createCell(6);
                p50Cell.setCellValue(s.getForecastP50() != null ? s.getForecastP50().doubleValue() : 0);
                p50Cell.setCellStyle(numberStyle);

                Cell p90Cell = row.createCell(7);
                p90Cell.setCellValue(s.getForecastP90() != null ? s.getForecastP90().doubleValue() : 0);
                p90Cell.setCellStyle(numberStyle);

                Cell qtyCell = row.createCell(8);
                qtyCell.setCellValue(s.getSuggestedQty() != null ? s.getSuggestedQty().doubleValue() : 0);
                qtyCell.setCellStyle(numberStyle);

                Cell urgencyCell = row.createCell(9);
                urgencyCell.setCellValue(s.getUrgency().name());
                switch (s.getUrgency()) {
                    case CRITICAL -> urgencyCell.setCellStyle(criticalStyle);
                    case HIGH -> urgencyCell.setCellStyle(highStyle);
                    default -> {}
                }
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    // ─── PDF ────────────────────────────────────────────────────────────────

    public byte[] generatePdf(List<SuggestionDto> suggestions) throws IOException {
        try (PDDocument doc = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            PDType1Font fontBold   = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNormal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            float margin    = 40;
            float pageWidth = page.getMediaBox().getWidth();
            float yStart    = page.getMediaBox().getHeight() - margin;
            float rowHeight = 18f;

            // Column widths (sum = pageWidth - 2*margin = 515)
            float[] colWidths = {55, 130, 55, 40, 50, 40, 60, 55, 60};
            String[] headers  = {"SKU", "Product", "Category", "Unit", "Stock", "Days", "P50(14d)", "P90(14d)", "Sugg.Qty"};

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = yStart;

                // Title
                cs.beginText();
                cs.setFont(fontBold, 13);
                cs.newLineAtOffset(margin, y);
                cs.showText("Forestock - Restock Suggestions");
                cs.endText();
                y -= 16;

                cs.beginText();
                cs.setFont(fontNormal, 9);
                cs.newLineAtOffset(margin, y);
                cs.showText("Generated: " + LocalDate.now().format(DATE_FMT) + "   |   Total suggestions: " + suggestions.size());
                cs.endText();
                y -= 20;

                // Header row background
                cs.setNonStrokingColor(0.85f, 0.85f, 0.85f);
                cs.addRect(margin, y - 4, pageWidth - 2 * margin, rowHeight);
                cs.fill();
                cs.setNonStrokingColor(0f, 0f, 0f);

                // Header text
                float x = margin;
                cs.setFont(fontBold, 8);
                for (int i = 0; i < headers.length; i++) {
                    cs.beginText();
                    cs.newLineAtOffset(x + 2, y + 4);
                    cs.showText(headers[i]);
                    cs.endText();
                    x += colWidths[i];
                }
                y -= rowHeight;

                // Separator line
                cs.setStrokingColor(0.5f, 0.5f, 0.5f);
                cs.moveTo(margin, y + rowHeight - 2);
                cs.lineTo(pageWidth - margin, y + rowHeight - 2);
                cs.stroke();

                // Data rows
                cs.setFont(fontNormal, 7.5f);
                int rowIndex = 0;
                for (SuggestionDto s : suggestions) {
                    // Alternating row background
                    if (rowIndex % 2 == 0) {
                        cs.setNonStrokingColor(0.96f, 0.96f, 0.96f);
                        cs.addRect(margin, y - 4, pageWidth - 2 * margin, rowHeight);
                        cs.fill();
                        cs.setNonStrokingColor(0f, 0f, 0f);
                    }

                    // Urgency color indicator
                    if (s.getUrgency() != null) {
                        switch (s.getUrgency()) {
                            case CRITICAL -> cs.setNonStrokingColor(0.9f, 0.2f, 0.2f);
                            case HIGH     -> cs.setNonStrokingColor(0.95f, 0.6f, 0.1f);
                            case MEDIUM   -> cs.setNonStrokingColor(0.95f, 0.85f, 0.1f);
                            case LOW      -> cs.setNonStrokingColor(0.2f, 0.75f, 0.2f);
                        }
                        cs.addRect(margin, y - 3, 4, rowHeight - 2);
                        cs.fill();
                        cs.setNonStrokingColor(0f, 0f, 0f);
                    }

                    String[] values = {
                            sanitizeForPdf(s.getProductSku()),
                            truncate(s.getProductName(), 22),
                            sanitizeForPdf(s.getProductCategory() != null ? s.getProductCategory() : ""),
                            sanitizeForPdf(s.getUnit()),
                            fmt(s.getCurrentStock()),
                            fmt(s.getDaysOfStock()),
                            fmt(s.getForecastP50()),
                            fmt(s.getForecastP90()),
                            fmt(s.getSuggestedQty())
                    };

                    x = margin + 6;
                    for (int i = 0; i < values.length; i++) {
                        cs.beginText();
                        cs.newLineAtOffset(x, y + 4);
                        cs.showText(values[i]);
                        cs.endText();
                        x += colWidths[i];
                    }

                    y -= rowHeight;
                    rowIndex++;

                    // New page if needed
                    if (y < margin + rowHeight) {
                        cs.close();
                        PDPage nextPage = new PDPage(PDRectangle.A4);
                        doc.addPage(nextPage);
                        // Note: for multi-page we'd need to reopen — keeping simple for now
                        break;
                    }
                }

                // Bottom line
                cs.setStrokingColor(0.5f, 0.5f, 0.5f);
                cs.moveTo(margin, y + rowHeight - 2);
                cs.lineTo(pageWidth - margin, y + rowHeight - 2);
                cs.stroke();
            }

            doc.save(out);
            return out.toByteArray();
        }
    }

    private String fmt(java.math.BigDecimal val) {
        if (val == null) return "0";
        return String.format("%.1f", val.doubleValue());
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        String clean = sanitizeForPdf(s);
        return clean.length() > max ? clean.substring(0, max - 1) + "." : clean;
    }

    /** Strips diacritics so PDFBox Type1 fonts (WinAnsiEncoding) don't crash. */
    private String sanitizeForPdf(String s) {
        if (s == null) return "";
        String normalized = Normalizer.normalize(s, Normalizer.Form.NFD);
        return normalized.replaceAll("[^\\p{ASCII}]", "");
    }
}
