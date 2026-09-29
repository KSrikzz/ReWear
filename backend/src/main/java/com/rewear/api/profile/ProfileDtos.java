package com.rewear.api.profile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class ProfileDtos {
    private ProfileDtos() {}

    public record CreateRequest(
        @NotBlank String role,
        @NotBlank @Size(max = 80) String name,
        @Size(max = 24) String phone,
        @NotBlank @Size(max = 80) String location,
        @Size(max = 80) String businessName
    ) {}

    public record UpdateRequest(
        @Size(max = 80) String name,
        @Size(max = 24) String phone,
        @Size(max = 80) String location,
        @Size(max = 80) String businessName,
        @Size(max = 500) String about
    ) {}

    public record ProfileResponse(
        String id,
        String role,
        String name,
        String email,
        String phone,
        String location,
        String businessName,
        String about,
        String businessPlan,
        String membershipStatus,
        String accountStatus
    ) {}
}
