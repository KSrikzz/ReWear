package com.rewear.api.profile;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.rewear.api.profile.ProfileDtos.CreateRequest;
import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileDtos.UpdateRequest;

@RestController
@RequestMapping("/api")
public class ProfileController {
    private final ProfileService profiles;

    public ProfileController(ProfileService profiles) {
        this.profiles = profiles;
    }

    @PostMapping("/profiles")
    @ResponseStatus(HttpStatus.CREATED)
    public ProfileResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateRequest request) {
        return profiles.create(jwt, request);
    }

    @GetMapping("/me")
    public ProfileResponse me(@AuthenticationPrincipal Jwt jwt) {
        return profiles.get(jwt);
    }

    @PatchMapping("/me")
    public ProfileResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateRequest request) {
        return profiles.update(jwt, request);
    }
}
