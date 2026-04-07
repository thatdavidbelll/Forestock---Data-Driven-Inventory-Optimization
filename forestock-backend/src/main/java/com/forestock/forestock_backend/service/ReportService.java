package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Inventory;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.dto.response.SuggestionDto;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import lombok.RequiredArgsConstructor;
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
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final SalesTransactionRepository salesTransactionRepository;
    private final InventoryService inventoryService;
    private final StoreConfigurationService storeConfigurationService;

    // ─── Excel ──────────────────────────────────────────────────────────────

    public byte[] generateExcel(List<SuggestionDto> suggestions) throws IOException {
        return generateExcel(suggestions, null);
    }

    public byte[] generateExcel(List<SuggestionDto> suggestions, java.util.UUID storeId) throws IOException {
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
            titleCell.setCellValue("Forestock — Restock Suggestions Report — " + LocalDate.now().format(dateFormatterForStore(storeId)));
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
        return generatePdf(suggestions, null);
    }

    public byte[] generatePdf(List<SuggestionDto> suggestions, java.util.UUID storeId) throws IOException {
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
                cs.showText("Generated: " + LocalDate.now().format(dateFormatterForStore(storeId)) + "   |   Total suggestions: " + suggestions.size());
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

    public byte[] generateInventoryValuationReport(java.util.UUID storeId, String format) throws IOException {
        List<Inventory> inventory = inventoryRepository.findLatestForAllProductsByStore(storeId);
        List<Map<String, Object>> rows = inventory.stream()
                .sorted(Comparator.comparing((Inventory item) -> item.getProduct().getCategory() != null ? item.getProduct().getCategory() : "")
                        .thenComparing(item -> item.getProduct().getName()))
                .map(item -> {
                    Product product = item.getProduct();
                    BigDecimal totalValue = product.getUnitCost() != null
                            ? item.getQuantity().multiply(product.getUnitCost()).setScale(2, RoundingMode.HALF_UP)
                            : null;
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("SKU", product.getSku());
                    row.put("Product", product.getName());
                    row.put("Category", product.getCategory());
                    row.put("Quantity", item.getQuantity());
                    row.put("Unit Cost", product.getUnitCost());
                    row.put("Total Value", totalValue);
                    return row;
                })
                .toList();
        return renderTabularReport(storeId, "Inventory Valuation", List.of("SKU", "Product", "Category", "Quantity", "Unit Cost", "Total Value"), rows, format);
    }

    public byte[] generateSalesReport(java.util.UUID storeId, LocalDate from, LocalDate to, String format) throws IOException {
        Map<java.util.UUID, BigDecimal> totalsByProduct = new LinkedHashMap<>();
        for (SalesTransaction transaction : salesTransactionRepository.findBySaleDateBetweenAndStoreId(from, to, storeId)) {
            totalsByProduct.merge(transaction.getProduct().getId(), transaction.getQuantitySold(), BigDecimal::add);
        }

        List<Map<String, Object>> rows = productRepository.findByStoreIdAndActiveTrue(storeId).stream()
                .filter(product -> totalsByProduct.containsKey(product.getId()))
                .sorted((left, right) -> totalsByProduct.get(right.getId()).compareTo(totalsByProduct.get(left.getId())))
                .map(product -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("SKU", product.getSku());
                    row.put("Product", product.getName());
                    row.put("Category", product.getCategory());
                    row.put("Units Sold", totalsByProduct.get(product.getId()));
                    return row;
                })
                .toList();
        return renderTabularReport(storeId, "Sales Performance (" + from + " to " + to + ")", List.of("SKU", "Product", "Category", "Units Sold"), rows, format);
    }

    public byte[] generateSlowMoversReport(java.util.UUID storeId, int inactiveDays, String format) throws IOException {
        List<Map<String, Object>> rows = inventoryService.getSlowMovers(inactiveDays).stream()
                .sorted((left, right) -> Long.compare(
                        right.getDaysSinceLastSale() != null ? right.getDaysSinceLastSale() : Long.MAX_VALUE,
                        left.getDaysSinceLastSale() != null ? left.getDaysSinceLastSale() : Long.MAX_VALUE
                ))
                .map(item -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("SKU", item.getSku());
                    row.put("Product", item.getName());
                    row.put("Category", item.getCategory());
                    row.put("Current Stock", item.getCurrentStock());
                    row.put("Last Sale Date", item.getLastSaleDate());
                    row.put("Days Inactive", item.getDaysSinceLastSale());
                    row.put("Est. Value", item.getEstimatedStockValue());
                    return row;
                })
                .toList();
        return renderTabularReport(storeId, "Slow Movers (" + inactiveDays + " days)", List.of("SKU", "Product", "Category", "Current Stock", "Last Sale Date", "Days Inactive", "Est. Value"), rows, format);
    }

    private byte[] renderTabularReport(java.util.UUID storeId, String title, List<String> headers, List<Map<String, Object>> rows, String format) throws IOException {
        if ("pdf".equalsIgnoreCase(format)) {
            return renderTablePdf(storeId, title, headers, rows);
        }
        return renderTableExcel(storeId, title, headers, rows);
    }

    private byte[] renderTableExcel(java.util.UUID storeId, String title, List<String> headers, List<Map<String, Object>> rows) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Report");
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleStyle.setFont(titleFont);

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue(title + " — " + LocalDate.now().format(dateFormatterForStore(storeId)));
            titleCell.setCellStyle(titleStyle);

            Row headerRow = sheet.createRow(2);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(headerStyle);
            }

            int rowIndex = 3;
            for (Map<String, Object> row : rows) {
                Row excelRow = sheet.createRow(rowIndex++);
                for (int i = 0; i < headers.size(); i++) {
                    Object value = row.get(headers.get(i));
                    excelRow.createCell(i).setCellValue(value == null ? "—" : value.toString());
                }
            }

            for (int i = 0; i < headers.size(); i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    private byte[] renderTablePdf(java.util.UUID storeId, String title, List<String> headers, List<Map<String, Object>> rows) throws IOException {
        try (PDDocument doc = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth()));
            doc.addPage(page);
            PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNormal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float margin = 30;
                float y = page.getMediaBox().getHeight() - margin;
                cs.beginText();
                cs.setFont(fontBold, 13);
                cs.newLineAtOffset(margin, y);
                cs.showText(sanitizeForPdf(title));
                cs.endText();
                y -= 16;
                cs.beginText();
                cs.setFont(fontNormal, 9);
                cs.newLineAtOffset(margin, y);
                cs.showText("Generated: " + LocalDate.now().format(dateFormatterForStore(storeId)));
                cs.endText();
                y -= 22;

                float colWidth = (page.getMediaBox().getWidth() - (2 * margin)) / headers.size();
                float x = margin;
                cs.setFont(fontBold, 8);
                for (String header : headers) {
                    cs.beginText();
                    cs.newLineAtOffset(x, y);
                    cs.showText(truncate(header, 16));
                    cs.endText();
                    x += colWidth;
                }
                y -= 16;

                cs.setFont(fontNormal, 7);
                for (Map<String, Object> row : rows) {
                    x = margin;
                    for (String header : headers) {
                        cs.beginText();
                        cs.newLineAtOffset(x, y);
                        cs.showText(truncate(row.get(header) == null ? "—" : row.get(header).toString(), 18));
                        cs.endText();
                        x += colWidth;
                    }
                    y -= 14;
                    if (y < margin) break;
                }
            }

            doc.save(out);
            return out.toByteArray();
        }
    }

    private DateTimeFormatter dateFormatterForStore(java.util.UUID storeId) {
        if (storeId == null) {
            return DateTimeFormatter.ofPattern("dd/MM/yyyy");
        }
        try {
            String timezone = storeConfigurationService.getConfigForStore(storeId).getTimezone();
            if (timezone == null || timezone.isBlank()) {
                return DateTimeFormatter.ofPattern("dd/MM/yyyy");
            }
            ZoneId.of(timezone);
        } catch (RuntimeException ex) {
            log.warn("Falling back to default report date format for store {} due to invalid/missing timezone", storeId, ex);
            return DateTimeFormatter.ofPattern("dd/MM/yyyy");
        }
        return DateTimeFormatter.ofPattern("dd/MM/yyyy");
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
