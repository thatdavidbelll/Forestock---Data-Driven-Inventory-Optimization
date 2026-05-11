package com.forestock.forestock_backend.domain.enums;

public enum StorePlanTier {
    FREE(15),
    PAID(null);

    private final Integer productLimit;

    StorePlanTier(Integer productLimit) {
        this.productLimit = productLimit;
    }

    public Integer getProductLimit() {
        return productLimit;
    }
}
