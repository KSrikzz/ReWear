package com.rewear.api.garment;

import java.math.BigDecimal;
import java.util.List;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class GarmentDtos {
    private GarmentDtos() {}

    public record SaveRequest(
        @NotBlank @Size(max = 80) String name,
        @Size(max = 60) String designer,
        @NotBlank @Size(max = 48) String category,
        @NotBlank @Size(max = 24) String condition,
        @Size(max = 500) String description,
        @NotNull @DecimalMin("0.01") BigDecimal price,
        @DecimalMin("0.00") BigDecimal mrp,
        @DecimalMin("0.00") BigDecimal depositAmount,
        @Min(1) @Max(10000) Integer quantity,
        @NotBlank @Size(max = 64) String size,
        @NotBlank @Size(max = 80) String distance,
        @Size(max = 100) String fitMatch,
        @Size(max = 500) String careInstructions,
        @NotBlank @Size(max = 2000) String image,
        @Size(max = 32) String style,
        @Size(max = 32) String colour,
        @Size(max = 12) List<@Size(max = 32) String> occasions,
        Boolean pickupAvailable,
        Boolean deliveryAvailable,
        @Size(max = 100) List<@Size(max = 12) String> deliveryPostcodes,
        BigDecimal approximateLatitude,
        BigDecimal approximateLongitude,
        @DecimalMin("0.01") BigDecimal heightCm,
        @DecimalMin("0.01") BigDecimal chestCm,
        @DecimalMin("0.01") BigDecimal waistCm,
        @DecimalMin("0.01") BigDecimal hipCm,
        @DecimalMin("0.01") BigDecimal shoulderCm,
        @DecimalMin("0.01") BigDecimal inseamCm
    ) {}

    public record AvailabilityRequest(@NotNull Boolean available) {}

    public record LifecycleRequest(
        @Size(max = 24) String condition,
        Boolean underMaintenance,
        Boolean retired,
        @Size(max = 500) String repairNote
    ) {}

    public record DiscoveryCriteria(
        String occasion, String category, String size, String style, String colour, BigDecimal budgetMin, BigDecimal budgetMax,
        Integer rentalDays, LocalDate rentalStart, LocalDate rentalEnd, String area, String postcode,
        BigDecimal latitude, BigDecimal longitude, Integer radiusKm, String fulfilment,
        String condition, BigDecimal minimumRating, Boolean premiumOnly, int limit, int offset
    ) {}
}
