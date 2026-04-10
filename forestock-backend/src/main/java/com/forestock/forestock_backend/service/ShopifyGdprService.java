package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.GdprRequest;
import com.forestock.forestock_backend.domain.ShopifyOrder;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.repository.GdprRequestRepository;
import com.forestock.forestock_backend.repository.ShopifyOrderRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShopifyGdprService {

    private final GdprRequestRepository gdprRequestRepository;
    private final ShopifyOrderRepository shopifyOrderRepository;
    private final AppUserRepository appUserRepository;
    private final StoreRepository storeRepository;

    @Transactional
    public void logDataRequest(String shopDomain, long customerId, String customerEmail) {
        GdprRequest req = GdprRequest.builder()
                .shopDomain(shopDomain)
                .webhookTopic("customers/data_request")
                .shopifyCustomerId(customerId)
                .customerEmail(customerEmail)
                .receivedAt(LocalDateTime.now())
                .build();
        gdprRequestRepository.save(req);
    }

    @Transactional
    public void redactCustomer(String shopDomain, long customerId,
                               String customerEmail, List<Long> orderIds) {
        Optional<Store> storeOpt = storeRepository.findBySlug(shopDomain);
        if (storeOpt.isPresent()) {
            Store store = storeOpt.get();
            if (!orderIds.isEmpty()) {
                List<ShopifyOrder> orders = shopifyOrderRepository
                        .findByStoreIdAndShopifyOrderIdIn(store.getId(), orderIds);
                for (ShopifyOrder order : orders) {
                    order.setCustomerEmail(null);
                    order.setCustomerFirstName(null);
                    order.setCustomerLastName(null);
                }
                shopifyOrderRepository.saveAll(orders);
                shopifyOrderRepository.redactRawPayloadForOrders(store.getId(), orderIds.stream().mapToLong(Long::longValue).toArray());
            }
        }

        GdprRequest req = GdprRequest.builder()
                .shopDomain(shopDomain)
                .webhookTopic("customers/redact")
                .shopifyCustomerId(customerId)
                .customerEmail(customerEmail)
                .receivedAt(LocalDateTime.now())
                .build();
        gdprRequestRepository.save(req);
    }

    @Transactional
    public void redactShop(String shopDomain) {
        Optional<Store> storeOpt = storeRepository.findBySlug(shopDomain);
        if (storeOpt.isPresent()) {
            Store store = storeOpt.get();

            shopifyOrderRepository.anonymiseCustomerPiiByStore(store.getId());

            shopifyOrderRepository.redactRawPayloadForStore(store.getId());

            List<AppUser> users = appUserRepository.findByStoreId(store.getId());
            for (AppUser user : users) {
                user.setEmail(null);
            }
            appUserRepository.saveAll(users);
        }

        GdprRequest req = GdprRequest.builder()
                .shopDomain(shopDomain)
                .webhookTopic("shop/redact")
                .shopifyCustomerId(null)
                .customerEmail(null)
                .receivedAt(LocalDateTime.now())
                .build();
        gdprRequestRepository.save(req);
    }
}
