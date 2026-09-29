package com.rewear.api.protection;

import java.math.BigDecimal;
import java.util.List;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class ProtectionDtos {
    private ProtectionDtos() {}
    public record ClaimRequest(@NotBlank @Size(max = 1200) String reason,
        @DecimalMin("0.01") BigDecimal requestedAmount, @Size(max = 3) List<@Size(max = 180) String> evidencePaths) {}
    public record OwnerResponse(@NotBlank @Size(max = 1000) String response) {}
    public record DecisionRequest(@NotBlank String decision, @Size(max = 1000) String note,
        @DecimalMin("0.00") BigDecimal approvedAmount) {}
}
