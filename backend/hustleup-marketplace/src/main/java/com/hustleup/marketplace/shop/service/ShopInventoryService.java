package com.hustleup.marketplace.shop.service;

import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.model.ShopProduct;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import com.hustleup.marketplace.shop.repository.ShopProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShopInventoryService {
    private final ShopProductRepository productRepository;
    private final ShopOrderRepository orderRepository;

    /** The checkout transaction holds the product lock until its orders are saved. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean reserve(ShopProduct lockedProduct, int quantity) {
        if (quantity < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be at least one");
        Integer stock = lockedProduct.getStockQuantity();
        if (stock == null) return false;
        if (stock < quantity) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    lockedProduct.getName() + " has only " + stock + " units available");
        }
        lockedProduct.setStockQuantity(stock - quantity);
        productRepository.save(lockedProduct);
        return true;
    }

    /**
     * Call for a verified expired/failed checkout. Locks the order first, so duplicate
     * webhook deliveries restore inventory once. Paid or fulfilled orders are never restored.
     */
    @Transactional
    public void releaseUnpaid(UUID orderId) {
        ShopOrder order = orderRepository.findLockedById(orderId).orElse(null);
        if (order == null || !order.isStockReserved()) return;
        if (order.getStatus() != ShopOrder.ShopOrderStatus.AWAITING_PAYMENT
                && order.getStatus() != ShopOrder.ShopOrderStatus.CANCELLED) return;
        productRepository.findLockedById(order.getProductId()).ifPresent(product -> {
            if (product.getStockQuantity() != null) {
                product.setStockQuantity(Math.addExact(product.getStockQuantity(), order.getQuantity()));
                productRepository.save(product);
            }
        });
        order.setStockReserved(false);
        order.setStatus(ShopOrder.ShopOrderStatus.CANCELLED);
        orderRepository.save(order);
    }
}
