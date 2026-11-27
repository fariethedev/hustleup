package com.hustleup.marketplace.safety;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.listing.model.*;
import com.hustleup.marketplace.listing.service.AlgoliaIndexService;
import com.hustleup.marketplace.shop.repository.ShopRepository;
import com.hustleup.marketplace.shop.model.Shop;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class SellerSafetyServiceTest {
    final SellerSafetyRepository states=mock(SellerSafetyRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final ListingRepository listings=mock(ListingRepository.class);
    final ShopRepository shops=mock(ShopRepository.class);
    final AlgoliaIndexService search=mock(AlgoliaIndexService.class);
    final SellerSafetyService service=new SellerSafetyService(states,users,listings,shops,search);
    final UUID seller=UUID.randomUUID();
    @Test void suspensionHidesListingsAndShopAndPersistsReason() {
        var listing=Listing.builder().id(UUID.randomUUID()).status(ListingStatus.ACTIVE).build();
        var shop=Shop.builder().published(true).build();
        when(users.findLockedById(seller)).thenReturn(Optional.of(User.builder().id(seller).build()));
        when(listings.findBySellerId(seller)).thenReturn(List.of(listing));
        when(shops.findByOwnerId(seller)).thenReturn(Optional.of(shop));
        when(states.save(any())).thenAnswer(i->i.getArgument(0));
        var state=service.suspend(seller,"Repeated non-delivery",true);
        assertTrue(state.isSuspended()); assertTrue(state.isRefundOpenOrders());
        assertEquals("Repeated non-delivery",state.getReason());
        assertEquals(ListingStatus.PAUSED,listing.getStatus()); assertFalse(shop.isPublished());
        verify(search).deleteListing(listing.getId().toString());
    }
    @Test void suspendedSellerCannotPassLockedAdmissionOrPayoutGuard() {
        var state=new SellerSafety(); state.setSuspended(true);
        when(users.findLockedById(seller)).thenReturn(Optional.of(new User()));
        when(states.findLocked(seller)).thenReturn(Optional.of(state));
        assertThrows(ResponseStatusException.class,()->service.lockAndRequireActive(seller));
    }
    @Test void suspensionRequiresWrittenReason() {
        assertThrows(ResponseStatusException.class,()->service.suspend(seller,"",true));
        verifyNoInteractions(users,listings,shops,search);
    }
}
