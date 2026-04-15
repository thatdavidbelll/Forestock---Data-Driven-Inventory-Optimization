package com.forestock.forestock_backend.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class ShopifyPurchaseOrderRequest {
    private String shopDomain;
    private List<String> suggestionIds;
}
