package com.hustleup.common.email;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.http.HttpMethod.POST;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;

class EmailServiceTest {
    @Test
    void resendApiKeyEnablesDeliveryAndSendsWrappedHtmlThroughResend() {
        RestClient.Builder clientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(clientBuilder).build();
        server.expect(requestTo("https://api.resend.com/emails"))
                .andExpect(method(POST))
                .andExpect(header("Authorization", "Bearer re_test_key"))
                .andExpect(jsonPath("$.from").value("HustleSpace <mail@example.test>"))
                .andExpect(jsonPath("$.to[0]").value("person@example.test"))
                .andExpect(jsonPath("$.subject").value("Welcome"))
                .andExpect(jsonPath("$.html", containsString("<p>Hello</p>")))
                .andRespond(withSuccess("{\"id\":\"email_test\"}", MediaType.APPLICATION_JSON));

        EmailService service = new EmailService(
                null, "", "HustleSpace <mail@example.test>", false, "us-east-1", "re_test_key", clientBuilder);
        assertTrue(service.isDeliverable());
        service.send("person@example.test", "Welcome", "<p>Hello</p>");

        server.verify();
    }

    @Test
    void missingProvidersRemainNonDeliverableAndDoNotRequireNetwork() {
        EmailService service = new EmailService(
                null, "", "HustleSpace <mail@example.test>", false, "us-east-1", "", RestClient.builder());

        assertFalse(service.isDeliverable());
        service.send("person@example.test", "Welcome", "<p>Hello</p>");
    }
}
