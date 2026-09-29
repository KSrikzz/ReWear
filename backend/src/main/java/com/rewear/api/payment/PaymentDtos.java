package com.rewear.api.payment;

import jakarta.validation.constraints.NotBlank;

public final class PaymentDtos {
    private PaymentDtos() {}
    public record SimulationRequest(@NotBlank String paymentMethod, Boolean succeed) {}
    public record MembershipPaymentRequest(@NotBlank String planId, @NotBlank String paymentMethod, Boolean succeed) {}
}
