package com.rewear.api.booking;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class BookingDtos {
    private BookingDtos() {}

    public record CreateRequest(
        @NotNull LocalDate pickupDate,
        @NotNull LocalDate returnDate,
        @NotNull @Min(1) @Max(30) Integer duration,
        @NotBlank @Size(max = 32) String selectedSize,
        @NotBlank String fulfilment,
        boolean rentalCare,
        boolean rentalProtection,
        @Size(max = 12) String deliveryPostcode
    ) {}

    public record TransitionRequest(@NotBlank String status, @Size(max = 5) List<@Size(max = 180) String> photoPaths) {}

    public record ReviewRequest(
        @NotNull @Min(1) @Max(5) Integer rating,
        String fit,
        String condition,
        String comment,
        @Size(max = 3) List<@Size(max = 180) String> imagePaths
    ) {}
}
