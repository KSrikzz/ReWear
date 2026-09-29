package com.rewear.api.payment;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import com.rewear.api.payment.PaymentDtos.MembershipPaymentRequest;
import com.rewear.api.payment.PaymentDtos.SimulationRequest;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    private final PaymentService payments;
    public PaymentController(PaymentService payments) { this.payments = payments; }

    @PostMapping("/bookings/{bookingId}/simulate")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> rental(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bookingId,
                                      @Valid @RequestBody SimulationRequest request) {
        return payments.rental(jwt, bookingId, request);
    }

    @PostMapping("/bookings/{bookingId}/cancel")
    public Map<String, Object> cancelRental(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bookingId) {
        return payments.cancelRental(jwt, bookingId);
    }

    @PostMapping("/memberships/simulate")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> membership(@AuthenticationPrincipal Jwt jwt,
                                         @Valid @RequestBody MembershipPaymentRequest request) {
        return payments.membership(jwt, request);
    }

    @GetMapping("/mine")
    public List<Map<String, Object>> mine(@AuthenticationPrincipal Jwt jwt) { return payments.mine(jwt); }
}
