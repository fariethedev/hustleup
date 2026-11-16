package com.hustleup.subscription.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.SubscriptionRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.subscription.service.StripeService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises route mapping, controller logic, and JSON serialization through Spring MVC. */
class SubscriptionControllerWebIntegrationTest {
    private final SubscriptionRepository subscriptions = mock(SubscriptionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final StripeService stripe = mock(StripeService.class);
    private final UUID userId = UUID.randomUUID();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new SubscriptionController(subscriptions, users, stripe)).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("buyer@example.test", "", java.util.List.of()));
        when(users.findByEmail("buyer@example.test"))
                .thenReturn(Optional.of(User.builder().id(userId).email("buyer@example.test").build()));
        when(subscriptions.findBySellerId(userId)).thenReturn(Optional.empty());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void plansEndpointMapsAndSerializesAvailableTiers() throws Exception {
        mvc.perform(get("/api/v1/subscriptions/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currency").value("PLN"))
                .andExpect(jsonPath("$.plans[*].id").isArray());
    }

    @Test
    void missingSubscriptionReturnsTheFreePlanForTheAuthenticatedUser() throws Exception {
        mvc.perform(get("/api/v1/subscriptions/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("FREE"));
    }
}
