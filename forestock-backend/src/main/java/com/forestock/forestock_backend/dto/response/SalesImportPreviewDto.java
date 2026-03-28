package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class SalesImportPreviewDto {
    private List<String> detectedColumns;
    private List<String> expectedColumns;
    private boolean columnMatch;
    private List<Map<String, String>> sample;
    private long totalRowsInFile;
    private int existingSkuMatches;
    private List<String> newSkus;
    private String dateFormatDetected;
    private List<String> errors;
}
