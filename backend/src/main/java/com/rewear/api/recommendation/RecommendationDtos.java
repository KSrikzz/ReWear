package com.rewear.api.recommendation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public final class RecommendationDtos {
    private RecommendationDtos() {}

    public record Measurements(
        @DecimalMin("0.01") BigDecimal heightCm,
        @DecimalMin("0.01") BigDecimal chestCm,
        @DecimalMin("0.01") BigDecimal waistCm,
        @DecimalMin("0.01") BigDecimal hipCm,
        @DecimalMin("0.01") BigDecimal shoulderCm,
        @DecimalMin("0.01") BigDecimal inseamCm
    ) {}

    public record DiscoveryRequest(
        @Size(max = 1000) String query,
        @Size(max = 40) String occasion,
        LocalDate eventDate,
        LocalDate rentalStartDate,
        LocalDate rentalEndDate,
        @Size(max = 48) String category,
        @Size(max = 64) String size,
        @Valid Measurements measurements,
        @Size(max = 32) String style,
        @Size(max = 32) String colour,
        @DecimalMin("0.00") BigDecimal budgetMin,
        @DecimalMin("0.00") BigDecimal budgetMax,
        @Size(max = 100) String area,
        @Size(max = 12) String postcode,
        BigDecimal latitude,
        BigDecimal longitude,
        @Min(1) @Max(100) Integer distanceKm,
        @Size(max = 16) String fulfilment,
        @Size(max = 24) String condition,
        @DecimalMin("0.00") @jakarta.validation.constraints.DecimalMax("5.00") BigDecimal minimumRating,
        Boolean premiumOnly,
        @Size(max = 24) String transactionType,
        @Size(max = 24) String sort,
        @Min(1) @Max(48) Integer limit,
        @Min(0) Integer offset,
        @Size(max = 3000000) String inspirationImageData,
        Boolean imageAnalysisConsent
    ) {}

    public record PreferenceRequest(
        @Size(max = 12) List<@Size(max = 48) String> preferredCategories,
        @Size(max = 12) List<@Size(max = 32) String> preferredStyles,
        @Size(max = 12) List<@Size(max = 32) String> preferredColours,
        @Size(max = 64) String preferredSize,
        @DecimalMin("0.00") BigDecimal budgetMin,
        @DecimalMin("0.01") BigDecimal budgetMax,
        @Size(max = 80) String preferredArea,
        @Size(max = 12) String preferredPostcode,
        @Size(max = 16) String fulfilment
    ) {}
}
