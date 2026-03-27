package com.forestock.forestock_backend.dto.request;

import lombok.Data;

@Data
public class SalesImportRequest {
    // Optional parameters that can accompany the CSV upload
    private boolean overwriteExisting = false;
}
